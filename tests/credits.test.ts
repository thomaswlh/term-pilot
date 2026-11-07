import { describe, expect, it } from "vitest";
import { demoCredits, miniature } from "../src/domain/credits";
import { hueFor } from "../src/domain/hue";
import type { Section } from "../src/domain/types";

const HUES = ["green", "amber", "teal", "blue"] as const;

function section(partial: Pick<Section, "courseCode" | "section" | "meetings">): Section {
  return {
    title: "Synthetic section",
    unit: "1",
    department: "FAH",
    teacher: "",
    notes: "",
    restriction: "",
    ...partial,
  };
}

describe("demoCredits", () => {
  it("counts 3 for each distinct course code and always labels Demo credits", () => {
    expect(demoCredits(["CSCI1004", "CSCI1004", "GELH1012"])).toEqual({
      total: 6,
      label: "Demo credits",
    });
  });

  it("returns zero Demo credits when there are no course codes", () => {
    expect(demoCredits([])).toEqual({ total: 0, label: "Demo credits" });
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
