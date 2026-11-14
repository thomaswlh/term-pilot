import { describe, expect, it } from "vitest";
import { completedClaims } from "../src/domain/academic";
import { loadCatalogue, sectionKey } from "../src/domain/catalogue";
import { applyExample, exampleStudents } from "../src/domain/examples";
import { validateSections } from "../src/domain/rules";
import { memoryStore } from "../src/db/store";

describe("example students", () => {
  const catalogue = loadCatalogue();

  it("each example's section keys exist in the catalogue", () => {
    const keys = new Set(catalogue.sections.map((s) => sectionKey(s)));
    for (const ex of exampleStudents) {
      for (const key of ex.sectionKeys) {
        expect(keys.has(key), `missing ${key} for ${ex.id}`).toBe(true);
      }
    }
  });

  it("validateSections passes for each example's major, completed, and starter keys", () => {
    for (const ex of exampleStudents) {
      const report = validateSections(
        ex.sectionKeys,
        { majorCode: ex.majorCode, claims: completedClaims(ex.completed) },
        catalogue,
      );
      expect(report.ok, `expected ok for ${ex.id}: ${JSON.stringify(report.failures)}`).toBe(true);
    }
  });

  it("applyExample keeps an existing timetable and adds a starter timetable", async () => {
    const store = memoryStore();
    const userId = "u-example-1";
    const existing = await store.createTimetable(userId, "Keep me");
    await applyExample(store, userId, "computer-science");

    const list = await store.listTimetables(userId);
    expect(list.map((t) => t.id)).toContain(existing.id);
    expect(list.length).toBe(2);
    const starter = list.find((t) => t.title === "Computer science starter");
    expect(starter).toBeTruthy();
    expect(starter!.sectionKeys.sort()).toEqual(["CSCI1004:001", "GELH1012:001"].sort());
    expect(starter!.revision).toBe(1);
  });

  it("calling applyExample twice adds another starter and leaves earlier starters in place", async () => {
    const store = memoryStore();
    const userId = "u-example-2";
    await applyExample(store, userId, "chinese");
    await applyExample(store, userId, "chinese");

    const list = await store.listTimetables(userId);
    const starters = list.filter((t) => t.title === "Chinese literature starter");
    expect(starters.length).toBe(2);
    expect(list.length).toBe(2);
  });

  it("Japanese example has empty completed and saved profile", async () => {
    const store = memoryStore();
    const userId = "u-example-3";
    await applyExample(store, userId, "japanese");
    const profile = await store.getProfile(userId);
    expect(profile.courses).toEqual([]);
    expect(profile.saved).toBe(true);
    expect(profile.majorCode).toBe("JAP25");
  });
});
