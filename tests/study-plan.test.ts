import { describe, expect, it } from "vitest";
import { automaticCourses, parseStudyPlan } from "../src/domain/study-plan";

const plan = parseStudyPlan({
  majorCode: "CPS19",
  curriculumYear: 2019,
  source: { title: "CIS plan", url: "https://example.test/cps19", retrievedAt: "2026-11-12" },
  courses: [
    {
      sourceCode: "CISC1001",
      catalogueCode: "CSCI1001",
      kind: "compulsory",
      suggestedYear: 1,
      suggestedSemester: 1,
      stream: null,
      verification: "verified",
      mapping: {
        sourceCode: "CISC1001",
        catalogueCode: "CSCI1001",
        title: "Reviewed mapping",
        url: "https://example.test/map",
        retrievedAt: "2026-11-12",
      },
    },
    {
      sourceCode: "GEST1004",
      catalogueCode: "GEST1004",
      kind: "compulsory-general-education",
      suggestedYear: 1,
      suggestedSemester: 1,
      stream: null,
      verification: "verified",
      mapping: null,
    },
    {
      sourceCode: "GEGA1001",
      catalogueCode: "GEGA1001",
      kind: "general-education",
      suggestedYear: null,
      suggestedSemester: null,
      stream: null,
      verification: "verified",
      mapping: null,
    },
    {
      sourceCode: "CSCI3023",
      catalogueCode: "CSCI3023",
      kind: "required-elective",
      suggestedYear: 3,
      suggestedSemester: 1,
      stream: "Data Science",
      verification: "verified",
      mapping: null,
    },
    {
      sourceCode: "GESB1000",
      catalogueCode: "GESB1000",
      kind: "compulsory-general-education",
      suggestedYear: null,
      suggestedSemester: null,
      stream: null,
      verification: "sources-disagree",
      mapping: null,
    },
  ],
});

describe("study plan rows", () => {
  it("automates verified compulsory courses and compulsory GE only", () => {
    expect(automaticCourses(plan, null).map((course) => course.catalogueCode)).toEqual(["CSCI1001", "GEST1004"]);
  });

  it("adds one named stream and ignores a listed GE", () => {
    expect(automaticCourses(plan, "Data Science").map((course) => course.catalogueCode)).toEqual([
      "CSCI1001",
      "GEST1004",
      "CSCI3023",
    ]);
    expect(automaticCourses(plan, "Data Science").some((course) => course.kind === "general-education")).toBe(false);
  });

  it("rejects a mapping that is only a shared title", () => {
    expect(() =>
      parseStudyPlan({
        majorCode: "CPS19",
        curriculumYear: 2019,
        source: { title: "CIS plan", url: "https://example.test/cps19", retrievedAt: "2026-11-12" },
        courses: [
          {
            sourceCode: "CISC1001",
            catalogueCode: "CSCI1001",
            kind: "compulsory",
            suggestedYear: 1,
            suggestedSemester: 1,
            stream: null,
            verification: "verified",
            mapping: null,
          },
        ],
      }),
    ).toThrow(/mapping/);
  });
});
