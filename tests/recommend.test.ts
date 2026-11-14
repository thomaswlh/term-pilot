import { describe, expect, it } from "vitest";
import { creditBook, type CreditBook } from "../src/domain/credits";
import { rankAdditions, type CourseSelection } from "../src/domain/recommend";
import { validateSections } from "../src/domain/rules";
import type { StudyPlan, StudyPlanCourse, StudyPlanKind } from "../src/domain/study-plan";
import type { Catalogue, Day, Section } from "../src/domain/types";
import type { PrerequisiteClaim } from "../src/domain/academic";

const DAYS: Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const PROGRAMME = "FIC";
const MAJOR = "CPS19";
const SOURCE_TITLE = "Computer Science study plan";

type RankProfile = {
  majorCode: string;
  programme: string | null;
  yearOfStudy: number | null;
  interests: string | null;
  claims: PrerequisiteClaim[];
};

let profile: RankProfile;
let catalogue: Catalogue;

type PlanCourseInput = {
  catalogueCode: string | null;
  kind: StudyPlanKind;
  verification?: StudyPlanCourse["verification"];
  stream?: string | null;
  sourceCode?: string;
  suggestedYear?: StudyPlanCourse["suggestedYear"];
  credits?: number;
  unit?: string;
  title?: string;
  courseType?: string;
};

type CourseInput = {
  courseCode: string;
  title?: string;
  unit?: string;
  credits?: number | null;
  courseType?: string;
};

function courseOf(key: string): string {
  return key.split(":")[0] ?? key;
}

function slot(index: number): Section["meetings"] {
  const day = DAYS[index % DAYS.length]!;
  const hour = 8 + Math.floor(index / DAYS.length);
  return [{ day, startMinutes: hour * 60, endMinutes: hour * 60 + 50 }];
}

function fixture(options: {
  planCourses?: PlanCourseInput[];
  faculty?: CourseInput[];
  extra?: CourseInput[];
  creditTarget?: number;
  interests?: string | null;
  sameSlot?: string[];
  geCount?: number;
  geAtLeast?: boolean;
  heldCodes?: string[];
  chosenKeys?: string[];
  stream?: string | null;
  yearOfStudy?: number | null;
  avoid?: { day: Day; startMinutes: number; endMinutes: number }[];
}): Parameters<typeof rankAdditions>[0] {
  const credits = new Map<string, number>();
  const sections: Section[] = [];
  const sameSlot = new Set(options.sameSlot ?? []);
  let slotIndex = sameSlot.size > 0 ? 1 : 0;

  const addSection = (course: CourseInput & { courseCode: string }) => {
    if (sections.some((section) => section.courseCode === course.courseCode)) return;
    const meetings = sameSlot.has(course.courseCode) ? slot(0) : slot(slotIndex++);
    sections.push({
      courseCode: course.courseCode,
      section: "001",
      title: course.title ?? course.courseCode,
      courseType: course.courseType ?? "",
      unit: course.unit ?? PROGRAMME,
      department: "",
      teacher: "",
      notes: "",
      restriction: "",
      meetings,
    });
    if (course.credits !== null) credits.set(course.courseCode, course.credits ?? 3);
  };

  const planRows: StudyPlanCourse[] = [];
  for (const row of options.planCourses ?? []) {
    const sourceCode = row.sourceCode ?? row.catalogueCode ?? "UNMAPPED";
    planRows.push({
      sourceCode,
      catalogueCode: row.catalogueCode,
      kind: row.kind,
      suggestedYear: row.suggestedYear ?? null,
      suggestedSemester: null,
      stream: row.stream ?? null,
      verification: row.verification ?? "verified",
      mapping:
        row.catalogueCode !== null && sourceCode !== row.catalogueCode
          ? {
              sourceCode,
              catalogueCode: row.catalogueCode,
              title: SOURCE_TITLE,
              url: "https://example.test/plan",
              retrievedAt: "2026-11-12",
            }
          : null,
    });
    if (row.catalogueCode === null) continue;
    const courseType =
      row.courseType ??
      (row.kind === "compulsory-general-education" || row.kind === "general-education" ? "GE Course" : "");
    addSection({
      courseCode: row.catalogueCode,
      title: row.title,
      unit: row.unit ?? PROGRAMME,
      credits: row.credits,
      courseType,
    });
  }

  for (const course of options.faculty ?? []) {
    addSection({ ...course, unit: course.unit ?? PROGRAMME });
  }
  for (const course of options.extra ?? []) {
    addSection({ ...course, unit: course.unit ?? "FAH" });
  }

  const plan: StudyPlan | null =
    options.planCourses === undefined
      ? null
      : {
          majorCode: MAJOR,
          curriculumYear: 2019,
          source: { title: SOURCE_TITLE, url: "https://example.test/plan", retrievedAt: "2026-11-12" },
          courses: planRows,
        };

  catalogue = {
    sections,
    prerequisites: [],
    majors: [{ code: MAJOR, name: "Computer Science", programme: PROGRAMME }],
    specializations: [],
  };
  profile = {
    majorCode: MAJOR,
    programme: PROGRAMME,
    yearOfStudy: options.yearOfStudy ?? null,
    interests: options.interests ?? null,
    claims: [],
  };
  const book: CreditBook = creditBook(
    [...credits.entries()].map(([courseCode, value]) => ({
      courseCode,
      credits: value,
      sourceUrl: `https://example.test/${courseCode}`,
      retrievedAt: "2026-11-12",
    })),
  );

  return {
    catalogue,
    credits: book,
    profile,
    plan,
    stream: options.stream ?? null,
    chosenKeys: options.chosenKeys ?? [],
    heldCodes: options.heldCodes ?? [],
    creditTarget: options.creditTarget ?? 0,
    geCount: options.geCount ?? 0,
    geAtLeast: options.geAtLeast ?? false,
    avoid: options.avoid ?? [],
  };
}

function codes(selections: CourseSelection[]): string[] {
  return selections.map((row) => row.courseCode);
}

describe("rankAdditions", () => {
  it("places two compulsory 3-credit courses ahead of one 6-credit elective", () => {
    const result = rankAdditions(fixture({
      planCourses: [
        { catalogueCode: "CSCI1001", kind: "compulsory" },
        { catalogueCode: "CSCI1004", kind: "compulsory" },
      ],
      extra: [{ courseCode: "JAPN1000", unit: "FAH", credits: 6 }],
      creditTarget: 6,
    }));
    expect(result.keys.map(courseOf)).toEqual(["CSCI1001", "CSCI1004"]);
    expect(result.selections.every((row) => row.basis === "verified-compulsory")).toBe(true);
    expect(result.gapReason).toBe("none");
    expect(result.selections.every((row) => row.detail === SOURCE_TITLE)).toBe(true);
  });

  it("rejects an overlapping pair inside the window", () => {
    const result = rankAdditions(fixture({
      sameSlot: ["CSCI1001", "CSCI1004"],
      planCourses: [
        { catalogueCode: "CSCI1001", kind: "compulsory" },
        { catalogueCode: "CSCI1004", kind: "compulsory" },
        { catalogueCode: "CSCI2001", kind: "compulsory" },
      ],
      creditTarget: 6,
    }));
    expect(result.keys).toHaveLength(2);
    expect(validateSections(result.keys, profile, catalogue).ok).toBe(true);
  });

  it("places a faculty interest match before another faculty course", () => {
    const result = rankAdditions(fixture({
      interests: "compilers",
      faculty: [
        { courseCode: "CSCI2100", title: "Linear algebra seminar" },
        { courseCode: "CSCI2200", title: "Compilers workshop" },
      ],
      creditTarget: 3,
    }));
    expect(result.selections[0]).toMatchObject({ courseCode: "CSCI2200", basis: "inferred-interest" });
    expect(result.selections[0]?.detail).toContain("compilers");
  });

  it("does not place an outside-faculty interest hit before a faculty course", () => {
    const result = rankAdditions(fixture({
      interests: "computer science",
      faculty: [{ courseCode: "CSCI2100", title: "Systems" }],
      extra: [{ courseCode: "CIVL1000", unit: "FEG", title: "Computer Science" }],
      creditTarget: 3,
    }));
    expect(result.selections[0].courseCode).toBe("CSCI2100");
  });

  it("selects a verified compulsory GE and not a listed GE", () => {
    const result = rankAdditions(fixture({
      planCourses: [
        { catalogueCode: "GEST1004", kind: "compulsory-general-education" },
        { catalogueCode: "GEGA1001", kind: "general-education" },
      ],
      creditTarget: 3,
    }));
    expect(result.selections.map((row) => row.courseCode)).toEqual(["GEST1004"]);
    expect(result.selections[0].basis).toBe("verified-compulsory");
  });

  it("reports search-bound when an unmet target used a tier larger than 12", () => {
    const bounded = rankAdditions(fixture({
      creditTarget: 5,
      faculty: Array.from({ length: 13 }, (_, index) => ({
        courseCode: `CSCI${3000 + index}`,
        title: "Elective",
        credits: 3,
      })),
    }));
    expect(bounded.gapReason).toBe("search-bound");
    expect(bounded.keys.length).toBeGreaterThan(0);
  });

  it("reports no-legal-course when a small tier cannot reach the target", () => {
    const blocked = rankAdditions(fixture({
      creditTarget: 5,
      faculty: [{ courseCode: "CSCI2100", title: "Systems", credits: 3 }],
    }));
    expect(blocked.gapReason).toBe("no-legal-course");
    expect(blocked.keys).toHaveLength(1);
  });

  it("keeps the larger earlier subset when it ties a later exact course", () => {
    const result = rankAdditions(fixture({
      yearOfStudy: 1,
      creditTarget: 3,
      faculty: [
        { courseCode: "CSCI1001", title: "One", credits: 1 },
        { courseCode: "CSCI1002", title: "Two", credits: 1 },
        { courseCode: "CSCI1003", title: "Three", credits: 1 },
        { courseCode: "CSCI4004", title: "Four", credits: 3 },
      ],
    }));
    expect(result.keys.map(courseOf)).toEqual(["CSCI1001", "CSCI1002", "CSCI1003"]);
    expect(result.gapReason).toBe("none");
  });

  it("leaves a required elective out until the request names its stream", () => {
    const withoutStream = rankAdditions(fixture({
      planCourses: [
        { catalogueCode: "CSCI1001", kind: "compulsory" },
        { catalogueCode: "CSCI3000", kind: "required-elective", stream: "Artificial Intelligence" },
      ],
      creditTarget: 6,
    }));
    expect(codes(withoutStream.selections)).toEqual(["CSCI1001"]);

    const named = rankAdditions(fixture({
      planCourses: [
        { catalogueCode: "CSCI1001", kind: "compulsory" },
        { catalogueCode: "CSCI3000", kind: "required-elective", stream: "Artificial Intelligence" },
      ],
      stream: "Artificial Intelligence",
      creditTarget: 6,
    }));
    expect(codes(named.selections)).toEqual(["CSCI1001", "CSCI3000"]);
    expect(named.selections[1]).toMatchObject({
      basis: "verified-required-elective",
      detail: SOURCE_TITLE,
    });
  });

  it("does not select a sources-disagree compulsory general-education row", () => {
    const result = rankAdditions(fixture({
      planCourses: [
        {
          catalogueCode: "GEST1004",
          kind: "compulsory-general-education",
          verification: "sources-disagree",
          unit: PROGRAMME,
        },
      ],
      creditTarget: 3,
    }));
    expect(result.selections).toEqual([]);
    expect(result.keys).toEqual([]);
  });

  it("does not select a plan row whose catalogue code is null", () => {
    const result = rankAdditions(fixture({
      planCourses: [
        { catalogueCode: null, kind: "compulsory", sourceCode: "CISC1001" },
      ],
      faculty: [{ courseCode: "CSCI2100", title: "Systems" }],
      extra: [{ courseCode: "CISC1001", unit: "FAH", title: "Unmapped" }],
      creditTarget: 3,
    }));
    expect(codes(result.selections)).toEqual(["CSCI2100"]);
    expect(result.selections[0]?.basis).toBe("inferred-faculty");
  });

  it("places a faculty course before a general elective when there is no plan", () => {
    const result = rankAdditions(fixture({
      faculty: [{ courseCode: "CSCI2100", title: "Systems" }],
      extra: [{ courseCode: "JAPN1000", unit: "FAH", title: "Japanese" }],
      creditTarget: 3,
    }));
    expect(result.selections[0]).toMatchObject({ courseCode: "CSCI2100", basis: "inferred-faculty" });
  });

  it("labels a placed outside-faculty course that is not an interest hit as a general elective", () => {
    const result = rankAdditions(fixture({
      faculty: [{ courseCode: "CSCI2100", title: "Systems" }],
      extra: [{ courseCode: "JAPN1000", unit: "FAH", title: "Japanese" }],
      creditTarget: 6,
    }));
    expect(result.selections.map((row) => row.basis)).toEqual(["inferred-faculty", "general-elective"]);
    expect(result.selections[1]?.courseCode).toBe("JAPN1000");
  });

  it("stops an exact GE count and lets geAtLeast add another GE course", () => {
    const courses: CourseInput[] = [
      { courseCode: "GEST1001", unit: "FAH", title: "GE one", courseType: "GE Course" },
      { courseCode: "GEST1002", unit: "FAH", title: "GE two", courseType: "GE Course" },
    ];
    const exact = rankAdditions(fixture({
      extra: courses,
      creditTarget: 6,
      geCount: 1,
    }));
    expect(codes(exact.selections)).toEqual(["GEST1001"]);

    const atLeast = rankAdditions(fixture({
      extra: courses,
      creditTarget: 6,
      geCount: 1,
      geAtLeast: true,
    }));
    expect(codes(atLeast.selections)).toEqual(["GEST1001", "GEST1002"]);
    expect(atLeast.gapReason).toBe("none");
  });

  it("skips a held code and does not place it", () => {
    const result = rankAdditions(fixture({
      faculty: [
        { courseCode: "CSCI2100", title: "Systems" },
        { courseCode: "CSCI2200", title: "Networks" },
      ],
      heldCodes: ["CSCI2100"],
      creditTarget: 3,
    }));
    expect(result.selections.map((row) => row.courseCode)).toEqual(["CSCI2200"]);
  });

  it("places a verified compulsory when an already chosen course has unknown credits", () => {
    const result = rankAdditions(fixture({
      planCourses: [{ catalogueCode: "CSCI1001", kind: "compulsory" }],
      extra: [{ courseCode: "MATH1000", credits: null }],
      chosenKeys: ["MATH1000:001"],
      creditTarget: 6,
    }));
    expect(result.selections.map((row) => row.courseCode)).toEqual(["CSCI1001"]);
    expect(result.selections[0]?.basis).toBe("verified-compulsory");
    expect(result.gapReason).not.toBe("none");
  });

  it("leaves interest tiers empty when interests are blank", () => {
    const result = rankAdditions(fixture({
      interests: "   ",
      faculty: [
        { courseCode: "CSCI2100", title: "Compilers workshop" },
        { courseCode: "CSCI2200", title: "Systems" },
      ],
      creditTarget: 3,
    }));
    expect(result.selections[0]).toMatchObject({ courseCode: "CSCI2100", basis: "inferred-faculty" });
  });
});
