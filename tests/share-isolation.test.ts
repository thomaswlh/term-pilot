import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("public share page", () => {
  it("does not read the profile", () => {
    const source = readFileSync(new URL("../src/app/s/[token]/page.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("getProfile");
    expect(source).not.toContain("interests");
    expect(source).not.toContain("courseRecords");
    expect(source).not.toContain("admissionCohort");
  });
});
