import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { loadCatalogue } from "../src/domain/catalogue";
import type { CreditRecord } from "../src/domain/credits";

const DETAIL_URL = "https://isw.um.edu.mo/siwci/faces/courseDetailUG";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CONCURRENCY = 4;
const ATTEMPTS = 3;

// Media-feature parameters that returned the Credits HTML on 2026-11-10.
const MEDIA_FEATURES =
  "_afrPage=0&_afrMT=screen&_afrMFW=1280&_afrMFH=800&_afrMFDW=1280&_afrMFDH=800&_afrMFC=8&_afrMFCI=0&_afrMFM=0&_afrMFR=96&_afrMFG=0&_afrMFS=0&_afrMFO=0";

export function readOfficialCredits(html: string): { credits: number; title: string } | null {
  const creditsMatch = html.match(/>Credits<\/span>[\s\S]*?<span[^>]*>([^<]*)<\/span>/);
  if (!creditsMatch) return null;
  const raw = creditsMatch[1].trim();
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  const titleMatch = html.match(/width:520pt">([^<]*)<\/span>/);
  return {
    credits: Number(raw),
    title: decodeTitle(titleMatch?.[1] ?? ""),
  };
}

function decodeTitle(value: string): string {
  return value.replace(/&#8217;/g, "'").trim();
}

type FetchSuccess = { ok: true; record: CreditRecord; title: string };
type FetchFailure = { ok: false; courseCode: string; reason: string };

async function refreshCredits(): Promise<void> {
  const titles = new Map<string, Set<string>>();
  for (const section of loadCatalogue().sections) {
    const courseCode = section.courseCode.trim();
    if (!courseCode) continue;
    const known = titles.get(courseCode) ?? new Set<string>();
    known.add(section.title.trim());
    titles.set(courseCode, known);
  }

  const courseCodes = [...titles.keys()].sort();
  const retrievedAt = new Date().toISOString().slice(0, 10);
  const results = await mapPool(courseCodes, CONCURRENCY, (courseCode) =>
    fetchRecord(courseCode, retrievedAt),
  );

  const records: CreditRecord[] = [];
  const unmatched: string[] = [];
  const mismatches: string[] = [];

  for (const result of results) {
    if (!result.ok) {
      unmatched.push(`${result.courseCode} (${result.reason})`);
      continue;
    }
    records.push(result.record);
    const workbookTitles = [...(titles.get(result.record.courseCode) ?? [])];
    if (!workbookTitles.includes(result.title)) {
      mismatches.push(
        `${result.record.courseCode}: official "${result.title}" / workbook "${workbookTitles.join(" | ")}"`,
      );
    }
  }

  records.sort((left, right) => left.courseCode.localeCompare(right.courseCode));

  if (unmatched.length === 0) {
    const snapshotPath = path.join(process.cwd(), "src/domain/data/credit-snapshot.json");
    writeFileSync(snapshotPath, `${JSON.stringify(records, null, 2)}\n`);
    console.log(`wrote ${records.length} credit records`);
  }

  if (unmatched.length === 0) console.log("unmatched: none");
  else {
    console.log("unmatched:");
    for (const line of unmatched) console.log(line);
  }

  if (mismatches.length === 0) console.log("title mismatches: none");
  else {
    console.log("title mismatches:");
    for (const line of mismatches) console.log(line);
  }

  if (unmatched.length > 0) process.exitCode = 1;
}

async function fetchRecord(courseCode: string, retrievedAt: string): Promise<FetchSuccess | FetchFailure> {
  let reason = "credits missing";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const html = await fetchOfficialPage(courseCode);
      const pageCode = html.match(/width:130pt">([^<]*)<\/span>/)?.[1]?.trim();
      if (pageCode && pageCode !== courseCode) {
        reason = `page showed ${pageCode}`;
      } else {
        const parsed = readOfficialCredits(html);
        if (parsed) {
          return {
            ok: true,
            title: parsed.title,
            record: {
              courseCode,
              credits: parsed.credits,
              sourceUrl: `${DETAIL_URL}?courseCode=${courseCode}`,
              retrievedAt,
            },
          };
        }
        reason = "credits missing";
      }
    } catch (error) {
      reason = error instanceof Error ? error.message : "request failed";
    }
    if (attempt < ATTEMPTS) await delay(400 * attempt);
  }
  return { ok: false, courseCode, reason };
}

async function fetchOfficialPage(courseCode: string): Promise<string> {
  const jar = new Map<string, string>();
  const firstUrl = `${DETAIL_URL}?courseCode=${encodeURIComponent(courseCode)}`;
  const first = await requestText(firstUrl, jar);
  const loop = first.match(/'_afrLoop',\s*'([^']+)'/);
  const windowId = first.match(/'_afrPage',\s*'[^']*',\s*'([^']+)'/);
  if (!loop?.[1] || !windowId?.[1]) {
    throw new Error("missing ADF loopback");
  }
  const secondUrl =
    `${firstUrl}&_afrLoop=${encodeURIComponent(loop[1])}` +
    `&_afrWindowMode=0&Adf-Window-Id=${encodeURIComponent(windowId[1])}&${MEDIA_FEATURES}`;
  return requestText(secondUrl, jar);
}

async function requestText(url: string, jar: Map<string, string>): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "text/html",
    "User-Agent": USER_AGENT,
  };
  if (jar.size > 0) {
    headers.Cookie = [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(45_000) });
  rememberCookies(response, jar);
  const body = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return body;
}

function rememberCookies(response: Response, jar: Map<string, string>): void {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const cookie of cookies) {
    const pair = cookie.split(";")[0] ?? "";
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    jar.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
}

async function mapPool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  let finished = 0;

  async function run(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T);
      finished += 1;
      if (finished % 50 === 0 || finished === items.length) {
        console.error(`fetched ${finished}/${items.length}`);
      }
    }
  }

  const workers = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workers }, () => run()));
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runningAsCli(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  const scriptPath = fileURLToPath(import.meta.url);
  return path.resolve(entry) === scriptPath || import.meta.url === pathToFileURL(entry).href;
}

if (runningAsCli()) {
  refreshCredits().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
