import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Gallery, type GalleryCard } from "../src/components/gallery";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {}, refresh: () => {} }),
}));

vi.mock("@/components/account-menu", () => ({
  AccountMenu: () => <div>Account</div>,
}));

const sampleCard: GalleryCard = {
  id: "tt-1",
  title: "Semester 1",
  editedLabel: "7 Nov 2026",
  creditTotal: 6,
  columns: [
    { day: "MON", blocks: [{ hue: "green", top: 0.2 }] },
    { day: "TUE", blocks: [] },
    { day: "WED", blocks: [] },
    { day: "THU", blocks: [] },
    { day: "FRI", blocks: [] },
    { day: "SAT", blocks: [] },
    { day: "SUN", blocks: [] },
  ],
};

describe("Gallery component", () => {
  it("renders Slate Atelier cards with a 124px cover and credits label", () => {
    const html = renderToStaticMarkup(<Gallery cards={[sampleCard]} />);
    const source = readFileSync("src/components/gallery.tsx", "utf8");

    expect(html).not.toContain("Studio Gallery");
    expect(html).toContain("Semester 1");
    expect(html).toContain("7 Nov 2026 · 6 credits");
    expect(html).not.toContain("Demo credits");
    expect(html).toContain("New timetable");
    expect(html).toContain("height:124px");
    expect(html).toContain("#FAFBFD");
    expect(html).toContain("minmax(300px, 1fr)");
    expect(html).toContain("gap:18px");
    expect(html).toContain('aria-label="Actions for Semester 1"');
    expect(html).toContain('aria-label="Open Semester 1"');
    expect(html).toContain("margin-top:14px;position:relative;z-index:1;pointer-events:none");
    expect(html).toContain("pointer-events:auto");
    expect(html).toMatch(/aria-label="Actions for Semester 1"[^>]*pointer-events:auto/);
    expect(source).toContain('from "@/components/ui/dialog"');
    expect(source).toContain("Delete this timetable?");
    expect(source).toContain("permanently removed");
    expect(source).not.toContain("creditLabel");
  });
});
