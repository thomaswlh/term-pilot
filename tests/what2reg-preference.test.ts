import { describe, expect, it } from "vitest";
import { creditBook } from "../src/domain/credits";
import { rankAdditions } from "../src/domain/recommend";
import type { Catalogue, Section } from "../src/domain/types";
import type { StudyPlan } from "../src/domain/study-plan";
import { rankAdditionsWithReviews } from "../src/domain/what2reg/preference";
import type { CommunityReviewNote } from "../src/domain/what2reg/types";

function section(courseCode: string, number: string, day: Section["meetings"][number]["day"]): Section {
  return {
    courseCode,
    section: number,
    title: courseCode,
    courseType: "",
    unit: "FIC",
    department: "",
    teacher: number === "001" ? "HARD PROF" : "EASY PROF",
    notes: "",
    restriction: "",
    meetings: [{ day, startMinutes: 9 * 60, endMinutes: 10 * 60 }],
  };
}

function input() {
  const catalogue: Catalogue = {
    sections: [
      section("CSCI1001", "001", "MON"),
      section("CSCI1001", "002", "TUE"),
      section("CSCI2100", "001", "WED"),
    ],
    prerequisites: [],
    majors: [{ code: "CPS19", name: "Computer Science", programme: "FIC" }],
    specializations: [],
  };
  const plan: StudyPlan = {
    majorCode: "CPS19",
    curriculumYear: 2019,
    source: { title: "Computer Science study plan", url: "https://example.test/plan", retrievedAt: "2026-11-12" },
    courses: [
      {
        sourceCode: "CSCI1001",
        catalogueCode: "CSCI1001",
        kind: "compulsory",
        suggestedYear: 1,
        suggestedSemester: null,
        stream: null,
        verification: "verified",
        mapping: null,
      },
      {
        sourceCode: "CSCI2100",
        catalogueCode: "CSCI2100",
        kind: "required-elective",
        suggestedYear: 2,
        suggestedSemester: null,
        stream: "Systems",
        verification: "verified",
        mapping: null,
      },
    ],
  };
  return {
    catalogue,
    credits: creditBook([
      { courseCode: "CSCI1001", credits: 3, sourceUrl: "https://example.test/CSCI1001", retrievedAt: "2026-11-12" },
      { courseCode: "CSCI2100", credits: 3, sourceUrl: "https://example.test/CSCI2100", retrievedAt: "2026-11-12" },
    ]),
    profile: {
      majorCode: "CPS19",
      programme: "FIC",
      yearOfStudy: 2,
      interests: null,
      claims: [],
    },
    plan,
    stream: "Systems",
    chosenKeys: [],
    heldCodes: [],
    creditTarget: 6,
    geCount: 0,
    geAtLeast: false,
    avoid: [],
  };
}

function harsh(courseCode: string): CommunityReviewNote {
  return {
    courseCode,
    instructor: "HARD PROF",
    grade: 1,
    difficulty: 5,
    usefulness: 1,
    summary: "Too hard. Drop this course.",
    url: `https://umeh.top/course/${courseCode}`,
    understanding: null,
  };
}

describe("review notes on ranked courses", () => {
  it("does not drop a compulsory or required course when reviews say it is hard", () => {
    const ranked = rankAdditions(input());
    const reviewed = rankAdditionsWithReviews(input(), [harsh("CSCI1001"), harsh("CSCI2100")]);
    expect(ranked.selections.map((row) => row.basis).sort()).toEqual(["verified-compulsory", "verified-required-elective"]);
    expect(reviewed.keys).toEqual(ranked.keys);
    expect(reviewed.selections.map((row) => row.courseCode)).toEqual(ranked.selections.map((row) => row.courseCode));
    expect(reviewed.selections.map((row) => row.basis)).toEqual(ranked.selections.map((row) => row.basis));
    expect(reviewed.gapReason).toBe(ranked.gapReason);
    const compulsory = reviewed.selections.find((row) => row.basis === "verified-compulsory");
    expect(compulsory?.sectionKey).toBe("CSCI1001:001");
    expect(compulsory?.detail).toContain("does not remove this required course");
    expect(compulsory?.detail).toContain("澳大選咩課");
    expect(reviewed.explanation).toContain("not official University of Macau");
  });

  it("leaves the ranked keys untouched when there are no reviews", () => {
    const ranked = rankAdditions(input());
    const reviewed = rankAdditionsWithReviews(input(), []);
    expect(reviewed.keys).toEqual(ranked.keys);
    expect(reviewed.selections).toEqual(ranked.selections);
    expect(reviewed.explanation).toBeNull();
  });
});
