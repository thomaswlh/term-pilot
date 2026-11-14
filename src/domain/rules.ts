import {
  declaredStatusSentence,
  prerequisiteReportedSentence,
  type CourseStatus,
  type PrerequisiteClaim,
} from "./academic";
import { majorCodesInText, restrictionOutcome, unverifiedWish, type RestrictionNeed } from "./restrictions";
import { sectionKey, timedMeetings } from "./section";
import type { Catalogue, Day, Meeting, PrereqRow, Section } from "./types";

const CLASS_NOT_FOR = "CLASS NOT FOR";
const CLASS_FOR = "CLASS FOR";

export type RuleFailure =
  | { rule: "no-sections" }
  | { rule: "unknown-section"; sectionKey: string }
  | { rule: "untimed"; sectionKey: string }
  | { rule: "overlap"; sectionKeys: [string, string] }
  | { rule: "duplicate-course"; courseCode: string; sectionKeys: string[] }
  | { rule: "class-for"; sectionKey: string }
  | { rule: "class-not-for"; sectionKey: string }
  | { rule: "eligibility-unverified"; sectionKey: string; need: RestrictionNeed }
  | { rule: "prerequisite"; sectionKey: string; groupNo: string; courses: string[] };

type ClassForFailure = Extract<RuleFailure, { rule: "class-for" }>;
type ClassNotForFailure = Extract<RuleFailure, { rule: "class-not-for" }>;

export type RuleWarning =
  | {
      rule: "prerequisite-not-enforced";
      sectionKey: string;
      groupNo: string;
      requiredCount: number;
    }
  | {
      rule: "prerequisite-student-reported";
      sectionKey: string;
      courseCode: string;
      basis: "waived" | "transfer";
    }
  | {
      rule: "declared-status";
      sectionKey: string;
      courseCode: string;
      status: CourseStatus;
    };

export type RuleReport = { ok: boolean; failures: RuleFailure[]; warnings: RuleWarning[] };

const MAJOR_TOKEN = /[A-Z]{3}\d{2}(?!\d)/g;

export function majorTokens(text: string): string[] {
  const upper = text.toUpperCase();
  const matches = upper.match(MAJOR_TOKEN);
  return matches ?? [];
}

function normalizeScope(value: string): string {
  return value.trim().toUpperCase();
}

function extractPhraseBody(fullText: string, phrase: "notFor" | "for"): string {
  const upper = fullText.toUpperCase();
  if (phrase === "notFor") {
    const start = upper.indexOf(CLASS_NOT_FOR);
    if (start === -1) {
      return "";
    }
    const bodyStart = start + CLASS_NOT_FOR.length;
    const otherAt = upper.indexOf(CLASS_FOR, bodyStart);
    const end = otherAt === -1 ? fullText.length : otherAt;
    return fullText.slice(bodyStart, end);
  }
  const start = upper.indexOf(CLASS_FOR);
  if (start === -1) {
    return "";
  }
  const bodyStart = start + CLASS_FOR.length;
  const otherAt = upper.indexOf(CLASS_NOT_FOR, bodyStart);
  const end = otherAt === -1 ? fullText.length : otherAt;
  return fullText.slice(bodyStart, end);
}

function classNotForTokens(restriction: string): string[] {
  return majorTokens(extractPhraseBody(restriction, "notFor"));
}

function classForTokens(restriction: string): string[] {
  return majorTokens(extractPhraseBody(restriction, "for"));
}

export function evaluateClassRestrictions(
  restriction: string,
  majorCode: string,
): { classFor?: ClassForFailure; classNotFor?: ClassNotForFailure } {
  const upper = restriction.toUpperCase();
  const hasNotFor = upper.includes(CLASS_NOT_FOR);
  const hasFor = upper.includes(CLASS_FOR);
  if (!hasNotFor && !hasFor) {
    return {};
  }
  const result: { classFor?: ClassForFailure; classNotFor?: ClassNotForFailure } = {};
  if (hasNotFor) {
    const blocked = classNotForTokens(restriction);
    if (blocked.length > 0 && blocked.includes(majorCode)) {
      result.classNotFor = { rule: "class-not-for", sectionKey: "" };
    }
  }
  if (hasFor) {
    const allowed = classForTokens(restriction);
    if (!allowed.includes(majorCode)) {
      result.classFor = { rule: "class-for", sectionKey: "" };
    }
  }
  return result;
}

type TimedEntry = { sectionKey: string; meeting: Meeting & { day: Day; startMinutes: number; endMinutes: number } };

export function meetingsOverlap(
  a: Meeting & { day: Day; startMinutes: number; endMinutes: number },
  b: Meeting & { day: Day; startMinutes: number; endMinutes: number },
): boolean {
  if (a.day !== b.day) {
    return false;
  }
  return a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

function applicablePrereqRows(
  rows: PrereqRow[],
  courseCode: string,
  majorCode: string,
  majors: readonly string[],
): PrereqRow[] {
  return rows.filter((row) => {
    if (row.courseCode !== courseCode) {
      return false;
    }
    const scope = normalizeScope(row.preRequisiteFor);
    if (scope === "ALL") {
      return true;
    }
    if (scope === "MAJOR") {
      return majorCodesInText(row.majorList, majors).includes(majorCode.toUpperCase());
    }
    return false;
  });
}

function evaluatePrerequisites(
  catalogue: Catalogue,
  section: Section,
  profile: { majorCode: string; claims: PrerequisiteClaim[] },
  failures: RuleFailure[],
  warnings: RuleWarning[],
): void {
  const key = sectionKey(section);
  const applicable = applicablePrereqRows(
    catalogue.prerequisites,
    section.courseCode,
    profile.majorCode,
    catalogue.majors.map((major) => major.code),
  );
  if (applicable.length === 0) {
    return;
  }

  const byGroup = new Map<string, PrereqRow[]>();
  for (const row of applicable) {
    const g = row.groupNo.trim() || "__default__";
    const list = byGroup.get(g) ?? [];
    list.push(row);
    byGroup.set(g, list);
  }

  for (const [groupNo, groupRows] of byGroup) {
    const counts = new Set(groupRows.map((r) => r.requiredCount));
    if (counts.size > 1) {
      warnings.push({
        rule: "prerequisite-not-enforced",
        sectionKey: key,
        groupNo: groupNo === "__default__" ? groupRows[0]!.groupNo : groupNo,
        requiredCount: Math.min(...counts),
      });
      continue;
    }
    const requiredCount = groupRows[0]!.requiredCount;
    const courses = groupRows.map((r) => r.requiredCourseCode.trim()).filter(Boolean);

    if (requiredCount > 1) {
      warnings.push({
        rule: "prerequisite-not-enforced",
        sectionKey: key,
        groupNo: groupNo === "__default__" ? groupRows[0]!.groupNo : groupNo,
        requiredCount,
      });
      continue;
    }

    if (requiredCount === 1) {
      const matching = profile.claims.filter((claim) => courses.includes(claim.courseCode));
      if (matching.some((claim) => claim.basis === "completed")) {
        continue;
      }
      const courseCode = courses.find((code) =>
        matching.some((claim) => claim.courseCode === code && (claim.basis === "waived" || claim.basis === "transfer")),
      );
      const reported = courseCode
        ? matching.find(
            (claim) =>
              claim.courseCode === courseCode && (claim.basis === "waived" || claim.basis === "transfer"),
          )
        : undefined;
      if (courseCode && reported && reported.basis !== "completed") {
        warnings.push({
          rule: "prerequisite-student-reported",
          sectionKey: key,
          courseCode,
          basis: reported.basis,
        });
        continue;
      }
      failures.push({
        rule: "prerequisite",
        sectionKey: key,
        groupNo: groupNo === "__default__" ? groupRows[0]!.groupNo : groupNo,
        courses,
      });
    }
  }
}

export function validateSections(
  keys: string[],
  profile: { majorCode: string; claims: PrerequisiteClaim[]; yearOfStudy?: number | null },
  catalogue: Catalogue,
  resolvedSections?: Map<string, Section>,
): RuleReport {
  const failures: RuleFailure[] = [];
  const warnings: RuleWarning[] = [];

  if (keys.length === 0) {
    return { ok: false, failures: [{ rule: "no-sections" }], warnings: [] };
  }

  const sectionsByKey = new Map<string, Section | undefined>();
  for (const key of keys) {
    sectionsByKey.set(
      key,
      resolvedSections ? resolvedSections.get(key) : catalogue.sections.find((s) => sectionKey(s) === key),
    );
  }

  for (const key of keys) {
    const section = sectionsByKey.get(key);
    if (!section) {
      failures.push({ rule: "unknown-section", sectionKey: key });
    }
  }

  const resolved: { key: string; section: Section }[] = [];
  for (const key of keys) {
    const section = sectionsByKey.get(key);
    if (section) {
      resolved.push({ key, section });
    }
  }

  for (const { key, section } of resolved) {
    if (timedMeetings(section).length === 0) {
      failures.push({ rule: "untimed", sectionKey: key });
    }
  }

  const keysByCourse = new Map<string, string[]>();
  const seenKeys = new Set<string>();
  for (const { key, section } of resolved) {
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    const list = keysByCourse.get(section.courseCode) ?? [];
    list.push(key);
    keysByCourse.set(section.courseCode, list);
  }
  for (const [courseCode, sectionKeys] of keysByCourse) {
    if (sectionKeys.length < 2) continue;
    failures.push({
      rule: "duplicate-course",
      courseCode,
      sectionKeys: [...sectionKeys].sort(),
    });
  }

  const timedEntries: TimedEntry[] = [];
  for (const { key, section } of resolved) {
    for (const meeting of timedMeetings(section)) {
      timedEntries.push({
        sectionKey: key,
        meeting: meeting as TimedEntry["meeting"],
      });
    }
  }

  for (let i = 0; i < timedEntries.length; i++) {
    for (let j = i + 1; j < timedEntries.length; j++) {
      const a = timedEntries[i]!;
      const b = timedEntries[j]!;
      if (a.sectionKey === b.sectionKey) {
        continue;
      }
      if (meetingsOverlap(a.meeting, b.meeting)) {
        const pair: [string, string] =
          a.sectionKey < b.sectionKey ? [a.sectionKey, b.sectionKey] : [b.sectionKey, a.sectionKey];
        failures.push({ rule: "overlap", sectionKeys: pair });
      }
    }
  }

  const known = {
    majors: catalogue.majors.map((major) => major.code),
    programmes: [
      ...new Set(catalogue.majors.map((major) => major.programme).filter((programme) => programme.trim() !== "")),
    ],
    specializations: catalogue.specializations,
  };
  const programme = catalogue.majors.find((major) => major.code === profile.majorCode)?.programme ?? null;
  for (const { key, section } of resolved) {
    const outcome = restrictionOutcome(
      section.restriction,
      { majorCode: profile.majorCode, programme, yearOfStudy: profile.yearOfStudy ?? null },
      known,
    );
    if (outcome.status === "ineligible") {
      failures.push({ rule: outcome.rule, sectionKey: key });
    } else if (outcome.status === "unverified") {
      failures.push({ rule: "eligibility-unverified", sectionKey: key, need: outcome.need });
    }
  }

  for (const { section } of resolved) {
    evaluatePrerequisites(catalogue, section, profile, failures, warnings);
  }

  return { ok: failures.length === 0, failures, warnings };
}

export function warningSentence(warning: RuleWarning): string {
  switch (warning.rule) {
    case "prerequisite-not-enforced":
      return `Prerequisite group ${warning.groupNo} for ${warning.sectionKey} was not confirmed.`;
    case "prerequisite-student-reported":
      return prerequisiteReportedSentence(warning.sectionKey, warning.courseCode, warning.basis);
    case "declared-status":
      return declaredStatusSentence(warning.courseCode, warning.status);
    default: {
      const _exhaustive: never = warning;
      return String(_exhaustive);
    }
  }
}

export function ruleSentence(failure: RuleFailure): string {
  switch (failure.rule) {
    case "unknown-section":
      return `Unknown section ${failure.sectionKey}.`;
    case "untimed":
      return `Section ${failure.sectionKey} has no weekly meeting.`;
    case "overlap":
      return `Sections ${failure.sectionKeys[0]} and ${failure.sectionKeys[1]} have overlapping meetings.`;
    case "duplicate-course":
      return `Course ${failure.courseCode} already has a section on this timetable (${failure.sectionKeys.join(", ")}).`;
    case "class-for":
      return `Section ${failure.sectionKey} is not offered for your major (class for).`;
    case "class-not-for":
      return `Section ${failure.sectionKey} is not for your major (class not for).`;
    case "eligibility-unverified":
      return unverifiedWish(failure.sectionKey, failure.need);
    case "prerequisite":
      return `Section ${failure.sectionKey} requires prior credit in group ${failure.groupNo}: ${failure.courses.join(", ")}.`;
    case "no-sections":
      return "Add at least one section before checking the rules.";
    default: {
      const _exhaustive: never = failure;
      return String(_exhaustive);
    }
  }
}
