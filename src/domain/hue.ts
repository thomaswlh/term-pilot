import type { HueName } from "./theme";

const HUES = ["green", "amber", "teal", "blue"] as const satisfies readonly HueName[];

export function hueFor(courseCode: string): HueName {
  let hash = 0;
  for (let i = 0; i < courseCode.length; i++) {
    hash = (Math.imul(hash, 31) + courseCode.charCodeAt(i)) >>> 0;
  }
  return HUES[hash % HUES.length] ?? "green";
}
