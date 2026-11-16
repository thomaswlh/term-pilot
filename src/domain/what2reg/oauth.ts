import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  WHAT2REG_MCP_URL,
  WHAT2REG_REQUIRED_SCOPE,
  WHAT2REG_SCOPE,
  type What2RegGrant,
} from "./types";

export type OauthConfig = {
  clientId: string;
  clientSecret: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
  scope?: string;
  resource?: string;
};

export type FormPoster = (
  url: string,
  body: URLSearchParams,
) => Promise<{ status: number; body: string }>;

export type TokenResult =
  | { ok: true; grant: What2RegGrant }
  | { ok: false; reason: "unauthorized" | "unavailable" };

export function createPkce(bytes: (size: number) => Buffer = randomBytes): {
  verifier: string;
  challenge: string;
} {
  const verifier = bytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthorizeUrl(input: {
  config: OauthConfig;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(input.config.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.config.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("scope", input.config.scope ?? WHAT2REG_SCOPE);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", input.config.resource ?? WHAT2REG_MCP_URL);
  return url.toString();
}

type OauthState = {
  state: string;
  verifier: string;
  userId: string;
  redirectUri: string;
  exp: number;
};

export function sealOauthState(payload: OauthState, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function openOauthState(sealed: string, secret: string, now: number): OauthState | null {
  const split = sealed.split(".");
  if (split.length !== 2) return null;
  const [body, mac] = split;
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OauthState;
    if (!payload.state || !payload.verifier || !payload.userId || !payload.redirectUri) return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

function formBody(config: OauthConfig, fields: Record<string, string>): URLSearchParams {
  const body = new URLSearchParams(fields);
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  return body;
}

function grantFromToken(json: unknown, now: number): What2RegGrant | null {
  if (!json || typeof json !== "object") return null;
  const row = json as Record<string, unknown>;
  const accessToken = typeof row.access_token === "string" ? row.access_token : "";
  if (!accessToken) return null;
  const scope = typeof row.scope === "string" ? row.scope : WHAT2REG_REQUIRED_SCOPE;
  if (!scope.split(/\s+/).includes(WHAT2REG_REQUIRED_SCOPE)) return null;
  const refreshToken = typeof row.refresh_token === "string" && row.refresh_token ? row.refresh_token : null;
  const expiresIn = typeof row.expires_in === "number" ? row.expires_in : null;
  let expiresAt: string | null = null;
  if (expiresIn !== null && Number.isFinite(expiresIn) && Number.isFinite(now)) {
    const date = new Date(now + expiresIn * 1000);
    expiresAt = Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return { accessToken, refreshToken, expiresAt, scope };
}

async function readToken(postForm: FormPoster, url: string, body: URLSearchParams, now: number): Promise<TokenResult> {
  let response: { status: number; body: string };
  try {
    response = await postForm(url, body);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (response.status === 401 || response.status === 400 || response.status === 403) {
    return { ok: false, reason: "unauthorized" };
  }
  if (response.status < 200 || response.status >= 300) return { ok: false, reason: "unavailable" };
  try {
    const grant = grantFromToken(JSON.parse(response.body) as unknown, now);
    if (!grant) return { ok: false, reason: "unauthorized" };
    return { ok: true, grant };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export function exchangeAuthorizationCode(input: {
  config: OauthConfig;
  code: string;
  redirectUri: string;
  verifier: string;
  postForm: FormPoster;
  now?: number;
}): Promise<TokenResult> {
  const now = input.now ?? Date.now();
  const body = formBody(input.config, {
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier,
    resource: input.config.resource ?? WHAT2REG_MCP_URL,
  });
  return readToken(input.postForm, input.config.tokenEndpoint, body, now);
}

export function refreshAccessToken(input: {
  config: OauthConfig;
  refreshToken: string;
  postForm: FormPoster;
  now?: number;
}): Promise<TokenResult> {
  const now = input.now ?? Date.now();
  const body = formBody(input.config, {
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    resource: input.config.resource ?? WHAT2REG_MCP_URL,
  });
  return readToken(input.postForm, input.config.tokenEndpoint, body, now);
}

export async function revokeAccess(input: {
  config: OauthConfig;
  token: string;
  hint: "access_token" | "refresh_token";
  postForm: FormPoster;
}): Promise<void> {
  const body = formBody(input.config, { token: input.token, token_type_hint: input.hint });
  try {
    await input.postForm(input.config.revocationEndpoint, body);
  } catch {
    // Revocation is best-effort. The local grant is deleted either way.
  }
}
