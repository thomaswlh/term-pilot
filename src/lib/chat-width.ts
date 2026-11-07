export const CHAT_WIDTH_DEFAULT = 380;
export const CHAT_WIDTH_MIN = 320;
export const CHAT_WIDTH_MAX = 640;
export const CHAT_WIDTH_STORAGE_KEY = "termpilot.chatWidth";
export const WEEK_MIN_SHEET_RESERVE = 360;

export function clampChatWidth(width: number, ceiling = CHAT_WIDTH_MAX): number {
  const cap = Math.min(CHAT_WIDTH_MAX, ceiling);
  return Math.min(cap, Math.max(CHAT_WIDTH_MIN, Math.round(width)));
}

export function maxChatWidthForRow(rowWidth: number): number {
  const byLayout = rowWidth - WEEK_MIN_SHEET_RESERVE;
  return clampChatWidth(byLayout, CHAT_WIDTH_MAX);
}

export function parseStoredChatWidth(raw: string | null): number {
  if (raw == null || raw === "") return CHAT_WIDTH_DEFAULT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return CHAT_WIDTH_DEFAULT;
  const clamped = clampChatWidth(n);
  if (clamped !== Math.round(n)) return CHAT_WIDTH_DEFAULT;
  return clamped;
}
