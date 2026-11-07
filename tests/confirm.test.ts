import { describe, expect, it } from "vitest";
import type { Proposal } from "../src/db/store";
import type { Catalogue, PrereqRow, Section } from "../src/domain/types";
import {
  decideConfirm,
  decideDiscard,
  decideManualAdd,
  decideManualRemove,
} from "../src/domain/confirm";
import { ruleSentence, validateSections, type RuleFailure } from "../src/domain/rules";

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

function makeProposal(overrides: Partial<Proposal> & Pick<Proposal, "userId" | "timetableId" | "baseRevision" | "sectionKeys">): Proposal {
  return {
    id: "p1",
    droppedWishes: [],
    warnings: [],
    summary: "",
    status: "open",
    ...overrides,
  } as Proposal;
}

describe("confirm decisions", () => {
  const profile = { majorCode: "CLL19" as const, completed: [] as string[] };

  it("decideManualAdd: unsaved profile returns the profile sentence and no success revision", () => {
    const report = { ok: true, failures: [] as RuleFailure[], warnings: [] };
    const r = decideManualAdd({
      profileSaved: false,
      timetable: { revision: 1, sectionKeys: [] },
      sectionKey: "X:001",
      report,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("Save your profile before adding a section.");
    }
  });

  it("decideManualAdd: legal key bumps revision and includes the key", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "L",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const keys = ["L:001"];
    const report = validateSections(keys, profile, cat);
    expect(report.ok).toBe(true);
    const r = decideManualAdd({
      profileSaved: true,
      timetable: { revision: 1, sectionKeys: [] },
      sectionKey: "L:001",
      report,
    });
    expect(r).toEqual({ ok: true, sectionKeys: ["L:001"], revision: 2 });
  });

  it("decideManualAdd: key already present with passing report bumps revision", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "L",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ]);
    const report = validateSections(["L:001"], profile, cat);
    expect(report.ok).toBe(true);
    const r = decideManualAdd({
      profileSaved: true,
      timetable: { revision: 5, sectionKeys: ["L:001"] },
      sectionKey: "L:001",
      report,
    });
    expect(r).toEqual({ ok: true, sectionKeys: ["L:001"], revision: 6 });
  });

  it("decideManualAdd: overlap report fails with ruleSentence of the first failure", () => {
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
    const keys = ["A:001", "B:001"];
    const report = validateSections(keys, profile, cat);
    expect(report.ok).toBe(false);
    const first = report.failures[0]!;
    expect(first.rule).toBe("overlap");
    const r = decideManualAdd({
      profileSaved: true,
      timetable: { revision: 1, sectionKeys: ["A:001"] },
      sectionKey: "B:001",
      report,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(ruleSentence(first));
    }
  });

  it("decideManualAdd: untimed failure reason mentions no weekly meeting", () => {
    const cat = makeCatalogue([
      makeSection({
        courseCode: "U",
        section: "001",
        meetings: [{ day: null, startMinutes: null, endMinutes: null }],
      }),
    ]);
    const report = validateSections(["U:001"], profile, cat);
    expect(report.ok).toBe(false);
    const r = decideManualAdd({
      profileSaved: true,
      timetable: { revision: 1, sectionKeys: [] },
      sectionKey: "U:001",
      report,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason.toLowerCase()).toMatch(/no weekly meeting/);
    }
  });

  it("decideManualAdd: uses real validateSections overlap fixture so routes revalidate", () => {
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
    const report = validateSections(["A:001", "B:001"], profile, cat);
    const r = decideManualAdd({
      profileSaved: true,
      timetable: { revision: 3, sectionKeys: ["A:001"] },
      sectionKey: "B:001",
      report,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe(ruleSentence(report.failures[0]!));
    }
  });

  it("decideManualRemove: removes a present key and bumps revision", () => {
    const r = decideManualRemove({
      timetable: { revision: 2, sectionKeys: ["A:001", "B:001"] },
      sectionKey: "A:001",
    });
    expect(r).toEqual({ ok: true, sectionKeys: ["B:001"], revision: 3 });
  });

  it("decideManualRemove: absent key fails", () => {
    const r = decideManualRemove({
      timetable: { revision: 1, sectionKeys: ["B:001"] },
      sectionKey: "A:001",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("That section is not on this timetable.");
    }
  });

  it("decideConfirm: apply forbidden when actor differs from proposal owner", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u2",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "forbidden" });
  });

  it("decideConfirm: apply forbidden when timetable user differs", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u2", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "forbidden" });
  });

  it("decideConfirm: apply when revision matches and report ok", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 3,
      sectionKeys: ["P:001", "Q:002"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 3 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({
      ok: true,
      effect: "apply",
      sectionKeys: ["P:001", "Q:002"],
      revision: 4,
    });
  });

  it("decideConfirm: save-as-new on same input has no revision field", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 3,
      sectionKeys: ["P:001", "Q:002"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "save-as-new",
      proposal,
      timetable: { userId: "u1", revision: 3 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({
      ok: true,
      effect: "save-as-new",
      sectionKeys: ["P:001", "Q:002"],
    });
    expect("revision" in r).toBe(false);
  });

  it("decideConfirm: apply when proposal status is applied yields already-applied", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "applied",
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: true, effect: "already-applied" });
  });

  it("decideConfirm: save-as-new when proposal status is applied yields already-applied", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "applied",
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "save-as-new",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: true, effect: "already-applied" });
  });

  it("decideConfirm: apply when proposal status is saved-as-new yields already-applied", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "saved-as-new",
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: true, effect: "already-applied" });
  });

  it("decideConfirm: apply when status is discarded returns discarded", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "discarded",
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "discarded" });
  });

  it("decideConfirm: apply stale when timetable revision exceeds baseRevision", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 2,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 5 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("decideConfirm: save-as-new stale on the same timetable", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 2,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "save-as-new",
      proposal,
      timetable: { userId: "u1", revision: 5 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("decideConfirm: apply stale when timetable revision is below baseRevision", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 4,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("decideConfirm: save-as-new stale when timetable revision is below baseRevision", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 4,
      sectionKeys: ["X:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "save-as-new",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "stale" });
  });

  it("decideConfirm: apply when report fails returns illegal with ruleSentence detail", () => {
    const failure: RuleFailure = { rule: "untimed", sectionKey: "Z:001" };
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["Z:001"],
    });
    const r = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal,
      timetable: { userId: "u1", revision: 1 },
      report: { ok: false, failures: [failure], warnings: [] },
    });
    expect(r).toEqual({ ok: false, reason: "illegal", detail: ruleSentence(failure) });
  });

  it("decideDiscard: owner of open proposal returns discarded status", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "open",
    });
    expect(decideDiscard({ actorId: "u1", proposal })).toEqual({
      ok: true,
      status: "discarded",
    });
  });

  it("decideDiscard: non-owner is forbidden", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
    });
    expect(decideDiscard({ actorId: "u2", proposal })).toEqual({ ok: false, reason: "forbidden" });
  });

  it("decideConfirm: missing proposal or timetable returns missing", () => {
    const proposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
    });
    const report = { ok: true, failures: [] as RuleFailure[], warnings: [] };
    expect(
      decideConfirm({
        actorId: "u1",
        mode: "apply",
        proposal: null,
        timetable: { userId: "u1", revision: 1 },
        report,
      }),
    ).toEqual({ ok: false, reason: "missing" });
    expect(
      decideConfirm({
        actorId: "u1",
        mode: "apply",
        proposal,
        timetable: null,
        report,
      }),
    ).toEqual({ ok: false, reason: "missing" });
  });

  it("decideDiscard: null proposal returns missing", () => {
    expect(decideDiscard({ actorId: "u1", proposal: null })).toEqual({ ok: false, reason: "missing" });
  });

  it("decideDiscard: owner still gets discarded when proposal already discarded or applied", () => {
    const discarded = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "discarded",
    });
    expect(decideDiscard({ actorId: "u1", proposal: discarded })).toEqual({
      ok: true,
      status: "discarded",
    });
    const applied = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 1,
      sectionKeys: ["X:001"],
      status: "applied",
    });
    expect(decideDiscard({ actorId: "u1", proposal: applied })).toEqual({
      ok: true,
      status: "discarded",
    });
  });

  it("decideConfirm: second call after applied returns already-applied", () => {
    const openProposal = makeProposal({
      userId: "u1",
      timetableId: "t1",
      baseRevision: 4,
      sectionKeys: ["A:001"],
      status: "open",
    });
    const first = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal: openProposal,
      timetable: { userId: "u1", revision: 4 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(first).toEqual({ ok: true, effect: "apply", sectionKeys: ["A:001"], revision: 5 });

    const appliedProposal = { ...openProposal, status: "applied" as const };
    const second = decideConfirm({
      actorId: "u1",
      mode: "apply",
      proposal: appliedProposal,
      timetable: { userId: "u1", revision: 5 },
      report: { ok: true, failures: [], warnings: [] },
    });
    expect(second).toEqual({ ok: true, effect: "already-applied" });
  });
});
