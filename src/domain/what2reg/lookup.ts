import type { ReviewCache } from "./cache";
import type { ToolCallResult } from "./client";
import {
  CARD_INSTRUCTOR_CAP,
  CARD_REVIEW_INSTRUCTOR_CAP,
  REVIEW_PAGE_LIMIT,
  WHAT2REG_ATTRIBUTION,
  WHAT2REG_DISCLAIMER,
  type InstructorReviews,
  type ReviewLookup,
  type ReviewSummary,
} from "./types";

export type ToolCaller = (name: string, args: Record<string, unknown>) => Promise<ToolCallResult>;

const SUMMARY_LIMIT = 400;

export function normalizeCourseCode(code: string): string {
  return code.trim().toUpperCase();
}

export function normalizeInstructor(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

export function safeUmehUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 500) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.hostname !== "umeh.top" && url.hostname !== "www.umeh.top") return null;
  if (url.username || url.password) return null;
  return url.toString();
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clip(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > SUMMARY_LIMIT ? `${trimmed.slice(0, SUMMARY_LIMIT - 1)}…` : trimmed;
}

function courseUrl(code: string, value: unknown): string | null {
  return safeUmehUrl(value) ?? safeUmehUrl(`https://umeh.top/course/${encodeURIComponent(code)}`);
}

type CourseInstructor = {
  name: string;
  grade: number | null;
  difficulty: number | null;
  usefulness: number | null;
  url: string | null;
};

function readCourse(data: unknown, courseCode: string): { url: string | null; instructors: CourseInstructor[] } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const course = row.course && typeof row.course === "object" ? (row.course as Record<string, unknown>) : null;
  const instructors = Array.isArray(row.instructors) ? row.instructors : [];
  const parsed: CourseInstructor[] = [];
  for (const item of instructors) {
    if (!item || typeof item !== "object") continue;
    const instructor = item as Record<string, unknown>;
    const name = typeof instructor.name === "string" ? normalizeInstructor(instructor.name) : "";
    if (!name) continue;
    parsed.push({
      name,
      grade: numberOrNull(instructor.grade),
      difficulty: numberOrNull(instructor.difficulty),
      usefulness: numberOrNull(instructor.reward),
      url: safeUmehUrl(instructor.reviewUrl),
    });
    if (parsed.length >= 20) break;
  }
  return { url: courseUrl(courseCode, course?.url), instructors: parsed };
}

function readSummaries(data: unknown): { url: string | null; summaries: ReviewSummary[] } | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const reviews = Array.isArray(row.reviews) ? row.reviews : [];
  const summaries: ReviewSummary[] = [];
  for (const item of reviews) {
    if (!item || typeof item !== "object") continue;
    const review = item as Record<string, unknown>;
    const english = clip(review.contentEn);
    const original = clip(review.content);
    const text = english ?? original;
    if (!text) continue;
    summaries.push({
      text,
      url: safeUmehUrl(review.url),
      publishedAt: typeof review.publishedAt === "string" ? review.publishedAt : null,
    });
    if (summaries.length >= REVIEW_PAGE_LIMIT) break;
  }
  return { url: safeUmehUrl(row.url), summaries };
}

function base(courseCode: string, status: ReviewLookup["status"], instructors: InstructorReviews[]): ReviewLookup {
  return {
    status,
    courseCode,
    attribution: WHAT2REG_ATTRIBUTION,
    disclaimer: WHAT2REG_DISCLAIMER,
    instructors,
    understanding: null,
    mayRejectLegalCourse: false,
  };
}

function cacheKey(kind: "course" | "reviews", courseCode: string, instructor = ""): string {
  return `${kind}:${courseCode}:${instructor}`;
}

export async function lookupCourseReviews(input: {
  accessToken: string | null;
  courseCode: string;
  instructors: string[];
  cache: ReviewCache;
  callTool: ToolCaller;
  /** How many instructor review pages to read. Defaults to the card cap and never pages past the first page. */
  reviewInstructorCap?: number;
}): Promise<ReviewLookup> {
  const courseCode = normalizeCourseCode(input.courseCode);
  if (!courseCode) return base("", "unavailable", []);
  if (!input.accessToken) return base(courseCode, "unauthorized", []);

  const requested = [...new Set(input.instructors.map(normalizeInstructor).filter((name) => name.length > 0))].slice(
    0,
    CARD_INSTRUCTOR_CAP,
  );

  let course = input.cache.get<{ url: string | null; instructors: CourseInstructor[] }>(cacheKey("course", courseCode));
  if (!course) {
    let called: ToolCallResult;
    try {
      called = await input.callTool("get_course", { code: courseCode, page: 1 });
    } catch {
      return base(courseCode, "unavailable", []);
    }
    if (!called.ok) {
      if (called.code === "not_found") return base(courseCode, "empty", []);
      if (called.code === "unauthorized" || called.code === "forbidden") return base(courseCode, "unauthorized", []);
      return base(courseCode, "unavailable", []);
    }
    const parsed = readCourse(called.data, courseCode);
    if (!parsed) return base(courseCode, "unavailable", []);
    course = parsed;
    input.cache.set(cacheKey("course", courseCode), course);
  }

  const ratingByName = new Map(course.instructors.map((row) => [row.name, row]));
  const names =
    requested.length > 0
      ? requested
      : course.instructors.slice(0, CARD_INSTRUCTOR_CAP).map((row) => row.name);
  const reviewCap = Math.max(0, Math.min(input.reviewInstructorCap ?? CARD_REVIEW_INSTRUCTOR_CAP, CARD_REVIEW_INSTRUCTOR_CAP));
  const reviewNames = names.slice(0, reviewCap);
  const rows: InstructorReviews[] = [];

  for (const name of names) {
    const rating = ratingByName.get(name);
    let summaries: ReviewSummary[] = [];
    let reviewUrl = rating?.url ?? null;
    if (reviewNames.includes(name)) {
      const key = cacheKey("reviews", courseCode, name);
      const cached = input.cache.get<{ url: string | null; summaries: ReviewSummary[] }>(key);
      if (cached) {
        summaries = cached.summaries;
        reviewUrl = cached.url ?? reviewUrl;
      } else {
        let called: ToolCallResult;
        try {
          called = await input.callTool("get_course_reviews", {
            code: courseCode,
            instructor: name,
            page: 1,
            limit: REVIEW_PAGE_LIMIT,
          });
        } catch {
          called = { ok: false, code: "unavailable" };
        }
        if (called.ok) {
          const parsed = readSummaries(called.data) ?? { url: null, summaries: [] };
          input.cache.set(key, parsed);
          summaries = parsed.summaries;
          reviewUrl = parsed.url ?? reviewUrl;
        } else if (called.code === "not_found") {
          const empty = { url: reviewUrl, summaries: [] };
          input.cache.set(key, empty);
        } else if (called.code === "unauthorized" || called.code === "forbidden") {
          return base(courseCode, "unauthorized", []);
        }
        // A failed review page still leaves the course ratings visible.
      }
    }
    rows.push({
      name,
      grade: rating?.grade ?? null,
      difficulty: rating?.difficulty ?? null,
      usefulness: rating?.usefulness ?? null,
      url: reviewUrl ?? course.url,
      summaries,
    });
  }

  const hasContent = rows.some(
    (row) => row.grade !== null || row.difficulty !== null || row.usefulness !== null || row.summaries.length > 0,
  );
  return base(courseCode, hasContent ? "ok" : "empty", rows);
}
