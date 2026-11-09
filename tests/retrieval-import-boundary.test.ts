import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

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
  it("keeps legacy, dense, and hybrid out of the request path", () => {
    const files = [...filesUnder("src/app"), ...filesUnder("src/agent"), "src/domain/planner.ts"];
    const forbidden = ["domain/search-legacy", "domain/retrieval/dense", "domain/retrieval/hybrid", "domain/retrieval/model"];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const needle of forbidden) expect(source, file).not.toContain(needle);
    }
  });
});
