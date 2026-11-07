import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProposalList } from "../src/components/proposal-list";

describe("proposal list", () => {
  it("renders statuses newest-first and omits confirm actions on resolved rows", () => {
    const html = renderToStaticMarkup(
      <ProposalList
        items={[
          { id: "p-new", summary: "newest plan", status: "open", stale: false },
          { id: "p-applied", summary: "applied plan", status: "applied", stale: false },
          { id: "p-saved", summary: "saved plan", status: "saved-as-new", stale: false },
          { id: "p-discard", summary: "discarded plan", status: "discarded", stale: false },
        ]}
        selectedId={null}
        onOpenProposal={() => {}}
        onHideProposal={() => {}}
      />,
    );
    expect(html.indexOf("newest plan")).toBeLessThan(html.indexOf("applied plan"));
    expect(html).toContain("Open");
    expect(html).toContain("Applied");
    expect(html).toContain("Saved as new");
    expect(html).toContain("Discarded");
    expect(html).toContain("Show on week");
    expect(html).not.toContain("Apply to the current timetable");
    expect(html).not.toContain("Save as a new timetable");
    expect(html).not.toContain("Discarding");
  });

  it("marks stale open proposals", () => {
    const html = renderToStaticMarkup(
      <ProposalList
        items={[{ id: "p-stale", summary: "stale plan", status: "open", stale: true }]}
        selectedId={null}
        onOpenProposal={() => {}}
        onHideProposal={() => {}}
      />,
    );
    expect(html).toContain("Out of date");
  });
});
