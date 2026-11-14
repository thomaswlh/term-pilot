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

const { appStore } = vi.hoisted(() => ({
  appStore: {
    getTimetable: vi.fn(),
    getProfile: vi.fn(),
    listProposals: vi.fn(),
    writeSections: vi.fn(),
  },
}));

vi.mock("@/auth", () => ({
  requireUserId,
  UnauthorizedError,
}));

vi.mock("@/db/server-store", () => ({
  appStore,
}));

import { DELETE, POST } from "../src/app/api/timetables/[id]/sections/route";

describe("timetables/[id]/sections mutation proposal lock", () => {
  const context = { params: Promise.resolve({ id: "tt_test" }) };

  beforeEach(() => {
    vi.clearAllMocks();
    requireUserId.mockResolvedValue("user_test");
  });

  it("rejects POST and DELETE with 409 when an open proposal exists and does not call writeSections", async () => {
    appStore.getTimetable.mockResolvedValue({
      id: "tt_test",
      userId: "user_test",
      sectionKeys: [],
      revision: 1,
    });
    appStore.listProposals.mockResolvedValue([
      { id: "prop_1", status: "open" },
    ]);

    const postReq = new Request("http://localhost/api/timetables/tt_test/sections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sectionKey: "MATH1001:001" }),
    });

    const postRes = await POST(postReq, context);
    expect(postRes.status).toBe(409);
    const postBody = await postRes.json();
    expect(postBody).toEqual({
      error: "Finish reviewing the open AI proposal to add courses manually.",
    });

    const deleteReq = new Request("http://localhost/api/timetables/tt_test/sections", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sectionKey: "MATH1001:001" }),
    });

    const deleteRes = await DELETE(deleteReq, context);
    expect(deleteRes.status).toBe(409);
    const deleteBody = await deleteRes.json();
    expect(deleteBody).toEqual({
      error: "Finish reviewing the open AI proposal to add courses manually.",
    });

    expect(appStore.writeSections).not.toHaveBeenCalled();
  });

  it("accepts a manual add when proposals are only applied, only discarded, or only saved-as-new", async () => {
    const nonLockingStatuses = ["applied", "discarded", "saved-as-new"] as const;

    for (const status of nonLockingStatuses) {
      vi.clearAllMocks();
      appStore.getTimetable.mockResolvedValue({
        id: "tt_test",
        userId: "user_test",
        sectionKeys: [],
        revision: 1,
      });
      appStore.listProposals.mockResolvedValue([
        { id: "prop_1", status },
      ]);
      appStore.getProfile.mockResolvedValue({
        saved: true,
        majorCode: "CPS19",
        courses: [],
        yearOfStudy: null,
        admissionCohort: null,
        interests: null,
      });
      appStore.writeSections.mockResolvedValue({
        id: "tt_test",
        userId: "user_test",
        sectionKeys: ["MATH1001:001"],
        revision: 2,
      });

      const postReq = new Request("http://localhost/api/timetables/tt_test/sections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sectionKey: "MATH1001:001" }),
      });

      const res = await POST(postReq, context);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.timetable.sectionKeys).toEqual(["MATH1001:001"]);
      expect(body.timetable.revision).toBe(2);
      expect(appStore.writeSections).toHaveBeenCalledWith(
        "user_test",
        "tt_test",
        ["MATH1001:001"],
        2,
      );
    }
  });
});
