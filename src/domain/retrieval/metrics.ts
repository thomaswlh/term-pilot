export function recallAt5(relevant: string[], ranked: string[]): number {
  if (relevant.length === 0) {
    return 0;
  }
  const rel = new Set(relevant);
  const top = ranked.slice(0, 5);
  const hits = top.filter((key) => rel.has(key)).length;
  return hits / relevant.length;
}

export function mrr(relevant: string[], ranked: string[]): number {
  const rel = new Set(relevant);
  for (let i = 0; i < ranked.length; i++) {
    const key = ranked[i];
    if (key !== undefined && rel.has(key)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

export function scoreCondensed(
  ranking: string[],
  judgments: Map<string, "relevant" | "irrelevant">,
  k: number,
): { recall: number; mrr: number; ndcg: number } | null {
  const relevant = [...judgments.entries()].filter(([, label]) => label === "relevant").map(([code]) => code);
  if (relevant.length === 0) return null;
  const condensed = ranking.filter((code) => judgments.has(code));
  const top = condensed.slice(0, k);
  const relevantSet = new Set(relevant);
  const recall = top.filter((code) => relevantSet.has(code)).length / relevant.length;
  const first = condensed.findIndex((code) => relevantSet.has(code));
  const reciprocal = first === -1 ? 0 : 1 / (first + 1);
  const dcg = top.reduce((sum, code, index) => sum + gain(judgments.get(code) ?? "irrelevant") / Math.log2(index + 2), 0);
  const idealCount = Math.min(k, relevant.length);
  let idcg = 0;
  for (let index = 0; index < idealCount; index++) idcg += 1 / Math.log2(index + 2);
  return { recall, mrr: reciprocal, ndcg: idcg === 0 ? 0 : dcg / idcg };
}

function gain(label: "relevant" | "irrelevant"): number {
  return label === "relevant" ? 1 : 0;
}
