import { describe, expect, it } from "vitest";
import { hueFor } from "../src/domain/hue";
import { validateSections, type RuleFailure } from "../src/domain/rules";
import type { Catalogue, Section } from "../src/domain/types";
import { buildWeek } from "../src/domain/week";

function section(partial: Pick<Section, "courseCode" | "section" | "meetings"> & Partial<Section>): Section {
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

function catalogue(sections: Section[]): Catalogue {
  return { sections, prerequisites: [], majors: [] };
}

const noFailures = { failures: [] as RuleFailure[] };

const FULL_WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

describe("buildWeek", () => {
  it("always returns Monday through Sunday and draws weekday blocks", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        title: "World History",
        meetings: [
          { day: "TUE", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 },
          { day: "FRI", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 },
        ],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["GELH1012:001"],
    });

    expect(week.days).toEqual(FULL_WEEK);
    expect(week.blocks).toHaveLength(2);
    expect(week.blocks.map((block) => block.day).sort()).toEqual(["FRI", "TUE"]);
    expect(week.blocks.every((block) => block.kind === "saved")).toBe(true);
    expect(week.blocks.every((block) => block.sectionKey === "GELH1012:001")).toBe(true);
  });

  it("draws a Saturday block while keeping all seven columns", () => {
    const saved = [
      section({
        courseCode: "CISC1000",
        section: "001",
        meetings: [{ day: "SAT", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["CISC1000:001"],
    });

    expect(week.days).toEqual(FULL_WEEK);
    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.day).toBe("SAT");
  });

  it("draws a Sunday block while keeping all seven columns", () => {
    const saved = [
      section({
        courseCode: "SUN1000",
        section: "001",
        meetings: [{ day: "SUN", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["SUN1000:001"],
    });

    expect(week.days).toEqual(FULL_WEEK);
    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.day).toBe("SUN");
  });

  it("draws no block for an untimed meeting and still returns seven columns", () => {
    const saved = [
      section({
        courseCode: "ENGL4000",
        section: "001",
        title: "Thesis",
        meetings: [
          { day: null, startMinutes: null, endMinutes: null },
          { day: "SAT", startMinutes: null, endMinutes: 12 * 60 },
        ],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["ENGL4000:001"],
    });

    expect(week.blocks).toEqual([]);
    expect(week.days).toEqual(FULL_WEEK);
  });

  it("gives both days of one course the same hue", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        meetings: [
          { day: "TUE", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 },
          { day: "FRI", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 },
        ],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["GELH1012:001"],
    });

    expect(week.blocks).toHaveLength(2);
    expect(week.blocks[0]?.hue).toBe(hueFor("GELH1012"));
    expect(week.blocks[1]?.hue).toBe(week.blocks[0]?.hue);
  });

  it("marks both blocks in a failed overlap report as conflicts", () => {
    const first = section({
      courseCode: "A",
      section: "001",
      title: "Alpha",
      meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
    });
    const second = section({
      courseCode: "B",
      section: "001",
      title: "Beta",
      meetings: [{ day: "MON", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
    });
    const report = validateSections(["A:001", "B:001"], { majorCode: "CLL19", completed: [] }, catalogue([first, second]));
    expect(report.ok).toBe(false);
    expect(report.failures.some((failure) => failure.rule === "overlap")).toBe(true);

    const week = buildWeek({
      saved: [first, second],
      proposal: null,
      savedKeys: ["A:001", "B:001"],
      failures: report.failures,
    });

    expect(week.blocks).toHaveLength(2);
    expect(week.blocks.every((block) => block.conflict)).toBe(true);
  });

  it("sets conflict false when the report passes", () => {
    const saved = [
      section({
        courseCode: "L",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ];
    const report = validateSections(["L:001"], { majorCode: "CLL19", completed: [] }, catalogue(saved));
    expect(report.ok).toBe(true);

    const week = buildWeek({
      saved,
      proposal: null,
      savedKeys: ["L:001"],
      failures: report.failures,
    });

    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.conflict).toBe(false);
  });

  it("exposes course code, title, and time on a block and has no pulse flag", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        title: "World History",
        meetings: [{ day: "TUE", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 }],
      }),
    ];
    const week = buildWeek({
      saved,
      ...noFailures,
      savedKeys: ["GELH1012:001"],
    });
    const block = week.blocks[0];

    expect(block?.courseCode).toBe("GELH1012");
    expect(block?.title).toBe("World History");
    expect(block?.startMinutes).toBe(13 * 60);
    expect(block?.endMinutes).toBe(14 * 60 + 15);
    expect(block).not.toHaveProperty("pulse");
  });

  it("marks a proposal section as proposal when its key is not saved", () => {
    const proposed = section({
      courseCode: "NEW1000",
      section: "001",
      meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const week = buildWeek({
      saved: [],
      proposal: [proposed],
      savedKeys: [],
      failures: [],
    });

    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.kind).toBe("proposal");
    expect(week.blocks[0]?.sectionKey).toBe("NEW1000:001");
  });

  it("marks a proposal section as saved when its key is already saved", () => {
    const proposed = section({
      courseCode: "KEEP1000",
      section: "001",
      meetings: [{ day: "WED", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
    });
    const week = buildWeek({
      saved: [],
      proposal: [proposed],
      savedKeys: ["KEEP1000:001"],
      failures: [],
    });

    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.kind).toBe("saved");
  });

  it("draws an empty week when the selected proposal has no sections", () => {
    const saved = section({
      courseCode: "GELH1012",
      section: "001",
      meetings: [{ day: "TUE", startMinutes: 13 * 60, endMinutes: 14 * 60 + 15 }],
    });
    const week = buildWeek({
      saved: [saved],
      proposal: [],
      savedKeys: ["GELH1012:001"],
      failures: [],
    });

    expect(week.blocks).toEqual([]);
    expect(week.days).toEqual(FULL_WEEK);
  });

  it("omits a saved section that the proposal drops", () => {
    const kept = section({
      courseCode: "KEEP1000",
      section: "001",
      meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const dropped = section({
      courseCode: "DROP1000",
      section: "001",
      meetings: [{ day: "TUE", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const week = buildWeek({
      saved: [kept, dropped],
      proposal: [kept],
      savedKeys: ["KEEP1000:001", "DROP1000:001"],
      failures: [],
    });

    expect(week.blocks.map((block) => block.sectionKey)).toEqual(["KEEP1000:001"]);
    expect(week.blocks[0]?.kind).toBe("saved");
  });

  it("draws a Saturday proposal block while keeping all seven columns", () => {
    const saved = section({
      courseCode: "WEEK1000",
      section: "001",
      meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const proposed = section({
      courseCode: "SAT1000",
      section: "001",
      meetings: [{ day: "SAT", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
    });
    const week = buildWeek({
      saved: [saved],
      proposal: [proposed],
      savedKeys: ["WEEK1000:001"],
      failures: [],
    });

    expect(week.days).toEqual(FULL_WEEK);
    expect(week.blocks).toHaveLength(1);
    expect(week.blocks[0]?.day).toBe("SAT");
    expect(week.blocks[0]?.kind).toBe("proposal");
  });
});

describe("buildWeek with preview block", () => {
  it("draws a preview block with kind 'preview' when preview section is provided", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        title: "World History",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 + 15 }],
      }),
    ];
    const preview = section({
      courseCode: "MATH1001",
      section: "001",
      title: "Calculus I",
      meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
    });

    const week = buildWeek({
      saved,
      failures: [],
      savedKeys: ["GELH1012:001"],
      preview,
    });

    const previewBlock = week.blocks.find((b) => b.courseCode === "MATH1001");
    expect(previewBlock).toBeDefined();
    expect(previewBlock?.kind).toBe("preview");
    expect(previewBlock?.conflict).toBe(false);
  });

  it("marks both saved and preview blocks as conflict when their meeting times overlap", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        title: "World History",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 + 15 }],
      }),
    ];
    const preview = section({
      courseCode: "MATH1001",
      section: "001",
      title: "Calculus I",
      meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    });

    const week = buildWeek({
      saved,
      failures: [],
      savedKeys: ["GELH1012:001"],
      preview,
    });

    const savedBlock = week.blocks.find((b) => b.courseCode === "GELH1012");
    const previewBlock = week.blocks.find((b) => b.courseCode === "MATH1001");
    expect(savedBlock?.conflict).toBe(true);
    expect(previewBlock?.conflict).toBe(true);
  });

  it("does not flag a preview that starts when the saved meeting ends", () => {
    const saved = [
      section({
        courseCode: "GELH1012",
        section: "001",
        title: "World History",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ];
    const preview = section({
      courseCode: "MATH1001",
      section: "001",
      title: "Calculus I",
      meetings: [{ day: "MON", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
    });

    const week = buildWeek({
      saved,
      failures: [],
      savedKeys: ["GELH1012:001"],
      preview,
    });

    expect(week.blocks.every((block) => block.conflict === false)).toBe(true);
  });
});
