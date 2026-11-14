import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { coursesFromCompleted } from "../src/domain/academic";
import { postgresStore } from "../src/db/postgres";

describe("postgresStore", () => {
  it.skipIf(!process.env.DATABASE_URL)("matches memory store behaviour", async () => {
    const connectionString = process.env.DATABASE_URL!;
    const sql = postgres(connectionString, { max: 1 });

    const mainUser = randomUUID();
    const userB = randomUUID();
    const userA = randomUUID();
    const legacyUser = randomUUID();

    try {
      const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");
      await sql.unsafe(schema);

      const store = postgresStore(sql);

      const newUser = await store.getProfile(mainUser);
      expect(newUser).toEqual({
        userId: mainUser,
        majorCode: null,
        courses: [],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
        saved: false,
      });

      const saved1 = await store.saveProfile(mainUser, {
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

      const saved2 = await store.saveProfile(mainUser, {
        majorCode: "CLL19",
        courses: coursesFromCompleted(["CHLL1003"]),
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      });
      expect(saved2.majorCode).toBe("CLL19");
      expect(saved2.courses).toEqual(coursesFromCompleted(["CHLL1003"]));

      await sql`
        insert into profiles (user_id, major_code, completed, saved, course_records)
        values (${legacyUser}, 'CPS19', ${["CSCI1001"]}, true, null)
      `;
      const legacy = await store.getProfile(legacyUser);
      expect(legacy.courses).toEqual(coursesFromCompleted(["CSCI1001"]));
      await store.saveProfile(legacyUser, {
        majorCode: "CPS19",
        courses: [],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      });
      await sql`update profiles set completed = ${["CSCI1001"]} where user_id = ${legacyUser}`;
      expect((await store.getProfile(legacyUser)).courses).toEqual([]);

      const ttDefault = await store.createTimetable(mainUser);
      expect(ttDefault.title).toBe("Untitled timetable");
      expect(ttDefault.revision).toBe(1);
      expect(ttDefault.sectionKeys).toEqual([]);

      const ttNamed = await store.createTimetable(mainUser, "Spring plan");
      expect(ttNamed.title).toBe("Spring plan");

      const userBTimetable = await store.createTimetable(userB);
      const crossTt = await store.getTimetable(userA, userBTimetable.id);
      expect(crossTt).toBeNull();

      const proposal = await store.createProposal({
        userId: userB,
        timetableId: userBTimetable.id,
        baseRevision: userBTimetable.revision,
        sectionKeys: ["GELH1012:001"],
        droppedWishes: [],
        warnings: [],
        summary: "test",
      });
      const crossProposal = await store.getProposal(userA, proposal.id);
      expect(crossProposal).toBeNull();

      const userAList = await store.listTimetables(userA);
      expect(userAList).toEqual([]);

      const mainList = await store.listTimetables(mainUser);
      expect(mainList.map((row) => row.sectionKeys.length)).toEqual([0, 0]);

      const ttB = await store.createTimetable(userB, "B timetable");
      const ownerFirst = await store.writeSections(userB, ttB.id, ["GELH1012:001"], 2);
      expect(ownerFirst).not.toBeNull();
      expect(ownerFirst!.sectionKeys).toEqual(["GELH1012:001"]);
      expect(ownerFirst!.revision).toBe(2);

      const crossWrite = await store.writeSections(mainUser, ttB.id, ["OTHER:001"], 2);
      expect(crossWrite).toBeNull();

      const stillB = await store.getTimetable(userB, ttB.id);
      expect(stillB).not.toBeNull();
      expect(stillB!.sectionKeys).toEqual(["GELH1012:001"]);
      expect(stillB!.revision).toBe(2);

      const ownerSecond = await store.writeSections(userB, ttB.id, ["GELH1012:002"], 3);
      expect(ownerSecond).not.toBeNull();
      expect(ownerSecond!.sectionKeys).toEqual(["GELH1012:002"]);
      expect(ownerSecond!.revision).toBe(3);

      expect(await store.getShareStatus(userB, ttB.id)).toBeNull();
      const token = await store.enableShare(userB, ttB.id);
      expect(token).not.toBeNull();
      expect(token).not.toBe(ttB.id);
      expect(await store.enableShare(userA, ttB.id)).toBeNull();

      const shared = await store.getSharedTimetable(token!);
      expect(shared!.title).toBe("B timetable");
      expect(shared!.sectionKeys).toEqual(["GELH1012:002"]);
      expect(shared).not.toHaveProperty("userId");

      expect(await store.disableShare(userB, ttB.id)).toBe(true);
      expect(await store.getSharedTimetable(token!)).toBeNull();

      const token2 = await store.enableShare(userB, ttB.id);
      expect(token2).not.toBe(token);
      expect(await store.getSharedTimetable(token!)).toBeNull();
    } finally {
      await sql`delete from timetables where user_id in (${mainUser}, ${userB}, ${userA})`;
      await sql`delete from profiles where user_id in (${mainUser}, ${userB}, ${userA}, ${legacyUser})`;
      await sql.end({ timeout: 5 });
    }
  });
});
