export function rankByCosine(
  courses: { courseCode: string; vector: number[] }[],
  queryVector: number[],
  limit: number,
): { courseCode: string; score: number }[] {
  return courses
    .map((course) => ({ courseCode: course.courseCode, score: cosine(course.vector, queryVector) }))
    .sort((a, b) => b.score - a.score || a.courseCode.localeCompare(b.courseCode))
    .slice(0, Math.max(0, limit));
}

function cosine(left: number[], right: number[]): number {
  const leftLength = euclideanLength(left);
  const rightLength = euclideanLength(right);
  if (leftLength === 0 || rightLength === 0) return 0;
  const width = Math.max(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < width; index++) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot / (leftLength * rightLength);
}

function euclideanLength(vector: number[]): number {
  let sum = 0;
  for (const value of vector) sum += value * value;
  return Math.sqrt(sum);
}
