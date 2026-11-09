import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogue, type Catalogue } from "../src/domain/catalogue";
import { assertSheet, renderBrief, type BriefPool } from "../src/domain/retrieval/brief";
import { mrr, recallAt5 } from "../src/domain/retrieval/metrics";
import { writeAtomic } from "../src/domain/retrieval/pool";
import { searchSections } from "../src/domain/search";
import { searchSectionsLegacy } from "../src/domain/search-legacy";

const poolPath = path.join(process.cwd(), "tests/retrieval/pool.json");
const sheetPath = path.join(process.cwd(), "tests/retrieval/labeling-sheet.csv");
const queriesPath = path.join(process.cwd(), "tests/retrieval/queries.json");
const briefPath = path.join(process.cwd(), "docs/retrieval/decision-brief.md");

type ExactQuery = { text: string; relevant: string[] };

function main(): void {
  if (!existsSync(poolPath)) throw new Error(`Missing study file: ${poolPath}`);
  if (!existsSync(sheetPath)) throw new Error(`Missing study file: ${sheetPath}`);

  const pool = JSON.parse(readFileSync(poolPath, "utf8")) as BriefPool;
  const csv = readFileSync(sheetPath, "utf8");
  assertSheet(pool, csv);

  const catalogue = loadCatalogue();
  const queries = loadExactQueries(queriesPath);
  const legacy = exactScores(catalogue, queries, searchSectionsLegacy);
  const repaired = exactScores(catalogue, queries, searchSections);
  const brief = renderBrief({
    pool,
    csv,
    exact: {
      legacyRecall: legacy.recall,
      legacyMrr: legacy.mrr,
      repairedRecall: repaired.recall,
      repairedMrr: repaired.mrr,
    },
  });

  mkdirSync(path.dirname(briefPath), { recursive: true });
  writeAtomic(briefPath, brief);
}

function loadExactQueries(filePath: string): ExactQuery[] {
  if (!existsSync(filePath)) throw new Error(`Missing study file: ${filePath}`);
  const parsed = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  if (!Array.isArray(parsed)) throw new Error("queries.json must be an array");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid query row");
    const row = item as { text?: unknown; relevant?: unknown };
    if (typeof row.text !== "string" || !Array.isArray(row.relevant)) throw new Error("Invalid query row");
    const relevant = row.relevant.filter((key): key is string => typeof key === "string");
    if (relevant.length !== row.relevant.length) throw new Error("Invalid query row");
    return { text: row.text, relevant };
  });
}

function exactScores(
  catalogue: Catalogue,
  queries: ExactQuery[],
  rank: (catalogue: Catalogue, query: string, limit: number) => { sectionKey: string }[],
): { recall: number; mrr: number } {
  const recalls: number[] = [];
  const reciprocal: number[] = [];
  for (const query of queries) {
    const ranked = rank(catalogue, query.text, 50).map((hit) => hit.sectionKey);
    recalls.push(recallAt5(query.relevant, ranked));
    reciprocal.push(mrr(query.relevant, ranked));
  }
  if (recalls.length === 0) return { recall: 0, mrr: 0 };
  return {
    recall: recalls.reduce((sum, value) => sum + value, 0) / recalls.length,
    mrr: reciprocal.reduce((sum, value) => sum + value, 0) / reciprocal.length,
  };
}

main();
