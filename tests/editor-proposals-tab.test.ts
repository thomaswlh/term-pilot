import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("editor proposals tab", () => {
  const editor = readFileSync("src/components/editor.tsx", "utf8");

  it("switches Chat and Proposals in the AI Planner sidebar", () => {
    expect(editor).toContain('role="tablist"');
    expect(editor).toContain("Proposals");
    expect(editor).toContain("ProposalList");
    expect(editor).toContain('sidebarTab !== "chat"');
    expect(editor).toContain("resolvedProposalSentence");
    expect(editor).toContain("openSelected");
  });
});
