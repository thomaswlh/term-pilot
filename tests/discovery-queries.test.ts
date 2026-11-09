import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const discoveryQueries = [
  { id: "a1", category: "A", text: "linear algebra" },
  { id: "a2", category: "A", text: "calculus" },
  { id: "a3", category: "A", text: "japanese" },
  { id: "a4", category: "A", text: "statistics" },
  { id: "b1", category: "B", text: "ML" },
  { id: "b2", category: "B", text: "coding" },
  { id: "b3", category: "B", text: "stats" },
  { id: "b4", category: "B", text: "AI" },
  { id: "c1", category: "C", text: "CSCI 1004" },
  { id: "c2", category: "C", text: "GELH 1012" },
  { id: "c3", category: "C", text: "Haiwei Sun" },
  { id: "c4", category: "C", text: "CSCI1004:001" },
];

describe("discovery queries", () => {
  it("reads the twelve labeling queries from JSON in order", () => {
    const queries = JSON.parse(readFileSync(new URL("./retrieval/discovery-queries.json", import.meta.url), "utf8"));
    expect(queries).toEqual(discoveryQueries);
  });
});
