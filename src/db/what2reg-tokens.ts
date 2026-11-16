import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { What2RegGrant, What2RegTokenStore } from "@/domain/what2reg/types";

type GlobalTokens = typeof globalThis & {
  termPilotWhat2RegTokens?: Map<string, What2RegGrant>;
};

function memoryMap(): Map<string, What2RegGrant> {
  const globalTokens = globalThis as GlobalTokens;
  globalTokens.termPilotWhat2RegTokens ??= new Map();
  return globalTokens.termPilotWhat2RegTokens;
}

export function memoryWhat2RegTokens(): What2RegTokenStore {
  const grants = memoryMap();
  return {
    async get(userId) {
      const row = grants.get(userId);
      return row ? { ...row } : null;
    },
    async save(userId, grant) {
      grants.set(userId, { ...grant });
    },
    async delete(userId) {
      grants.delete(userId);
    },
  };
}

export function emptyWhat2RegTokens(): What2RegTokenStore {
  const grants = new Map<string, What2RegGrant>();
  return {
    async get(userId) {
      const row = grants.get(userId);
      return row ? { ...row } : null;
    },
    async save(userId, grant) {
      grants.set(userId, { ...grant });
    },
    async delete(userId) {
      grants.delete(userId);
    },
  };
}

function encryptionKey(): Buffer | null {
  const raw = process.env.WHAT2REG_TOKEN_KEY?.trim();
  if (!raw) return null;
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) return decoded;
  return createHash("sha256").update(raw).digest();
}

export function sealSecret(plain: string): string {
  const key = encryptionKey();
  if (!key) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("WHAT2REG_TOKEN_KEY is required in production");
    }
    return `plain:${plain}`;
  }
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function openSecret(sealed: string): string | null {
  if (sealed.startsWith("plain:")) {
    if (process.env.NODE_ENV === "production") return null;
    return sealed.slice("plain:".length);
  }
  const key = encryptionKey();
  if (!key || !sealed.startsWith("v1:")) return null;
  const [, ivPart, tagPart, dataPart] = sealed.split(":");
  if (!ivPart || !tagPart || !dataPart) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}

export function sealGrant(grant: What2RegGrant): string {
  return sealSecret(JSON.stringify(grant));
}

export function openGrant(sealed: string): What2RegGrant | null {
  const plain = openSecret(sealed);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as What2RegGrant;
    if (!parsed.accessToken || typeof parsed.accessToken !== "string") return null;
    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      expiresAt: typeof parsed.expiresAt === "string" ? parsed.expiresAt : null,
      scope: typeof parsed.scope === "string" ? parsed.scope : "",
    };
  } catch {
    return null;
  }
}
