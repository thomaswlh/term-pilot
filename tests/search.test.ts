import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { loadCatalogue } from "../src/domain/catalogue";
import { searchSections } from "../src/domain/search";
import type { Catalogue } from "../src/domain/types";
import { mrr, recallAt5 } from "./retrieval/metrics";

const QUERIES_PATH = path.join(process.cwd(), "tests/retrieval/queries.json");

type JudgmentRow = { id: string; text: string; relevant: string[] };

function loadJudgmentQueries(filePath: string): JudgmentRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing queries file at ${filePath}`);
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed) || parsed.length !== 20) {
    throw new Error("queries.json must be an array of length 20");
  }
  const rows: JudgmentRow[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      throw new Error("Invalid query row");
    }
    const rec = (item as { relevant?: unknown }).relevant;
    if (!Array.isArray(rec) || rec.length === 0) {
      throw new Error("Each query must have a non-empty relevant array");
    }
    rows.push(item as JudgmentRow);
  }
  return rows;
}

describe("retrieval judgments file", () => {
  it("rejects a missing file", () => {
    const missing = path.join(process.cwd(), "tests/retrieval/queries-does-not-exist.json");
    expect(() => loadJudgmentQueries(missing)).toThrow(/Missing queries file/);
  });

  it("rejects files that are not arrays of length 20", () => {
    const tmp = path.join(os.tmpdir(), `queries-invalid-${Date.now()}.json`);
    fs.writeFileSync(tmp, JSON.stringify([]));
    expect(() => loadJudgmentQueries(tmp)).toThrow(/array of length 20/);
    fs.unlinkSync(tmp);
  });

  it("rejects rows with an empty relevant array", () => {
    const tmp = path.join(os.tmpdir(), `queries-empty-rel-${Date.now()}.json`);
    const rows = Array.from({ length: 20 }, (_, index) =>
      index === 0 ? { id: "bad", text: "X", relevant: [] } : { id: `ok${index}`, text: "Y", relevant: ["Y:001"] },
    );
    fs.writeFileSync(tmp, JSON.stringify(rows));
    expect(() => loadJudgmentQueries(tmp)).toThrow(/non-empty relevant/);
    fs.unlinkSync(tmp);
  });

  it("loads the bundled queries.json", () => {
    const rows = loadJudgmentQueries(QUERIES_PATH);
    expect(rows).toHaveLength(20);
    expect(rows.every((row) => row.relevant.length > 0)).toBe(true);
  });
});

describe("searchSections", () => {
  const catalogue = loadCatalogue();

  it("returns at most 10 hits for GELH1012 and includes GELH1012:001", () => {
    const hits = searchSections(catalogue, "GELH1012");
    expect(hits.length).toBeLessThanOrEqual(10);
    expect(hits.some((hit) => hit.sectionKey === "GELH1012:001")).toBe(true);
  });

  it("includes ENGL4000:001 even when the section has no timed meeting", () => {
    const hits = searchSections(catalogue, "ENGL4000");
    expect(hits.some((hit) => hit.sectionKey === "ENGL4000:001")).toBe(true);
  });

  it("returns stable ordering for repeated queries", () => {
    const first = searchSections(catalogue, "CHLL2004").map((hit) => hit.sectionKey);
    const second = searchSections(catalogue, "CHLL2004").map((hit) => hit.sectionKey);
    expect(second).toEqual(first);
  });

  it("returns no hits when the query tokens do not match any section text", () => {
    const tiny: Catalogue = {
      sections: [
        {
          courseCode: "TEST101",
          section: "001",
          title: "Introductory Algebra Workshop",
          unit: "3",
          department: "MATH",
          teacher: "Jones",
          notes: "Morning section",
          restriction: "",
          meetings: [],
        },
      ],
      prerequisites: [],
      majors: [],
    };

    expect(searchSections(tiny, "quantumcomputingzephyr")).toEqual([]);
    expect(searchSections(tiny, "algebra")).toEqual([]);
    expect(searchSections(tiny, "Jones").some((hit) => hit.sectionKey === "TEST101:001")).toBe(true);
  });

  it("matches department prefix tokens such as CSCI", () => {
    const hits = searchSections(catalogue, "CSCI", 50);
    expect(hits.some((hit) => hit.courseCode.startsWith("CSCI"))).toBe(true);
  });

  it("prints Recall@5 and MRR without enforcing a minimum score", () => {
    const queries = loadJudgmentQueries(QUERIES_PATH);
    const recalls: number[] = [];
    const mrrs: number[] = [];

    for (const row of queries) {
      const ranked = searchSections(catalogue, row.text, 50).map((hit) => hit.sectionKey);
      recalls.push(recallAt5(row.relevant, ranked));
      mrrs.push(mrr(row.relevant, ranked));
    }

    const meanRecall = recalls.reduce((a, b) => a + b, 0) / recalls.length;
    const meanMrr = mrrs.reduce((a, b) => a + b, 0) / mrrs.length;
    process.stdout.write(`Recall@5=${meanRecall} MRR=${meanMrr}\n`);
  });
});
