import { describe, expect, it } from "vitest";
import { buildSheet, poolDepthFor, sheetBlocksRewrite } from "../src/domain/retrieval/pool";

const fusionBm25 = Array.from({ length: 50 }, (_, index) => `B${String(index).padStart(2, "0")}`);
const fusionDense = Array.from({ length: 50 }, (_, index) => `D${String(index).padStart(2, "0")}`);

const queries = [
  {
    id: "a1",
    category: "A" as const,
    text: "linear algebra",
    runs: {
      "bm25-legacy": [] as string[],
      bm25: ["MATH1001", "ISOM2005"],
      dense: ["ISOM2005", "MATH1001"],
      hybrid: ["MATH1001"],
    },
    fusionInputs: { bm25: fusionBm25, dense: fusionDense },
  },
];

const fields = new Map([
  ["MATH1001", { title: "Linear Algebra I", department: "MTH", instructor: "JIN XIAO QING | SUN HAIWEI", notes: "" }],
  ["ISOM2005", { title: "Linear Algebra, Honours", department: "AIM", instructor: "A", notes: "Line one\nLine two" }],
]);

describe("pool sheet", () => {
  it("uses depth 10 until the deduped row count passes 240", () => {
    expect(poolDepthFor(240)).toBe(10);
    expect(poolDepthFor(241)).toBe(5);
  });

  it("writes empty labels and ranks in run order", () => {
    const built = buildSheet({ queries, fields, depth: 10, model: pinnedModel(), courseTextHash: "abc", latency: emptyLatency() });
    expect(built.depth).toBe(10);
    expect(built.csv).toContain("bm25:1;dense:2;hybrid:1,");
    expect(built.csv).toContain("bm25:2;dense:1,");
    expect(built.csv).not.toContain("relevant");
    expect(built.csv).not.toContain("irrelevant");
    expect(built.csv.split("\n")[0]).toBe(
      "queryId,category,query,courseCode,title,department,instructor,notes,proposedBy,label",
    );
    expect(built.pool.queries[0]?.fusionInputs?.bm25).toHaveLength(50);
    expect(built.pool.queries[0]?.runs.bm25).toHaveLength(2);
    expect(built.csv).not.toContain("B49");
  });

  it("quotes a comma and turns a newline into a space", () => {
    const built = buildSheet({ queries, fields, depth: 10, model: pinnedModel(), courseTextHash: "abc", latency: emptyLatency() });
    expect(built.csv).toContain('"Linear Algebra, Honours"');
    expect(built.csv).toContain("Line one Line two");
    expect(built.csv).not.toContain("Line one\nLine two");
  });

  it("blocks a rewrite once any label cell is non-empty", () => {
    expect(sheetBlocksRewrite("label\n")).toBe(false);
    expect(sheetBlocksRewrite("queryId,label\na1,relevant")).toBe(true);
    expect(sheetBlocksRewrite("queryId,label\na1,maybe")).toBe(true);
  });
});

function pinnedModel() {
  return {
    id: "Xenova/all-MiniLM-L6-v2",
    revision: "751bff37182d3f1213fa05d7196b954e230abad9",
    packageVersion: "4.3.2",
    dtype: "q8",
  };
}

function emptyLatency() {
  return {
    bm25LegacyBuildMs: 0,
    bm25BuildMs: 0,
    denseLoadMs: 0,
    embedBuildMs: 0,
    queryMs: { "bm25-legacy": [0], bm25: [0], dense: [0], hybrid: [0] },
  };
}
