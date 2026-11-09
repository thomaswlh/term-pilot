import { renameSync, writeFileSync } from "node:fs";
import { courseFields } from "./course-text";

const RUNS = ["bm25-legacy", "bm25", "dense", "hybrid"] as const;

type RunName = (typeof RUNS)[number];
type CourseFields = ReturnType<typeof courseFields>;

export type PoolModel = {
  id: string;
  revision: string;
  packageVersion: string;
  dtype: string;
};

export type PoolLatency = {
  bm25LegacyBuildMs: number;
  bm25BuildMs: number;
  denseLoadMs: number;
  embedBuildMs: number;
  queryMs: Record<RunName, number[]>;
};

export type PoolQuery = {
  id: string;
  category: string;
  text: string;
  runs: Record<RunName, string[]>;
};

export type PoolDocument = {
  depth: 5 | 10;
  model: PoolModel;
  courseTextHash: string;
  latency: PoolLatency;
  queries: PoolQuery[];
};

const COLUMNS = [
  "queryId",
  "category",
  "query",
  "courseCode",
  "title",
  "department",
  "instructor",
  "notes",
  "proposedBy",
  "label",
] as const;

export function poolDepthFor(rowCount: number): 5 | 10 {
  return rowCount > 240 ? 5 : 10;
}

export function buildSheet(input: {
  queries: PoolQuery[];
  fields: Map<string, CourseFields>;
  depth: 5 | 10;
  model: PoolModel;
  courseTextHash: string;
  latency: PoolLatency;
}): { depth: 5 | 10; csv: string; pool: PoolDocument } {
  const queries = input.queries.map((query) => ({
    id: query.id,
    category: query.category,
    text: query.text,
    runs: cutRuns(query.runs, input.depth),
  }));
  const lines = [COLUMNS.join(",")];
  for (const query of queries) {
    const courseCodes = [...coursesInRuns(query.runs)].sort((left, right) => left.localeCompare(right));
    for (const courseCode of courseCodes) {
      const field = input.fields.get(courseCode);
      lines.push(
        encodeRow([
          query.id,
          query.category,
          query.text,
          courseCode,
          field?.title ?? "",
          field?.department ?? "",
          field?.instructor ?? "",
          field?.notes ?? "",
          proposedBy(query.runs, courseCode),
          "",
        ]),
      );
    }
  }
  return {
    depth: input.depth,
    csv: lines.join("\n"),
    pool: {
      depth: input.depth,
      model: input.model,
      courseTextHash: input.courseTextHash,
      latency: input.latency,
      queries,
    },
  };
}

export function sheetBlocksRewrite(csv: string): boolean {
  const rows = parseCsv(csv);
  const header = rows[0];
  if (!header) return false;
  const labelIndex = header.indexOf("label");
  if (labelIndex < 0) return false;
  return rows.slice(1).some((row) => (row[labelIndex] ?? "").trim().length > 0);
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? "";
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const last = rows[rows.length - 1];
  if (last && last.length === 1 && last[0] === "") rows.pop();
  return rows;
}

export function writeAtomic(filePath: string, contents: string): void {
  const temporary = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporary, contents, "utf8");
  renameSync(temporary, filePath);
}

function cutRuns(runs: PoolQuery["runs"], depth: number): PoolQuery["runs"] {
  return {
    "bm25-legacy": runs["bm25-legacy"].slice(0, depth),
    bm25: runs.bm25.slice(0, depth),
    dense: runs.dense.slice(0, depth),
    hybrid: runs.hybrid.slice(0, depth),
  };
}

function coursesInRuns(runs: PoolQuery["runs"]): Set<string> {
  const courseCodes = new Set<string>();
  for (const run of RUNS) {
    for (const courseCode of runs[run]) courseCodes.add(courseCode);
  }
  return courseCodes;
}

function proposedBy(runs: PoolQuery["runs"], courseCode: string): string {
  return RUNS.flatMap((run) => {
    const index = runs[run].indexOf(courseCode);
    return index === -1 ? [] : [`${run}:${index + 1}`];
  }).join(";");
}

function encodeRow(values: string[]): string {
  return values.map(encodeField).join(",");
}

function encodeField(value: string): string {
  const flattened = value.replace(/\r\n|[\n\r]/g, " ");
  if (!/[",\n\r]/.test(flattened)) return flattened;
  return `"${flattened.replace(/"/g, '""')}"`;
}
