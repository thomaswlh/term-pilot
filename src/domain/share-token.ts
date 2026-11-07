import { randomBytes } from "node:crypto";

export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}
