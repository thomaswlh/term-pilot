import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Editor shell and rail", () => {
  it("describes the 380px sheet, the 46px rail, and the mounted panel", () => {
    const editor = readFileSync("src/components/editor.tsx", "utf8");
    const week = readFileSync("src/components/week.tsx", "utf8");

    expect(editor).toContain('aria-label="Back to gallery"');
    expect(editor).toContain("AI Planner");
    expect(editor).toContain("AI PLANNER");
    expect(editor).toContain("Collapse AI chat");
    expect(editor).toContain("Expand AI chat");
    expect(editor).toContain("CHAT_WIDTH_DEFAULT");
    expect(editor).toContain("46");
    expect(editor).toContain('aria-label="Resize AI chat"');
    expect(editor).toContain('role="separator"');
    expect(editor).toContain("{creditTotal} credits");
    expect(editor).toContain("<CopilotPanel");
    expect(editor).toContain("hidden={!chatOpen}");
    expect(editor).not.toContain("{chatOpen && <CopilotPanel");
    expect(editor).not.toContain("chatOpen ? <CopilotPanel");
    expect(editor).not.toContain("Hide chat");
    expect(editor).not.toContain("Show chat");
    expect(editor).not.toContain("Demo credits");
    expect(editor).not.toContain("borderRadius: 999");
    expect(week).toContain("borderRadius: 14");
    expect(week).toContain("minWidth: 960");
    expect(week).not.toContain("borderRadius: 18");
    expect(week).not.toContain("minWidth: 980");
  });
});
