import type { Day, Meeting, Section } from "./types";

export function sectionKey(section: Pick<Section, "courseCode" | "section">): string {
  return `${section.courseCode}:${section.section}`;
}

export function parseSectionKey(key: string): { courseCode: string; section: string } {
  const idx = key.indexOf(":");
  if (idx === -1) {
    return { courseCode: key, section: "" };
  }
  return { courseCode: key.slice(0, idx), section: key.slice(idx + 1) };
}

export function timedMeetings(section: Section): Meeting[] {
  return section.meetings.filter(
    (meeting): meeting is Meeting & { day: Day; startMinutes: number; endMinutes: number } =>
      meeting.day !== null && meeting.startMinutes !== null && meeting.endMinutes !== null,
  );
}
