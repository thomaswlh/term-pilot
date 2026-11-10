import { precisionAtReturned, scoreCondensed } from "./metrics";
import { parseCsv, type PoolDocument } from "./pool";

const RUNS = ["bm25-legacy", "bm25", "dense", "hybrid"] as const;
const CATEGORIES = ["A", "B", "C"] as const;
const LIMITATION = [
  "Unjudged courses are omitted before scoring. They are not given a gain of zero. Recall divides by the courses marked relevant. Courses outside the frozen pool are invisible. A run that returned nothing contributes no rows. Removing an unjudged row can move a judged course upward. These figures do not change searchSections.",
  "Recall@k counts relevant courses the run never returned. Precision@returned scores only returned courses that carry a judgment. A shorter candidate list is a coverage difference, not automatically a worse ranking.",
  "k follows poolDepthFor: 10 unless the deduped labeling sheet would exceed 240 rows, when k becomes 5.",
  "bm25-legacy keeps the frozen tokenizer. On c4 (CSCI1004:001) its hits are instructor digit matches such as TBC_2026-1, not retrieval of that section.",
  "c3 (Haiwei Sun) has one lexical instructor match (MATH1001). Dense top-10 in the frozen pool does not include it. Each category has four queries, so one degenerate query is 25% of a category mean.",
].join(" ");

type RunName = (typeof RUNS)[number];
type Judgment = "relevant" | "irrelevant";
type Score = { recall: number; mrr: number; ndcg: number };

export type BriefPool = Omit<PoolDocument, "depth"> & { depth: number };

export function assertSheet(pool: BriefPool, csv: string): Map<string, Map<string, Judgment>> {
  if (pool.depth !== 5 && pool.depth !== 10) throw new Error("Invalid depth");

  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const queryIndex = header.indexOf("queryId");
  const courseIndex = header.indexOf("courseCode");
  const labelIndex = header.indexOf("label");
  if (queryIndex < 0 || courseIndex < 0 || labelIndex < 0) throw new Error("Invalid label");

  const coursesByQuery = new Map<string, Set<string>>();
  for (const query of pool.queries) {
    const codes = new Set<string>();
    for (const run of RUNS) {
      for (const code of query.runs[run]) codes.add(code);
    }
    coursesByQuery.set(query.id, codes);
  }

  const judgments = new Map<string, Map<string, Judgment>>();
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    if (row.every((cell) => cell.trim().length === 0)) continue;
    const queryId = row[queryIndex] ?? "";
    const courseCode = row[courseIndex] ?? "";
    const label = (row[labelIndex] ?? "").trim();
    const key = `${queryId}\0${courseCode}`;
    if (seen.has(key)) throw new Error("Duplicate judgment row");
    seen.add(key);
    if (label.length === 0) continue;
    if (label !== "relevant" && label !== "irrelevant") throw new Error("Invalid label");
    const courses = coursesByQuery.get(queryId);
    if (!courses || !courses.has(courseCode)) throw new Error("Course is not in the pool");
    const queryJudgments = judgments.get(queryId) ?? new Map<string, Judgment>();
    queryJudgments.set(courseCode, label);
    judgments.set(queryId, queryJudgments);
  }
  return judgments;
}

export function renderBrief(input: {
  pool: BriefPool;
  csv: string;
  exact: { legacyRecall: number; legacyMrr: number; repairedRecall: number; repairedMrr: number };
}): string {
  const judgments = assertSheet(input.pool, input.csv);
  const k = input.pool.depth;
  const excluded: string[] = [];
  const lines = [
    "# Retrieval decision brief",
    "",
    `Model ${input.pool.model.id}`,
    `Revision ${input.pool.model.revision}`,
    `Package ${input.pool.model.packageVersion}`,
    `dtype ${input.pool.model.dtype}`,
    `Depth ${formatMetric(input.pool.depth)}`,
    `k=${formatMetric(k)}`,
    `Course text hash ${input.pool.courseTextHash}`,
    "",
  ];

  for (const category of CATEGORIES) {
    lines.push(...renderCategory(category, input.pool, judgments, excluded), "");
  }

  lines.push("## Excluded queries");
  if (excluded.length === 0) lines.push("None");
  else lines.push(...excluded);
  lines.push("");

  for (const run of RUNS) {
    const coverage = countCoverage(input.pool, judgments, run);
    lines.push(`Coverage ${run} judged=${coverage.judged} unjudged=${coverage.unjudged}`);
  }
  lines.push(
    "",
    `bm25-legacy build=${formatMetric(input.pool.latency.bm25LegacyBuildMs)}`,
    `bm25 build=${formatMetric(input.pool.latency.bm25BuildMs)}`,
    `dense load=${formatMetric(input.pool.latency.denseLoadMs)}`,
    `embed build=${formatMetric(input.pool.latency.embedBuildMs)}`,
    "",
  );

  for (const run of RUNS) {
    const timing = summarize(input.pool.latency.queryMs[run]);
    lines.push(`${run} query median=${formatMetric(timing.median)} max=${formatMetric(timing.max)}`);
  }
  lines.push(
    "",
    `Legacy exact-code Recall@5=${formatMetric(input.exact.legacyRecall)} MRR=${formatMetric(input.exact.legacyMrr)}`,
    `Repaired exact-code Recall@5=${formatMetric(input.exact.repairedRecall)} MRR=${formatMetric(input.exact.repairedMrr)}`,
    "",
    LIMITATION,
    "",
  );
  return lines.join("\n");
}

function renderCategory(
  category: string,
  pool: BriefPool,
  judgments: Map<string, Map<string, Judgment>>,
  excluded: string[],
): string[] {
  const lines = [`## Category ${category}`];
  const scored: Array<{ id: string; scores: Record<RunName, Score>; labels: Map<string, Judgment> }> = [];

  for (const query of pool.queries) {
    if (query.category !== category) continue;
    const labels = judgments.get(query.id) ?? new Map<string, Judgment>();
    const scores = {} as Record<RunName, Score>;
    let missing = false;
    for (const run of RUNS) {
      const score = scoreCondensed(query.runs[run], labels, pool.depth);
      if (score === null) {
        missing = true;
        break;
      }
      scores[run] = score;
    }
    if (missing) {
      excluded.push(query.id);
      continue;
    }
    scored.push({ id: query.id, scores, labels });
    for (const run of RUNS) {
      lines.push(metricLine(`${query.id} ${run}`, scores[run], pool.depth));
      lines.push(precisionLine(`${query.id} ${run}`, query.runs[run], labels, pool.depth));
    }
    const baseline = scores.bm25;
    for (const run of ["dense", "hybrid", "bm25-legacy"] as const) {
      const score = scores[run];
      if (score.recall < baseline.recall || score.mrr < baseline.mrr || score.ndcg < baseline.ndcg) {
        lines.push(`Regression ${query.id} ${run}`);
      }
    }
  }

  if (scored.length === 0) {
    lines.push("No scored queries");
    return lines;
  }

  for (const run of RUNS) {
    lines.push(
      metricLine(
        `Category ${category} ${run}`,
        {
          recall: mean(scored.map((item) => item.scores[run].recall)),
          mrr: mean(scored.map((item) => item.scores[run].mrr)),
          ndcg: mean(scored.map((item) => item.scores[run].ndcg)),
        },
        pool.depth,
      ),
    );
    const precisions = scored
      .map((item) => precisionAtReturned(pool.queries.find((q) => q.id === item.id)!.runs[run], item.labels, pool.depth))
      .filter((value): value is { returned: number; precision: number } => value !== null);
    if (precisions.length === 0) {
      lines.push(`Category ${category} ${run} Precision@returned=n/a (n=0 queries)`);
    } else {
      lines.push(
        `Category ${category} ${run} Precision@returned mean=${formatMetric(
          mean(precisions.map((value) => value.precision)),
        )} (n=${precisions.length} queries)`,
      );
    }
  }
  return lines;
}

function metricLine(prefix: string, score: Score, k: number): string {
  return `${prefix} Recall@${k}=${formatMetric(score.recall)} MRR=${formatMetric(score.mrr)} nDCG=${formatMetric(score.ndcg)}`;
}

function precisionLine(
  prefix: string,
  ranking: string[],
  judgments: Map<string, Judgment>,
  k: number,
): string {
  const scored = precisionAtReturned(ranking, judgments, k);
  if (scored === null) {
    return `${prefix} returned=${Math.min(k, ranking.length)} Precision@returned=n/a`;
  }
  return `${prefix} returned=${scored.returned} Precision@returned=${formatMetric(scored.precision)}`;
}

function countCoverage(
  pool: BriefPool,
  judgments: Map<string, Map<string, Judgment>>,
  run: RunName,
): { judged: number; unjudged: number } {
  let judged = 0;
  let unjudged = 0;
  for (const query of pool.queries) {
    const labels = judgments.get(query.id) ?? new Map<string, Judgment>();
    for (const code of query.runs[run].slice(0, pool.depth)) {
      if (labels.has(code)) judged += 1;
      else unjudged += 1;
    }
  }
  return { judged, unjudged };
}

function summarize(times: number[] | undefined): { median: number; max: number } {
  const sorted = [...(times ?? [])].sort((left, right) => left - right);
  if (sorted.length === 0) return { median: 0, max: 0 };
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return { median, max: sorted[sorted.length - 1]! };
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatMetric(value: number): string {
  if (!Number.isFinite(value) || Object.is(value, -0)) return "0";
  return String(value);
}
