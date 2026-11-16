import {
  WHAT2REG_AUTHORIZATION_ENDPOINT,
  WHAT2REG_MCP_URL,
  WHAT2REG_REVOCATION_ENDPOINT,
  WHAT2REG_SCOPE,
  WHAT2REG_TOKEN_ENDPOINT,
} from "./types";

export type What2RegConfig = {
  mcpUrl: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  revocationEndpoint: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string | null;
  scope: string;
  resource: string;
};

export function readWhat2RegConfig(
  env: Record<string, string | undefined> = process.env,
): What2RegConfig | null {
  const clientId = env.WHAT2REG_CLIENT_ID?.trim() ?? "";
  const clientSecret = env.WHAT2REG_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret) return null;
  return {
    mcpUrl: env.WHAT2REG_MCP_URL?.trim() || WHAT2REG_MCP_URL,
    authorizationEndpoint: env.WHAT2REG_AUTHORIZATION_ENDPOINT?.trim() || WHAT2REG_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: env.WHAT2REG_TOKEN_ENDPOINT?.trim() || WHAT2REG_TOKEN_ENDPOINT,
    revocationEndpoint: env.WHAT2REG_REVOCATION_ENDPOINT?.trim() || WHAT2REG_REVOCATION_ENDPOINT,
    clientId,
    clientSecret,
    redirectUri: env.WHAT2REG_REDIRECT_URI?.trim() || null,
    scope: env.WHAT2REG_SCOPE?.trim() || WHAT2REG_SCOPE,
    resource: env.WHAT2REG_RESOURCE?.trim() || WHAT2REG_MCP_URL,
  };
}

export function what2RegConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return readWhat2RegConfig(env) !== null;
}
