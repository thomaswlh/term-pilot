import { sectionKey } from "./section";
import type { Catalogue, Section } from "./types";

const BM25_K1 = 1.2;
const BM25_B = 0.75;

const TOKEN_RE = /[a-z0-9]+(?::[0-9]{2})?/g;

export type SearchHit = {
  sectionKey: string;
  courseCode: string;
  section: string;
  title: string;
  teacher: string;
};

type DocRecord = {
  section: Section;
  key: string;
  tokens: string[];
  length: number;
};

export function searchSections(catalogue: Catalogue, query: string, limit: number = 10): SearchHit[] {
  const docs = catalogue.sections.map((section) => buildDoc(section));
  const queryTokens = tokenize(query);

  if (queryTokens.length === 0) {
    return [];
  }

  if (docs.length === 0) {
    return [];
  }

  const queryCounts = new Map<string, number>();
  for (const token of queryTokens) {
    queryCounts.set(token, (queryCounts.get(token) ?? 0) + 1);
  }

  const n = docs.length;
  const avgdl = docs.reduce((sum, doc) => sum + doc.length, 0) / n || 1;

  const df = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set(doc.tokens);
    for (const term of seen) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const scored = docs.map((doc) => {
    const termFreq = termFrequency(doc.tokens);
    let score = 0;

    for (const [term, qtf] of queryCounts) {
      const documentFrequency = df.get(term);
      if (documentFrequency === undefined || documentFrequency === 0) {
        continue;
      }

      const freq = termFreq.get(term) ?? 0;
      if (freq === 0) {
        continue;
      }

      const idf = Math.log(1 + (n - documentFrequency + 0.5) / (documentFrequency + 0.5));
      const numerator = freq * (BM25_K1 + 1);
      const denominator = freq + BM25_K1 * (1 - BM25_B + BM25_B * (doc.length / avgdl));
      score += idf * (numerator / denominator) * qtf;
    }

    return { doc, score };
  });

  const positive = scored.filter((hit) => hit.score > 0);

  positive.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.doc.key.localeCompare(b.doc.key);
  });

  const capped = typeof limit === "number" && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 10;

  return positive.slice(0, capped).map(({ doc }) => ({
    sectionKey: doc.key,
    courseCode: doc.section.courseCode,
    section: doc.section.section,
    title: doc.section.title,
    teacher: doc.section.teacher,
  }));
}

function buildDoc(section: Section): DocRecord {
  const key = sectionKey(section);
  const text = buildSectionText(section);
  const tokens = tokenize(text);
  return { section, key, tokens, length: tokens.length };
}

function buildSectionText(section: Section): string {
  const prefix = courseCodeLetterPrefix(section.courseCode);
  return [section.courseCode, prefix, section.teacher]
    .filter((part) => part.trim().length > 0)
    .join(" ");
}

function courseCodeLetterPrefix(courseCode: string): string {
  const match = courseCode.match(/^[A-Za-z]+/);
  return match ? match[0] : "";
}

function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  return lower.match(TOKEN_RE) ?? [];
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }
  return counts;
}
