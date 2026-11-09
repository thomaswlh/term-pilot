import { sectionKey } from "./section";
import type { Catalogue, Meeting, Section } from "./types";

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const TOKEN_RE = /[a-z0-9]+(?::[0-9]{2,3})?/g;
const SECTION_KEY_RE = /^([a-z]+)(\d+):(\d{3})$/;
const COURSE_CODE_RE = /^([a-z]+)(\d+)$/;

export type SearchHit = {
  sectionKey: string;
  courseCode: string;
  section: string;
  title: string;
  teacher: string;
};

export type ScoredSection = SearchHit & { score: number };

type DocRecord = { section: Section; key: string; tokens: string[]; length: number };

const indexCache = new WeakMap<Catalogue, DocRecord[]>();

export function prepareSearchIndex(catalogue: Catalogue): void {
  docsFor(catalogue);
}

export function scoreSections(catalogue: Catalogue, query: string): ScoredSection[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];
  const docs = docsFor(catalogue);
  if (docs.length === 0) return [];

  const queryCounts = new Map<string, number>();
  for (const token of queryTokens) queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);
  const n = docs.length;
  const avgdl = docs.reduce((sum, doc) => sum + doc.length, 0) / n || 1;
  const df = new Map<string, number>();
  for (const doc of docs) {
    for (const term of new Set(doc.tokens)) df.set(term, (df.get(term) ?? 0) + 1);
  }

  return docs
    .map((doc) => ({ doc, score: bm25(doc, queryCounts, df, n, avgdl) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || a.doc.key.localeCompare(b.doc.key))
    .map(({ doc, score }) => ({
      sectionKey: doc.key,
      courseCode: doc.section.courseCode,
      section: doc.section.section,
      title: doc.section.title,
      teacher: doc.section.teacher,
      score,
    }));
}

export function searchSections(catalogue: Catalogue, query: string, limit: number = 10): SearchHit[] {
  const capped = typeof limit === "number" && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10;
  return scoreSections(catalogue, query)
    .slice(0, capped)
    .map(({ score: _score, ...hit }) => hit);
}

function docsFor(catalogue: Catalogue): DocRecord[] {
  const cached = indexCache.get(catalogue);
  if (cached) return cached;
  const docs = catalogue.sections.map((section) => {
    const key = sectionKey(section);
    const text = documentText(section, key);
    const tokens = tokenize(text);
    return { section, key, tokens, length: tokens.length };
  });
  indexCache.set(catalogue, docs);
  return docs;
}

function documentText(section: Section, key: string): string {
  const meetings = section.meetings.map(renderMeeting).filter((value): value is string => value !== null);
  return [key, section.courseCode, section.title, section.teacher, section.department, section.notes, ...meetings]
    .filter((part) => part.trim().length > 0)
    .join(" ");
}

function renderMeeting(meeting: Meeting): string | null {
  if (meeting.day === null || meeting.startMinutes === null || meeting.endMinutes === null) return null;
  return `${meeting.day} ${formatMinutes(meeting.startMinutes)}-${formatMinutes(meeting.endMinutes)}`;
}

function formatMinutes(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function tokenize(text: string): string[] {
  const raw = text.toLowerCase().match(TOKEN_RE) ?? [];
  const tokens: string[] = [];
  for (const token of raw) {
    tokens.push(token);
    const sectionMatch = SECTION_KEY_RE.exec(token);
    if (sectionMatch) {
      const prefix = sectionMatch[1] ?? "";
      const courseNumber = sectionMatch[2] ?? "";
      const sectionNumber = sectionMatch[3] ?? "";
      tokens.push(`${prefix}${courseNumber}`, prefix, courseNumber, sectionNumber);
      continue;
    }
    const courseMatch = COURSE_CODE_RE.exec(token);
    if (courseMatch) tokens.push(courseMatch[1] ?? "", courseMatch[2] ?? "");
  }
  return tokens;
}

function bm25(
  doc: DocRecord,
  queryCounts: Map<string, number>,
  df: Map<string, number>,
  n: number,
  avgdl: number,
): number {
  const termFreq = new Map<string, number>();
  for (const token of doc.tokens) termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
  let score = 0;
  for (const [term, qtf] of queryCounts) {
    const documentFrequency = df.get(term);
    const freq = termFreq.get(term) ?? 0;
    if (documentFrequency === undefined || documentFrequency === 0 || freq === 0) continue;
    const idf = Math.log(1 + (n - documentFrequency + 0.5) / (documentFrequency + 0.5));
    const numerator = freq * (BM25_K1 + 1);
    const denominator = freq + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / avgdl));
    score += idf * (numerator / denominator) * qtf;
  }
  return score;
}
