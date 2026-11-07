import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const BANNED_PATTERNS = [
  { pattern: /#0B57D0/i, reason: "Banned Google blue button color" },
  { pattern: /#F4F0E8/i, reason: "Banned warm paper ground" },
  { pattern: /#FFFCF7/i, reason: "Banned warm paper sheet" },
  { pattern: /#1F1A16/i, reason: "Banned warm paper ink" },
  { pattern: /#8A5A3A/i, reason: "Banned warm paper focus" },
  { pattern: /#9A3E3A/i, reason: "Banned warm paper rose" },
  { pattern: /Demo credits/, reason: "User-facing label must be 'credits', not 'Demo credits'" },
];

function getFiles(dir: string, ext: string[]): string[] {
  let files: string[] = [];
  for (const item of readdirSync(dir)) {
    const full = join(dir, item);
    if (statSync(full).isDirectory()) {
      if (item !== "node_modules" && item !== ".next" && item !== ".git") {
        files = files.concat(getFiles(full, ext));
      }
    } else if (ext.some((e) => item.endsWith(e))) {
      files.push(full);
    }
  }
  return files;
}

describe("Visual and Anti-Slop Audit", () => {
  it("contains no banned Google brand cues or warm paper colors in src/", () => {
    const srcFiles = getFiles("src", [".ts", ".tsx", ".css"]);
    const violations: string[] = [];

    for (const file of srcFiles) {
      const content = readFileSync(file, "utf8");
      for (const { pattern, reason } of BANNED_PATTERNS) {
        if (pattern.test(content)) {
          // Allow internal domain definition of label in credits.ts if needed, but not in UI components
          if (file.includes("credits.ts") && reason.includes("Demo credits")) continue;
          violations.push(`${file}: matches ${pattern} (${reason})`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("verifies Nordic Steel Teal #1B5E6B and cool zinc ground #EFF2F5 are present in globals.css", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("#1B5E6B");
    expect(css).toContain("#EFF2F5");
  });

  it("verifies CourseSearchPanel and editor adhere strictly to Slate Atelier tokens", () => {
    const searchPanel = readFileSync("src/components/course-search-panel.tsx", "utf8");
    expect(searchPanel).toContain("360");
    expect(searchPanel).toContain("46");
    expect(searchPanel).toContain("14");
    expect(searchPanel).toContain("#144425"); // Fit sage
    expect(searchPanel).toContain("#D8EDE1"); // Fit sage tint
    expect(searchPanel).toContain("#FBEAE9"); // Conflict tint
    expect(searchPanel).not.toContain("#0B57D0");
    expect(searchPanel).not.toContain("#F4F0E8");
  });
});
