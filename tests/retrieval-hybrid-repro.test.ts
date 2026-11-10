import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fuseCourses } from "../src/domain/retrieval/hybrid";
import type { PoolDocument } from "../src/domain/retrieval/pool";

describe("committed pool hybrid reproducibility", () => {
  it("re-derives hybrid from stored fusion inputs at evaluation depth", () => {
    const pool = JSON.parse(readFileSync("tests/retrieval/pool.json", "utf8")) as PoolDocument;
    const depth = pool.depth;
    for (const query of pool.queries) {
      expect(query.fusionInputs, query.id).toBeDefined();
      const inputs = query.fusionInputs!;
      expect(inputs.bm25.slice(0, depth), `${query.id} bm25 prefix`).toEqual(query.runs.bm25);
      expect(inputs.dense.slice(0, depth), `${query.id} dense prefix`).toEqual(query.runs.dense);
      expect(fuseCourses(inputs.bm25, inputs.dense).slice(0, depth), `${query.id} hybrid`).toEqual(
        query.runs.hybrid,
      );
    }
  });
});
