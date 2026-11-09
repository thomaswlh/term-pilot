import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { loadCatalogue } from "../src/domain/catalogue";
import { collapseCourses } from "../src/domain/retrieval/course-rank";
import { courseEmbeddingText, courseFields } from "../src/domain/retrieval/course-text";
import { FUSION_DEPTH, fuseCourses } from "../src/domain/retrieval/hybrid";
import { EMBEDDING_MODEL } from "../src/domain/retrieval/model";
import {
  buildSheet,
  poolDepthFor,
  sheetBlocksRewrite,
  writeAtomic,
  type PoolLatency,
  type PoolQuery,
} from "../src/domain/retrieval/pool";
import { rankByCosine } from "../src/domain/retrieval/vector";
import { prepareSearchIndex, scoreSections } from "../src/domain/search";
import { prepareLegacyIndex, scoreSectionsLegacy } from "../src/domain/search-legacy";

const PACKAGE_VERSION = "4.3.2";
const EMBED_BATCH = 32;
const sheetPath = path.join(process.cwd(), "tests/retrieval/labeling-sheet.csv");
const poolPath = path.join(process.cwd(), "tests/retrieval/pool.json");
const queriesPath = path.join(process.cwd(), "tests/retrieval/discovery-queries.json");
const usagePath = path.join(process.cwd(), "docs/AI-USAGE.md");
const cacheDirectory = path.join(process.cwd(), ".cache/retrieval/embeddings");

type DiscoveryQuery = { id: string; category: string; text: string };
type CourseRecord = {
  courseCode: string;
  sections: ReturnType<typeof loadCatalogue>["sections"];
  text: string;
};

function main(): Promise<void> {
  if (existsSync(sheetPath) && sheetBlocksRewrite(readFileSync(sheetPath, "utf8"))) {
    throw new Error("Refusing to replace a labeled sheet");
  }

  return runPool();
}

async function runPool(): Promise<void> {
  const { loadEmbedder, embedTexts } = await import("../src/domain/retrieval/dense");
  const catalogue = loadCatalogue();
  const discovery = loadDiscoveryQueries(queriesPath);
  const courses = coursesInCodeOrder(catalogue);
  if (courses.length === 0) throw new Error("Catalogue has no courses.");

  const texts = courses.map((course) => course.text);
  const courseCodes = courses.map((course) => course.courseCode);
  const courseTextHash = createHash("sha256").update(texts.join("\n")).digest("hex");
  const embeddingFile = path.join(cacheDirectory, `${EMBEDDING_MODEL.revision}-q8-${courseTextHash}.json`);
  const cached = readCache(embeddingFile, courseCodes);

  console.log("Loading embedding model");
  const loadStarted = performance.now();
  const embedder = await loadEmbedder();
  const denseLoadMs = elapsedMs(loadStarted);

  const embedStarted = performance.now();
  const courseVectors = cached ?? (await embedChunks((batch) => embedTexts(embedder, batch), texts));
  assertVectors(courseVectors, texts.length);
  const queryVectors = await embedTexts(
    embedder,
    discovery.map((query) => query.text),
  );
  assertVectors(queryVectors, discovery.length);
  if (queryVectors[0]?.length !== courseVectors[0]?.length) throw new Error("Embedding width mismatch.");
  const embedBuildMs = elapsedMs(embedStarted);

  const legacyStarted = performance.now();
  prepareLegacyIndex(catalogue);
  const bm25LegacyBuildMs = elapsedMs(legacyStarted);
  const repairedStarted = performance.now();
  prepareSearchIndex(catalogue);
  const bm25BuildMs = elapsedMs(repairedStarted);

  const queryMs: PoolLatency["queryMs"] = {
    "bm25-legacy": [],
    bm25: [],
    dense: [],
    hybrid: [],
  };
  const rankedCourses = courseCodes.map((courseCode, index) => ({
    courseCode,
    vector: courseVectors[index] ?? [],
  }));
  const queries: PoolQuery[] = discovery.map((query, index) => {
    const queryVector = queryVectors[index];
    if (!queryVector) throw new Error("Missing query embedding.");

    const legacyQueryStarted = performance.now();
    const legacy = collapseCourses(scoreSectionsLegacy(catalogue, query.text), 10).map((row) => row.courseCode);
    queryMs["bm25-legacy"].push(elapsedMs(legacyQueryStarted));

    const repairedQueryStarted = performance.now();
    const repaired = collapseCourses(scoreSections(catalogue, query.text), FUSION_DEPTH).map((row) => row.courseCode);
    queryMs.bm25.push(elapsedMs(repairedQueryStarted));

    const denseQueryStarted = performance.now();
    const dense = rankByCosine(rankedCourses, queryVector, FUSION_DEPTH).map((row) => row.courseCode);
    queryMs.dense.push(elapsedMs(denseQueryStarted));

    const hybridStarted = performance.now();
    const hybrid = fuseCourses(repaired, dense);
    queryMs.hybrid.push(elapsedMs(hybridStarted));

    return {
      id: query.id,
      category: query.category,
      text: query.text,
      runs: { "bm25-legacy": legacy, bm25: repaired, dense, hybrid },
    };
  });

  const depth = poolDepthFor(sheetRowsAtDepth10(queries));
  const built = buildSheet({
    queries,
    fields: fieldsForPooled(courses, queries),
    depth,
    model: {
      id: EMBEDDING_MODEL.id,
      revision: EMBEDDING_MODEL.revision,
      packageVersion: PACKAGE_VERSION,
      dtype: EMBEDDING_MODEL.dtype,
    },
    courseTextHash,
    latency: { bm25LegacyBuildMs, bm25BuildMs, denseLoadMs, embedBuildMs, queryMs },
  });

  mkdirSync(cacheDirectory, { recursive: true });
  writeAtomic(embeddingFile, `${JSON.stringify({ courseCodes, vectors: courseVectors })}\n`);
  writeAtomic(poolPath, `${JSON.stringify(built.pool, null, 2)}\n`);
  writeAtomic(sheetPath, built.csv.endsWith("\n") ? built.csv : `${built.csv}\n`);
  recordUsage(usageEntry(new Date().toISOString().slice(0, 10)));
  console.log(`Wrote retrieval pool at depth ${built.depth}`);
}

function loadDiscoveryQueries(filePath: string): DiscoveryQuery[] {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  if (!Array.isArray(parsed) || parsed.length !== 12) throw new Error("Expected 12 discovery queries.");
  return parsed.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Invalid discovery query.");
    const row = item as { id?: unknown; category?: unknown; text?: unknown };
    if (typeof row.id !== "string" || typeof row.category !== "string" || typeof row.text !== "string") {
      throw new Error("Invalid discovery query.");
    }
    return { id: row.id, category: row.category, text: row.text };
  });
}

function coursesInCodeOrder(catalogue: ReturnType<typeof loadCatalogue>): CourseRecord[] {
  const byCourse = new Map<string, CourseRecord["sections"]>();
  for (const section of catalogue.sections) {
    const sections = byCourse.get(section.courseCode) ?? [];
    sections.push(section);
    byCourse.set(section.courseCode, sections);
  }
  return [...byCourse.keys()]
    .sort((left, right) => left.localeCompare(right))
    .map((courseCode) => {
      const sections = byCourse.get(courseCode) ?? [];
      return { courseCode, sections, text: courseEmbeddingText(courseCode, sections) };
    });
}

function readCache(filePath: string, courseCodes: string[]): number[][] | null {
  if (!existsSync(filePath)) return null;
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (!isUsableCache(parsed, courseCodes)) return null;
    return parsed.vectors;
  } catch {
    return null;
  }
}

function isUsableCache(value: unknown, courseCodes: string[]): value is { courseCodes: string[]; vectors: number[][] } {
  if (!value || typeof value !== "object") return false;
  const record = value as { courseCodes?: unknown; vectors?: unknown };
  if (!Array.isArray(record.courseCodes) || !Array.isArray(record.vectors)) return false;
  if (record.courseCodes.length !== courseCodes.length || record.vectors.length !== courseCodes.length) return false;
  for (let index = 0; index < courseCodes.length; index += 1) {
    if (record.courseCodes[index] !== courseCodes[index]) return false;
  }
  const width = vectorWidth(record.vectors[0]);
  if (width === null) return false;
  return record.vectors.every((vector) => vectorWidth(vector) === width);
}

function vectorWidth(value: unknown): number | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  for (const item of value) {
    if (typeof item !== "number" || !Number.isFinite(item)) return null;
  }
  return value.length;
}

function assertVectors(vectors: number[][], count: number): void {
  const width = vectorWidth(vectors[0]);
  const usable = vectors.length === count && width !== null && vectors.every((vector) => vectorWidth(vector) === width);
  if (!usable) throw new Error("Embedding vectors are unusable.");
}

async function embedChunks(
  embed: (batch: string[]) => Promise<number[][]>,
  texts: string[],
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let index = 0; index < texts.length; index += EMBED_BATCH) {
    const batch = texts.slice(index, index + EMBED_BATCH);
    console.log(`Embedding courses ${index + 1}-${index + batch.length} of ${texts.length}`);
    vectors.push(...(await embed(batch)));
  }
  return vectors;
}

function elapsedMs(started: number): number {
  return Math.round(performance.now() - started);
}

function sheetRowsAtDepth10(queries: PoolQuery[]): number {
  let rows = 0;
  for (const query of queries) {
    const seen = new Set<string>();
    for (const run of Object.values(query.runs)) {
      for (const courseCode of run.slice(0, 10)) seen.add(courseCode);
    }
    rows += seen.size;
  }
  return rows;
}

function fieldsForPooled(courses: CourseRecord[], queries: PoolQuery[]): Map<string, ReturnType<typeof courseFields>> {
  const wanted = new Set<string>();
  for (const query of queries) {
    for (const run of Object.values(query.runs)) {
      for (const courseCode of run.slice(0, 10)) wanted.add(courseCode);
    }
  }
  const fields = new Map<string, ReturnType<typeof courseFields>>();
  for (const course of courses) {
    if (wanted.has(course.courseCode)) fields.set(course.courseCode, courseFields(course.sections));
  }
  return fields;
}

function usageEntry(runDate: string): string {
  return `## ${runDate} — offline retrieval pool

- Model: ${EMBEDDING_MODEL.id}
- Revision: ${EMBEDDING_MODEL.revision}
- Dtype: ${EMBEDDING_MODEL.dtype}
- Package: @huggingface/transformers@${PACKAGE_VERSION}
- Purpose: offline course-retrieval pool for human labeling
- Relevance labels are human. This command does not write them.
`;
}

function recordUsage(entry: string): void {
  const next = existsSync(usagePath)
    ? `${readFileSync(usagePath, "utf8").replace(/\s*$/, "")}\n\n${entry}`
    : `# AI usage\n\n${entry}`;
  writeAtomic(usagePath, next);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
