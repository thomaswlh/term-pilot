import { describe, expect, it } from "vitest";
import { coursesFromCompleted } from "../src/domain/academic";
import { memoryStore } from "../src/db/store";

describe("memoryStore", () => {
  it("profile and timetable isolation", async () => {
    const store = memoryStore();

    const newUser = await store.getProfile("user-1");
    expect(newUser).toEqual({
      userId: "user-1",
      majorCode: null,
      courses: [],
      yearOfStudy: null,
      admissionCohort: null,
      interests: null,
      saved: false,
    });

    const saved1 = await store.saveProfile("user-1", {
      majorCode: "CPS19",
      courses: coursesFromCompleted([]),
      yearOfStudy: null,
      admissionCohort: null,
      interests: null,
    });
    expect(saved1.saved).toBe(true);
    expect(saved1.majorCode).toBe("CPS19");
    expect(saved1.courses).toEqual([]);
    expect(saved1.yearOfStudy).toBeNull();
    expect(saved1.admissionCohort).toBeNull();
    expect(saved1.interests).toBeNull();

    const saved2 = await store.saveProfile("user-1", {
      majorCode: "CLL19",
      courses: coursesFromCompleted(["CHLL1003"]),
      yearOfStudy: null,
      admissionCohort: null,
      interests: null,
    });
    expect(saved2.majorCode).toBe("CLL19");
    expect(saved2.courses).toEqual(coursesFromCompleted(["CHLL1003"]));

    const ttDefault = await store.createTimetable("user-1");
    expect(ttDefault.title).toBe("Untitled timetable");
    expect(ttDefault.revision).toBe(1);
    expect(ttDefault.sectionKeys).toEqual([]);

    const ttNamed = await store.createTimetable("user-1", "Spring plan");
    expect(ttNamed.title).toBe("Spring plan");

    const userB = await store.createTimetable("user-b");
    const crossTt = await store.getTimetable("user-a", userB.id);
    expect(crossTt).toBeNull();

    const proposal = await store.createProposal({
      userId: "user-b",
      timetableId: userB.id,
      baseRevision: userB.revision,
      sectionKeys: ["GELH1012:001"],
      droppedWishes: [],
      warnings: [],
      summary: "test",
    });
    const crossProposal = await store.getProposal("user-a", proposal.id);
    expect(crossProposal).toBeNull();

    const userAList = await store.listTimetables("user-a");
    expect(userAList).toEqual([]);

    const user1List = await store.listTimetables("user-1");
    expect(user1List.map((row) => row.sectionKeys.length)).toEqual([0, 0]);

    const ttB = await store.createTimetable("user-b", "B timetable");
    const ownerFirst = await store.writeSections("user-b", ttB.id, ["GELH1012:001"], 2);
    expect(ownerFirst).not.toBeNull();
    expect(ownerFirst!.sectionKeys).toEqual(["GELH1012:001"]);
    expect(ownerFirst!.revision).toBe(2);

    const crossWrite = await store.writeSections("user-1", ttB.id, ["OTHER:001"], 2);
    expect(crossWrite).toBeNull();

    const stillB = await store.getTimetable("user-b", ttB.id);
    expect(stillB).not.toBeNull();
    expect(stillB!.sectionKeys).toEqual(["GELH1012:001"]);
    expect(stillB!.revision).toBe(2);

    const ownerSecond = await store.writeSections("user-b", ttB.id, ["GELH1012:002"], 3);
    expect(ownerSecond).not.toBeNull();
    expect(ownerSecond!.sectionKeys).toEqual(["GELH1012:002"]);
    expect(ownerSecond!.revision).toBe(3);
  });

  it("lists proposals newest first", async () => {
    const store = memoryStore();
    await store.saveProfile("user-1", {
      majorCode: "CPS19",
      courses: [],
      yearOfStudy: null,
      admissionCohort: null,
      interests: null,
    });
    const tt = await store.createTimetable("user-1", "Plan");
    const older = await store.createProposal({
      userId: "user-1",
      timetableId: tt.id,
      baseRevision: tt.revision,
      sectionKeys: ["A:001"],
      droppedWishes: [],
      warnings: [],
      summary: "older",
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const newer = await store.createProposal({
      userId: "user-1",
      timetableId: tt.id,
      baseRevision: tt.revision,
      sectionKeys: ["B:001"],
      droppedWishes: [],
      warnings: [],
      summary: "newer",
    });
    const rows = await store.listProposals("user-1", tt.id);
    expect(rows.map((row) => row.id)).toEqual([newer.id, older.id]);
  });

  it("share tokens are owner-only and expose saved sections only", async () => {
    const store = memoryStore();
    const tt = await store.createTimetable("owner", "Shared plan");
    expect(await store.getShareStatus("owner", tt.id)).toBeNull();

    const token = await store.enableShare("owner", tt.id);
    expect(token).not.toBeNull();
    expect(token).not.toBe(tt.id);

    const forbiddenEnable = await store.enableShare("other", tt.id);
    expect(forbiddenEnable).toBeNull();

    const sharedEmpty = await store.getSharedTimetable(token!);
    expect(sharedEmpty).toEqual({
      title: "Shared plan",
      sectionKeys: [],
      updatedAt: tt.updatedAt,
    });
    expect(sharedEmpty).not.toHaveProperty("userId");

    await store.writeSections("owner", tt.id, ["GELH1012:001"], 2);
    await store.createProposal({
      userId: "owner",
      timetableId: tt.id,
      baseRevision: 2,
      sectionKeys: ["OTHER:099"],
      droppedWishes: [],
      warnings: [],
      summary: "proposal only",
    });

    const sharedSaved = await store.getSharedTimetable(token!);
    expect(sharedSaved!.sectionKeys).toEqual(["GELH1012:001"]);

    expect(await store.disableShare("owner", tt.id)).toBe(true);
    expect(await store.getSharedTimetable(token!)).toBeNull();

    const token2 = await store.enableShare("owner", tt.id);
    expect(token2).not.toBeNull();
    expect(token2).not.toBe(token);
    expect(await store.getShareStatus("owner", tt.id)).toBe(token2);
    expect(await store.getSharedTimetable(token!)).toBeNull();
    const sharedAgain = await store.getSharedTimetable(token2!);
    expect(sharedAgain).not.toBeNull();
    expect(sharedAgain!.sectionKeys).toEqual(["GELH1012:001"]);
  });

  it("keeps an emptied course list empty and hides it from another user", async () => {
    const store = memoryStore();
    await store.saveProfile("user-a", {
      majorCode: "CPS19",
      courses: coursesFromCompleted(["CSCI1001"]),
      yearOfStudy: 2,
      admissionCohort: "2024/2025",
      interests: "compilers",
    });
    await store.saveProfile("user-a", {
      majorCode: "CPS19",
      courses: [],
      yearOfStudy: 2,
      admissionCohort: "2024/2025",
      interests: "compilers",
    });
    expect((await store.getProfile("user-a")).courses).toEqual([]);
    expect(await store.getProfile("user-b")).toMatchObject({ saved: false, courses: [] });
  });

  it("does not put academic context on a shared timetable", async () => {
    const store = memoryStore();
    await store.saveProfile("owner", {
      majorCode: "CLL19",
      courses: [{ courseCode: "EELC1011", status: "waived", recognizesPrerequisite: false, reason: "placement test" }],
      yearOfStudy: 1,
      admissionCohort: "2025/2026",
      interests: "private interest",
    });
    const timetable = await store.createTimetable("owner", "Visible");
    await store.writeSections("owner", timetable.id, ["CHLL1000:002"], timetable.revision);
    const token = await store.enableShare("owner", timetable.id);
    expect(await store.enableShare("other", timetable.id)).toBeNull();
    const shared = await store.getSharedTimetable(token!);
    expect(shared).toEqual({ title: "Visible", sectionKeys: ["CHLL1000:002"], updatedAt: expect.any(String) });
    expect(JSON.stringify(shared)).not.toContain("private interest");
    expect(JSON.stringify(shared)).not.toContain("placement test");
    expect(JSON.stringify(shared)).not.toContain("EELC1011");
  });
});
