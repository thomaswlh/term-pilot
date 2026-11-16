import { WHAT2REG_DISCLAIMER, REVIEW_THEMES, type ReviewLookup, type ReviewPoint, type ReviewTheme, type ReviewUnderstanding } from "./types";

export type ReviewCompleter = (prompt: string) => Promise<string | null>;

const REQUIRED = new Set(["verified-compulsory", "verified-required-elective"]);

const THEME_PATTERNS: { theme: ReviewTheme; pattern: RegExp }[] = [
  { theme: "workload", pattern: /workload|assignment|homework|reading|project|作業/i },
  { theme: "teaching", pattern: /lectur|teach|explain|professor|clear|boring|老師|講/i },
  { theme: "assessment", pattern: /exam|quiz|midterm|final|test|考試/i },
  { theme: "worth", pattern: /worth|useful|recommend|waste|值得/i },
  { theme: "grading", pattern: /grade|lenient|curve|分數/i },
];

const POSITIVE = /easy|easier|light|clear|helpful|worth|recommend|fair|lenient|容易|推薦|值得|清楚/i;
const NEGATIVE = /hard|harder|heavy|unclear|boring|waste|strict|difficult|tough|難|不推薦|不值得|沉悶/i;

function reviewTexts(lookup: ReviewLookup): string[] {
  const texts: string[] = [];
  for (const instructor of lookup.instructors) {
    for (const summary of instructor.summaries) {
      const text = summary.text.trim();
      if (text) texts.push(text);
    }
  }
  return texts;
}

function themesIn(text: string): ReviewTheme[] {
  const found = THEME_PATTERNS.filter((row) => row.pattern.test(text)).map((row) => row.theme);
  return found.length > 0 ? found : ["other"];
}

function band(value: number, high: string, middle: string, low: string): string {
  if (value >= 4) return high;
  if (value >= 2.5) return middle;
  return low;
}

function scoreImpression(label: string, value: number | null, high: string, middle: string, low: string): string | null {
  if (value === null) return null;
  return `${label} score ${value}: ${band(value, high, middle, low)}.`;
}

function firstScores(lookup: ReviewLookup): { grade: number | null; difficulty: number | null; usefulness: number | null } {
  for (const instructor of lookup.instructors) {
    if (instructor.grade !== null || instructor.difficulty !== null || instructor.usefulness !== null) {
      return { grade: instructor.grade, difficulty: instructor.difficulty, usefulness: instructor.usefulness };
    }
  }
  return { grade: null, difficulty: null, usefulness: null };
}

function polarity(text: string): "positive" | "negative" | "mixed" | "none" {
  const positive = POSITIVE.test(text);
  const negative = NEGATIVE.test(text);
  if (positive && negative) return "mixed";
  if (positive) return "positive";
  if (negative) return "negative";
  return "none";
}

function clip(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 180 ? `${trimmed.slice(0, 179)}…` : trimmed;
}

/**
 * Extract a fixed-schema reading from scores and the public review text.
 * Every pro and con copies a review span into `groundedIn`.
 * Returns null when there is nothing to read.
 */
export function buildReviewUnderstanding(lookup: ReviewLookup): ReviewUnderstanding | null {
  const texts = reviewTexts(lookup);
  const scores = firstScores(lookup);
  if (texts.length === 0 && scores.grade === null && scores.difficulty === null && scores.usefulness === null) {
    return null;
  }
  const pros: ReviewPoint[] = [];
  const cons: ReviewPoint[] = [];
  const themes = new Set<ReviewTheme>();
  let mixed = false;
  let sawPositive = false;
  let sawNegative = false;
  for (const text of texts) {
    const commentThemes = themesIn(text);
    for (const theme of commentThemes) themes.add(theme);
    const tone = polarity(text);
    if (tone === "mixed") mixed = true;
    if (tone === "positive") sawPositive = true;
    if (tone === "negative") sawNegative = true;
    const point: ReviewPoint = { text: clip(text), theme: commentThemes[0] ?? "other", groundedIn: text };
    if (tone === "positive" && pros.length < 3) pros.push(point);
    if (tone === "negative" && cons.length < 3) cons.push(point);
  }
  const conflict = mixed || (sawPositive && sawNegative);
  const small = texts.length < 3;
  const uncertainty = conflict ? "conflict" : small ? "small-sample" : "none";
  const uncertaintyNote =
    conflict && small
      ? `Only ${texts.length} public comment${texts.length === 1 ? "" : "s"}, and they disagree.`
      : conflict
        ? "The public comments disagree."
        : small
          ? texts.length === 0
            ? "No public comments were returned, so this is only the numeric scores."
            : `Only ${texts.length} public comment${texts.length === 1 ? "" : "s"}.`
          : null;
  return {
    courseCode: lookup.courseCode,
    impression: {
      grade: scoreImpression("Grade", scores.grade, "on the high side", "in the middle", "on the low side"),
      difficulty: scoreImpression("Difficulty", scores.difficulty, "on the hard side", "moderate", "on the easier side"),
      usefulness: scoreImpression("Usefulness", scores.usefulness, "on the high side", "in the middle", "on the low side"),
    },
    themes: [...themes],
    pros,
    cons,
    uncertainty,
    uncertaintyNote,
    sampleSize: texts.length,
  };
}

export function understandingBlurb(understanding: ReviewUnderstanding): string {
  const scores = [understanding.impression.grade, understanding.impression.difficulty, understanding.impression.usefulness].filter(
    (line): line is string => line !== null,
  );
  const about = understanding.themes.length > 0 ? `Comments talk about ${understanding.themes.join(", ")}.` : "";
  const pro = understanding.pros[0] ? `In favour: ${understanding.pros[0].text}` : "";
  const con = understanding.cons[0] ? `Against: ${understanding.cons[0].text}` : "";
  return [scores.join(" "), about, pro, con, understanding.uncertaintyNote].filter((part) => part && part.length > 0).join(" ");
}

function grounded(snippet: string, texts: readonly string[]): boolean {
  const needle = snippet.trim().toLowerCase();
  if (needle.length < 8) return false;
  return texts.some((text) => text.toLowerCase().includes(needle));
}

function asTheme(value: unknown): ReviewTheme {
  return typeof value === "string" && (REVIEW_THEMES as readonly string[]).includes(value) ? (value as ReviewTheme) : "other";
}

function pointsFrom(value: unknown, texts: readonly string[]): ReviewPoint[] {
  if (!Array.isArray(value)) return [];
  const points: ReviewPoint[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const groundedIn = typeof row.groundedIn === "string" ? row.groundedIn.trim() : "";
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (!text || !grounded(groundedIn, texts)) continue;
    points.push({ text: clip(text), theme: asTheme(row.theme), groundedIn });
    if (points.length >= 3) break;
  }
  return points;
}

/** Parse a model JSON object. Ungrounded points are dropped. Invalid JSON returns null. */
export function parseModelUnderstanding(raw: string, texts: readonly string[]): { pros: ReviewPoint[]; cons: ReviewPoint[] } | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced?.[1] ?? trimmed;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const row = parsed as Record<string, unknown>;
  return { pros: pointsFrom(row.pros, texts), cons: pointsFrom(row.cons, texts) };
}

function understandingPrompt(lookup: ReviewLookup): string {
  const lines = reviewTexts(lookup).map((text, index) => `${index + 1}. ${text}`);
  return [
    "Read these public course comments and return JSON only.",
    'Shape: {"pros":[{"text":"short point","theme":"workload|teaching|assessment|worth|grading|other","groundedIn":"exact words copied from one comment"}],"cons":[...]}',
    "Use at most 3 pros and 3 cons. groundedIn must be copied from a comment. Do not add facts that are not in the comments.",
    lines.join("\n"),
  ].join("\n");
}

/**
 * Ask the model for pros and cons, then keep the score impression and uncertainty from the comments themselves.
 * A failed or unparsable model call returns null so the caller can show the raw reviews.
 */
export async function understandReviews(lookup: ReviewLookup, complete: ReviewCompleter): Promise<ReviewUnderstanding | null> {
  const draft = buildReviewUnderstanding(lookup);
  if (!draft) return null;
  let raw: string | null;
  try {
    raw = await complete(understandingPrompt(lookup));
  } catch {
    return null;
  }
  if (!raw) return null;
  const parsed = parseModelUnderstanding(raw, reviewTexts(lookup));
  if (!parsed) return null;
  const pros = parsed.pros.length > 0 ? parsed.pros : draft.pros;
  const cons = parsed.cons.length > 0 ? parsed.cons : draft.cons;
  const themes = new Set<ReviewTheme>(draft.themes);
  for (const point of [...pros, ...cons]) themes.add(point.theme);
  return { ...draft, pros, cons, themes: [...themes] };
}

type QuestionFocus = "pass" | "workload" | "worth" | "programme" | "general";

function focusOf(question: string): QuestionFocus {
  const text = question.toLowerCase();
  if (/pass|easy|grade|exam|分數|易唔易|易/.test(text)) return "pass";
  if (/workload|heavy|assignment|homework|作業|忙/.test(text)) return "workload";
  if (/worth|useful|recommend|值得/.test(text)) return "worth";
  if (/programme|program|study plan|major|compulsory|required|clash|必修/.test(text)) return "programme";
  return "general";
}

function pointsFor(understanding: ReviewUnderstanding, themes: readonly ReviewTheme[]): ReviewPoint[] {
  return [...understanding.pros, ...understanding.cons].filter((point) => themes.includes(point.theme));
}

function sentence(point: ReviewPoint): string {
  return point.text;
}

/**
 * Rewrite a short report for one student question.
 * It uses only the structured summary, so two questions about the same reviews do not share one canned paragraph.
 */
export function rewriteForRequest(input: {
  understanding: ReviewUnderstanding;
  question: string;
  basis?: string | null;
}): string {
  const { understanding } = input;
  const focus = focusOf(input.question);
  const parts: string[] = [];
  if (focus === "pass") {
    if (understanding.impression.grade) parts.push(understanding.impression.grade);
    const points = pointsFor(understanding, ["assessment", "grading"]);
    if (points.length > 0) parts.push(points.map(sentence).join(" "));
    else parts.push("The comments do not say whether the course is easy to pass.");
  } else if (focus === "workload") {
    if (understanding.impression.difficulty) parts.push(understanding.impression.difficulty);
    const points = pointsFor(understanding, ["workload"]);
    if (points.length > 0) parts.push(points.map(sentence).join(" "));
    else parts.push("The comments do not say whether the workload is heavy.");
  } else if (focus === "worth") {
    if (understanding.impression.usefulness) parts.push(understanding.impression.usefulness);
    const points = pointsFor(understanding, ["worth", "teaching"]);
    if (points.length > 0) parts.push(points.map(sentence).join(" "));
    else parts.push("The comments do not say whether the course is worth taking.");
  } else if (focus === "programme") {
    parts.push("These comments do not say whether the course fits the study plan.");
    if (input.basis && REQUIRED.has(input.basis)) {
      parts.push("The course stays because the study plan marks it required.");
    }
  } else {
    parts.push(understandingBlurb(understanding));
  }
  if (focus !== "general" && understanding.uncertaintyNote) parts.push(understanding.uncertaintyNote);
  if (input.basis && REQUIRED.has(input.basis)) {
    parts.push("This community opinion does not remove this required course.");
  }
  parts.push(WHAT2REG_DISCLAIMER);
  return parts.filter((part) => part.length > 0).join(" ");
}

export function understandingCacheKey(lookup: ReviewLookup): string {
  const body = lookup.instructors
    .map((instructor) =>
      [
        instructor.name,
        instructor.grade ?? "",
        instructor.difficulty ?? "",
        instructor.usefulness ?? "",
        ...instructor.summaries.map((summary) => summary.text),
      ].join("|"),
    )
    .join("\n");
  return `understanding:${lookup.courseCode}:${body}`;
}
