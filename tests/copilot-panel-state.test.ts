import { describe, expect, it } from "vitest";
import { planToolView, toolTitle } from "../src/components/plan-tool-state";

describe("plan tool view", () => {
  it("shows a credit report without treating a stored-nothing result as a failure", () => {
    const view = planToolView(
      {
        proposalId: null,
        summary: "Verified credits: 0. Target 18, gap 18.",
        credits: { verifiedTotal: 0, unknownCourseCodes: [], status: "verified", target: 18, gap: 18 },
        droppedWishes: [],
      },
      false,
    );
    expect(view.failed).toBe(false);
    expect(view.detail).toBe("Verified credits: 0. Target 18, gap 18.");
    expect(view.proposalId).toBeNull();
  });

  it("shows a validation failure and a running search", () => {
    const view = planToolView({ ok: false, failures: [{ rule: "no-sections" }], warnings: [] }, false);
    expect(view.failed).toBe(true);
    expect(view.detail).toBe("Add at least one section before checking the rules.");
    expect(toolTitle("searchSections", "running")).toBe("Searching the catalogue");
    expect(toolTitle("searchSections", "done")).toBe("Searched the catalogue");
    expect(toolTitle("plan", "failed")).toBe("Could not draft a proposal");
  });

  it("treats a backend Error prefix as a failed tool result", () => {
    const limit = planToolView(
      "Error: This turn reached its 12-tool-call limit. Ask for a smaller change.",
      false,
    );
    expect(limit).toEqual({
      failed: true,
      detail: "This turn reached its 12-tool-call limit. Ask for a smaller change.",
      proposalId: null,
      summary: null,
    });
    expect(toolTitle("plan", limit.failed ? "failed" : "done")).toBe("Could not draft a proposal");

    const timeout = planToolView(
      "Error: This turn reached its 60-second limit. Ask for a smaller change.",
      false,
    );
    expect(timeout.failed).toBe(true);
    expect(timeout.detail).toBe("This turn reached its 60-second limit. Ask for a smaller change.");
  });

  it("does not treat a successful payload that mentions an error as a thrown failure", () => {
    const view = planToolView(
      {
        proposalId: null,
        summary: "No section changes. Verified credits: 3.",
        credits: { verifiedTotal: 3, unknownCourseCodes: [], status: "verified", target: null, gap: null },
        reason: "Error: not a thrown tool",
      },
      false,
    );
    expect(view.failed).toBe(false);
    expect(view.detail).toBe("No section changes. Verified credits: 3.");
  });

  it("titles a plan that stored nothing as a check, and a stored plan as a proposal", () => {
    const creditOnly = planToolView(
      {
        proposalId: null,
        summary: "No section changes. Verified credits: 3.",
        credits: { verifiedTotal: 3, unknownCourseCodes: [], status: "verified", target: null, gap: null },
        droppedWishes: [],
      },
      false,
    );
    expect(toolTitle("plan", "done", creditOnly)).toBe("Checked this timetable");

    const drafted = planToolView(
      {
        proposalId: "proposal-1",
        summary: "added MATH1001:001.",
        credits: { verifiedTotal: 6, unknownCourseCodes: [], status: "verified", target: null, gap: null },
        droppedWishes: [],
      },
      false,
    );
    expect(toolTitle("plan", "done", drafted)).toBe("Drafted a proposal");
    expect(toolTitle("plan", "failed", creditOnly)).toBe("Could not draft a proposal");
  });
});
