import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const REQUIRED = [
  "sheetBlocksRewrite",
  "loadEmbedder",
  "prepareLegacyIndex",
  "prepareSearchIndex",
  ".cache/retrieval/embeddings",
  "EMBEDDING_MODEL",
  "fuseCourses",
  "FUSION_DEPTH",
  "Relevance labels are human",
];

describe("retrieval pool command", () => {
  it("locks the offline script to human labels and the pinned helpers", () => {
    const scriptUrl = new URL("../scripts/retrieval-pool.ts", import.meta.url);
    expect(existsSync(scriptUrl), "scripts/retrieval-pool.ts").toBe(true);
    if (!existsSync(scriptUrl)) return;

    const source = readFileSync(scriptUrl, "utf8");
    for (const token of REQUIRED) expect(source).toContain(token);

    const guardAt = source.indexOf("Refusing to replace a labeled sheet");
    const embedderAt = source.indexOf("loadEmbedder");
    expect(guardAt).toBeGreaterThanOrEqual(0);
    expect(embedderAt).toBeGreaterThan(guardAt);
    expect(source).toMatch(/await import\(\s*["'][^"']*retrieval\/dense["']\s*\)/);
    expect(source).not.toMatch(/from\s+["'][^"']*retrieval\/dense["']/);

    const outsideGuard = source.replaceAll("Refusing to replace a labeled sheet", "");
    expect(outsideGuard.toLowerCase()).not.toContain("relevant");
  });
});
