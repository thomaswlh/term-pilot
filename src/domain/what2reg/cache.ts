import { REVIEW_CACHE_TTL_MS } from "./types";

type Entry = { expiresAt: number; value: unknown };

export type ReviewCache = {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  size(): number;
};

export function createReviewCache(options?: { ttlMs?: number; now?: () => number }): ReviewCache {
  const ttlMs = options?.ttlMs ?? REVIEW_CACHE_TTL_MS;
  const now = options?.now ?? Date.now;
  const entries = new Map<string, Entry>();

  return {
    get<T>(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set<T>(key: string, value: T) {
      entries.set(key, { expiresAt: now() + ttlMs, value });
    },
    size() {
      return entries.size;
    },
  };
}
