import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogue } from "../src/domain/catalogue";
import { collapseCourses } from "../src/domain/retrieval/course-rank";
import { courseEmbeddingText } from "../src/domain/retrieval/course-text";
import { fuseCourses } from "../src/domain/retrieval/hybrid";
import { EMBEDDING_MODEL } from "../src/domain/retrieval/model";
import type { PoolDocument } from "../src/domain/retrieval/pool";
import { rankByCosine } from "../src/domain/retrieval/vector";
import { prepareSearchIndex, scoreSections } from "../src/domain/search";

const poolPath = path.join(process.cwd(), "tests/retrieval/pool.json");
const sheetPath = path.join(process.cwd(), "tests/retrieval/labeling-sheet.csv");
const PACKAGE_VERSION = "4.3.2";
const FUSION_DEPTH = 50;

async function main(): Promise<void> {
  const sheetBefore = createHash("sha256").update(readFileSync(sheetPath)).digest("hex");
  const pool = JSON.parse(readFileSync(poolPath, "utf8")) as PoolDocument;
  const catalogue = loadCatalogue();
  prepareSearchIndex(catalogue);

  const courses = coursesInCodeOrder(catalogue);
  const courseTextHash = createHash("sha256")
    .update(courses.map((c) => c.text).join("\n"))
    .digest("hex");
  if (courseTextHash !== pool.courseTextHash) {
    throw new Error("Course text hash mismatch");
  }

  const embeddingFile = path.join(
    process.cwd(),
    ".cache/retrieval/embeddings",
    `${EMBEDDING_MODEL.revision}-q8-${courseTextHash}.json`,
  );
  if (!existsSync(embeddingFile)) throw new Error(`Missing cache: ${embeddingFile}`);
  const cached = JSON.parse(readFileSync(embeddingFile, "utf8")) as {
    courseCodes: string[];
    vectors: number[][];
  };
  const rankedCourses = cached.courseCodes.map((courseCode, index) => ({
    courseCode,
    vector: cached.vectors[index] ?? [],
  }));

  const { loadEmbedder, embedTexts } = await import("../src/domain/retrieval/dense");
  const embedder = await loadEmbedder();
  const queryVectors = await embedTexts(
    embedder,
    pool.queries.map((query) => query.text),
  );

  const depth = pool.depth;
  for (let index = 0; index < pool.queries.length; index += 1) {
    const query = pool.queries[index]!;
    const queryVector = queryVectors[index];
    if (!queryVector) throw new Error(`Missing query vector for ${query.id}`);

    const bm25 = collapseCourses(scoreSections(catalogue, query.text), FUSION_DEPTH).map((row) => row.courseCode);
    const dense = rankByCosine(rankedCourses, queryVector, FUSION_DEPTH).map((row) => row.courseCode);
    const hybrid = fuseCourses(bm25, dense);

    if (JSON.stringify(bm25.slice(0, depth)) !== JSON.stringify(query.runs.bm25)) {
      throw new Error(`bm25 mismatch at depth for ${query.id}`);
    }
    if (JSON.stringify(dense.slice(0, depth)) !== JSON.stringify(query.runs.dense)) {
      throw new Error(`dense mismatch at depth for ${query.id}`);
    }
    if (JSON.stringify(hybrid.slice(0, depth)) !== JSON.stringify(query.runs.hybrid)) {
      throw new Error(`hybrid mismatch at depth for ${query.id}`);
    }

    query.fusionInputs = { bm25, dense };
  }

  writeFileSync(poolPath, `${JSON.stringify(pool, null, 2)}\n`, "utf8");

  const sheetAfter = createHash("sha256").update(readFileSync(sheetPath)).digest("hex");
  if (sheetBefore !== sheetAfter) throw new Error("Labeling sheet changed");
  console.log("Backfilled fusionInputs on", pool.queries.length, "queries");
}

function coursesInCodeOrder(catalogue: ReturnType<typeof loadCatalogue>) {
  const byCourse = new Map<string, typeof catalogue.sections>();
  for (const section of catalogue.sections) {
    const list = byCourse.get(section.courseCode) ?? [];
    list.push(section);
    byCourse.set(section.courseCode, list);
  }
  return [...byCourse.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((courseCode) => {
      const sections = byCourse.get(courseCode) ?? [];
      return { courseCode, text: courseEmbeddingText(courseCode, sections) };
    });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
