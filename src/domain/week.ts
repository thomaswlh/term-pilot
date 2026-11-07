import { hueFor } from "./hue";
import type { RuleFailure } from "./rules";
import type { HueName } from "./theme";
import type { Day, Meeting, Section } from "./types";

export type WeekBlock = {
  sectionKey: string;
  courseCode: string;
  title: string;
  day: Day;
  startMinutes: number;
  endMinutes: number;
  hue: HueName;
  kind: "saved" | "proposal" | "preview";
  conflict: boolean;
};

function meetingsOverlap(
  a: { day: Day; startMinutes: number; endMinutes: number },
  b: { day: Day; startMinutes: number; endMinutes: number },
): boolean {
  return a.day === b.day && a.startMinutes < b.endMinutes && b.startMinutes < a.endMinutes;
}

const ALL_DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function keyFor(section: Pick<Section, "courseCode" | "section">): string {
  return `${section.courseCode}:${section.section}`;
}

function drawnMeetings(
  section: Section,
): Array<Meeting & { day: Day; startMinutes: number; endMinutes: number }> {
  return section.meetings.filter(
    (meeting): meeting is Meeting & { day: Day; startMinutes: number; endMinutes: number } =>
      meeting.day !== null && meeting.startMinutes !== null && meeting.endMinutes !== null,
  );
}

function conflictKeys(failures: RuleFailure[]): Set<string> {
  const keys = new Set<string>();
  for (const failure of failures) {
    if (failure.rule === "overlap") {
      keys.add(failure.sectionKeys[0]);
      keys.add(failure.sectionKeys[1]);
      continue;
    }
    keys.add(failure.sectionKey);
  }
  return keys;
}

export function buildWeek(input: {
  saved: Section[];
  proposal?: Section[] | null;
  savedKeys: string[];
  failures: RuleFailure[];
  preview?: Section | null;
}): { days: Day[]; blocks: WeekBlock[] } {
  const drawn = input.proposal == null ? input.saved : input.proposal;
  const conflicts = conflictKeys(input.failures);
  const previewOverlapKeys = new Set<string>();

  if (input.preview != null) {
    const previewKey = keyFor(input.preview);
    const previewTimed = drawnMeetings(input.preview);
    for (const section of drawn) {
      const drawnKey = keyFor(section);
      for (const drawnMeeting of drawnMeetings(section)) {
        for (const previewMeeting of previewTimed) {
          if (meetingsOverlap(drawnMeeting, previewMeeting)) {
            previewOverlapKeys.add(drawnKey);
            previewOverlapKeys.add(previewKey);
          }
        }
      }
    }
  }

  const blocks: WeekBlock[] = [];

  for (const section of drawn) {
    const key = keyFor(section);
    const hue = hueFor(section.courseCode);
    const kind = input.savedKeys.includes(key) ? "saved" : "proposal";
    for (const meeting of drawnMeetings(section)) {
      blocks.push({
        sectionKey: key,
        courseCode: section.courseCode,
        title: section.title,
        day: meeting.day,
        startMinutes: meeting.startMinutes,
        endMinutes: meeting.endMinutes,
        hue,
        kind,
        conflict: conflicts.has(key) || previewOverlapKeys.has(key),
      });
    }
  }

  if (input.preview != null) {
    const key = keyFor(input.preview);
    const hue = hueFor(input.preview.courseCode);
    for (const meeting of drawnMeetings(input.preview)) {
      blocks.push({
        sectionKey: key,
        courseCode: input.preview.courseCode,
        title: input.preview.title,
        day: meeting.day,
        startMinutes: meeting.startMinutes,
        endMinutes: meeting.endMinutes,
        hue,
        kind: "preview",
        conflict: previewOverlapKeys.has(key),
      });
    }
  }

  return { days: [...ALL_DAYS], blocks };
}
