import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("TimetablePage props threading", () => {
  it("threads profile.majorCode to Editor", () => {
    const page = readFileSync("src/app/timetables/[id]/page.tsx", "utf8");
    expect(page).toContain("majorCode={profile.majorCode}");
  });

  it("validates saved proposals with prerequisiteClaims", () => {
    const page = readFileSync("src/app/timetables/[id]/page.tsx", "utf8");
    expect(page).toContain("claims: prerequisiteClaims(profile.courses)");
    expect(page).not.toContain("completedClaims");
  });
});
