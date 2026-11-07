import { timedMeetings } from "./section";
import { hueFor } from "./hue";
import type { HueName } from "./theme";
import type { Day, Section } from "./types";

const WEEK_DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_START_MINUTES = 8 * 60;
const DAY_SPAN_MINUTES = 14 * 60;

export type MiniatureBlock = {
  hue: HueName;
  top: number;
};

export type MiniatureColumn = {
  day: Day;
  blocks: MiniatureBlock[];
};

export function demoCredits(courseCodes: string[]): { total: number; label: "Demo credits" } {
  return { total: new Set(courseCodes).size * 3, label: "Demo credits" };
}

export function miniature(sections: Section[]): { columns: MiniatureColumn[] } {
  const columns: MiniatureColumn[] = WEEK_DAYS.map((day) => ({ day, blocks: [] }));
  const byDay = new Map(columns.map((column) => [column.day, column]));

  for (const section of sections) {
    for (const meeting of timedMeetings(section)) {
      if (meeting.day === null || meeting.startMinutes === null) continue;
      const column = byDay.get(meeting.day);
      if (!column) continue;
      const raw = (meeting.startMinutes - DAY_START_MINUTES) / DAY_SPAN_MINUTES;
      column.blocks.push({
        hue: hueFor(section.courseCode),
        top: Math.min(1, Math.max(0, raw)),
      });
    }
  }

  return { columns };
}
