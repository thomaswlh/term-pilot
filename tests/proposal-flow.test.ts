import { describe, expect, it } from "vitest";
import { coursesFromCompleted } from "../src/domain/academic";
import { memoryStore } from "../src/db/store";
import { applyProposalDecision } from "../src/domain/proposal-flow";
import type { Catalogue, Section } from "../src/domain/types";

function section(partial: Pick<Section, "courseCode" | "section" | "meetings"> & Partial<Section>): Section {
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

function catalogue(): Catalogue {
  return {
    sections: [
      section({
        courseCode: "LEGAL",
        section: "001",
        meetings: [{ day: "MON", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
      section({
        courseCode: "CHLL",
        section: "001",
        meetings: [{ day: "TUE", startMinutes: 10 * 60, endMinutes: 11 * 60 }],
      }),
    ],
    prerequisites: [],
    majors: [], specializations: [],
  };
}

async function savedAccount() {
  const store = memoryStore();
  const userId = "student";
  await store.saveProfile(userId, {
    majorCode: "CLL19",
    courses: coursesFromCompleted([]),
    yearOfStudy: null,
    admissionCohort: null,
    interests: null,
  });
  const timetable = await store.createTimetable(userId, "Fall plan");
  return { store, userId, timetable, cat: catalogue() };
}

describe("proposal flow", () => {
  it("applies an empty section list as clearing the timetable", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const seeded = await store.writeSections(userId, timetable.id, ["LEGAL:001"], timetable.revision);
    expect(seeded).not.toBeNull();
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: seeded!.revision,
      sectionKeys: [],
      droppedWishes: [],
      warnings: [],
      summary: "cleared",
    });

    const applied = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });

    expect(applied).toMatchObject({ ok: true, effect: "apply" });
    const after = await store.getTimetable(userId, timetable.id);
    expect(after?.sectionKeys).toEqual([]);
    expect(after?.revision).toBe(seeded!.revision + 1);
  });

  it("applies a stored proposal once, then leaves the section list unchanged on a second apply", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: timetable.revision,
      sectionKeys: ["LEGAL:001"],
      droppedWishes: [],
      warnings: [],
      summary: "added LEGAL:001.",
    });

    const applied = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });
    expect(applied).toMatchObject({ ok: true, effect: "apply" });

    const after = await store.getTimetable(userId, timetable.id);
    const stored = await store.getProposal(userId, proposal.id);
    expect(after?.revision).toBe(2);
    expect(after?.sectionKeys).toEqual(["LEGAL:001"]);
    expect(stored?.status).toBe("applied");

    const again = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });
    expect(again).toMatchObject({ ok: true, effect: "already-applied" });

    const twice = await store.getTimetable(userId, timetable.id);
    const still = await store.getProposal(userId, proposal.id);
    expect(twice?.sectionKeys).toEqual(["LEGAL:001"]);
    expect(twice?.sectionKeys).toHaveLength(proposal.sectionKeys.length);
    expect(twice?.revision).toBe(2);
    expect(still?.status).toBe("applied");
  });

  it("returns stale when a second timetable save lands after the proposal and leaves both revisions unchanged", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: timetable.revision,
      sectionKeys: ["LEGAL:001"],
      droppedWishes: ["evening"],
      warnings: [],
      summary: "added LEGAL:001.",
    });
    const second = await store.createTimetable(userId, "Other notebook");
    const savedAgain = await store.writeSections(userId, timetable.id, ["CHLL:001"], timetable.revision + 1);
    expect(savedAgain?.revision).toBe(2);

    const result = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });
    expect(result).toEqual({ ok: false, reason: "stale" });

    const source = await store.getTimetable(userId, timetable.id);
    const other = await store.getTimetable(userId, second.id);
    const open = await store.getProposal(userId, proposal.id);
    expect(source?.revision).toBe(2);
    expect(source?.sectionKeys).toEqual(["CHLL:001"]);
    expect(other?.revision).toBe(1);
    expect(other?.sectionKeys).toEqual([]);
    expect(open?.status).toBe("open");
    expect(open?.baseRevision).toBe(1);
    expect(await store.listTimetables(userId)).toHaveLength(2);
  });

  it("saves the proposal as a new revision-1 timetable and leaves the source revision unchanged", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const seeded = await store.writeSections(userId, timetable.id, ["LEGAL:001"], timetable.revision);
    expect(seeded?.revision).toBe(1);
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: 1,
      sectionKeys: ["LEGAL:001", "CHLL:001"],
      droppedWishes: [],
      warnings: [],
      summary: "added CHLL:001.",
    });

    const result = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "save-as-new",
      catalogue: cat,
    });
    expect(result).toMatchObject({ ok: true, effect: "save-as-new" });

    const source = await store.getTimetable(userId, timetable.id);
    expect(source?.revision).toBe(1);
    expect(source?.sectionKeys).toEqual(["LEGAL:001"]);

    const rows = await store.listTimetables(userId);
    const created = rows.find((row) => row.id !== timetable.id);
    expect(created?.title).toBe("Fall plan proposal");
    expect(created?.revision).toBe(1);
    expect(created?.sectionKeys).toEqual(["LEGAL:001", "CHLL:001"]);
    expect((await store.getProposal(userId, proposal.id))?.status).toBe("saved-as-new");
  });

  it("save-as-new is idempotent after status is saved-as-new", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const seeded = await store.writeSections(userId, timetable.id, ["LEGAL:001"], timetable.revision);
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: seeded?.revision ?? 1,
      sectionKeys: ["LEGAL:001", "CHLL:001"],
      droppedWishes: [],
      warnings: [],
      summary: "added CHLL:001.",
    });
    const first = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "save-as-new",
      catalogue: cat,
    });
    expect(first).toMatchObject({ ok: true, effect: "save-as-new" });
    const timetablesBefore = await store.listTimetables(userId);

    const second = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "save-as-new",
      catalogue: cat,
    });
    expect(second).toMatchObject({ ok: true, effect: "already-applied" });
    const timetablesAfter = await store.listTimetables(userId);
    expect(timetablesAfter).toHaveLength(timetablesBefore.length);
    expect((await store.getProposal(userId, proposal.id))?.status).toBe("saved-as-new");
  });

  it("discards an open proposal and leaves saved sections unchanged", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const seeded = await store.writeSections(userId, timetable.id, ["LEGAL:001"], timetable.revision);
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: seeded?.revision ?? 1,
      sectionKeys: ["CHLL:001"],
      droppedWishes: [],
      warnings: [],
      summary: "removed LEGAL:001; added CHLL:001.",
    });

    const result = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "discard",
      catalogue: cat,
    });
    expect(result).toMatchObject({ ok: true, effect: "discard" });

    const source = await store.getTimetable(userId, timetable.id);
    expect(source?.sectionKeys).toEqual(["LEGAL:001"]);
    expect(source?.revision).toBe(1);
    expect((await store.getProposal(userId, proposal.id))?.status).toBe("discarded");
    expect(await store.listTimetables(userId)).toHaveLength(1);
  });

  it("does not apply a proposal for a different user", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const seeded = await store.writeSections(userId, timetable.id, ["LEGAL:001"], timetable.revision);
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: seeded?.revision ?? 1,
      sectionKeys: ["CHLL:001"],
      droppedWishes: [],
      warnings: [],
      summary: "added CHLL:001.",
    });

    const result = await applyProposalDecision({
      store,
      actorId: "someone-else",
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(["forbidden", "missing"]).toContain(result.reason);
    }

    const source = await store.getTimetable(userId, timetable.id);
    expect(source?.sectionKeys).toEqual(["LEGAL:001"]);
    expect(source?.revision).toBe(1);
    expect((await store.getProposal(userId, proposal.id))?.status).toBe("open");
    expect(await store.listTimetables(userId)).toHaveLength(1);
  });

  it("refuses an illegal proposal without writing sections", async () => {
    const { store, userId, timetable, cat } = await savedAccount();
    const proposal = await store.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: timetable.revision,
      sectionKeys: ["MISSING:001"],
      droppedWishes: [],
      warnings: [],
      summary: "added MISSING:001.",
    });

    const result = await applyProposalDecision({
      store,
      actorId: userId,
      proposalId: proposal.id,
      action: "apply",
      catalogue: cat,
    });
    expect(result).toMatchObject({ ok: false, reason: "illegal" });

    const source = await store.getTimetable(userId, timetable.id);
    expect(source?.sectionKeys).toEqual([]);
    expect(source?.revision).toBe(1);
    expect((await store.getProposal(userId, proposal.id))?.status).toBe("open");
  });
});
