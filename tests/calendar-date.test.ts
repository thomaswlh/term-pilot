import { describe, expect, it } from "vitest";
import { calendarDate } from "../src/domain/retrieval/calendar-date";

describe("calendarDate", () => {
  it("uses the local calendar day in Asia/Macau instead of UTC", () => {
    const instant = new Date("2026-11-09T20:32:00.000Z");
    expect(calendarDate(instant, "Asia/Macau")).toBe("2026-11-10");
  });
});
