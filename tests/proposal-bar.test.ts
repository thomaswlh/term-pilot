import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("proposal review bar", () => {
  const editor = readFileSync("src/components/editor.tsx", "utf8");
  const week = readFileSync("src/components/week.tsx", "utf8");

  it("keeps the confirm actions and docks them on the week sheet", () => {
    expect(editor).toContain("function changeSentence");
    expect(editor).toContain("{proposalSentence}");
    expect(editor).toContain("{proposalCreditLabel}");
    expect(editor).not.toContain("proposalCredits");
    expect(editor).not.toContain("demoCredits");
    expect(editor).toContain('confirmProposal("discard")');
    expect(editor).toContain('confirmProposal("save-as-new")');
    expect(editor).toContain('confirmProposal("apply")');
    expect(editor).toContain("Discard");
    expect(editor).toContain("Save as a new timetable");
    expect(editor).toContain("Apply to the current timetable");
    expect(editor).not.toContain("Save as new");
    expect(editor).not.toContain("Apply to timetable");
    expect(week).toContain('background: "#FAFBFD"');
  });
});
