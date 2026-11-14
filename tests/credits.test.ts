import { describe, expect, it } from "vitest";
import {
  creditBook,
  creditReport,
  formatCourseCredits,
  formatCredits,
  miniature,
  type CreditRecord,
} from "../src/domain/credits";
import { hueFor } from "../src/domain/hue";
import type { Section } from "../src/domain/types";

const records: CreditRecord[] = [
  {
    courseCode: "GELH1012",
    credits: 3,
    sourceUrl: "https://isw.um.edu.mo/siwci/faces/courseDetailUG?courseCode=GELH1012",
    retrievedAt: "2026-11-10",
  },
  {
    courseCode: "GESB1001",
    credits: 1,
    sourceUrl: "https://isw.um.edu.mo/siwci/faces/courseDetailUG?courseCode=GESB1001",
    retrievedAt: "2026-11-10",
  },
  {
    courseCode: "CPED1001",
    credits: 0.5,
    sourceUrl: "https://isw.um.edu.mo/siwci/faces/courseDetailUG?courseCode=CPED1001",
    retrievedAt: "2026-11-10",
  },
];

const HUES = ["green", "amber", "teal", "blue"] as const;

function section(partial: Pick<Section, "courseCode" | "section" | "meetings">): Section {
  return {
    title: "Synthetic section",
    courseType: "",
    unit: "1",
    department: "FAH",
    teacher: "",
    notes: "",
    restriction: "",
    ...partial,
  };
}

describe("credit snapshot", () => {
  const book = creditBook(records);

  it("sums known courses once and lists unknown codes", () => {
    const report = creditReport(["GELH1012", "GELH1012", "GESB1001", "NOPE1000"], book);
    expect(report).toEqual({
      verifiedTotal: 4,
      unknownCourseCodes: ["NOPE1000"],
      status: "incomplete",
    });
    expect(formatCredits(report)).toBe("4 credits verified, NOPE1000 unknown");
  });

  it("formats a fractional total and a met total without calling a course 3 credits by count", () => {
    expect(formatCredits(creditReport(["CPED1001"], book))).toBe("0.5 credits");
    expect(formatCredits(creditReport(["GELH1012", "GESB1001"], book))).toBe("4 credits");
    expect(formatCourseCredits("NOPE1000", book)).toBe("credits unknown");
  });
});

describe("hueFor", () => {
  it("returns the same palette hue for the same course code", () => {
    const hue = hueFor("GELH1012");
    expect(hueFor("GELH1012")).toBe(hue);
    expect(HUES).toContain(hue);
  });
});

describe("miniature", () => {
  it("draws seven day columns with hue and vertical position and no course code text", () => {
    const view = miniature([
      section({
        courseCode: "GELH1012",
        section: "001",
        meetings: [
          { day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 + 45 },
          { day: "WED", startMinutes: 14 * 60, endMinutes: 15 * 60 },
          { day: "SAT", startMinutes: 9 * 60, endMinutes: 10 * 60 },
          { day: null, startMinutes: null, endMinutes: null },
        ],
      }),
    ]);

    expect(view.columns.map((column) => column.day)).toEqual(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]);

    const monday = view.columns[0]?.blocks ?? [];
    const wednesday = view.columns[2]?.blocks ?? [];
    const saturday = view.columns[5]?.blocks ?? [];
    expect(monday).toHaveLength(1);
    expect(wednesday).toHaveLength(1);
    expect(saturday).toHaveLength(1);
    expect(Object.keys(monday[0] ?? {}).sort()).toEqual(["hue", "top"]);
    expect(monday[0]?.hue).toBe(hueFor("GELH1012"));
    expect(wednesday[0]?.hue).toBe(hueFor("GELH1012"));
    expect(monday[0]?.top).toBeCloseTo((9 * 60 - 8 * 60) / (14 * 60), 5);
    expect(wednesday[0]?.top).toBeGreaterThan(monday[0]?.top ?? 0);

    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain("courseCode");
    expect(serialized).not.toContain("GELH1012");
    expect(view.columns.reduce((count, column) => count + column.blocks.length, 0)).toBe(3);
  });
});
