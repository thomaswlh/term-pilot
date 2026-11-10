import { sectionKey, timedMeetings } from "./section";
import { searchSections, type SearchHit } from "./search";
import { ruleSentence, validateSections, type RuleFailure, type RuleWarning } from "./rules";
import type { Catalogue, Day, Section } from "./types";

export type AvoidRange = { day: Day; startMinutes: number; endMinutes: number };
export type PlanRequest = { topics: string[]; keep: string[]; drop: string[]; avoid: AvoidRange[] };
export type PlanDraft = {
  sectionKeys: string[];
  droppedWishes: string[];
  warnings: RuleWarning[];
  summary: string;
};
export type PlanOutcome = { proposal: PlanDraft } | { proposal: null; reason: string };

const TOPIC_TOKEN_RE = /[a-z0-9]+(?::[0-9]{2,3})?/g;

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

function hitMatchesTopicIdentity(hit: SearchHit, topicTokenSet: Set<string>): boolean {
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
  return catalogue.sections.some((s) => sectionKey(s) === key);
}

function sectionsByKey(catalogue: Catalogue): Map<string, Section> {
  const map = new Map<string, Section>();
  for (const s of catalogue.sections) {
    map.set(sectionKey(s), s);
  }
  return map;
}

function meetingOverlapsAvoid(
  meeting: { day: Day; startMinutes: number; endMinutes: number },
  avoid: AvoidRange,
): boolean {
  if (meeting.day !== avoid.day) {
    return false;
  }
  return meeting.startMinutes < avoid.endMinutes && avoid.startMinutes < meeting.endMinutes;
}

function sectionOverlapsAvoidRanges(key: string, catalogue: Catalogue, avoid: AvoidRange[]): boolean {
  const section = sectionsByKey(catalogue).get(key);
  if (!section) {
    return false;
  }
  for (const meeting of timedMeetings(section)) {
    const m = meeting as { day: Day; startMinutes: number; endMinutes: number };
    for (const range of avoid) {
      if (meetingOverlapsAvoid(m, range)) {
        return true;
      }
    }
  }
  return false;
}

function setsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}

function summarySentence(params: {
  currentKeys: string[];
  finalKeys: string[];
  droppedWishes: string[];
}): string {
  const currentSet = new Set(params.currentKeys);
  const finalSet = new Set(params.finalKeys);
  const added = [...finalSet].filter((k) => !currentSet.has(k)).sort();
  const removed = [...currentSet].filter((k) => !finalSet.has(k)).sort();
  const parts: string[] = [];
  if (added.length > 0) {
    parts.push(`added ${added.join(", ")}`);
  }
  if (removed.length > 0) {
    parts.push(`removed ${removed.join(", ")}`);
  }
  if (params.droppedWishes.length > 0) {
    parts.push(`dropped wishes: ${params.droppedWishes.join(", ")}`);
  }
  if (parts.length === 0) {
    return "No section changes.";
  }
  return `${parts.join("; ")}.`;
}

export function planRequest(input: {
  request: PlanRequest;
  currentKeys: string[];
  profile: { majorCode: string; completed: string[] };
  catalogue: Catalogue;
}): PlanOutcome {
  const { request, currentKeys, profile, catalogue } = input;
  const { topics, keep, drop, avoid } = request;

  for (const key of keep) {
    if (!catalogueHasKey(catalogue, key)) {
      return { proposal: null, reason: `Unknown section ${key}.` };
    }
  }
  for (const key of drop) {
    if (!catalogueHasKey(catalogue, key)) {
      return { proposal: null, reason: `Unknown section ${key}.` };
    }
  }

  const dropSet = new Set(drop);
  let keys = currentKeys.filter((k) => !dropSet.has(k));
  for (const k of keep) {
    if (!keys.includes(k)) {
      keys = [...keys, k];
    }
  }

  const baselineKeys = [...keys];

  const baselineReport = validateSections(keys, profile, catalogue);
  if (!baselineReport.ok) {
    return { proposal: null, reason: ruleSentence(baselineReport.failures[0] as RuleFailure) };
  }

  const droppedWishes: string[] = [];

  for (const topic of topics) {
    const hits = eligibleTopicHits(searchSections(catalogue, topic, 10), topic);
    if (hits.length === 0) {
      return { proposal: null, reason: `No sections found for ${topic}.` };
    }

    let sawLegalHit = false;
    let topicSatisfied = false;

    for (const hit of hits) {
      const hitKey = hit.sectionKey;
      const trialKeys = keys.includes(hitKey) ? [...keys] : [...keys, hitKey];
      const trialReport = validateSections(trialKeys, profile, catalogue);
      if (!trialReport.ok) {
        continue;
      }
      sawLegalHit = true;

      const overlapsAvoid = sectionOverlapsAvoidRanges(hitKey, catalogue, avoid);

      if (keys.includes(hitKey)) {
        if (!overlapsAvoid) {
          topicSatisfied = true;
          break;
        }
        continue;
      }

      if (!overlapsAvoid) {
        keys = trialKeys;
        topicSatisfied = true;
        break;
      }
    }

    if (!topicSatisfied) {
      if (!sawLegalHit) {
        return { proposal: null, reason: `No legal section for ${topic}.` };
      }
      droppedWishes.push(topic);
    }

    const afterTopicReport = validateSections(keys, profile, catalogue);
    if (!afterTopicReport.ok) {
      return { proposal: null, reason: ruleSentence(afterTopicReport.failures[0] as RuleFailure) };
    }
  }

  if (setsEqual(keys, currentKeys) && droppedWishes.length === 0) {
    return { proposal: null, reason: "Nothing to change." };
  }

  const finalReport = validateSections(keys, profile, catalogue);
  if (!finalReport.ok) {
    return { proposal: null, reason: ruleSentence(finalReport.failures[0] as RuleFailure) };
  }

  return {
    proposal: {
      sectionKeys: keys,
      droppedWishes,
      warnings: finalReport.warnings,
      summary: summarySentence({
        currentKeys,
        finalKeys: keys,
        droppedWishes,
      }),
    },
  };
}
