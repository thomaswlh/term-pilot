export const WHAT2REG_STATE_COOKIE = "termpilot_what2reg_oauth";

export function readStateCookie(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === WHAT2REG_STATE_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}
