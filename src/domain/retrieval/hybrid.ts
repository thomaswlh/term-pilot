export const RRF_K = 60;
export const FUSION_DEPTH = 50;

export function fuseCourses(bm25: string[], dense: string[]): string[] {
  const scores = new Map<string, number>();
  for (const list of [bm25.slice(0, FUSION_DEPTH), dense.slice(0, FUSION_DEPTH)]) {
    const seen = new Set<string>();
    list.forEach((courseCode, index) => {
      if (seen.has(courseCode)) return;
      seen.add(courseCode);
      scores.set(courseCode, (scores.get(courseCode) ?? 0) + 1 / (RRF_K + index + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([courseCode]) => courseCode);
}
