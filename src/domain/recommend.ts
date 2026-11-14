import type { PrerequisiteClaim } from "./academic";
import type { CreditBook } from "./credits";
import { meetingsOverlap } from "./rules";
import { searchSections } from "./search";
import { parseSectionKey, sectionKey, timedMeetings } from "./section";
import type { StudyPlan } from "./study-plan";
import { automaticCourses } from "./study-plan";
import type { Catalogue, Day, Section } from "./types";
import { validateSections } from "./rules";

export type SelectionBasis =
  | "verified-compulsory"
  | "verified-required-elective"
  | "inferred-faculty"
  | "inferred-interest"
  | "general-elective";

export type GapReason = "none" | "needs-target" | "no-legal-course" | "search-bound";

export type CourseSelection = {
  sectionKey: string;
  courseCode: string;
  basis: SelectionBasis;
  detail: string;
};

type AvoidRange = { day: Day; startMinutes: number; endMinutes: number };

type RankProfile = {
  majorCode: string;
  programme: string | null;
  yearOfStudy: number | null;
  interests: string | null;
  claims: PrerequisiteClaim[];
};

type Candidate = {
  code: string;
  credits: number;
  basis: SelectionBasis;
  detail: string;
  suggestedYear: number | null;
  group: number;
};

type WindowCourse = Candidate & { key: string };

const WINDOW = 12;

function halfCredits(value: number): number {
  return Math.round(value * 2);
}

function compareSectionNumber(a: string, b: string): number {
  const left = Number.parseInt(a, 10);
  const right = Number.parseInt(b, 10);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
  return a.localeCompare(b);
}

function firstDigit(courseCode: string): number | null {
  const match = /(\d)/.exec(courseCode);
  return match ? Number(match[1]) : null;
}

function yearDistance(candidate: Candidate, yearOfStudy: number | null): number {
  if (yearOfStudy === null) return 0;
  const year = candidate.suggestedYear ?? firstDigit(candidate.code);
  if (year === null) return 0;
  return Math.abs(year - yearOfStudy);
}

function compareCandidates(left: Candidate, right: Candidate, remainingHalf: number, yearOfStudy: number | null): number {
  if (left.group !== right.group) return left.group - right.group;
  const year = yearDistance(left, yearOfStudy) - yearDistance(right, yearOfStudy);
  if (year !== 0) return year;
  const leftHalf = halfCredits(left.credits);
  const rightHalf = halfCredits(right.credits);
  const leftFits = leftHalf <= remainingHalf ? 0 : 1;
  const rightFits = rightHalf <= remainingHalf ? 0 : 1;
  if (leftFits !== rightFits) return leftFits - rightFits;
  const distance = Math.abs(leftHalf - remainingHalf) - Math.abs(rightHalf - remainingHalf);
  if (distance !== 0) return distance;
  return left.code.localeCompare(right.code);
}

function lexSmaller(left: number[], right: number[]): boolean {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index++) {
    if (left[index]! < right[index]!) return true;
    if (left[index]! > right[index]!) return false;
  }
  return left.length < right.length;
}

function overlapsAvoid(section: Section, avoid: AvoidRange[]): boolean {
  for (const meeting of timedMeetings(section)) {
    for (const range of avoid) {
      if (meeting.day !== range.day || meeting.startMinutes === null || meeting.endMinutes === null) continue;
      if (meeting.startMinutes < range.endMinutes && range.startMinutes < meeting.endMinutes) return true;
    }
  }
  return false;
}

function sectionsOverlap(left: Section, right: Section): boolean {
  for (const a of timedMeetings(left)) {
    if (a.day === null || a.startMinutes === null || a.endMinutes === null) continue;
    for (const b of timedMeetings(right)) {
      if (b.day === null || b.startMinutes === null || b.endMinutes === null) continue;
      if (meetingsOverlap(
        { day: a.day, startMinutes: a.startMinutes, endMinutes: a.endMinutes },
        { day: b.day, startMinutes: b.startMinutes, endMinutes: b.endMinutes },
      )) {
        return true;
      }
    }
  }
  return false;
}

function blockedCodes(plan: StudyPlan | null, stream: string | null): Set<string> {
  const blocked = new Set<string>();
  if (!plan) return blocked;
  const named = stream !== null && stream.length > 0 ? stream : null;
  const automatic = new Set(
    automaticCourses(plan, named).map((course) => course.catalogueCode).filter((code): code is string => code !== null),
  );
  for (const course of plan.courses) {
    if (course.catalogueCode === null || automatic.has(course.catalogueCode)) continue;
    if (course.verification !== "verified" || course.kind === "required-elective") {
      blocked.add(course.catalogueCode);
    }
  }
  return blocked;
}

function suggestedYearFor(plan: StudyPlan | null, code: string): number | null {
  if (!plan) return null;
  const row = plan.courses.find((course) => course.catalogueCode === code && course.suggestedYear !== null);
  return row?.suggestedYear ?? null;
}

export function rankAdditions(input: {
  catalogue: Catalogue;
  credits: CreditBook;
  profile: RankProfile;
  plan: StudyPlan | null;
  stream: string | null;
  chosenKeys: string[];
  heldCodes: string[];
  creditTarget: number;
  geCount: number;
  geAtLeast: boolean;
  avoid: AvoidRange[];
}): { keys: string[]; selections: CourseSelection[]; gapReason: GapReason } {
  const { catalogue, credits, profile, plan, avoid } = input;
  const stream = input.stream !== null && input.stream.length > 0 ? input.stream : null;
  const held = new Set(input.heldCodes);
  const chosen = new Set(input.chosenKeys.map((key) => parseSectionKey(key).courseCode));
  const byKey = new Map<string, Section>();
  const byCourse = new Map<string, Section[]>();
  const geCodes = new Set<string>();
  for (const section of catalogue.sections) {
    const key = sectionKey(section);
    byKey.set(key, section);
    const list = byCourse.get(section.courseCode) ?? [];
    list.push(section);
    byCourse.set(section.courseCode, list);
    if (section.courseType === "GE Course") geCodes.add(section.courseCode);
  }
  for (const list of byCourse.values()) {
    list.sort((left, right) => compareSectionNumber(left.section, right.section));
  }

  const claimsProfile = {
    majorCode: profile.majorCode,
    claims: profile.claims,
    yearOfStudy: profile.yearOfStudy,
  };
  const confirmed = new Map<string, boolean>();
  const isConfirmed = (code: string): boolean => {
    const cached = confirmed.get(code);
    if (cached !== undefined) return cached;
    for (const section of byCourse.get(code) ?? []) {
      if (timedMeetings(section).length === 0) continue;
      const key = sectionKey(section);
      if (validateSections([key], claimsProfile, catalogue, byKey).ok) {
        confirmed.set(code, true);
        return true;
      }
    }
    confirmed.set(code, false);
    return false;
  };

  let totalHalf = 0;
  for (const code of chosen) {
    const value = credits.creditsFor(code);
    if (value === null) continue;
    totalHalf += halfCredits(value);
  }
  const targetHalf = halfCredits(input.creditTarget);
  if (totalHalf >= targetHalf) {
    return { keys: [], selections: [], gapReason: "none" };
  }

  const blocked = blockedCodes(plan, stream);
  const dismissed = new Set<string>([...held, ...chosen, ...blocked]);
  const programme = profile.programme;

  const accept = (
    code: string,
    basis: SelectionBasis,
    detail: string,
    group: number,
    suggestedYear: number | null,
  ): Candidate | null => {
    if (dismissed.has(code)) return null;
    dismissed.add(code);
    const value = credits.creditsFor(code);
    if (value === null || value <= 0) return null;
    if (!isConfirmed(code)) return null;
    return { code, credits: value, basis, detail, suggestedYear, group };
  };

  const tiers: Candidate[][] = [[], [], [], [], []];
  const auto = plan ? automaticCourses(plan, stream) : [];
  for (const course of auto) {
    if (course.catalogueCode === null) continue;
    const basis: SelectionBasis =
      course.kind === "required-elective" ? "verified-required-elective" : "verified-compulsory";
    const group = course.kind === "required-elective" ? 1 : 0;
    const candidate = accept(course.catalogueCode, basis, plan?.source.title ?? "", group, course.suggestedYear);
    if (candidate) tiers[0]!.push(candidate);
  }

  const interestText = profile.interests?.trim() ?? "";
  const interestHits: { code: string; unit: string }[] = [];
  if (interestText.length > 0) {
    const seenHit = new Set<string>();
    for (const hit of searchSections(catalogue, interestText, WINDOW)) {
      if (seenHit.has(hit.courseCode)) continue;
      seenHit.add(hit.courseCode);
      interestHits.push({ code: hit.courseCode, unit: hit.unit });
    }
  }
  for (const hit of interestHits) {
    if (programme === null || hit.unit !== programme) continue;
    const candidate = accept(hit.code, "inferred-interest", interestText, 0, suggestedYearFor(plan, hit.code));
    if (candidate) tiers[1]!.push(candidate);
  }

  if (programme !== null) {
    const seenFaculty = new Set<string>();
    for (const section of catalogue.sections) {
      if (section.unit !== programme || seenFaculty.has(section.courseCode)) continue;
      seenFaculty.add(section.courseCode);
      const candidate = accept(
        section.courseCode,
        "inferred-faculty",
        programme,
        0,
        suggestedYearFor(plan, section.courseCode),
      );
      if (candidate) tiers[2]!.push(candidate);
    }
  }

  for (const hit of interestHits) {
    if (programme !== null && hit.unit === programme) continue;
    const candidate = accept(hit.code, "inferred-interest", interestText, 0, suggestedYearFor(plan, hit.code));
    if (candidate) tiers[3]!.push(candidate);
  }

  const seenOther = new Set<string>();
  for (const section of catalogue.sections) {
    if (seenOther.has(section.courseCode)) continue;
    seenOther.add(section.courseCode);
    const candidate = accept(
      section.courseCode,
      "general-elective",
      "Confirmed eligible",
      0,
      suggestedYearFor(plan, section.courseCode),
    );
    if (candidate) tiers[4]!.push(candidate);
  }

  const committed = [...input.chosenKeys];
  const selections: CourseSelection[] = [];
  let remainingHalf = targetHalf - totalHalf;
  let tierExceeded = false;
  const geExact = input.geCount > 0 && !input.geAtLeast;

  const firstLegal = (code: string): string | null => {
    for (const section of byCourse.get(code) ?? []) {
      const key = sectionKey(section);
      if (overlapsAvoid(section, avoid)) continue;
      if (validateSections([...committed, key], claimsProfile, catalogue, byKey).ok) return key;
    }
    return null;
  };

  const chosenGe = (): number => {
    let count = 0;
    for (const code of new Set(committed.map((key) => parseSectionKey(key).courseCode))) {
      if (geCodes.has(code)) count += 1;
    }
    return count;
  };

  for (const tier of tiers) {
    if (tier.length > WINDOW) tierExceeded = true;
    if (remainingHalf <= 0) break;
    const ordered = [...tier].sort((left, right) => compareCandidates(left, right, remainingHalf, profile.yearOfStudy));
    let cursor = 0;
    while (cursor < ordered.length && remainingHalf > 0) {
      const window: WindowCourse[] = [];
      while (window.length < WINDOW && cursor < ordered.length) {
        const candidate = ordered[cursor]!;
        cursor += 1;
        const key = firstLegal(candidate.code);
        if (key === null) continue;
        window.push({ ...candidate, key });
      }
      if (window.length === 0) break;
      const picked = chooseWindow(
        window,
        remainingHalf,
        geExact,
        input.geCount,
        chosenGe(),
        geCodes,
        committed,
        claimsProfile,
        catalogue,
        byKey,
      );
      for (const item of picked) {
        committed.push(item.key);
        selections.push({
          sectionKey: item.key,
          courseCode: item.code,
          basis: item.basis,
          detail: item.detail,
        });
        remainingHalf -= halfCredits(item.credits);
      }
    }
  }

  const gapReason: GapReason = remainingHalf <= 0 ? "none" : tierExceeded ? "search-bound" : "no-legal-course";
  return {
    keys: selections.map((row) => row.sectionKey),
    selections,
    gapReason,
  };
}

function chooseWindow(
  window: WindowCourse[],
  remainingHalf: number,
  geExact: boolean,
  geCount: number,
  geAlready: number,
  geCodes: Set<string>,
  committed: string[],
  claimsProfile: { majorCode: string; claims: PrerequisiteClaim[]; yearOfStudy: number | null },
  catalogue: Catalogue,
  byKey: Map<string, Section>,
): WindowCourse[] {
  const count = window.length;
  const conflict: number[] = Array.from({ length: count }, () => 0);
  for (let left = 0; left < count; left++) {
    const leftSection = byKey.get(window[left]!.key);
    if (!leftSection) continue;
    for (let right = left + 1; right < count; right++) {
      const rightSection = byKey.get(window[right]!.key);
      if (!rightSection || !sectionsOverlap(leftSection, rightSection)) continue;
      conflict[left] = (conflict[left] ?? 0) | (1 << right);
      conflict[right] = (conflict[right] ?? 0) | (1 << left);
    }
  }

  const passing: { half: number; ranks: number[]; items: WindowCourse[] }[] = [];
  for (let mask = 1; mask < 1 << count; mask++) {
    let half = 0;
    let geAdded = 0;
    let clash = false;
    const ranks: number[] = [];
    const items: WindowCourse[] = [];
    for (let index = 0; index < count; index++) {
      if ((mask & (1 << index)) === 0) continue;
      if (((conflict[index] ?? 0) & mask) !== 0) {
        clash = true;
        break;
      }
      const item = window[index]!;
      half += halfCredits(item.credits);
      if (geCodes.has(item.code)) geAdded += 1;
      ranks.push(index);
      items.push(item);
    }
    if (clash || half > remainingHalf) continue;
    if (geExact && geAdded > 0 && geAlready + geAdded > geCount) continue;
    passing.push({ half, ranks, items });
  }

  passing.sort(
    (left, right) => right.half - left.half || (lexSmaller(left.ranks, right.ranks) ? -1 : lexSmaller(right.ranks, left.ranks) ? 1 : 0),
  );

  for (const candidate of passing) {
    const keys = [...committed, ...candidate.items.map((item) => item.key)];
    if (validateSections(keys, claimsProfile, catalogue, byKey).ok) return candidate.items;
  }
  return [];
}
