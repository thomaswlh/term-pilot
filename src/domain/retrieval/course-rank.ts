export type CourseScore = { courseCode: string; score: number };

export function collapseCourses(scored: { courseCode: string; score: number }[], limit: number): CourseScore[] {
  const best = new Map<string, number>();
  for (const row of scored) {
    const current = best.get(row.courseCode);
    if (current === undefined || row.score > current) best.set(row.courseCode, row.score);
  }
  return [...best.entries()]
    .map(([courseCode, score]) => ({ courseCode, score }))
    .sort((a, b) => b.score - a.score || a.courseCode.localeCompare(b.courseCode))
    .slice(0, Math.max(0, limit));
}
