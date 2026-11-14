import {
  ADMISSION_COHORTS,
  type AdmissionCohort,
  type CourseRecord,
  type CourseStatus,
} from "./academic";

const COURSE_CODE_PATTERN = /^[A-Z]{4}\d{4}$/;
const COURSE_STATUSES = new Set<CourseStatus>(["completed", "waived", "transfer"]);
const COURSE_CODE_ERROR = "Course codes use four letters and four digits.";
const DUPLICATE_COURSE_ERROR = "A course can appear only once.";

type ProfileFields = {
  majorCode: string;
  yearOfStudy: 1 | 2 | 3 | 4 | 5 | null;
  admissionCohort: AdmissionCohort | null;
  interests: string | null;
};

export type ProfileInput = ProfileFields & {
  courses: CourseRecord[];
};

type LegacyProfileInput = ProfileFields & {
  completedCodes: string[];
};

type ParsedProfileValue = ProfileInput | LegacyProfileInput | ProfileFields;

type ParseFailure = { ok: false; error: string };

type ParseResult = { ok: true; value: ParsedProfileValue } | ParseFailure;

type ParseSuccess<T> = [unknown] extends [T]
  ? ParsedProfileValue
  : T extends { courses: unknown }
    ? ProfileInput
    : LegacyProfileInput | ProfileFields;

export function parseProfileInput<T>(
  body: T,
  majorCodes: string[],
): { ok: true; value: ParseSuccess<T> } | ParseFailure;
export function parseProfileInput(body: unknown, majorCodes: string[]): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "majorCode must be a code from the catalogue" };
  }

  const record = body as Record<string, unknown>;
  const majorSet = new Set(majorCodes.map((code) => code.trim().toUpperCase()));

  const majorRaw = record.majorCode;
  const majorCode = typeof majorRaw === "string" ? majorRaw.trim().toUpperCase() : "";
  if (!majorSet.has(majorCode)) {
    return { ok: false, error: "majorCode must be a code from the catalogue" };
  }

  let courses: CourseRecord[] | undefined;
  let completedCodes: string[] | undefined;
  if (record.courses !== undefined) {
    const parsedCourses = parseCourseRecords(record.courses);
    if (!parsedCourses.ok) return parsedCourses;
    courses = parsedCourses.courses;
  } else if (record.completed !== undefined) {
    const parsedCompleted = parseCompletedCodes(record.completed);
    if (!parsedCompleted.ok) return parsedCompleted;
    completedCodes = parsedCompleted.completedCodes;
  }

  let yearOfStudy: ProfileFields["yearOfStudy"] = null;
  const yearRaw = record.yearOfStudy;
  if (yearRaw !== undefined && yearRaw !== null) {
    if (typeof yearRaw !== "number" || !Number.isInteger(yearRaw) || yearRaw < 1 || yearRaw > 5) {
      return { ok: false, error: "Year of study must be 1 through 5." };
    }
    yearOfStudy = yearRaw as 1 | 2 | 3 | 4 | 5;
  }

  let admissionCohort: AdmissionCohort | null = null;
  const cohortRaw = record.admissionCohort;
  if (cohortRaw !== undefined && cohortRaw !== null && cohortRaw !== "") {
    if (typeof cohortRaw !== "string" || !(ADMISSION_COHORTS as readonly string[]).includes(cohortRaw)) {
      return { ok: false, error: "Choose a listed admission cohort." };
    }
    admissionCohort = cohortRaw as AdmissionCohort;
  }

  let interests: string | null = null;
  const interestsRaw = record.interests;
  if (interestsRaw !== undefined && interestsRaw !== null) {
    if (typeof interestsRaw !== "string") {
      return { ok: false, error: "Keep interests to 200 characters." };
    }
    const trimmedInterests = interestsRaw.trim();
    if (trimmedInterests.length > 200) {
      return { ok: false, error: "Keep interests to 200 characters." };
    }
    interests = trimmedInterests.length > 0 ? trimmedInterests : null;
  }

  const fields = { majorCode, yearOfStudy, admissionCohort, interests };
  if (courses !== undefined) {
    return { ok: true, value: { ...fields, courses } };
  }
  if (completedCodes !== undefined) {
    return { ok: true, value: { ...fields, completedCodes } };
  }
  return { ok: true, value: fields };
}

export function mergeLegacyCompleted(existing: CourseRecord[], completedCodes: string[]): CourseRecord[] {
  const seen = new Set<string>();
  const merged: CourseRecord[] = [];

  for (const courseCode of completedCodes) {
    if (seen.has(courseCode)) continue;
    seen.add(courseCode);
    merged.push({
      courseCode,
      status: "completed",
      recognizesPrerequisite: false,
      reason: null,
    });
  }

  for (const record of existing) {
    if (record.status !== "waived" && record.status !== "transfer") continue;
    if (seen.has(record.courseCode)) continue;
    seen.add(record.courseCode);
    merged.push({
      courseCode: record.courseCode,
      status: record.status,
      recognizesPrerequisite: record.recognizesPrerequisite,
      reason: record.reason,
    });
  }

  return merged;
}

function parseCourseRecords(
  coursesRaw: unknown,
): { ok: true; courses: CourseRecord[] } | ParseFailure {
  if (!Array.isArray(coursesRaw)) {
    return { ok: false, error: COURSE_CODE_ERROR };
  }

  const courses: CourseRecord[] = [];
  const seenCodes = new Set<string>();

  for (const item of coursesRaw) {
    if (typeof item !== "object" || item === null) {
      return { ok: false, error: COURSE_CODE_ERROR };
    }

    const course = item as Record<string, unknown>;
    const courseCode = normalizeCourseCode(course.courseCode);
    if (!courseCode) {
      return { ok: false, error: COURSE_CODE_ERROR };
    }

    const statusRaw = course.status;
    if (typeof statusRaw !== "string" || !COURSE_STATUSES.has(statusRaw as CourseStatus)) {
      return { ok: false, error: "Choose completed, waived, or transfer." };
    }
    const status = statusRaw as CourseStatus;

    if (seenCodes.has(courseCode)) {
      return { ok: false, error: DUPLICATE_COURSE_ERROR };
    }
    seenCodes.add(courseCode);

    if (status === "completed") {
      courses.push({
        courseCode,
        status: "completed",
        recognizesPrerequisite: false,
        reason: null,
      });
      continue;
    }

    const recognizesPrerequisite = course.recognizesPrerequisite === true;
    let reason: string | null = null;
    const reasonRaw = course.reason;
    if (reasonRaw !== undefined && reasonRaw !== null) {
      if (typeof reasonRaw !== "string") {
        return { ok: false, error: "Keep the reason to 160 characters." };
      }
      const trimmedReason = reasonRaw.trim();
      if (trimmedReason.length > 160) {
        return { ok: false, error: "Keep the reason to 160 characters." };
      }
      reason = trimmedReason.length > 0 ? trimmedReason : null;
    }

    courses.push({
      courseCode,
      status,
      recognizesPrerequisite,
      reason,
    });
  }

  return { ok: true, courses };
}

function parseCompletedCodes(
  completedRaw: unknown,
): { ok: true; completedCodes: string[] } | ParseFailure {
  if (!Array.isArray(completedRaw)) {
    return { ok: false, error: COURSE_CODE_ERROR };
  }

  const completedCodes: string[] = [];
  const seenCodes = new Set<string>();
  for (const item of completedRaw) {
    const courseCode = normalizeCourseCode(item);
    if (!courseCode) {
      return { ok: false, error: COURSE_CODE_ERROR };
    }
    if (seenCodes.has(courseCode)) {
      return { ok: false, error: DUPLICATE_COURSE_ERROR };
    }
    seenCodes.add(courseCode);
    completedCodes.push(courseCode);
  }

  return { ok: true, completedCodes };
}

function normalizeCourseCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const courseCode = value.trim().toUpperCase();
  if (!COURSE_CODE_PATTERN.test(courseCode)) return null;
  return courseCode;
}
