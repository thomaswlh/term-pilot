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
