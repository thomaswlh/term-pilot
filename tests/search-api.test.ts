import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireUserId, UnauthorizedError } = vi.hoisted(() => {
  class UnauthorizedError extends Error {
    constructor() {
      super("Unauthorized");
      this.name = "UnauthorizedError";
    }
  }
  return {
    requireUserId: vi.fn(async () => "user_test"),
    UnauthorizedError,
  };
});

vi.mock("@/auth", () => ({
  requireUserId,
  UnauthorizedError,
}));

import { GET } from "../src/app/api/search/route";

type SearchMeeting = { day: string; startMinutes: number; endMinutes: number };
type SearchPrerequisite = {
  preRequisiteFor: string;
  majorList: string;
  requiredCount: number;
  groupNo: string;
  requiredCourseCode: string;
};

function assertMeetingShape(meetings: unknown): asserts meetings is SearchMeeting[] {
  expect(Array.isArray(meetings)).toBe(true);
  expect((meetings as SearchMeeting[]).length).toBeGreaterThan(0);
  for (const meeting of meetings as SearchMeeting[]) {
    expect(typeof meeting.day).toBe("string");
    expect(typeof meeting.startMinutes).toBe("number");
    expect(typeof meeting.endMinutes).toBe("number");
    expect(meeting.endMinutes).toBeGreaterThan(meeting.startMinutes);
  }
}

function assertEnrichedHit(hit: Record<string, unknown>) {
  expect(hit.title).toBe("Linear Algebra I");
  expect(hit.unit).toBe("FSC");
  expect(hit.department).toBe("MTH");
  expect(typeof hit.notes).toBe("string");
  expect(typeof hit.restriction).toBe("string");
  expect(Array.isArray(hit.prerequisites)).toBe(true);
  assertMeetingShape(hit.meetings);
}

describe("GET /api/search", () => {
  beforeEach(() => {
    requireUserId.mockReset();
    requireUserId.mockResolvedValue("user_test");
  });

  it("returns 401 when the caller is signed out", async () => {
    requireUserId.mockRejectedValueOnce(new UnauthorizedError());
    const res = await GET(new Request("http://localhost:3000/api/search?q=MATH1001"));
    expect(res.status).toBe(401);
  });

  it("returns up to 20 hits with enriched section metadata and meetings", async () => {
    const req = new Request("http://localhost:3000/api/search?q=MATH1001");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { hits: Array<Record<string, unknown>> };
    expect(Array.isArray(data.hits)).toBe(true);
    expect(data.hits.length).toBeGreaterThan(0);
    expect(data.hits.length).toBeLessThanOrEqual(20);

    const hit = data.hits[0];
    expect(hit).toHaveProperty("sectionKey");
    expect(hit).toHaveProperty("courseCode");
    expect(hit).toHaveProperty("section");
    expect(hit).toHaveProperty("title");
    expect(hit).toHaveProperty("teacher");
    expect(hit).toHaveProperty("unit");
    expect(hit).toHaveProperty("department");
    expect(hit).toHaveProperty("notes");
    expect(hit).toHaveProperty("restriction");
    expect(hit).toHaveProperty("prerequisites");
    expect(hit).toHaveProperty("meetings");
    expect(Array.isArray(hit.meetings)).toBe(true);
    expect(Array.isArray(hit.prerequisites)).toBe(true);

    expect(data.hits.length).toBe(2);
    for (const mathHit of data.hits) {
      expect(mathHit.courseCode).toBe("MATH1001");
      assertEnrichedHit(mathHit);
      expect((mathHit.prerequisites as unknown[]).length).toBe(0);
    }

    const bySection = new Map(data.hits.map((h) => [h.section as string, h]));
    expect(bySection.get("001")?.teacher).toBe("JIN XIAO QING");
    expect(bySection.get("002")?.teacher).toBe("SUN HAIWEI");
    expect(bySection.get("001")?.notes).toBe("");
    expect(bySection.get("001")?.restriction).toBe("");
    expect(bySection.get("002")?.notes).toBe("");
    expect(bySection.get("002")?.restriction).toBe("");

    const meetings001 = (bySection.get("001")?.meetings as SearchMeeting[]).map((m) => ({
      day: m.day,
      start: m.startMinutes,
      end: m.endMinutes,
    }));
    expect(meetings001).toEqual(
      expect.arrayContaining([
        { day: "TUE", start: 600, end: 675 },
        { day: "FRI", start: 600, end: 675 },
        { day: "WED", start: 660, end: 710 },
      ]),
    );
    expect(meetings001).toHaveLength(3);

    const meetings002 = (bySection.get("002")?.meetings as SearchMeeting[]).map((m) => ({
      day: m.day,
      start: m.startMinutes,
      end: m.endMinutes,
    }));
    expect(meetings002).toEqual(
      expect.arrayContaining([
        { day: "MON", start: 690, end: 765 },
        { day: "THU", start: 690, end: 765 },
        { day: "WED", start: 600, end: 650 },
        { day: "WED", start: 660, end: 710 },
      ]),
    );
    expect(meetings002).toHaveLength(4);
  });

  it("returns more than 10 CSCI hits with CSCI3010 prerequisite detail", async () => {
    const res = await GET(new Request("http://localhost:3000/api/search?q=CSCI"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { hits: Array<Record<string, unknown>> };
    expect(data.hits.length).toBeGreaterThan(10);
    expect(data.hits.length).toBeLessThanOrEqual(20);

    const csci3010 = data.hits.find((h) => h.courseCode === "CSCI3010");
    expect(csci3010).toBeDefined();
    const prerequisites = csci3010!.prerequisites as SearchPrerequisite[];
    expect(prerequisites.length).toBeGreaterThanOrEqual(1);

    const prereq = prerequisites[0];
    expect(prereq).toHaveProperty("preRequisiteFor");
    expect(prereq).toHaveProperty("majorList");
    expect(prereq).toHaveProperty("requiredCount");
    expect(prereq).toHaveProperty("groupNo");
    expect(prereq).toHaveProperty("requiredCourseCode");
    expect(prereq.preRequisiteFor).toBe("ALL");
    expect(prereq.majorList).toBe("");
    expect(prereq.requiredCount).toBe(1);
    expect(prereq.groupNo).toBe("1");
    expect(prereq.requiredCourseCode).toBe("CSCI3001");
  });

  it("handles empty query by returning empty hits list", async () => {
    const req = new Request("http://localhost:3000/api/search?q=");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { hits: unknown[] };
    expect(data.hits).toEqual([]);
  });
});
