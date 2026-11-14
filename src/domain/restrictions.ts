const CLASS_NOT_FOR = "CLASS NOT FOR";
const CLASS_FOR = "CLASS FOR";

const YEAR_NUMBER: Record<string, number> = {
  FIRST: 1,
  SECOND: 2,
  THIRD: 3,
  FOURTH: 4,
  FIFTH: 5,
};

export type RestrictionNeed = "uninterpreted" | "specialization" | "year";

export type RestrictionOutcome =
  | { status: "eligible" }
  | { status: "ineligible"; rule: "class-for" | "class-not-for" }
  | { status: "unverified"; need: RestrictionNeed };

type Student = { majorCode: string; programme: string | null; yearOfStudy: number | null };

type Known = {
  majors: readonly string[];
  programmes: readonly string[];
  specializations: readonly { majorCode: string; code: string }[];
};

type Alternative =
  | { kind: "match" }
  | { kind: "miss" }
  | { kind: "unverified"; need: RestrictionNeed };

type PhraseDecision =
  | { status: "empty" }
  | { status: "match" }
  | { status: "miss" }
  | { status: "unverified"; need: RestrictionNeed };

const WISH: Record<RestrictionNeed, (sectionKey: string) => string> = {
  uninterpreted: (sectionKey) =>
    `Eligibility for ${sectionKey} is unverified. TermPilot could not interpret part of this section's class restriction. This course was not added.`,
  specialization: (sectionKey) =>
    `Eligibility for ${sectionKey} is unverified. This section names a specialization, which TermPilot does not have on your profile. This course was not added.`,
  year: (sectionKey) =>
    `Eligibility for ${sectionKey} is unverified. Save your year of study to check this section. This course was not added.`,
};

export function unverifiedWish(sectionKey: string, need: RestrictionNeed): string {
  return WISH[need](sectionKey);
}

export function majorCodesInText(text: string, majors: readonly string[]): string[] {
  const upper = text.toUpperCase();
  const ordered = [...majors].sort((left, right) => right.length - left.length);
  const found: string[] = [];
  const seen = new Set<string>();
  let index = 0;
  while (index < upper.length) {
    const matched = ordered.find(
      (major) => upper.startsWith(major.toUpperCase(), index) && boundaryAfter(upper, index + major.length),
    );
    if (!matched) {
      index += 1;
      continue;
    }
    const code = matched.toUpperCase();
    if (!seen.has(code)) {
      seen.add(code);
      found.push(code);
    }
    index += matched.length;
  }
  return found;
}

export function restrictionOutcome(restriction: string, student: Student, known: Known): RestrictionOutcome {
  const upper = restriction.toUpperCase();
  const hasNotFor = upper.includes(CLASS_NOT_FOR);
  const hasFor = upper.includes(CLASS_FOR);
  if (!hasNotFor && !hasFor) return { status: "eligible" };

  const majors = [...known.majors].sort((left, right) => right.length - left.length);
  const programmes = new Set(known.programmes.map((code) => code.trim().toUpperCase()).filter(Boolean));
  const normalized: Student = {
    majorCode: student.majorCode.toUpperCase(),
    programme: student.programme?.trim() ? student.programme.trim().toUpperCase() : null,
    yearOfStudy: student.yearOfStudy,
  };

  if (hasNotFor) {
    const excluded = decidePhrase(
      alternativesIn(extractPhraseBody(restriction, "notFor"), programmes, majors, known.specializations, normalized),
    );
    if (excluded.status === "match") return { status: "ineligible", rule: "class-not-for" };
    if (excluded.status === "empty") return { status: "unverified", need: "uninterpreted" };
    if (excluded.status === "unverified") return { status: "unverified", need: excluded.need };
  }

  if (!hasFor) return { status: "eligible" };
  const allowed = decidePhrase(
    alternativesIn(extractPhraseBody(restriction, "for"), programmes, majors, known.specializations, normalized),
  );
  if (allowed.status === "match") return { status: "eligible" };
  if (allowed.status === "unverified") return { status: "unverified", need: allowed.need };
  if (allowed.status === "empty") return { status: "unverified", need: "uninterpreted" };
  return { status: "ineligible", rule: "class-for" };
}

function boundaryAfter(text: string, index: number): boolean {
  const next = text[index];
  return next === undefined || !/[A-Z0-9]/.test(next);
}

function extractPhraseBody(fullText: string, phrase: "notFor" | "for"): string {
  const upper = fullText.toUpperCase();
  if (phrase === "notFor") {
    const start = upper.indexOf(CLASS_NOT_FOR);
    if (start === -1) return "";
    const bodyStart = start + CLASS_NOT_FOR.length;
    const otherAt = upper.indexOf(CLASS_FOR, bodyStart);
    return fullText.slice(bodyStart, otherAt === -1 ? fullText.length : otherAt);
  }
  const start = upper.indexOf(CLASS_FOR);
  if (start === -1) return "";
  const bodyStart = start + CLASS_FOR.length;
  const otherAt = upper.indexOf(CLASS_NOT_FOR, bodyStart);
  return fullText.slice(bodyStart, otherAt === -1 ? fullText.length : otherAt);
}

function cleanPiece(piece: string): string {
  return piece.replace(/\s+/g, " ").trim().replace(/^:+\s*/, "").trim().toUpperCase();
}

function slashAlternatives(piece: string): string[] {
  return piece
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function alternativesIn(
  body: string,
  programmes: ReadonlySet<string>,
  majors: readonly string[],
  specializations: Known["specializations"],
  student: Student,
): Alternative[] {
  const pieces = body.split(" - ").map(cleanPiece).filter(Boolean);
  const alternatives: Alternative[] = [];
  let index = 0;
  while (index < pieces.length) {
    const piece = pieces[index]!;
    if (!programmes.has(piece)) {
      for (const alternative of slashAlternatives(piece)) {
        alternatives.push(classifyAlternative(alternative, null, student, majors, specializations));
      }
      index += 1;
      continue;
    }
    const next = pieces[index + 1];
    if (next && !programmes.has(next)) {
      for (const alternative of slashAlternatives(next)) {
        alternatives.push(classifyAlternative(alternative, piece, student, majors, specializations));
      }
      index += 2;
      continue;
    }
    alternatives.push(student.programme === piece ? { kind: "match" } : { kind: "miss" });
    index += 1;
  }
  return alternatives;
}

function classifyAlternative(
  alternative: string,
  faculty: string | null,
  student: Student,
  majors: readonly string[],
  specializations: Known["specializations"],
): Alternative {
  const text = alternative.trim().toUpperCase();
  const bareYear = yearValue(text);
  if (bareYear !== null) {
    if (!faculty) return { kind: "unverified", need: "uninterpreted" };
    return classifyYear(bareYear, student.programme === faculty, student.yearOfStudy);
  }

  const major = majors.find(
    (code) => text.startsWith(code.toUpperCase()) && boundaryAfter(text, code.length),
  );
  if (!major) return { kind: "unverified", need: "uninterpreted" };
  const code = major.toUpperCase();
  const rest = text.slice(code.length).replace(/^[\s-]+/, "").trim();
  if (!rest) {
    return student.majorCode === code ? { kind: "match" } : { kind: "miss" };
  }
  const year = yearValue(rest);
  if (year !== null) {
    if (student.majorCode !== code) return { kind: "miss" };
    return classifyYear(year, true, student.yearOfStudy);
  }
  const specialization = specializations.some(
    (item) => item.majorCode.toUpperCase() === code && item.code.toUpperCase() === rest,
  );
  if (specialization) {
    if (student.majorCode !== code) return { kind: "miss" };
    return { kind: "unverified", need: "specialization" };
  }
  return { kind: "unverified", need: "uninterpreted" };
}

function classifyYear(year: number, scopeMatches: boolean, yearOfStudy: number | null): Alternative {
  if (!scopeMatches) return { kind: "miss" };
  if (yearOfStudy === null) return { kind: "unverified", need: "year" };
  return yearOfStudy === year ? { kind: "match" } : { kind: "miss" };
}

function yearValue(text: string): number | null {
  const match = /^(FIRST|SECOND|THIRD|FOURTH|FIFTH) YEAR$/.exec(text);
  if (!match) return null;
  return YEAR_NUMBER[match[1]!] ?? null;
}

function decidePhrase(alternatives: Alternative[]): PhraseDecision {
  if (alternatives.length === 0) return { status: "empty" };
  if (alternatives.some((alternative) => alternative.kind === "match")) return { status: "match" };
  const needs = alternatives.flatMap((alternative) =>
    alternative.kind === "unverified" ? [alternative.need] : [],
  );
  if (needs.length === 0) return { status: "miss" };
  if (needs.includes("uninterpreted")) return { status: "unverified", need: "uninterpreted" };
  if (needs.includes("specialization")) return { status: "unverified", need: "specialization" };
  return { status: "unverified", need: "year" };
}
