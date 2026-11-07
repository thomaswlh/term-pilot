import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Week } from "../src/components/week";
import type { WeekBlock } from "../src/domain/week";

const proposal: WeekBlock = {
  sectionKey: "GELH1012:001",
  courseCode: "GELH1012",
  title: "World History",
  day: "MON",
  startMinutes: 13 * 60,
  endMinutes: 14 * 60 + 15,
  hue: "green",
  kind: "proposal",
  conflict: true,
};

const saved: WeekBlock = {
  ...proposal,
  sectionKey: "CISC1000:001",
  courseCode: "CISC1000",
  kind: "saved",
  conflict: false,
  day: "TUE",
};

const proposalFill = "color-mix(in srgb, #D8EDE1 50%, #FFFFFF)";

function styleFor(html: string, kind: "proposal" | "saved" | "preview"): string {
  const marker = `data-kind="${kind}" style="`;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`missing ${kind} block`);
  const from = start + marker.length;
  const end = html.indexOf('"', from);
  return html.slice(from, end);
}

describe("proposal block markup", () => {
  it("draws a dashed Proposal block and a solid saved block", () => {
    const html = renderToStaticMarkup(
      <Week days={["MON", "TUE"]} blocks={[proposal, saved]} removingKey={null} onRemove={() => {}} />,
    );
    const proposalStyle = styleFor(html, "proposal");
    const savedStyle = styleFor(html, "saved");
    expect(html).toContain(">GELH1012<");
    expect(html).toContain("World History · Proposal");
    expect(proposalStyle).toContain("1.5px dashed #235E38");
    expect(proposalStyle).toContain("3px solid #235E38");
    expect(proposalStyle).toContain(`background:${proposalFill}`);
    expect(proposalStyle).not.toContain("background:#D8EDE1");
    expect(html).toContain("box-shadow:inset 0 0 0 2px #B3261E");
    expect(html).toContain("animation:none");
    expect(html).not.toContain("pulse");
    expect(html).toContain(">CISC1000<");
    expect(savedStyle).toContain("background:#D8EDE1");
    expect(savedStyle).toContain("3px solid");
    expect(savedStyle).not.toContain("color-mix");
    expect(html).not.toContain("Proposal CISC1000");
    expect(html).toContain(">×<");
    expect(html).toContain('aria-label="Remove CISC1000');
  });

  it("hides Remove while a proposal preview locks manual edits", () => {
    const html = renderToStaticMarkup(
      <Week
        days={["MON", "TUE"]}
        blocks={[proposal, saved]}
        removingKey={null}
        removable={false}
        onRemove={() => {}}
      />,
    );
    const proposalStyle = styleFor(html, "proposal");
    const savedStyle = styleFor(html, "saved");
    expect(html).not.toContain("Remove");
    expect(html).toContain(">GELH1012<");
    expect(html).toContain("World History · Proposal");
    expect(proposalStyle).toContain("1.5px dashed #235E38");
    expect(proposalStyle).toContain(`background:${proposalFill}`);
    expect(proposalStyle).not.toContain("background:#D8EDE1");
    expect(html).toContain(">CISC1000<");
    expect(savedStyle).toContain("background:#D8EDE1");
    expect(savedStyle).toContain("3px solid");
  });
});

describe("search preview block markup", () => {
  it("draws a dotted preview block with conflict ring", () => {
    const previewBlock: WeekBlock = {
      sectionKey: "MATH1001:001",
      courseCode: "MATH1001",
      title: "Calculus I",
      day: "MON",
      startMinutes: 10 * 60,
      endMinutes: 11 * 60 + 15,
      hue: "green",
      kind: "preview",
      conflict: true,
    };

    const html = renderToStaticMarkup(
      <Week days={["MON"]} blocks={[previewBlock]} removingKey={null} onRemove={() => {}} />,
    );

    const style = styleFor(html, "preview");
    expect(html).toContain(">MATH1001<");
    expect(html).toContain("Calculus I · Preview");
    expect(style).toContain("1.5px dotted #235E38");
    expect(style).toContain("3px solid #235E38");
    expect(style).toContain("background:transparent");
    expect(style).toContain("border-radius:6px");
    expect(html).toContain("box-shadow:inset 0 0 0 2px #B3261E");
  });

  it("renders no search field of its own", () => {
    const html = renderToStaticMarkup(
      <Week days={["MON"]} blocks={[]} removingKey={null} onRemove={() => {}} />,
    );
    expect(html).not.toContain("<input");
  });
});

describe("search discovery contract", () => {
  it("keeps debounced search and manual add without the floating dropdown", () => {
    const editor = readFileSync("src/components/editor.tsx", "utf8");
    expect(editor).toContain("/api/search?q=");
    expect(editor).toContain("AbortController");
    expect(editor).toContain("sectionFromHit");
    expect(editor).toContain("/api/timetables/${timetable.id}/sections");
    expect(editor).not.toContain("zIndex: 20");
    expect(editor).not.toContain("Search course code, title, or instructor (e.g. MATH1001)...");
    expect(editor).not.toContain("This overlaps a class already on the week.");
  });
});
