import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN_SUFFIXES = [
  "search-legacy",
  "retrieval/dense",
  "retrieval/hybrid",
  "retrieval/model",
] as const;

const IMPORT_SPECIFIER_RE =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function forbiddenImportSpecifier(specifier: string): boolean {
  return FORBIDDEN_SUFFIXES.some((suffix) => specifier.includes(suffix));
}

export function forbiddenImportsInSource(source: string): string[] {
  const hits: string[] = [];
  for (const match of source.matchAll(IMPORT_SPECIFIER_RE)) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    if (forbiddenImportSpecifier(specifier)) hits.push(specifier);
  }
  return hits;
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...filesUnder(full));
    else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) found.push(full);
  }
  return found;
}

describe("retrieval import boundary", () => {
  it("flags deep relative paths the old substring guard missed", () => {
    expect(forbiddenImportSpecifier("../../retrieval/dense")).toBe(true);
    expect(forbiddenImportSpecifier("@/domain/retrieval/dense")).toBe(true);
  });

  it("keeps legacy, dense, and hybrid out of the request path", () => {
    const files = [...filesUnder("src/app"), ...filesUnder("src/agent"), "src/domain/planner.ts"];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const hits = forbiddenImportsInSource(source);
      expect(hits, file).toEqual([]);
    }
  });
});
