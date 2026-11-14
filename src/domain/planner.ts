import {
  automaticSkipSentence,
  heldCourseCodes,
  prerequisiteClaims,
  type CourseRecord,
  type CourseStatus,
} from "./academic";
import {
  creditReport,
  formatCreditNumber,
  type CreditBook,
  type CreditReport,
} from "./credits";
import { loadCreditBook } from "./credit-snapshot";
import { rankAdditions, type CourseSelection, type GapReason } from "./recommend";
import { parseSectionKey, sectionKey, timedMeetings } from "./section";
import { searchSections, type SearchHit } from "./search";
import { ruleSentence, validateSections, warningSentence, type RuleFailure, type RuleWarning } from "./rules";
import { automaticCourses, loadStudyPlan, type StudyPlan } from "./study-plan";
import type { Catalogue, Day, Section } from "./types";

export type AvoidRange = { day: Day; startMinutes: number; endMinutes: number };

export type PlanRequest = {
  topics?: string[];
  keep?: string[];
  drop?: string[];
  avoid?: AvoidRange[];
  geCount?: number;
  geAtLeast?: boolean;
  creditTarget?: number | null;
  chooseCourses?: boolean;
  candidates?: string[];
  stream?: string | null;
};

export type PlanCreditReport = CreditReport & {
  target: number | null;
  gap: number | null;
};

export type PlanDraft = {
  sectionKeys: string[];
  droppedWishes: string[];
  warnings: RuleWarning[];
  summary: string;
  credits: PlanCreditReport;
  storePreview: boolean;
  selections: CourseSelection[];
  gapReason: GapReason;
};

const GAP_WISH: Record<Exclude<GapReason, "none">, string> = {
  "needs-target": "A credit target is needed before more courses can be chosen.",
  "no-legal-course": "No further confirmed-eligible course fits the remaining credits.",
  "search-bound": "Some confirmed-eligible courses were not tried together, so the remaining credits may still be placeable.",
};

export type PlanOutcome = { proposal: PlanDraft } | { proposal: null; reason: string };

const TOPIC_TOKEN_RE = /[a-z0-9]+(?::[0-9]{2,3})?/g;
const COURSE_CODE_RE = /^[A-Za-z]+\d+$/;

function topicTokens(topic: string): string[] {
  return topic.toLowerCase().match(TOPIC_TOKEN_RE) ?? [];
}

function courseCodePrefix(courseCode: string): string {
  const match = courseCode.match(/^[A-Za-z]+/);
  return match ? match[0].toLowerCase() : "";
}

function instructorTokens(teacher: string): string[] {
  return teacher.toLowerCase().match(TOPIC_TOKEN_RE) ?? [];
}

function hitMatchesTopicIdentity(
  hit: Pick<SearchHit, "courseCode" | "sectionKey" | "teacher">,
  topicTokenSet: Set<string>,
): boolean {
  if (topicTokenSet.has(hit.courseCode.toLowerCase())) return true;
  if (topicTokenSet.has(hit.sectionKey.toLowerCase())) return true;
  const prefix = courseCodePrefix(hit.courseCode);
  if (prefix.length > 0 && topicTokenSet.has(prefix)) return true;
  for (const token of instructorTokens(hit.teacher)) {
    if (topicTokenSet.has(token)) return true;
  }
  return false;
}

function eligibleTopicHits(hits: SearchHit[], topic: string): SearchHit[] {
  const tokens = topicTokens(topic);
  if (tokens.length === 0) return [];
  const topicTokenSet = new Set(tokens);
  return hits.filter((hit) => hitMatchesTopicIdentity(hit, topicTokenSet));
}

function catalogueHasKey(catalogue: Catalogue, key: string): boolean {
  return catalogue.sections.some((section) => sectionKey(section) === key);
}

function sectionsByKey(catalogue: Catalogue): Map<string, Section> {
  const map = new Map<string, Section>();
  for (const section of catalogue.sections) {
    map.set(sectionKey(section), section);
  }
  return map;
}

function meetingOverlapsAvoid(
  meeting: { day: Day; startMinutes: number; endMinutes: number },
  avoid: AvoidRange,
): boolean {
  if (meeting.day !== avoid.day) return false;
  return meeting.startMinutes < avoid.endMinutes && avoid.startMinutes < meeting.endMinutes;
}

function sectionOverlapsAvoidRanges(key: string, byKey: Map<string, Section>, avoid: AvoidRange[]): boolean {
  const section = byKey.get(key);
  if (!section) return false;
  for (const meeting of timedMeetings(section)) {
    const timed = meeting as { day: Day; startMinutes: number; endMinutes: number };
    for (const range of avoid) {
      if (meetingOverlapsAvoid(timed, range)) return true;
    }
  }
  return false;
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function compareSectionNumber(a: string, b: string): number {
  const left = Number.parseInt(a, 10);
  const right = Number.parseInt(b, 10);
  if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
  return a.localeCompare(b);
}

function courseCodesOf(keys: string[]): string[] {
  return [...new Set(keys.map((key) => parseSectionKey(key).courseCode))];
}

function exactSectionKey(topic: string, catalogue: Catalogue): string | null {
  const trimmed = topic.trim();
  return catalogue.sections.some((section) => sectionKey(section) === trimmed) ? trimmed : null;
}

function exactCourseCode(topic: string, catalogue: Catalogue): string | null {
  const compact = topic.replace(/[^A-Za-z0-9]/g, "");
  if (!COURSE_CODE_RE.test(compact)) return null;
  const found = catalogue.sections.find(
    (section) => section.courseCode.toLowerCase() === compact.toLowerCase(),
  );
  return found?.courseCode ?? null;
}

function summarySentence(params: {
  currentKeys: string[];
  finalKeys: string[];
  droppedWishes: string[];
}): string {
  const currentSet = new Set(params.currentKeys);
  const finalSet = new Set(params.finalKeys);
  const added = [...finalSet].filter((key) => !currentSet.has(key)).sort();
  const removed = [...currentSet].filter((key) => !finalSet.has(key)).sort();
  const parts: string[] = [];
  if (added.length > 0) parts.push(`added ${added.join(", ")}`);
  if (removed.length > 0) parts.push(`removed ${removed.join(", ")}`);
  if (params.droppedWishes.length > 0) parts.push(`dropped wishes: ${params.droppedWishes.join(", ")}`);
  if (parts.length === 0) return "No section changes.";
  return `${parts.join("; ")}.`;
}

function creditSentence(report: PlanCreditReport): string | null {
  const total = formatCreditNumber(report.verifiedTotal);
  if (report.target === null) {
    if (report.status !== "verified") {
      return `Verified credits: ${total}, unknown: ${report.unknownCourseCodes.join(", ")}.`;
    }
    return `Verified credits: ${total}.`;
  }
  if (report.status !== "verified") {
    return `Verified credits: ${total}, unknown: ${report.unknownCourseCodes.join(", ")}. Credit target not confirmed.`;
  }
  if (report.verifiedTotal > report.target) {
    return `Requested courses exceed the target by ${formatCreditNumber(report.verifiedTotal - report.target)}.`;
  }
  if (report.verifiedTotal === report.target) return `Verified credits: ${total}. Target met.`;
  const gap = formatCreditNumber(report.gap ?? report.target - report.verifiedTotal);
  return `Verified credits: ${total}. Target ${formatCreditNumber(report.target)}, gap ${gap}.`;
}

function buildSummary(params: {
  currentKeys: string[];
  finalKeys: string[];
  droppedWishes: string[];
  credits: PlanCreditReport;
  warnings: RuleWarning[];
  selections: CourseSelection[];
}): string {
  const parts = [summarySentence(params)];
  for (const selection of params.selections) {
    parts.push(`${selection.courseCode} added as ${selection.basis}.`);
  }
  const line = creditSentence(params.credits);
  if (line) parts.push(line);
  for (const warning of params.warnings) {
    parts.push(warningSentence(warning));
  }
  return parts.join(" ");
}

function profileClaims(profile: { majorCode: string; courses: CourseRecord[]; yearOfStudy?: number | null }) {
  return {
    majorCode: profile.majorCode,
    claims: prerequisiteClaims(profile.courses),
    yearOfStudy: profile.yearOfStudy,
  };
}

export function planRequest(input: {
  request: PlanRequest;
  savedKeys?: string[];
  currentKeys: string[];
  seedUnmet?: string[];
  profile: {
    majorCode: string;
    courses: CourseRecord[];
    yearOfStudy?: number | null;
    interests?: string | null;
  };
  catalogue: Catalogue;
  credits?: CreditBook;
  plan?: StudyPlan | null;
}): PlanOutcome {
  const { request, currentKeys, profile, catalogue } = input;
  const savedKeys = input.savedKeys ?? currentKeys;
  const credits = input.credits ?? loadCreditBook();
  const topics = request.topics ?? [];
  const keep = request.keep ?? [];
  const drop = request.drop ?? [];
  const avoid = request.avoid ?? [];
  const geCount = request.geCount ?? 0;
  const geAtLeast = request.geAtLeast ?? false;
  const geExact = geCount > 0 && !geAtLeast;
  const creditTarget = request.creditTarget ?? null;
  const chooseCourses = request.chooseCourses ?? false;
  const stream = request.stream ?? null;
  const plan = input.plan === undefined ? loadStudyPlan(profile.majorCode) : input.plan;
  const programme = catalogue.majors.find((major) => major.code === profile.majorCode)?.programme ?? null;
  const byKey = sectionsByKey(catalogue);
  const geCodes = new Set<string>();
  for (const section of catalogue.sections) {
    if (section.courseType === "GE Course") geCodes.add(section.courseCode);
  }
  const geCourseCount = (sectionKeys: string[]) =>
    courseCodesOf(sectionKeys).filter((code) => geCodes.has(code)).length;

  const droppedWishes: string[] = [...(input.seedUnmet ?? [])];
  const declaredWarnings: RuleWarning[] = [];
  const held = new Set(heldCourseCodes(profile.courses));
  const statusByCode = new Map<string, CourseStatus>();
  for (const course of profile.courses) {
    if (!statusByCode.has(course.courseCode)) statusByCode.set(course.courseCode, course.status);
  }
  const skippedHeld = new Set<string>();
  const noteHeld = (code: string): boolean => {
    if (!held.has(code)) return false;
    if (!skippedHeld.has(code)) {
      skippedHeld.add(code);
      const status = statusByCode.get(code);
      if (status) droppedWishes.push(automaticSkipSentence(code, status));
    }
    return true;
  };
  const sectionsInNumberOrder = (code: string): string[] =>
    catalogue.sections
      .filter((section) => section.courseCode === code)
      .sort((a, b) => compareSectionNumber(a.section, b.section))
      .map((section) => sectionKey(section));
  for (const key of keep) {
    if (!catalogueHasKey(catalogue, key)) droppedWishes.push(`Unknown section ${key}.`);
  }
  for (const key of drop) {
    if (!catalogueHasKey(catalogue, key)) droppedWishes.push(`Unknown section ${key}.`);
  }

  const dropSet = new Set(drop.filter((key) => catalogueHasKey(catalogue, key)));
  let keys = currentKeys.filter((key) => !dropSet.has(key));
  const keptNew: string[] = [];
  for (const key of keep) {
    if (catalogueHasKey(catalogue, key) && !keys.includes(key)) {
      keys = [...keys, key];
      if (!currentKeys.includes(key)) keptNew.push(key);
    }
  }

  if (keys.length > 0) {
    const baseline = validateSections(keys, profileClaims(profile), catalogue, byKey);
    if (!baseline.ok) return { proposal: null, reason: ruleSentence(baseline.failures[0] as RuleFailure) };
  }

  const topicTokenSetFor = (topic: string) => new Set(topicTokens(topic));

  const chosenSatisfies = (topic: string): boolean => {
    const topicTokenSet = topicTokenSetFor(topic);
    if (topicTokenSet.size === 0) return false;
    return keys.some((key) => {
      const section = byKey.get(key);
      if (!section) return false;
      const matches = hitMatchesTopicIdentity(
        { courseCode: section.courseCode, sectionKey: key, teacher: section.teacher },
        topicTokenSet,
      );
      return matches && !sectionOverlapsAvoidRanges(key, byKey, avoid);
    });
  };

  const orderedTopicKeys = (
    topic: string,
  ): { keys: string[]; directHeld: boolean } | { identity: true } | { missing: true } => {
    const exactKey = exactSectionKey(topic, catalogue);
    if (exactKey) {
      const code = parseSectionKey(exactKey).courseCode;
      if (held.has(code)) return { keys: sectionsInNumberOrder(code), directHeld: true };
      return { keys: [exactKey], directHeld: false };
    }
    const exact = exactCourseCode(topic, catalogue);
    if (exact) return { keys: sectionsInNumberOrder(exact), directHeld: held.has(exact) };
    const searched = searchSections(catalogue, topic, 10);
    if (searched.length === 0) return { missing: true };
    const identity = eligibleTopicHits(searched, topic);
    if (identity.length === 0) return { identity: true };
    return { keys: identity.map((hit) => hit.sectionKey), directHeld: false };
  };

  for (const topic of topics) {
    if (chosenSatisfies(topic)) continue;
    const topicTokenSet = topicTokenSetFor(topic);
    const retainedInAvoid = keys.filter((key) => {
      const section = byKey.get(key);
      if (!section) return false;
      const matches = hitMatchesTopicIdentity(
        { courseCode: section.courseCode, sectionKey: key, teacher: section.teacher },
        topicTokenSet,
      );
      return matches && sectionOverlapsAvoidRanges(key, byKey, avoid);
    });
    for (const key of retainedInAvoid) {
      const wish = `${key} is in a time you want to avoid.`;
      if (!droppedWishes.includes(wish)) droppedWishes.push(wish);
    }
    const ordered = orderedTopicKeys(topic);
    if ("missing" in ordered) {
      droppedWishes.push(`No sections found for ${topic}.`);
      continue;
    }
    if ("identity" in ordered) {
      droppedWishes.push(`No course identity for ${topic}.`);
      continue;
    }

    let sawLegal = false;
    let sawUntimed = false;
    let sawOther = false;
    let sawNonHeld = false;
    let placed = false;
    let cited: RuleFailure | null = null;
    const heldCodes: string[] = [];
    const alreadyChosen = new Map<string, string[]>();

    for (const hitKey of ordered.keys) {
      const code = parseSectionKey(hitKey).courseCode;
      if (!held.has(code)) sawNonHeld = true;
      if (!keys.includes(hitKey) && courseCodesOf(keys).includes(code)) {
        const existing = keys.filter((key) => parseSectionKey(key).courseCode === code);
        alreadyChosen.set(code, existing);
        continue;
      }
      if (held.has(code) && !ordered.directHeld) {
        if (!heldCodes.includes(code)) heldCodes.push(code);
        continue;
      }
      const trialKeys = keys.includes(hitKey) ? keys : [...keys, hitKey];
      const trial = validateSections(trialKeys, profileClaims(profile), catalogue, byKey);
      if (!trial.ok) {
        for (const failure of trial.failures) {
          cited ??= failure;
          if (failure.rule === "untimed") sawUntimed = true;
          else sawOther = true;
        }
        continue;
      }
      sawLegal = true;
      if (sectionOverlapsAvoidRanges(hitKey, byKey, avoid)) continue;
      const newlyPlaced = !keys.includes(hitKey);
      if (newlyPlaced) keys = trialKeys;
      placed = true;
      if (newlyPlaced && ordered.directHeld && held.has(code)) {
        const status = statusByCode.get(code);
        if (status) {
          declaredWarnings.push({
            rule: "declared-status",
            sectionKey: hitKey,
            courseCode: code,
            status,
          });
        }
      }
      break;
    }

    const everyHitHeld = !ordered.directHeld && heldCodes.length > 0 && !sawNonHeld;
    if (everyHitHeld) {
      for (const code of heldCodes) noteHeld(code);
    }
    if (placed) continue;
    if (retainedInAvoid.length > 0) continue;
    if (everyHitHeld && !sawLegal && !sawUntimed && !sawOther) continue;
    if (!sawLegal) {
      if (sawUntimed && !sawOther) {
        droppedWishes.push(`No timed section for ${topic}.`);
        continue;
      }
      if (alreadyChosen.size > 0 && cited === null && !sawUntimed && !sawOther) {
        for (const [code, existing] of alreadyChosen) {
          const wish = `${code} is already on this timetable as ${existing.join(", ")}.`;
          if (!droppedWishes.includes(wish)) droppedWishes.push(wish);
        }
        continue;
      }
      const failure = cited ?? ({ rule: "no-sections" } as const);
      droppedWishes.push(`No legal section for ${topic}. ${ruleSentence(failure)}`);
      continue;
    }
    droppedWishes.push(`${topic} overlaps a time to avoid.`);
  }

  const courseChosen = (code: string) => courseCodesOf(keys).includes(code);
  const isGeCourse = (code: string) => geCodes.has(code);

  const placeable = (key: string): boolean => {
    if (sectionOverlapsAvoidRanges(key, byKey, avoid)) return false;
    const trialKeys = keys.includes(key) ? keys : [...keys, key];
    return validateSections(trialKeys, profileClaims(profile), catalogue, byKey).ok;
  };

  const addGeCourse = (code: string): boolean => {
    if (courseChosen(code)) return false;
    if (noteHeld(code)) return false;
    const sections = catalogue.sections
      .filter((section) => section.courseCode === code && section.courseType === "GE Course")
      .sort((a, b) => compareSectionNumber(a.section, b.section));
    for (const section of sections) {
      const key = sectionKey(section);
      if (!placeable(key)) continue;
      keys = [...keys, key];
      return true;
    }
    return false;
  };

  const geAlready = () => geCourseCount(keys);

  if (geCount > geAlready()) {
    for (const topic of topics) {
      if (geCount <= geAlready()) break;
      const code = exactCourseCode(topic, catalogue);
      if (!code || !isGeCourse(code)) continue;
      addGeCourse(code);
    }
    const compulsoryGe = plan
      ? automaticCourses(plan, stream)
          .filter((course) => course.kind === "compulsory-general-education" && course.catalogueCode !== null)
          .map((course) => course.catalogueCode as string)
      : [];
    const geTier = (section: Section): number => {
      if (compulsoryGe.includes(section.courseCode)) return 0;
      if (programme !== null && section.unit === programme) return 1;
      return 2;
    };
    const geSections = catalogue.sections
      .filter((section) => section.courseType === "GE Course")
      .sort((a, b) => {
        const tier = geTier(a) - geTier(b);
        if (tier !== 0) return tier;
        if (geTier(a) === 0) {
          const planOrder = compulsoryGe.indexOf(a.courseCode) - compulsoryGe.indexOf(b.courseCode);
          if (planOrder !== 0) return planOrder;
        }
        return a.courseCode.localeCompare(b.courseCode) || compareSectionNumber(a.section, b.section);
      });
    const settled = new Set<string>();
    for (const section of geSections) {
      if (geCount <= geAlready()) break;
      if (settled.has(section.courseCode) || courseChosen(section.courseCode)) {
        settled.add(section.courseCode);
        continue;
      }
      if (noteHeld(section.courseCode)) {
        settled.add(section.courseCode);
        continue;
      }
      const key = sectionKey(section);
      if (!placeable(key)) continue;
      keys = [...keys, key];
      settled.add(section.courseCode);
    }
  }

  if (stream !== null && stream.length > 0) {
    const matches = plan?.courses.some((course) => course.stream === stream) ?? false;
    if (!matches) droppedWishes.push(`No reviewed stream matches ${stream}.`);
  }

  let selections: CourseSelection[] = [];
  let gapReason: GapReason = "none";
  if (chooseCourses && creditTarget === null) {
    gapReason = "needs-target";
    droppedWishes.push(GAP_WISH["needs-target"]);
  } else if (chooseCourses && creditTarget !== null) {
    for (const code of courseCodesOf(keys)) {
      if (credits.creditsFor(code) !== null) continue;
      droppedWishes.push(`${code} has unknown credits.`);
    }
    const ranked = rankAdditions({
      catalogue,
      credits,
      profile: {
        majorCode: profile.majorCode,
        programme,
        yearOfStudy: profile.yearOfStudy ?? null,
        interests: profile.interests ?? null,
        claims: prerequisiteClaims(profile.courses),
      },
      plan,
      stream,
      chosenKeys: keys,
      heldCodes: [...held],
      creditTarget,
      geCount,
      geAtLeast,
      avoid,
    });
    keys = [...keys, ...ranked.keys];
    selections = ranked.selections;
    gapReason = ranked.gapReason;
    if (gapReason !== "none") droppedWishes.push(GAP_WISH[gapReason]);
  }

  const finishedGe = geAlready();
  if (geCount > 0 && finishedGe < geCount) {
    droppedWishes.push(`Need ${geCount - finishedGe} more GE course(s).`);
  }
  if (geExact && finishedGe > geCount) {
    droppedWishes.push(`This set has ${finishedGe} GE courses; you asked for ${geCount}.`);
  }
  for (const key of keys) {
    if (!sectionOverlapsAvoidRanges(key, byKey, avoid)) continue;
    const wish = `${key} is in a time you want to avoid.`;
    if (!droppedWishes.includes(wish)) droppedWishes.push(wish);
  }

  let warnings: RuleWarning[] = [];
  if (keys.length > 0) {
    const finalReport = validateSections(keys, profileClaims(profile), catalogue, byKey);
    if (!finalReport.ok) return { proposal: null, reason: ruleSentence(finalReport.failures[0] as RuleFailure) };
    for (const key of keptNew) {
      if (!keys.includes(key)) continue;
      const code = parseSectionKey(key).courseCode;
      if (!held.has(code)) continue;
      const status = statusByCode.get(code);
      if (!status) continue;
      declaredWarnings.push({
        rule: "declared-status",
        sectionKey: key,
        courseCode: code,
        status,
      });
    }
    warnings = [...finalReport.warnings, ...declaredWarnings];
  } else {
    warnings = [...declaredWarnings];
  }

  const creditBase = creditReport(courseCodesOf(keys), credits);
  const gap =
    creditBase.status === "verified" && creditTarget !== null && creditBase.verifiedTotal <= creditTarget
      ? creditTarget - creditBase.verifiedTotal
      : null;
  const planCredits: PlanCreditReport = { ...creditBase, target: creditTarget, gap };

  return {
    proposal: {
      sectionKeys: keys,
      droppedWishes,
      warnings,
      summary: buildSummary({
        currentKeys,
        finalKeys: keys,
        droppedWishes,
        credits: planCredits,
        warnings,
        selections,
      }),
      credits: planCredits,
      storePreview: !setsEqual(keys, savedKeys),
      selections,
      gapReason,
    },
  };
}
