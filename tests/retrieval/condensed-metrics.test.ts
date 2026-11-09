import { describe, expect, it } from "vitest";
import { scoreCondensed } from "../../src/domain/retrieval/metrics";

describe("scoreCondensed", () => {
  it("drops an unjudged course instead of treating it as irrelevant", () => {
    const judgments = new Map<string, "relevant" | "irrelevant">([
      ["A", "relevant"],
      ["B", "relevant"],
    ]);
    const scored = scoreCondensed(["U", "A", "B"], judgments, 10);
    expect(scored).toEqual({ recall: 1, mrr: 1, ndcg: 1 });
  });

  it("gives an irrelevant course gain 0 and keeps it in the condensed rank", () => {
    const judgments = new Map<string, "relevant" | "irrelevant">([
      ["I", "irrelevant"],
      ["A", "relevant"],
    ]);
    const scored = scoreCondensed(["I", "A"], judgments, 10);
    expect(scored?.recall).toBe(1);
    expect(scored?.mrr).toBe(0.5);
    expect(scored?.ndcg).toBeCloseTo(1 / Math.log2(3));
  });

  it("counts a judged relevant course that the run did not return", () => {
    const judgments = new Map<string, "relevant" | "irrelevant">([
      ["A", "relevant"],
      ["B", "relevant"],
    ]);
    expect(scoreCondensed(["A"], judgments, 10)?.recall).toBe(0.5);
  });

  it("returns null when the query has no relevant mark", () => {
    const judgments = new Map<string, "relevant" | "irrelevant">([["I", "irrelevant"]]);
    expect(scoreCondensed(["I"], judgments, 10)).toBeNull();
  });
});
