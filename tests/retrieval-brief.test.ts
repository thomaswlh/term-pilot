import { describe, expect, it } from "vitest";
import { assertSheet, renderBrief, type BriefPool } from "../src/domain/retrieval/brief";

const pool: BriefPool = {
  depth: 10,
  model: {
    id: "Xenova/all-MiniLM-L6-v2",
    revision: "751bff37182d3f1213fa05d7196b954e230abad9",
    packageVersion: "4.3.2",
    dtype: "q8",
  },
  courseTextHash: "abc",
  latency: {
    bm25LegacyBuildMs: 1,
    bm25BuildMs: 1,
    denseLoadMs: 1,
    embedBuildMs: 1,
    queryMs: { "bm25-legacy": [1, 3], bm25: [1, 3], dense: [1, 3], hybrid: [1, 3] },
  },
  queries: [
    {
      id: "a1",
      category: "A",
      text: "linear algebra",
      runs: { "bm25-legacy": [], bm25: ["MATH1001"], dense: ["OTHER"], hybrid: ["MATH1001"] },
    },
  ],
};

const sheet = [
  "queryId,category,query,courseCode,title,department,instructor,notes,proposedBy,label",
  "a1,A,linear algebra,MATH1001,Linear Algebra I,MTH,JIN,,bm25:1,relevant",
  "a1,A,linear algebra,OTHER,Other,CSC,A,,dense:1,",
].join("\n");

describe("renderBrief", () => {
  it("reports categories, the pinned model, and a dense regression without naming a winner", () => {
    const brief = renderBrief({
      pool,
      csv: sheet,
      exact: { legacyRecall: 0.967, legacyMrr: 1, repairedRecall: 1, repairedMrr: 1 },
    });
    expect(brief).toContain("## Category A");
    expect(brief).toContain("## Category B");
    expect(brief).toContain("## Category C");
    const categoryA = brief.split("## Category B")[0] ?? "";
    expect(categoryA).toContain("Category A bm25 Recall@10=1 MRR=1 nDCG=1");
    expect(categoryA).toContain("Category A bm25-legacy Recall@10=0 MRR=0 nDCG=0");
    expect(categoryA).toContain("Category A dense Recall@10=0 MRR=0 nDCG=0");
    expect(categoryA).toContain("Category A hybrid Recall@10=1 MRR=1 nDCG=1");
    expect(categoryA).toContain("a1 bm25 Recall@10=1 MRR=1 nDCG=1");
    expect(categoryA).toContain("a1 bm25-legacy Recall@10=0 MRR=0 nDCG=0");
    expect(categoryA).toContain("a1 dense Recall@10=0 MRR=0 nDCG=0");
    expect(categoryA).toContain("a1 hybrid Recall@10=1 MRR=1 nDCG=1");
    expect(categoryA).not.toContain("No scored queries");
    expect(brief.split("## Category C")[0]).toContain("No scored queries");
    expect(brief.split("## Category C")[1]).toContain("No scored queries");
    expect(brief).toContain("Unjudged courses are omitted before scoring.");
    expect(brief).toContain("Precision@returned");
    expect(brief).toContain("a1 bm25 returned=");
    expect(brief).toContain("Category A bm25 Precision@returned mean=1 (n=1 queries)");
    expect(brief).toContain("Recall@k counts relevant courses the run never returned.");
    expect(brief).toContain("bm25-legacy keeps the frozen tokenizer");
    expect(brief).toContain("751bff37182d3f1213fa05d7196b954e230abad9");
    expect(brief).toContain("Package 4.3.2");
    expect(brief).toContain("Depth 10");
    expect(brief).toContain("k=10");
    expect(brief).toContain("q8");
    expect(brief).toContain("Regression a1 dense");
    expect(brief).toContain("Regression a1 bm25-legacy");
    expect(brief).not.toContain("Regression a1 hybrid");
    expect(brief).toContain("Coverage bm25 judged=1 unjudged=0");
    expect(brief).toContain("Coverage dense judged=0 unjudged=1");
    expect(brief).toContain("Coverage bm25-legacy judged=0 unjudged=0");
    expect(brief).toContain("Coverage hybrid judged=1 unjudged=0");
    expect(brief).toContain("bm25 build=1");
    expect(brief).toContain("bm25-legacy build=1");
    expect(brief).toContain("dense load=1");
    expect(brief).toContain("embed build=1");
    expect(brief).toContain("bm25 query median=2 max=3");
    expect(brief).toContain("bm25-legacy query median=2 max=3");
    expect(brief).toContain("dense query median=2 max=3");
    expect(brief).toContain("hybrid query median=2 max=3");
    expect(brief).toContain("Legacy exact-code Recall@5=0.967 MRR=1");
    expect(brief).toContain("Repaired exact-code Recall@5=1 MRR=1");
    expect(brief.toLowerCase()).not.toContain("deploy");
  });

  it("rejects a bad label, a labeled course outside the pool, a duplicate row, and a bad depth", () => {
    expect(() => assertSheet(pool, sheet.replace("relevant", "maybe"))).toThrow(/label/i);
    expect(() =>
      assertSheet(pool, sheet.replace("OTHER,Other,CSC,A,,dense:1,", "MISSING,Other,CSC,A,,dense:1,relevant")),
    ).toThrow(/pool/i);
    expect(assertSheet(pool, sheet.replace("OTHER", "MISSING")).get("a1")?.has("MISSING")).toBe(false);
    expect(() => assertSheet(pool, `${sheet}\n${sheet.split("\n")[1]}`)).toThrow(/duplicate/i);
    expect(() => assertSheet({ ...pool, depth: 7 }, sheet)).toThrow(/depth/i);
  });
});
