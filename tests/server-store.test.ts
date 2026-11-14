import { afterEach, describe, expect, it, vi } from "vitest";

type GlobalWithStore = typeof globalThis & {
  termPilotAppStore?: unknown;
  termPilotSql?: unknown;
  termPilotSchema?: unknown;
};

afterEach(() => {
  delete (globalThis as GlobalWithStore).termPilotAppStore;
  delete (globalThis as GlobalWithStore).termPilotSql;
  delete (globalThis as GlobalWithStore).termPilotSchema;
});

describe("appStore", () => {
  it("pins the store on globalThis and keeps timetables in one memory instance", async () => {
    const { appStore } = await import("../src/db/server-store");
    const created = await appStore.createTimetable("server-store-user", "Pinned");
    const list = await appStore.listTimetables("server-store-user");
    expect(list.some((row) => row.id === created.id)).toBe(true);
    expect((globalThis as GlobalWithStore).termPilotAppStore).toBeDefined();
  });

  it("exposes share methods as own properties on appStore", async () => {
    const { appStore } = await import("../src/db/server-store");
    expect(Object.hasOwn(appStore, "getShareStatus")).toBe(true);
    expect(Object.hasOwn(appStore, "enableShare")).toBe(true);
    expect(typeof appStore.getShareStatus).toBe("function");
  });

  it("replaces a stale global store missing share methods", async () => {
    const stale = { async getTimetable() { return null; } };
    (globalThis as GlobalWithStore).termPilotAppStore = stale;
    vi.resetModules();
    const { appStore } = await import("../src/db/server-store");
    expect(Object.hasOwn(appStore, "getShareStatus")).toBe(true);
    expect(typeof appStore.getShareStatus).toBe("function");
    expect(typeof appStore.enableShare).toBe("function");
    await appStore.getShareStatus("stale-check-user", "missing-id");
    const pinned = (globalThis as GlobalWithStore).termPilotAppStore;
    expect(pinned).not.toBe(stale);
    expect(typeof (pinned as { getShareStatus?: unknown }).getShareStatus).toBe("function");
  });
});
