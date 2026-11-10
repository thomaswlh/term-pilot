import { describe, expect, it } from "vitest";
import { sectionKey } from "../src/domain/catalogue";
import { planRequest, type PlanRequest } from "../src/domain/planner";
import type { Catalogue, PrereqRow, Section } from "../src/domain/types";

function makeSection(overrides: Partial<Section> & Pick<Section, "courseCode" | "section">): Section {
  return {
    title: "",
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
  return { sections, prerequisites, majors: [] };
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

const profile = { majorCode: "CLL19", completed: [] as string[] };

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
      proposal: {
        sectionKeys: expect.arrayContaining(["LEGAL:002", "NET:002"]),
        droppedWishes: [],
        warnings: [],
        summary: expect.any(String),
      },
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
    expect(outcome).toEqual({ proposal: null, reason: expect.stringMatching(/Unknown section/) });
  });

  it("returns no proposal when drop key is unknown", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: [], drop: ["UNKNOWN:099"], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({ proposal: null, reason: expect.stringMatching(/Unknown section/) });
  });

  it("returns Nothing to change when there is nothing to do", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: [], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: null,
      reason: expect.stringMatching(/Nothing to change/i),
    });
  });

  it("proposes a draft with keep LEGAL:002 when current is only LEGAL:001 and there are no topics", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: [], keep: ["LEGAL:002"], drop: [], avoid: [] },
      currentKeys: ["LEGAL:001"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: {
        sectionKeys: expect.arrayContaining(["LEGAL:001", "LEGAL:002"]),
        droppedWishes: [],
        warnings: [],
        summary: expect.any(String),
      },
    });
    expect(outcome.proposal!.sectionKeys.sort()).toEqual(["LEGAL:001", "LEGAL:002"].sort());
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
      proposal: {
        sectionKeys: [],
        droppedWishes: [],
        warnings: [],
        summary: expect.any(String),
      },
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
    expect(outcome.proposal).toBeNull();
    expect(outcome).toEqual({
      proposal: null,
      reason: expect.stringMatching(/cryptozoology/i),
    });
    if ("reason" in outcome) {
      expect(outcome.reason).toMatch(/No sections found/);
    }
  });

  it("returns no legal section when every search hit fails hard rules", () => {
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
    const catalogue = makeCatalogue([blocker, hitA, hitB]);
    const outcome = planRequest({
      request: { topics: ["ZEB"], keep: [], drop: [], avoid: [] },
      currentKeys: [sectionKey(blocker)],
      profile,
      catalogue,
    });
    expect(outcome.proposal).toBeNull();
    expect(outcome).toEqual({
      proposal: null,
      reason: expect.stringMatching(/ZEB/i),
    });
    if ("reason" in outcome) {
      expect(outcome.reason).toMatch(/No legal section for ZEB/i);
    }
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
      proposal: {
        sectionKeys: ["LEGAL:002"],
        droppedWishes: ["NET"],
        warnings: [],
        summary: expect.any(String),
      },
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

  it("returns Nothing to change when the chosen section already satisfies the topic outside avoid and a later hit exists", () => {
    const catalogue = baseFixtureCatalogue();
    const outcome = planRequest({
      request: { topics: ["NET"], keep: [], drop: [], avoid: [] },
      currentKeys: ["LEGAL:002", "NET:001"],
      profile,
      catalogue,
    });
    expect(outcome).toEqual({
      proposal: null,
      reason: expect.stringMatching(/Nothing to change/i),
    });
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
      proposal: {
        sectionKeys: [sectionKey(section)],
        droppedWishes: [],
        warnings: expect.arrayContaining([
          expect.objectContaining({ rule: "prerequisite-not-enforced" }),
        ]),
        summary: expect.any(String),
      },
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
    expect(outcome).toEqual({
      proposal: null,
      reason: expect.stringMatching(/No sections found for LAB/i),
    });
  });
});
