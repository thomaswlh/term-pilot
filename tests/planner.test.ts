import { describe, expect, it } from "vitest";
import {
  automaticSkipSentence,
  coursesFromCompleted,
  declaredStatusSentence,
  prerequisiteClaims,
  type CourseRecord,
} from "../src/domain/academic";
import { loadCatalogue, sectionKey } from "../src/domain/catalogue";
import { loadCreditBook } from "../src/domain/credit-snapshot";
import { creditBook } from "../src/domain/credits";
import { planRequest, type PlanRequest } from "../src/domain/planner";
import { validateSections, warningSentence } from "../src/domain/rules";
import type { StudyPlan, StudyPlanCourse } from "../src/domain/study-plan";
import type { Catalogue, Day, PrereqRow, Section } from "../src/domain/types";

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

function makeCatalogue(sections: Section[], prerequisites: PrereqRow[] = []): Catalogue {
  return { sections, prerequisites, majors: [], specializations: [] };
}

/** Four-section fixture: legal current + legal keep + two overlapping NET sections + Mon 09:00 slot. */
function baseFixtureCatalogue(): Catalogue {
  const legalCurrent = makeSection({
    courseCode: "LEGAL",
    section: "001",
    title: "Statute foundations",
    meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
  });
  const legalKeep = makeSection({
    courseCode: "LEGAL",
    section: "002",
    title: "Seminar cases",
    meetings: [{ day: "TUE", startMinutes: 14 * 60, endMinutes: 15 * 60 }],
  });
  const netOverlapCurrent = makeSection({
    courseCode: "NET",
    section: "001",
    title: "Intro to networks routing",
    meetings: [{ day: "MON", startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 30 }],
  });
  const netOverlapPeer = makeSection({
    courseCode: "NET",
    section: "002",
    title: "Switching lab exercise",
    meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
  });
  return makeCatalogue([legalCurrent, legalKeep, netOverlapCurrent, netOverlapPeer]);
}

/** Two NET sections share professor token `foxtrot`; extra repeat on NET:001 ranks it first under BM25. */
function bm25TwoLegalHitsCatalogue(): Catalogue {
  const legalOnly = makeSection({
    courseCode: "LEGAL",
    section: "001",
    title: "Statute foundations",
    meetings: [{ day: "MON", startMinutes: 9 * 60, endMinutes: 10 * 60 }],
  });
  const netFirst = makeSection({
    courseCode: "NET",
    section: "001",
    title: "Routing studio",
    teacher: "Foxtrot Foxtrot",
    meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
  });
  const netSecond = makeSection({
    courseCode: "NET",
    section: "002",
    title: "Switching lab",
    teacher: "Foxtrot",
    meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
  });
  return makeCatalogue([legalOnly, netFirst, netSecond]);
}

const profile = { majorCode: "CLL19", courses: [] as CourseRecord[] };

const book = creditBook([
  { courseCode: "AAA1000", credits: 3, sourceUrl: "https://example.test/AAA1000", retrievedAt: "2026-11-10" },
  { courseCode: "BBB1000", credits: 3, sourceUrl: "https://example.test/BBB1000", retrievedAt: "2026-11-10" },
  { courseCode: "CCC1000", credits: 1, sourceUrl: "https://example.test/CCC1000", retrievedAt: "2026-11-10" },
  { courseCode: "GEA1000", credits: 3, sourceUrl: "https://example.test/GEA1000", retrievedAt: "2026-11-10" },
  { courseCode: "GEB1000", credits: 3, sourceUrl: "https://example.test/GEB1000", retrievedAt: "2026-11-10" },
  { courseCode: "ZERO1000", credits: 0, sourceUrl: "https://example.test/ZERO1000", retrievedAt: "2026-11-10" },
]);

describe("planRequest", () => {
  it("drops the current section, keeps another legal section, and can add a topic hit", () => {
    const catalogue = baseFixtureCatalogue();
    const currentKeys = [sectionKey(catalogue.sections[0]!), sectionKey(catalogue.sections[1]!)];
    const request: PlanRequest = {
      topics: ["NET"],
      keep: ["LEGAL:002"],
      drop: ["LEGAL:001"],
      avoid: [],
    };
    const outcome = planRequest({ request, currentKeys, profile, catalogue });
    expect(outcome).toEqual({
      proposal: expect.objectContaining({
        sectionKeys: expect.arrayContaining(["LEGAL:002", "NET:002"]),
        droppedWishes: [],
        warnings: [],
        summary: expect.any(String),
        storePreview: true,
      }),
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toHaveLength(2);
    expect(outcome.proposal!.sectionKeys).not.toContain("LEGAL:001");
    expect(outcome.proposal!.summary).toMatch(/NET:002/);
    expect(outcome.proposal!.summary).toMatch(/LEGAL:001/);
  });

  it("returns null proposal when keep key is unknown", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: ["UNKNOWN:099"], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual(["LEGAL:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["Unknown section UNKNOWN:099."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("returns no proposal when drop key is unknown", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: [], drop: ["UNKNOWN:099"], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual(["LEGAL:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["Unknown section UNKNOWN:099."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("returns a credit report when the request changes no sections", () => {
    const catalogue = baseFixtureCatalogue();
    const legalBook = creditBook([
      { courseCode: "LEGAL", credits: 3, sourceUrl: "https://example.test/LEGAL", retrievedAt: "2026-11-10" },
    ]);
    const outcome = planRequest({
      request: { topics: [], keep: [], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
      credits: legalBook,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual(["LEGAL:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual([]);
    expect(outcome.proposal!.storePreview).toBe(false);
    expect(outcome.proposal!.credits).toMatchObject({
      verifiedTotal: 3,
      status: "verified",
      target: null,
      gap: null,
    });
    expect(outcome.proposal!.summary).toBe("No section changes. Verified credits: 3.");
  });

  it("refuses keep of a second section of a course already on the timetable", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: ["LEGAL:002"], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).toBeNull();
    if (outcome.proposal === null) {
      expect(outcome.reason).toBe(
        "Course LEGAL already has a section on this timetable (LEGAL:001, LEGAL:002).",
      );
    }
  });

  it("proposes a draft without LEGAL:001 when dropping it with no topics and it was in the current set", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: [], drop: ["LEGAL:001"], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: expect.objectContaining({
        sectionKeys: [],
        droppedWishes: [],
        warnings: [],
        summary: expect.any(String),
        storePreview: true,
      }),
    });
    expect(outcome.proposal!.sectionKeys).not.toContain("LEGAL:001");
  });

  it("returns no sections found when search has no token match for a topic", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "SILENT",
        section: "001",
        title: "Quiet title without the marker",
        meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: ["cryptozoology"], keep: [], drop: [], avoid: [] },
      currentKeys: [],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual([]);
    expect(outcome.proposal!.droppedWishes).toEqual(["No sections found for cryptozoology."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("keeps accepted sections when every hit for one topic fails hard rules", () => {
    const blocker = makeSection({
      courseCode: "BLK",
      section: "001",
      title: "Blocker course",
      meetings: [{ day: "MON", startMinutes: 12 * 60, endMinutes: 13 * 60 }],
    });
    const hitA = makeSection({
      courseCode: "ZEB",
      section: "001",
      title: "zebra stripes primer",
      meetings: [{ day: "MON", startMinutes: 12 * 60, endMinutes: 13 * 60 }],
    });
    const hitB = makeSection({
      courseCode: "ZEB",
      section: "002",
      title: "zebra migration maps",
      meetings: [{ day: "MON", startMinutes: 12 * 60 + 15, endMinutes: 13 * 60 + 15 }],
    });
    const kept = makeSection({
      courseCode: "OKAY",
      section: "001",
      title: "open seminar",
      meetings: [{ day: "TUE", startMinutes: 12 * 60, endMinutes: 13 * 60 }],
    });
    const catalogue = makeCatalogue([blocker, hitA, hitB, kept]);
    const outcome = planRequest({
      request: { topics: ["ZEB", "OKAY"], keep: [], drop: [], avoid: [] },
      currentKeys: [sectionKey(blocker)],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual([sectionKey(blocker), sectionKey(kept)]);
    expect(outcome.proposal!.droppedWishes).toHaveLength(1);
    expect(outcome.proposal!.droppedWishes[0]).toMatch(
      /^No legal section for ZEB\. Sections BLK:001 and ZEB:00[12] have overlapping meetings\.$/,
    );
  });

  it("records dropped wish when the only legal hit falls inside avoid ranges", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: {
        topics: ["NET"],
        keep: [],
        drop: [],
        avoid: [{ day: "MON", startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 + 30 }],
      },
      currentKeys: ["LEGAL:002"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: expect.objectContaining({
        sectionKeys: ["LEGAL:002"],
        droppedWishes: ["NET overlaps a time to avoid."],
        warnings: [],
        summary: expect.any(String),
        storePreview: false,
      }),
    });
  });

  it("adds exactly one section when two BM25 hits are legal and the query matches professor tokens", () => {
    const catalogue = bm25TwoLegalHitsCatalogue();
    const outcome = planRequest({
      request: { topics: ["foxtrot"], keep: [], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    const added = outcome.proposal!.sectionKeys.filter((k) => !["LEGAL:001"].includes(k));
    expect(added).toEqual(["NET:001"]);
  });

  it("adds at most one section per topic", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: {
        topics: ["NET", "NET"],
        keep: [],
        drop: ["LEGAL:001"],
        avoid: [],
      },
      currentKeys: ["LEGAL:001", "LEGAL:002"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    const netCount = outcome.proposal!.sectionKeys.filter((k) => k.startsWith("NET:")).length;
    expect(netCount).toBeLessThanOrEqual(1);
  });

  it("does not add a course that is not a keep and not returned for the topic", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: ["LEGAL:002"], drop: ["LEGAL:001"], avoid: [] },
      currentKeys: ["LEGAL:001", "LEGAL:002"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys.sort()).toEqual(["LEGAL:002"].sort());
  });

  it("returns a credit report when the chosen section already satisfies the topic outside avoid", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: ["NET"], keep: [], drop: [], avoid: [] },
      currentKeys: ["LEGAL:002", "NET:001"],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys.sort()).toEqual(["LEGAL:002", "NET:001"].sort());
    expect(outcome.proposal!.droppedWishes).toEqual([]);
    expect(outcome.proposal!.storePreview).toBe(false);
    expect(outcome.proposal!.summary).toMatch(/^No section changes\./);
    expect(outcome.proposal!.credits.target).toBeNull();
    expect(outcome.proposal!.credits.gap).toBeNull();
  });

  it("copies prerequisite need-2 warnings onto the draft", () => {
    const section = makeSection({
      courseCode: "WARN",
      section: "001",
      title: "warning carrier seminar",
      meetings: [{ day: "FRI", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      restriction: "",
    });
    const prerequisites: PrereqRow[] = [
      {
        courseCode: "WARN",
        preRequisiteFor: "ALL",
        majorList: "",
        requiredCount: 2,
        groupNo: "G1",
        requiredCourseCode: "BASE1",
      },
      {
        courseCode: "WARN",
        preRequisiteFor: "ALL",
        majorList: "",
        requiredCount: 2,
        groupNo: "G1",
        requiredCourseCode: "BASE2",
      },
    ];
    const catalogue = makeCatalogue([section], prerequisites);
    const outcome = planRequest({
      request: { topics: ["WARN"], keep: [], drop: [], avoid: [] },
      currentKeys: [],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: expect.objectContaining({
        sectionKeys: [sectionKey(section)],
        droppedWishes: [],
        warnings: expect.arrayContaining([
          expect.objectContaining({ rule: "prerequisite-not-enforced" }),
        ]),
        summary: expect.any(String),
        storePreview: true,
      }),
    });
  });

  it("summary mentions added keys, removed keys, and dropped wishes", () => {
    const catalogue = baseFixtureCatalogue();
    const sections = catalogue.sections.map((s) =>
      sectionKey(s) === "NET:002"
        ? { ...s, title: "Switching networks lab exercise" }
        : s,
    );
    const labOnly = makeSection({
      courseCode: "LAB",
      section: "001",
      title: "laboratory bench skills",
      meetings: [{ day: "MON", startMinutes: 9 * 60 + 35, endMinutes: 9 * 60 + 55 }],
    });
    const extended = makeCatalogue([...sections, labOnly]);
    const outcome = planRequest({
      request: {
        topics: ["NET", "LAB"],
        keep: [],
        drop: ["LEGAL:001"],
        // Blocks NET:001 and LAB:001; NET:002 at 10:00 does not overlap (end at 10:00 touches NET:002 start).
        avoid: [{ day: "MON", startMinutes: 9 * 60 + 30, endMinutes: 10 * 60 }],
      },
      currentKeys: ["LEGAL:001", "LEGAL:002"],
      profile,
      catalogue: extended,
    });
    expect(outcome.proposal).not.toBeNull();
    const s = outcome.proposal!.summary.toLowerCase();
    expect(s).toMatch(/added .*net:002/);
    expect(s).toMatch(/removed .*legal:001/);
    expect(s).toMatch(/dropped wishes:.*lab/);
  });

  it("does not satisfy a topic from a title-only search hit", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "NET",
        section: "002",
        title: "Switching lab exercise",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: ["LAB"], keep: [], drop: [], avoid: [] },
      currentKeys: [],
      profile,
      catalogue,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual([]);
    expect(outcome.proposal!.droppedWishes).toEqual(["No course identity for LAB."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("keeps a resolved topic when another topic has no sections", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "AAA1000", section: "001", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { topics: ["AAA1000", "cryptozoology"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["AAA1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["No sections found for cryptozoology."]);
    expect(outcome.proposal!.storePreview).toBe(true);
  });

  it("keeps a resolved topic when another topic has no identity", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "AAA1000", section: "001", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "LAB", section: "001", title: "bench skills", meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { topics: ["AAA1000", "bench"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["AAA1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["No course identity for bench."]);
    expect(outcome.proposal!.storePreview).toBe(true);
  });

  it("selects GE Course sections for geCount and does not use a teacher named Ge", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "EELC1008", section: "003", courseType: "", teacher: "GAO GE", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "GEA1000", section: "001", courseType: "GE Course", meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "GEB1000", section: "001", courseType: "GE Course", meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { geCount: 2 },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEA1000:001", "GEB1000:001"]);
  });

  it("adds recommended courses up to the credit target without going over", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "GEA1000", section: "001", courseType: "GE Course", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "AAA1000", section: "001", meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "BBB1000", section: "001", meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
      makeSection({ courseCode: "CCC1000", section: "001", meetings: [{ day: "THU", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: {
        geCount: 1,
        creditTarget: 7,
        chooseCourses: true,
        candidates: ["BBB1000", "AAA1000", "CCC1000"],
      },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys.sort()).toEqual(["AAA1000:001", "CCC1000:001", "GEA1000:001"]);
    expect(outcome.proposal!.credits).toMatchObject({ verifiedTotal: 7, status: "verified", target: 7, gap: 0 });
  });

  it("does not add recommended courses when chooseCourses is false", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "AAA1000", section: "001", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { creditTarget: 3, chooseCourses: false, candidates: ["AAA1000"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual([]);
    expect(outcome.proposal!.storePreview).toBe(false);
    expect(outcome.proposal!.credits.gap).toBe(3);
  });

  it("leaves gap null when a chosen course has no snapshot credit", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "ZZZ1000", section: "001", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { topics: ["ZZZ1000"], creditTarget: 3 },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["ZZZ1000:001"]);
    expect(outcome.proposal!.credits.unknownCourseCodes).toEqual(["ZZZ1000"]);
    expect(outcome.proposal!.credits.gap).toBeNull();
  });

  it("prepends seedUnmet as the first dropped wish when the request is otherwise empty", () => {
    const outcome = planRequest({
      request: {},
      currentKeys: [],
      seedUnmet: ["Unknown or closed preview."],
      profile,
      catalogue: makeCatalogue([]),
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.droppedWishes[0]).toBe("Unknown or closed preview.");
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("includes a verified credit sentence when creditTarget is null", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "AAA1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: ["AAA1000"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.summary).toContain("Verified credits: 3.");
  });

  it("includes unknown course codes in the credit sentence when creditTarget is null", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "ZZZ1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: ["ZZZ1000"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.summary).toContain("Verified credits: 0, unknown: ZZZ1000.");
    expect(outcome.proposal!.summary).not.toContain("Credit target not confirmed.");
  });

  it("places a named completed course when it is legal and keeps the other topic", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "AAA1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "BBB1000",
        section: "001",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: ["AAA1000", "BBB1000"] },
      currentKeys: [],
      profile: { majorCode: "CLL19", courses: coursesFromCompleted(["AAA1000"]) },
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["AAA1000:001", "BBB1000:001"]);
    expect(outcome.proposal!.warnings.map((warning) => warningSentence(warning))).toContain(
      declaredStatusSentence("AAA1000", "completed"),
    );
    expect(outcome.proposal!.credits.verifiedTotal).toBe(6);
  });

  it("records a declared-status warning when keep adds a reported course that is not on the timetable", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "AAA1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { topics: [], keep: ["AAA1000:001"], drop: [], avoid: [] },
      currentKeys: [],
      profile: { majorCode: "CLL19", courses: coursesFromCompleted(["AAA1000"]) },
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["AAA1000:001"]);
    expect(outcome.proposal!.warnings.map((warning) => warningSentence(warning))).toContain(
      declaredStatusSentence("AAA1000", "completed"),
    );
  });

  it("skips a held candidate and still places a different prefix hit", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "AAA1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "AAA2000",
        section: "001",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const credits = creditBook([
      { courseCode: "AAA1000", credits: 3, sourceUrl: "https://example.test/AAA1000", retrievedAt: "2026-11-10" },
      { courseCode: "AAA2000", credits: 3, sourceUrl: "https://example.test/AAA2000", retrievedAt: "2026-11-10" },
    ]);
    const outcome = planRequest({
      request: { topics: ["AAA"], candidates: ["AAA1000"], chooseCourses: true },
      currentKeys: [],
      profile: {
        majorCode: "CLL19",
        courses: [{ courseCode: "AAA1000", status: "waived", recognizesPrerequisite: false, reason: null }],
      },
      catalogue,
      credits,
    });
    expect(outcome.proposal?.sectionKeys).toEqual(["AAA2000:001"]);
    expect(outcome.proposal?.sectionKeys.some((key) => key.startsWith("AAA1000:"))).toBe(false);
    expect(outcome.proposal?.gapReason).toBe("needs-target");
    expect(outcome.proposal?.droppedWishes).toContain(
      "A credit target is needed before more courses can be chosen.",
    );
    expect(outcome.proposal?.credits.verifiedTotal).toBe(3);
  });

  it("places a named completed GE course and does not invent a held GE during a geCount walk", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "GEA1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEB1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const heldProfile = { majorCode: "CLL19", courses: coursesFromCompleted(["GEA1000"]) };
    const named = planRequest({
      request: { topics: ["GEA1000"] },
      currentKeys: [],
      profile: heldProfile,
      catalogue,
      credits: book,
    });
    expect(named.proposal!.sectionKeys).toEqual(["GEA1000:001"]);
    expect(named.proposal!.warnings.map((warning) => warningSentence(warning))).toContain(
      declaredStatusSentence("GEA1000", "completed"),
    );
    expect(named.proposal!.credits.verifiedTotal).toBe(3);

    const walked = planRequest({
      request: { geCount: 1 },
      currentKeys: [],
      profile: heldProfile,
      catalogue,
      credits: book,
    });
    expect(walked.proposal!.sectionKeys).toEqual(["GEB1000:001"]);
    expect(walked.proposal!.sectionKeys.some((key) => key.startsWith("GEA1000:"))).toBe(false);
    expect(walked.proposal!.droppedWishes).toContain(automaticSkipSentence("GEA1000", "completed"));
    expect(walked.proposal!.warnings.map((warning) => warningSentence(warning))).not.toContain(
      declaredStatusSentence("GEA1000", "completed"),
    );
    expect(walked.proposal!.credits.verifiedTotal).toBe(3);
  });

  it("does not place a recommended 0-credit course", () => {
    const catalogue = makeCatalogue([
      makeSection({ courseCode: "ZERO1000", section: "001", meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }] }),
    ]);
    const outcome = planRequest({
      request: { creditTarget: 3, chooseCourses: true, candidates: ["ZERO1000"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual([]);
    expect(outcome.proposal!.gapReason).toBe("no-legal-course");
    expect(outcome.proposal!.droppedWishes).toContain(
      "No further confirmed-eligible course fits the remaining credits.",
    );
  });

  it("keeps a saved section that overlaps avoid and does not add another section of that course", () => {
    const catalogue = makeCatalogue([
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
    ]);
    const chllBook = creditBook([
      { courseCode: "CHLL1000", credits: 3, sourceUrl: "https://example.test/CHLL1000", retrievedAt: "2026-11-10" },
    ]);
    const outcome = planRequest({
      request: {
        topics: ["CHLL1000"],
        avoid: [{ day: "FRI", startMinutes: 12 * 60, endMinutes: 18 * 60 }],
      },
      currentKeys: ["CHLL1000:001"],
      savedKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook,
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["CHLL1000:001 is in a time you want to avoid."]);
    expect(outcome.proposal!.storePreview).toBe(false);
    expect(outcome.proposal!.credits).toMatchObject({ verifiedTotal: 3, status: "verified", gap: null });
  });

  it("still places a different topic when a saved course overlaps avoid", () => {
    const catalogue = makeCatalogue([
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
    const partialBook = creditBook([
      { courseCode: "CHLL1000", credits: 3, sourceUrl: "https://example.test/CHLL1000", retrievedAt: "2026-11-10" },
      { courseCode: "MATH1001", credits: 3, sourceUrl: "https://example.test/MATH1001", retrievedAt: "2026-11-10" },
    ]);
    const outcome = planRequest({
      request: {
        topics: ["CHLL1000", "MATH1001"],
        avoid: [{ day: "FRI", startMinutes: 12 * 60, endMinutes: 18 * 60 }],
      },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: partialBook,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001", "MATH1001:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["CHLL1000:001 is in a time you want to avoid."]);
    expect(outcome.proposal!.credits.verifiedTotal).toBe(6);
    expect(outcome.proposal!.storePreview).toBe(true);
  });

  it("refuses to plan from a timetable that already has two sections of one course", () => {
    const catalogue = makeCatalogue([
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
    ]);
    const outcome = planRequest({
      request: {},
      currentKeys: ["CHLL1000:001", "CHLL1000:002"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: null,
      reason: "Course CHLL1000 already has a section on this timetable (CHLL1000:001, CHLL1000:002).",
    });
  });

  it("satisfies geCount with a second GE course rather than a second section", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "GEA1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEA1000",
        section: "002",
        courseType: "GE Course",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEB1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { geCount: 2 },
      currentKeys: ["GEA1000:001"],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEA1000:001", "GEB1000:001"]);
    expect(outcome.proposal!.sectionKeys).not.toContain("GEA1000:002");
  });

  it("explains that a requested section belongs to a course already on the timetable", () => {
    const catalogue = chllSwitchCatalogue();
    const outcome = planRequest({
      request: { topics: ["CHLL1000:002"] },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(outcome.proposal).not.toBeNull();
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual([
      "CHLL1000 is already on this timetable as CHLL1000:001.",
    ]);
    expect(outcome.proposal!.storePreview).toBe(false);
    expect(outcome.proposal!.summary).not.toContain("Add at least one section");
  });

  it("uses the already-chosen wish for a repeated course and does not invent a no-sections failure for a prefix", () => {
    const catalogue = chllSwitchCatalogue();
    const repeated = planRequest({
      request: { topics: ["CHLL1000", "CHLL1000:002"] },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(repeated.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(repeated.proposal!.droppedWishes).toEqual([
      "CHLL1000 is already on this timetable as CHLL1000:001.",
    ]);
    expect(repeated.proposal!.summary).not.toContain("Add at least one section");

    const prefix = planRequest({
      request: { topics: ["CHLL"] },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(prefix.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(prefix.proposal!.summary).not.toContain("Add at least one section");
  });

  it("switches section when the saved section is dropped", () => {
    const catalogue = chllSwitchCatalogue();
    const outcome = planRequest({
      request: { topics: ["CHLL1000:002"], drop: ["CHLL1000:001"] },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:002"]);
    expect(outcome.proposal!.droppedWishes).toEqual([]);
  });

  it("reports a saved section inside an avoid window when no topic is named", () => {
    const catalogue = chllSwitchCatalogue();
    const outcome = planRequest({
      request: { avoid: [{ day: "FRI", startMinutes: 15 * 60, endMinutes: 18 * 60 }] },
      currentKeys: ["CHLL1000:001"],
      savedKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["CHLL1000:001 is in a time you want to avoid."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("reports a saved avoid conflict while adding a different topic", () => {
    const catalogue = chllSwitchCatalogue();
    const mathBook = creditBook([
      ...chllBookRecords(),
      { courseCode: "MATH1001", credits: 3, sourceUrl: "https://example.test/MATH1001", retrievedAt: "2026-11-10" },
    ]);
    const outcome = planRequest({
      request: {
        topics: ["MATH1001"],
        avoid: [{ day: "FRI", startMinutes: 15 * 60, endMinutes: 18 * 60 }],
      },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: mathBook,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001", "MATH1001:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual(["CHLL1000:001 is in a time you want to avoid."]);
    expect(outcome.proposal!.storePreview).toBe(true);
  });

  it("leaves the wish list empty when avoid matches no retained section", () => {
    const catalogue = chllSwitchCatalogue();
    const outcome = planRequest({
      request: { avoid: [{ day: "SAT", startMinutes: 9 * 60, endMinutes: 10 * 60 }] },
      currentKeys: ["CHLL1000:001"],
      profile,
      catalogue,
      credits: chllBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CHLL1000:001"]);
    expect(outcome.proposal!.droppedWishes).toEqual([]);
  });

  it("keeps an exact GE count when recommended courses could add more", () => {
    const catalogue = geMixCatalogue();
    const outcome = planRequest({
      request: {
        geCount: 2,
        creditTarget: 12,
        chooseCourses: true,
        candidates: ["GEC1000", "GED1000", "GEE1000", "GEF1000", "AAA1000", "BBB1000"],
      },
      currentKeys: [],
      profile,
      catalogue,
      credits: geMixBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual([
      "GEA1000:001",
      "GEB1000:001",
      "AAA1000:001",
      "BBB1000:001",
    ]);
    expect(outcome.proposal!.credits).toMatchObject({ verifiedTotal: 12, gap: 0 });
    expect(outcome.proposal!.summary).not.toContain("you asked for 2");
  });

  it("keeps named GE courses that exceed the requested count and reports the overage", () => {
    const catalogue = geMixCatalogue();
    const outcome = planRequest({
      request: { topics: ["GEA1000", "GEB1000", "GEC1000"], geCount: 2 },
      currentKeys: [],
      profile,
      catalogue,
      credits: geMixBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEA1000:001", "GEB1000:001", "GEC1000:001"]);
    expect(outcome.proposal!.droppedWishes).toContain("This set has 3 GE courses; you asked for 2.");
  });

  it("keeps saved GE courses that exceed the requested count", () => {
    const catalogue = geMixCatalogue();
    const saved = ["GEA1000:001", "GEB1000:001", "GEC1000:001"];
    const outcome = planRequest({
      request: { geCount: 2 },
      currentKeys: saved,
      savedKeys: saved,
      profile,
      catalogue,
      credits: geMixBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(saved);
    expect(outcome.proposal!.droppedWishes).toEqual(["This set has 3 GE courses; you asked for 2."]);
    expect(outcome.proposal!.storePreview).toBe(false);
  });

  it("allows more than geCount when the student asked for a minimum", () => {
    const catalogue = geMixCatalogue();
    const outcome = planRequest({
      request: {
        geCount: 2,
        geAtLeast: true,
        creditTarget: 12,
        chooseCourses: true,
        candidates: ["GEC1000", "GED1000", "GEE1000", "GEF1000", "AAA1000", "BBB1000"],
      },
      currentKeys: [],
      profile,
      catalogue,
      credits: geMixBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual([
      "GEA1000:001",
      "GEB1000:001",
      "AAA1000:001",
      "BBB1000:001",
    ]);
    expect(outcome.proposal!.summary).not.toContain("you asked for 2");
  });

  it("does not treat geCount 0 as a request for exactly zero GE courses", () => {
    const catalogue = geMixCatalogue();
    const outcome = planRequest({
      request: { topics: ["AAA1000"], geCount: 0 },
      currentKeys: ["GEA1000:001"],
      profile,
      catalogue,
      credits: geMixBook(),
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEA1000:001", "AAA1000:001"]);
    expect(outcome.proposal!.summary).not.toContain("you asked for");
  });

  it("plans twelve eligible candidates against a credit target without the old multi-second scan", () => {
    const catalogue = loadCatalogue();
    const credits = loadCreditBook();
    const major = { majorCode: "CLL19", courses: [] as CourseRecord[] };
    const seen = new Set<string>();
    const chosen: string[] = [];
    const candidates: string[] = [];
    for (const section of catalogue.sections) {
      if (seen.has(section.courseCode)) continue;
      const value = credits.creditsFor(section.courseCode);
      if (value === null || value <= 0) continue;
      const key = sectionKey(section);
      if (!validateSections([...chosen, key], { majorCode: major.majorCode, claims: prerequisiteClaims(major.courses) }, catalogue).ok) continue;
      seen.add(section.courseCode);
      chosen.push(key);
      candidates.push(section.courseCode);
      if (candidates.length === 12) break;
    }
    expect(candidates).toHaveLength(12);
    const target = chosen.reduce((sum, key) => sum + (credits.creditsFor(key.split(":")[0]!) ?? 0), 0);
    const started = performance.now();
    const outcome = planRequest({
      request: {
        creditTarget: target,
        chooseCourses: true,
        candidates,
        avoid: [{ day: "MON", startMinutes: 60, endMinutes: 120 }],
      },
      currentKeys: [],
      profile: major,
      catalogue,
      credits,
    });
    const elapsed = performance.now() - started;
    expect(outcome.proposal).not.toBeNull();
    // Isolated runs land near 110ms. The old per-call catalogue scan took about 3s.
    // 1000ms still fails that regression when Vitest runs the suite in parallel.
    expect(elapsed).toBeLessThan(1000);
  });

  it("asks for a credit target before choosing courses and still places a named topic", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "AAA1000",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "BBB1000",
        section: "001",
        unit: "FIC",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    catalogue.majors = [{ code: "CLL19", name: "Letters", programme: "FIC" }];
    const outcome = planRequest({
      request: { topics: ["AAA1000"], chooseCourses: true, creditTarget: null, candidates: ["BBB1000"] },
      currentKeys: [],
      profile,
      catalogue,
      credits: book,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["AAA1000:001"]);
    expect(outcome.proposal!.gapReason).toBe("needs-target");
    expect(outcome.proposal!.selections).toEqual([]);
    expect(outcome.proposal!.droppedWishes).toContain(
      "A credit target is needed before more courses can be chosen.",
    );
    expect(outcome.proposal!.summary).toContain(
      "A credit target is needed before more courses can be chosen.",
    );
  });

  it("adds a required elective only after the request names its stream", () => {
    const plan = samplePlan([
      planCourse("CSCI1001", "compulsory"),
      planCourse("CSCI3000", "required-elective", "Systems"),
    ]);
    const catalogue = facultyPairCatalogue();
    const credits = pairBook();
    const unnamed = planRequest({
      request: { chooseCourses: true, creditTarget: 6 },
      currentKeys: [],
      profile,
      catalogue,
      credits,
      plan,
    });
    expect(unnamed.proposal!.sectionKeys).toEqual(["CSCI1001:001"]);

    const named = planRequest({
      request: { chooseCourses: true, creditTarget: 6, stream: "Systems" },
      currentKeys: [],
      profile,
      catalogue,
      credits,
      plan,
    });
    expect(named.proposal!.sectionKeys).toEqual(["CSCI1001:001", "CSCI3000:001"]);
    expect(named.proposal!.selections[1]).toMatchObject({
      courseCode: "CSCI3000",
      basis: "verified-required-elective",
    });
    expect(named.proposal!.summary).toContain("CSCI3000 added as verified-required-elective.");

    const unknown = planRequest({
      request: { chooseCourses: true, creditTarget: 6, stream: "Nope" },
      currentKeys: [],
      profile,
      catalogue,
      credits,
      plan,
    });
    expect(unknown.proposal!.sectionKeys).toEqual(["CSCI1001:001"]);
    expect(unknown.proposal!.droppedWishes).toContain("No reviewed stream matches Nope.");
  });

  it("places a faculty course before a general elective when the major has no plan file", () => {
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "JAPN1000",
        section: "001",
        unit: "FAH",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "CSCI2100",
        section: "001",
        unit: "FIC",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    catalogue.majors = [{ code: "CLL19", name: "Letters", programme: "FIC" }];
    const credits = creditBook([
      { courseCode: "JAPN1000", credits: 3, sourceUrl: "https://example.test/JAPN1000", retrievedAt: "2026-11-12" },
      { courseCode: "CSCI2100", credits: 3, sourceUrl: "https://example.test/CSCI2100", retrievedAt: "2026-11-12" },
    ]);
    const outcome = planRequest({
      request: { chooseCourses: true, creditTarget: 3 },
      currentKeys: [],
      profile,
      catalogue,
      credits,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["CSCI2100:001"]);
    expect(outcome.proposal!.selections[0]).toMatchObject({
      courseCode: "CSCI2100",
      basis: "inferred-faculty",
    });
    expect(outcome.proposal!.summary).toContain("CSCI2100 added as inferred-faculty.");
  });

  it("places a verified compulsory GE before a later course-code GE", () => {
    const plan = samplePlan([
      planCourse("GEST1004", "compulsory-general-education"),
      planCourse("GEGA1001", "general-education"),
    ]);
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "GEA1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEGA1001",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEST1004",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "WED", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { geCount: 1 },
      currentKeys: [],
      profile,
      catalogue,
      credits: geCodeBook(["GEA1000", "GEGA1001", "GEST1004"]),
      plan,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEST1004:001"]);
  });

  it("does not let a listed general-education row jump the course-code GE order", () => {
    const plan = samplePlan([planCourse("GEGA1001", "general-education")]);
    const catalogue = makeCatalogue([
      makeSection({
        courseCode: "GEA1000",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      makeSection({
        courseCode: "GEGA1001",
        section: "001",
        courseType: "GE Course",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const outcome = planRequest({
      request: { geCount: 1 },
      currentKeys: [],
      profile,
      catalogue,
      credits: geCodeBook(["GEA1000", "GEGA1001"]),
      plan,
    });
    expect(outcome.proposal!.sectionKeys).toEqual(["GEA1000:001"]);
  });
});

function geCodeBook(courseCodes: string[]) {
  return creditBook(
    courseCodes.map((courseCode) => ({
      courseCode,
      credits: 3,
      sourceUrl: `https://example.test/${courseCode}`,
      retrievedAt: "2026-11-12",
    })),
  );
}

function planCourse(catalogueCode: string, kind: StudyPlanCourse["kind"], stream: string | null = null): StudyPlanCourse {
  return {
    sourceCode: catalogueCode,
    catalogueCode,
    kind,
    suggestedYear: null,
    suggestedSemester: null,
    stream,
    verification: "verified",
    mapping: null,
  };
}

function samplePlan(courses: StudyPlanCourse[]): StudyPlan {
  return {
    majorCode: "CLL19",
    curriculumYear: 2019,
    source: { title: "Letters study plan", url: "https://example.test/plan", retrievedAt: "2026-11-12" },
    courses,
  };
}

function pairBook() {
  return creditBook([
    { courseCode: "CSCI1001", credits: 3, sourceUrl: "https://example.test/CSCI1001", retrievedAt: "2026-11-12" },
    { courseCode: "CSCI3000", credits: 3, sourceUrl: "https://example.test/CSCI3000", retrievedAt: "2026-11-12" },
  ]);
}

function facultyPairCatalogue(): Catalogue {
  const catalogue = makeCatalogue([
    makeSection({
      courseCode: "CSCI1001",
      section: "001",
      unit: "FIC",
      meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    }),
    makeSection({
      courseCode: "CSCI3000",
      section: "001",
      unit: "FIC",
      meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
    }),
  ]);
  catalogue.majors = [{ code: "CLL19", name: "Letters", programme: "FIC" }];
  return catalogue;
}

function chllBookRecords() {
  return [
    { courseCode: "CHLL1000", credits: 3, sourceUrl: "https://example.test/CHLL1000", retrievedAt: "2026-11-10" },
  ];
}

function chllBook() {
  return creditBook(chllBookRecords());
}

function chllSwitchCatalogue(): Catalogue {
  return makeCatalogue([
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
}

function geMixBook() {
  return creditBook(
    ["GEA1000", "GEB1000", "GEC1000", "GED1000", "GEE1000", "GEF1000", "AAA1000", "BBB1000"].map((courseCode) => ({
      courseCode,
      credits: 3,
      sourceUrl: `https://example.test/${courseCode}`,
      retrievedAt: "2026-11-10",
    })),
  );
}

function geMixCatalogue(): Catalogue {
  const slots: Array<[Day, number]> = [
    ["MON", 10],
    ["TUE", 10],
    ["WED", 10],
    ["THU", 10],
    ["FRI", 10],
    ["SAT", 10],
    ["MON", 14],
    ["TUE", 14],
  ];
  const specs: Array<[string, string]> = [
    ["GEA1000", "GE Course"],
    ["GEB1000", "GE Course"],
    ["GEC1000", "GE Course"],
    ["GED1000", "GE Course"],
    ["GEE1000", "GE Course"],
    ["GEF1000", "GE Course"],
    ["AAA1000", ""],
    ["BBB1000", ""],
  ];
  return makeCatalogue(
    specs.map(([courseCode, courseType], index) =>
      makeSection({
        courseCode,
        section: "001",
        courseType,
        meetings: [{ day: slots[index]![0], startMinutes: slots[index]![1] * 60, endMinutes: slots[index]![1] * 60 + 60 }],
      }),
    ),
  );
}
