import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("search copy", () => {
  it("tells the agent and the panel that titles are searchable", () => {
    const route = fs.readFileSync("src/app/api/copilotkit/[[...slug]]/route.ts", "utf8");
    const panel = fs.readFileSync("src/components/course-search-panel.tsx", "utf8");
    expect(route).toContain("Search the semester catalogue by course code, course title, or instructor name.");
    expect(route).not.toContain("not topic keywords");
    expect(panel).toContain('placeholder="Course code, title, or instructor"');
    expect(panel).toContain("Try a course code, a title word, or an instructor name.");
    expect(panel).not.toContain("or professor name.");
  });
});
