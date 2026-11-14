import { describe, expect, it } from "vitest";
import { completedClaims, prerequisiteReportedSentence } from "../src/domain/academic";
import { loadCatalogue, timedMeetings } from "../src/domain/catalogue";
import type { Catalogue, PrereqRow, Section } from "../src/domain/types";
import {
  majorTokens,
  ruleSentence,
  validateSections,
  warningSentence,
  type RuleFailure,
} from "../src/domain/rules";

function makeSection(overrides: Partial<Section> & Pick<Section, "courseCode" | "section">): Section {
  return {
    title: "",
    courseType: "",
    unit: "",
    department: "",
    teacher: "",
    notes: "",
    restriction: "",
    meetings: [],
    ...overrides,
  };
}

function makeCatalogue(
  sections: Section[],
  prerequisites: PrereqRow[] = [],
  majors: Catalogue["majors"] = [],
): Catalogue {
  return { sections, prerequisites, majors, specializations: [] };
}

function knownMajor(code: string, programme: string): Catalogue["majors"][number] {
  return { code, name: code, programme };
}

function need1Catalogue(): Catalogue {
  return makeCatalogue(
    [
      makeSection({
        courseCode: "NEED1",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ],
    [
      {
        courseCode: "NEED1",
        preRequisiteFor: "ALL",
        majorList: "",
        requiredCount: 1,
        groupNo: "G1",
        requiredCourseCode: "CHLL1003",
      },
      {
        courseCode: "NEED1",
        preRequisiteFor: "ALL",
        majorList: "",
        requiredCount: 1,
        groupNo: "G1",
        requiredCourseCode: "CHLL1004",
      },
    ],
  );
}

describe("rules", () => {
  it("returns both timed meetings for one section with two timed rows", () => {
    const section = makeSection({
      courseCode: "TEST",
      section: "001",
      meetings: [
        { day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 },
        { day: "TUE", startMinutes: 14 * 60, endMinutes: 15 * 60 },
      ],
    });
    expect(timedMeetings(section)).toHaveLength(2);
  });

  it("allows adjacent meetings on Monday 10:00–11:00 and 11:00–12:00 (no overlap)", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "A",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "B",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
      }),
    ]);
    const r = validateSections(["A:001", "B:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(r.failures.filter((f) => f.rule === "overlap")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("flags overlap for Monday 10:00–11:15 and 11:00–12:00", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "A",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 + 15 }],
      }),
      makeSection({
        courseCode: "B",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 11 * 60, endMinutes: 12 * 60 }],
      }),
    ]);
    const r = validateSections(["A:001", "B:001"], { majorCode: "CLL19", claims: [] }, cat);
    const overlaps = r.failures.filter((f) => f.rule === "overlap") as Extract<
      RuleFailure,
      { rule: "overlap" }
    >[];
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].sectionKeys.sort()).toEqual(["A:001", "B:001"].sort());
    expect(r.ok).toBe(false);
  });

  it("rejects two sections of one course and still allows two different courses", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "CHLL1000",
        section: "001",
        meetings: [{ day: "FRI", startMinutes: 16 * 60, endMinutes: 17 * 60 + 15 }],
      }),
      makeSection({
        courseCode: "CHLL1000",
        section: "002",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
      makeSection({
        courseCode: "MATH1001",
        section: "001",
        meetings: [{ day: "TUE", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ]);
    const duplicate = validateSections(
      ["CHLL1000:002", "CHLL1000:001"],
      { majorCode: "CLL19", claims: [] },
      cat,
    );
    expect(duplicate.ok).toBe(false);
    expect(duplicate.failures).toContainEqual({
      rule: "duplicate-course",
      courseCode: "CHLL1000",
      sectionKeys: ["CHLL1000:001", "CHLL1000:002"],
    });
    expect(ruleSentence(duplicate.failures[0]!)).toBe(
      "Course CHLL1000 already has a section on this timetable (CHLL1000:001, CHLL1000:002).",
    );

    const distinct = validateSections(
      ["CHLL1000:001", "MATH1001:001"],
      { majorCode: "CLL19", claims: [] },
      cat,
    );
    expect(distinct.ok).toBe(true);
    expect(distinct.failures).toEqual([]);
  });

  it("does not treat the same section key twice as two sections of a course", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "A",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const report = validateSections(["A:001", "A:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(report.failures.filter((failure) => failure.rule === "duplicate-course")).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("allows empty restriction text", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "X",
        section: "001",
        restriction: "",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ]);
    const r = validateSections(["X:001"], { majorCode: "CPS19", claims: [] }, cat);
    expect(r.failures.filter((f) => f.rule === "class-for" || f.rule === "class-not-for")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("Class for : with no readable alternative is unverified (CLL19)", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "EMPTY",
        section: "001",
        restriction: "Class for :",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ]);
    const r = validateSections(["EMPTY:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(r.failures).toContainEqual({
      rule: "eligibility-unverified",
      sectionKey: "EMPTY:001",
      need: "uninterpreted",
    });
    expect(r.ok).toBe(false);
  });

  it("Class for : FAH - CLL19 allows CLL19 and fails CPS19 with class-for", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "X",
        section: "001",
        restriction: "Class for : FAH - CLL19",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ],
    [],
    [knownMajor("CLL19", "FAH")],
    );
    expect(validateSections(["X:001"], { majorCode: "CLL19", claims: [] }, cat).ok).toBe(true);
    const r2 = validateSections(["X:001"], { majorCode: "CPS19", claims: [] }, cat);
    expect(r2.failures).toContainEqual({ rule: "class-for", sectionKey: "X:001" });
    expect(r2.ok).toBe(false);
    const r3 = validateSections(["X:001"], { majorCode: "CLL190", claims: [] }, cat);
    expect(r3.failures).toContainEqual({ rule: "class-for", sectionKey: "X:001" });
    expect(r3.ok).toBe(false);
  });

  it("Class not for : FAH - JAP19 / JAP25 blocks JAP25 and allows CLL19", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "X",
        section: "001",
        restriction: "Class not for : FAH - JAP19 / JAP25",
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ],
    [],
    [knownMajor("JAP19", "FAH"), knownMajor("JAP25", "FAH")],
    );
    expect(validateSections(["X:001"], { majorCode: "CLL19", claims: [] }, cat).ok).toBe(true);
    const r2 = validateSections(["X:001"], { majorCode: "JAP25", claims: [] }, cat);
    expect(r2.failures).toContainEqual({ rule: "class-not-for", sectionKey: "X:001" });
    expect(r2.ok).toBe(false);
  });

  it("text with both phrases leaves filler in the class-not-for body unverified", () => {
    const text =
      "Class not for : FAH - JAP19 / JAP25 some text Class for : FAH - CLL19";
    const cat = makeCatalogue([
      makeSection({
        courseCode: "X",
        section: "001",
        restriction: text,
        meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
      }),
    ],
    [],
    [knownMajor("JAP19", "FAH"), knownMajor("JAP25", "FAH"), knownMajor("CLL19", "FAH")],
    );
    const jap = validateSections(["X:001"], { majorCode: "JAP25", claims: [] }, cat);
    expect(jap.failures).toContainEqual({
      rule: "eligibility-unverified",
      sectionKey: "X:001",
      need: "uninterpreted",
    });
    expect(jap.ok).toBe(false);
    const cps = validateSections(["X:001"], { majorCode: "CPS19", claims: [] }, cat);
    expect(cps.failures).toContainEqual({
      rule: "eligibility-unverified",
      sectionKey: "X:001",
      need: "uninterpreted",
    });
    expect(cps.ok).toBe(false);
  });

  it("majorTokens: CLL1 does not match as CLL19 for token lists", () => {
    expect(majorTokens("PREFIX CLL1 SUFFIX CLL19")).toEqual(["CLL19"]);
  });

  it("majorTokens: CLL190 does not match CLL19 (no extra digit run)", () => {
    expect(majorTokens("CLL190")).toEqual([]);
  });

  it("need-1 group passes with either CHLL1003 or CHLL1004 and fails with neither", () => {
    const cat = need1Catalogue();
    expect(
      validateSections(["NEED1:001"], { majorCode: "CLL19", claims: completedClaims(["CHLL1003"]) }, cat).ok,
    ).toBe(true);
    expect(
      validateSections(["NEED1:001"], { majorCode: "CLL19", claims: completedClaims(["CHLL1004"]) }, cat).ok,
    ).toBe(true);
    const fail = validateSections(["NEED1:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(fail.failures.some((f) => f.rule === "prerequisite")).toBe(true);
    expect(fail.ok).toBe(false);
  });

  it("passes a one-course group from a recognized waiver and warns", () => {
    const cat = need1Catalogue();
    const report = validateSections(
      ["NEED1:001"],
      { majorCode: "CLL19", claims: [{ courseCode: "CHLL1003", basis: "waived" }] },
      cat,
    );
    expect(report.ok).toBe(true);
    expect(report.warnings).toContainEqual({
      rule: "prerequisite-student-reported",
      sectionKey: "NEED1:001",
      courseCode: "CHLL1003",
      basis: "waived",
    });
  });

  it("prefers a completed claim over a waiver in the same group", () => {
    const cat = need1Catalogue();
    const report = validateSections(
      ["NEED1:001"],
      {
        majorCode: "CLL19",
        claims: [
          { courseCode: "CHLL1003", basis: "completed" },
          { courseCode: "CHLL1004", basis: "waived" },
        ],
      },
      cat,
    );
    expect(report.ok).toBe(true);
    expect(report.warnings.some((warning) => warning.rule === "prerequisite-student-reported")).toBe(false);
  });

  it("fails a one-course group when a waiver checkbox is off and no claim is passed", () => {
    const cat = need1Catalogue();
    const report = validateSections(["NEED1:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(report.ok).toBe(false);
    expect(report.warnings.some((warning) => warning.rule === "prerequisite-student-reported")).toBe(false);
  });

  it("warningSentence names an unconfirmed group and a student-reported prerequisite", () => {
    expect(
      warningSentence({
        rule: "prerequisite-not-enforced",
        sectionKey: "PORT1001:001",
        groupNo: "G2",
        requiredCount: 2,
      }),
    ).toBe("Prerequisite group G2 for PORT1001:001 was not confirmed.");
    expect(
      warningSentence({
        rule: "prerequisite-student-reported",
        sectionKey: "NEED1:001",
        courseCode: "CHLL1003",
        basis: "waived",
      }),
    ).toBe(prerequisiteReportedSentence("NEED1:001", "CHLL1003", "waived"));
    expect(
      warningSentence({
        rule: "prerequisite-student-reported",
        sectionKey: "NEED1:001",
        courseCode: "CHLL1004",
        basis: "transfer",
      }),
    ).toBe(
      "Prerequisite for NEED1:001 uses your report that UM recognized CHLL1004 (a transfer equivalent). This is student-reported.",
    );
  });

  it("warningSentence labels a waived student-reported prerequisite as waived or tested out", () => {
    expect(
      warningSentence({
        rule: "prerequisite-student-reported",
        sectionKey: "NEED1:001",
        courseCode: "CHLL1003",
        basis: "waived",
      }),
    ).toBe(
      "Prerequisite for NEED1:001 uses your report that UM recognized CHLL1003 (waived or tested out). This is student-reported.",
    );
  });

  it("need-2 group warns prerequisite-not-enforced and ok stays true when need-1 group passes", () => {
    const cat = makeCatalogue(
      [
        makeSection({
          courseCode: "MIX",
          section: "001",
          meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
        }),
      ],
      [
        {
          courseCode: "MIX",
          preRequisiteFor: "ALL",
          majorList: "",
          requiredCount: 1,
          groupNo: "G1",
          requiredCourseCode: "CHLL1003",
        },
        {
          courseCode: "MIX",
          preRequisiteFor: "ALL",
          majorList: "",
          requiredCount: 2,
          groupNo: "G2",
          requiredCourseCode: "CPED1001",
        },
        {
          courseCode: "MIX",
          preRequisiteFor: "ALL",
          majorList: "",
          requiredCount: 2,
          groupNo: "G2",
          requiredCourseCode: "CPED1002",
        },
      ],
    );
    const r = validateSections(["MIX:001"], { majorCode: "CLL19", claims: completedClaims(["CHLL1003"]) }, cat);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.rule === "prerequisite-not-enforced" && w.groupNo === "G2")).toBe(
      true,
    );
    expect(r.failures).toEqual([]);
  });

  it("two rows in one group with required counts 1 and 2 warn and do not block", () => {
    const cat = makeCatalogue(
      [
        makeSection({
          courseCode: "W",
          section: "001",
          meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
        }),
      ],
      [
        {
          courseCode: "W",
          preRequisiteFor: "ALL",
          majorList: "",
          requiredCount: 1,
          groupNo: "G",
          requiredCourseCode: "AAA1001",
        },
        {
          courseCode: "W",
          preRequisiteFor: "ALL",
          majorList: "",
          requiredCount: 2,
          groupNo: "G",
          requiredCourseCode: "AAA1002",
        },
      ],
    );
    const r = validateSections(["W:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(r.warnings.some((w) => w.rule === "prerequisite-not-enforced" && w.groupNo === "G")).toBe(true);
    expect(r.failures.filter((f) => f.rule === "prerequisite")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("MAJOR row applies only when student major is a whole token in major list", () => {
    const cat = makeCatalogue(
      [
        makeSection({
          courseCode: "MAJ",
          section: "001",
          meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
        }),
      ],
      [
        {
          courseCode: "MAJ",
          preRequisiteFor: "MAJOR",
          majorList: "CLL19 CPS19",
          requiredCount: 1,
          groupNo: "ONLY",
          requiredCourseCode: "REQ1000",
        },
      ],
      [knownMajor("CLL19", "FAH"), knownMajor("CPS19", "FIC")],
    );
    const cpsFail = validateSections(["MAJ:001"], { majorCode: "CPS19", claims: [] }, cat);
    expect(cpsFail.failures.some((f) => f.rule === "prerequisite")).toBe(true);
    const other = validateSections(["MAJ:001"], { majorCode: "JAP25", claims: [] }, cat);
    expect(other.failures.filter((f) => f.rule === "prerequisite")).toEqual([]);
    const cll190 = validateSections(["MAJ:001"], { majorCode: "CLL190", claims: [] }, cat);
    expect(cll190.failures.filter((f) => f.rule === "prerequisite")).toEqual([]);
  });

  it("fails untimed when a section has no timed meeting", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "U",
        section: "001",
        meetings: [{ day: null, startMinutes: null, endMinutes: null }],
      }),
    ]);
    const r = validateSections(["U:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(r.failures).toContainEqual({ rule: "untimed", sectionKey: "U:001" });
    expect(r.ok).toBe(false);
  });

  it("one timed and one untimed meeting: only timed counts and can pass", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "MIXM",
        section: "001",
        meetings: [
          { day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 },
          { day: null, startMinutes: null, endMinutes: null },
        ],
      }),
    ]);
    expect(timedMeetings(cat.sections[0]!)).toHaveLength(1);
    const r = validateSections(["MIXM:001"], { majorCode: "CLL19", claims: [] }, cat);
    expect(r.failures.filter((f) => f.rule === "untimed")).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("ruleSentence overlap names both section keys; untimed mentions no weekly meeting", () => {
    const o: Extract<RuleFailure, { rule: "overlap" }> = {
      rule: "overlap",
      sectionKeys: ["P:001", "Q:002"],
    };
    const s = ruleSentence(o);
    expect(s).toContain("P:001");
    expect(s).toContain("Q:002");
    const u = ruleSentence({ rule: "untimed", sectionKey: "Z:001" });
    expect(u.toLowerCase()).toMatch(/no weekly meeting/);
  });

  const catalogue = loadCatalogue();

  it("workbook: CHLL2004:001 passes for CLL19 with CHLL1003; fails prerequisite with none", () => {
    const pass = validateSections(
      ["CHLL2004:001"],
      { majorCode: "CLL19", claims: completedClaims(["CHLL1003"]) },
      catalogue,
    );
    expect(pass.ok).toBe(true);
    const fail = validateSections(["CHLL2004:001"], { majorCode: "CLL19", claims: [] }, catalogue);
    expect(fail.failures.some((f) => f.rule === "prerequisite")).toBe(true);
    expect(fail.ok).toBe(false);
  });

  it("workbook: CHLL3000:001 for CPS19 is unverified because CLM25 is not a known major", () => {
    const r = validateSections(
      ["CHLL3000:001"],
      { majorCode: "CPS19", claims: [] },
      catalogue,
    );
    expect(r.failures).toContainEqual({
      rule: "eligibility-unverified",
      sectionKey: "CHLL3000:001",
      need: "uninterpreted",
    });
    expect(r.ok).toBe(false);
  });

  it("workbook: LAWS1003:201 for CLL19 includes class-for (WA17/WA25 have no brief tokens)", () => {
    const r = validateSections(["LAWS1003:201"], { majorCode: "CLL19", claims: [] }, catalogue);
    expect(r.failures.some((f) => f.rule === "class-for")).toBe(true);
  });

  it("workbook: JAPN1004:001 for JAP25 includes class-not-for", () => {
    const r = validateSections(
      ["JAPN1004:001"],
      { majorCode: "JAP25", claims: [] },
      catalogue,
    );
    expect(r.failures.some((f) => f.rule === "class-not-for")).toBe(true);
  });

  it("workbook: PORT1001:001 for CLL19 with nothing completed is ok with prerequisite-not-enforced warning", () => {
    const r = validateSections(
      ["PORT1001:001"],
      { majorCode: "CLL19", claims: [] },
      catalogue,
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.rule === "prerequisite-not-enforced")).toBe(true);
  });

  it("workbook: EDUC2025:001 with EDUC1036 is ok and warns; empty completed fails prerequisite", () => {
    const ok = validateSections(
      ["EDUC2025:001"],
      { majorCode: "CLL19", claims: completedClaims(["EDUC1036"]) },
      catalogue,
    );
    expect(ok.ok).toBe(true);
    expect(ok.warnings.some((w) => w.rule === "prerequisite-not-enforced")).toBe(true);
    const bad = validateSections(["EDUC2025:001"], { majorCode: "CLL19", claims: [] }, catalogue);
    expect(bad.failures.some((f) => f.rule === "prerequisite")).toBe(true);
    expect(bad.ok).toBe(false);
  });

  it("does not call an empty section list a valid timetable", () => {
    const report = validateSections([], { majorCode: "CLL19", claims: [] }, makeCatalogue([]));
    expect(report.ok).toBe(false);
    expect(report.failures).toEqual([{ rule: "no-sections" }]);
    expect(ruleSentence(report.failures[0]!)).toBe("Add at least one section before checking the rules.");
  });
});
