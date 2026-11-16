import { rankAdditions } from "../recommend";
import { rewriteForRequest, understandingBlurb } from "./understand";
import {
  WHAT2REG_ATTRIBUTION,
  WHAT2REG_DISCLAIMER,
  type CommunityReviewNote,
  type RankedAdditions,
} from "./types";

const REQUIRED = new Set(["verified-compulsory", "verified-required-elective"]);

function formatScore(value: number | null): string {
  return value === null ? "n/a" : String(value);
}

function noteFor(courseCode: string, notes: readonly CommunityReviewNote[]): CommunityReviewNote | undefined {
  return notes.find((note) => note.courseCode.toUpperCase() === courseCode.toUpperCase());
}

/**
 * Attach community-review wording to an already ranked set.
 * Section keys, order, basis, and gap reason stay as rankAdditions decided them.
 * A harsh review cannot remove a compulsory or required course.
 */
export function applyReviewContext(
  ranked: RankedAdditions,
  notes: readonly CommunityReviewNote[],
  question?: string | null,
): RankedAdditions & {
  explanation: string | null;
} {
  if (notes.length === 0) return { ...ranked, explanation: null };
  const asked = question?.trim() ?? "";
  const selections = ranked.selections.map((row) => {
    const note = noteFor(row.courseCode, notes);
    if (!note) return { ...row };
    if (note.understanding && asked) {
      const report = rewriteForRequest({ understanding: note.understanding, question: asked, basis: row.basis });
      return { ...row, detail: `${row.detail} ${report}`.trim() };
    }
    if (note.understanding) {
      const guard = REQUIRED.has(row.basis)
        ? " This community opinion does not remove this required course."
        : " This community opinion is a soft preference and does not change the chosen section.";
      return { ...row, detail: `${row.detail} ${understandingBlurb(note.understanding)}${guard}`.trim() };
    }
    const opinion =
      `Community opinion from ${WHAT2REG_ATTRIBUTION} for ${note.instructor ?? "this course"}: ` +
      `grade ${formatScore(note.grade)}, difficulty ${formatScore(note.difficulty)}, usefulness ${formatScore(note.usefulness)}.` +
      (note.summary ? ` ${note.summary}` : "");
    const guard = REQUIRED.has(row.basis)
      ? " This community opinion does not remove this required course."
      : " This community opinion is a soft preference among legal sections and does not change the chosen section.";
    return { ...row, detail: `${row.detail} ${opinion}${guard}`.trim() };
  });
  const keys = selections.map((row) => row.sectionKey);
  const unchanged =
    keys.length === ranked.keys.length &&
    keys.every((key, index) => key === ranked.keys[index]) &&
    selections.every((row, index) => row.basis === ranked.selections[index]?.basis && row.courseCode === ranked.selections[index]?.courseCode);
  if (!unchanged) {
    return { ...ranked, explanation: null };
  }
  return {
    keys,
    selections,
    gapReason: ranked.gapReason,
    explanation: `${WHAT2REG_DISCLAIMER} These notes do not drop a legal course.`,
  };
}

export function rankAdditionsWithReviews(
  input: Parameters<typeof rankAdditions>[0],
  notes: readonly CommunityReviewNote[],
  question?: string | null,
): RankedAdditions & { explanation: string | null } {
  return applyReviewContext(rankAdditions(input), notes, question);
}
