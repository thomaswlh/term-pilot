import { sectionKey } from "./section";
import type { Catalogue, Section } from "./types";

const BM25_K1 = 1.2;
const BM25_B = 0.75;
const TOKEN_RE = /[a-z0-9]+(?::[0-9]{2})?/g;

export type LegacyHit = {
  sectionKey: string;
  courseCode: string;
  section: string;
  title: string;
  teacher: string;
  score: number;
};

type DocRecord = { section: Section; key: string; tokens: string[]; length: number };

const indexCache = new WeakMap<Catalogue, DocRecord[]>();

export function prepareLegacyIndex(catalogue: Catalogue): void {
  docsFor(catalogue);
}

export function scoreSectionsLegacy(catalogue: Catalogue, query: string): LegacyHit[] {
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

  const scored = docs.map((doc) => {
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
    return { doc, score };
  });

  return scored
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

export function searchSectionsLegacy(catalogue: Catalogue, query: string, limit: number = 10) {
  const capped = typeof limit === "number" && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10;
  return scoreSectionsLegacy(catalogue, query)
    .slice(0, capped)
    .map(({ score: _score, ...hit }) => hit);
}

function docsFor(catalogue: Catalogue): DocRecord[] {
  const cached = indexCache.get(catalogue);
  if (cached) return cached;
  const docs = catalogue.sections.map((section) => {
    const key = sectionKey(section);
    const prefix = section.courseCode.match(/^[A-Za-z]+/)?.[0] ?? "";
    const text = [section.courseCode, prefix, section.teacher].filter((part) => part.trim().length > 0).join(" ");
    const tokens = text.toLowerCase().match(TOKEN_RE) ?? [];
    return { section, key, tokens, length: tokens.length };
  });
  indexCache.set(catalogue, docs);
  return docs;
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}
