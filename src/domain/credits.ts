import { timedMeetings } from "./section";
import { hueFor } from "./hue";
import type { HueName } from "./theme";
import type { Day, Section } from "./types";

const WEEK_DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_START_MINUTES = 8 * 60;
const DAY_SPAN_MINUTES = 14 * 60;

export type CreditRecord = {
  courseCode: string;
  credits: number;
  sourceUrl: string;
  retrievedAt: string;
};

export type CreditBook = {
  creditsFor(courseCode: string): number | null;
};

export type CreditReport = {
  verifiedTotal: number;
  unknownCourseCodes: string[];
  status: "verified" | "incomplete";
};

export type MiniatureBlock = {
  hue: HueName;
  top: number;
};

export type MiniatureColumn = {
  day: Day;
  blocks: MiniatureBlock[];
};

export function creditBook(records: CreditRecord[]): CreditBook {
  const byCode = new Map<string, number>();
  for (const record of records) {
    if (!Number.isFinite(record.credits)) continue;
    byCode.set(record.courseCode, record.credits);
  }
  return {
    creditsFor(courseCode: string) {
      return byCode.has(courseCode) ? byCode.get(courseCode)! : null;
    },
  };
}

export function creditValues(courseCodes: string[], book: CreditBook): Record<string, number> {
  const values: Record<string, number> = {};
  for (const courseCode of courseCodes) {
    if (Object.prototype.hasOwnProperty.call(values, courseCode)) continue;
    const credits = book.creditsFor(courseCode);
    if (credits !== null) values[courseCode] = credits;
  }
  return values;
}

export function creditBookFromValues(values: Record<string, number>): CreditBook {
  return {
    creditsFor(courseCode: string) {
      return Object.prototype.hasOwnProperty.call(values, courseCode) ? values[courseCode]! : null;
    },
  };
}

export function creditReport(courseCodes: string[], book: CreditBook): CreditReport {
  const unknownCourseCodes: string[] = [];
  let verifiedTotal = 0;
  for (const courseCode of new Set(courseCodes)) {
    const credits = book.creditsFor(courseCode);
    if (credits === null) unknownCourseCodes.push(courseCode);
    else verifiedTotal += credits;
  }
  unknownCourseCodes.sort();
  return {
    verifiedTotal,
    unknownCourseCodes,
    status: unknownCourseCodes.length === 0 ? "verified" : "incomplete",
  };
}

export function formatCreditNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

export function formatCredits(report: CreditReport): string {
  const total = formatCreditNumber(report.verifiedTotal);
  if (report.status === "verified") return `${total} credits`;
  return `${total} credits verified, ${report.unknownCourseCodes.join(", ")} unknown`;
}

export function formatCreditValue(credits: number | null): string {
  if (credits === null) return "credits unknown";
  return `${formatCreditNumber(credits)} credits`;
}

export function formatCourseCredits(courseCode: string, book: CreditBook): string {
  return formatCreditValue(book.creditsFor(courseCode));
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
