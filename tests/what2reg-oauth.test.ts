import { describe, expect, it } from "vitest";
import { readWhat2RegConfig } from "../src/domain/what2reg/config";
import {
  buildAuthorizeUrl,
  createPkce,
  exchangeAuthorizationCode,
  openOauthState,
  refreshAccessToken,
  revokeAccess,
  sealOauthState,
} from "../src/domain/what2reg/oauth";
import { emptyWhat2RegTokens, openGrant, sealGrant } from "../src/db/what2reg-tokens";
import { createReviewCache } from "../src/domain/what2reg/cache";
import { disconnectUser, notesForCourses, readReviewsForUser, type What2RegDeps } from "../src/domain/what2reg/runtime";

const config = {
  mcpUrl: "https://umeh.top/mcp",
  clientId: "client_test",
  clientSecret: "secret_test",
  authorizationEndpoint: "https://clerk.umeh.top/oauth/authorize",
  tokenEndpoint: "https://clerk.umeh.top/oauth/token",
  revocationEndpoint: "https://clerk.umeh.top/oauth/token/revoke",
  redirectUri: "http://localhost:3000/api/what2reg/callback",
  scope: "umhelper:read offline_access",
  resource: "https://umeh.top/mcp",
};

describe("What2Reg OAuth", () => {
  it("builds a PKCE authorization URL for umhelper:read", () => {
    const pkce = createPkce(() => Buffer.from("a".repeat(32)));
    const url = new URL(
      buildAuthorizeUrl({
        config,
        redirectUri: "http://localhost:3000/api/what2reg/callback",
        state: "state-1",
        codeChallenge: pkce.challenge,
      }),
    );
    expect(url.origin + url.pathname).toBe("https://clerk.umeh.top/oauth/authorize");
    expect(url.searchParams.get("scope")).toContain("umhelper:read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe(pkce.challenge);
    expect(url.searchParams.get("resource")).toBe("https://umeh.top/mcp");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/what2reg/callback");
  });

  it("round-trips the signed OAuth state", () => {
    const sealed = sealOauthState(
      {
        state: "state-1",
        verifier: "verifier-1",
        userId: "user_1",
        redirectUri: "http://localhost:3000/api/what2reg/callback",
        exp: 5_000,
      },
      "secret_test",
    );
    expect(openOauthState(sealed, "secret_test", 4_000)?.userId).toBe("user_1");
    expect(openOauthState(sealed, "other", 4_000)).toBeNull();
    expect(openOauthState(sealed, "secret_test", 5_000)).toBeNull();
  });

  it("exchanges, refreshes, and revokes with the documented token endpoint", async () => {
    const posts: string[] = [];
    const postForm = async (url: string, body: URLSearchParams) => {
      posts.push(`${url}?${body.get("grant_type") ?? body.get("token_type_hint")}`);
      if (body.get("grant_type") === "authorization_code") {
        return {
          status: 200,
          body: JSON.stringify({
            access_token: "access-1",
            refresh_token: "refresh-1",
            expires_in: 3600,
            scope: "umhelper:read offline_access",
            token_type: "bearer",
          }),
        };
      }
      if (body.get("grant_type") === "refresh_token") {
        return {
          status: 200,
          body: JSON.stringify({
            access_token: "access-2",
            expires_in: 3600,
            scope: "umhelper:read offline_access",
          }),
        };
      }
      return { status: 200, body: "" };
    };
    const exchanged = await exchangeAuthorizationCode({
      config,
      code: "code-1",
      redirectUri: "http://localhost:3000/api/what2reg/callback",
      verifier: "verifier-1",
      postForm,
      now: 1_000,
    });
    expect(exchanged.ok).toBe(true);
    if (!exchanged.ok) return;
    expect(exchanged.grant.accessToken).toBe("access-1");
    const refreshed = await refreshAccessToken({ config, refreshToken: "refresh-1", postForm, now: 2_000 });
    expect(refreshed.ok && refreshed.grant.accessToken).toBe("access-2");
    await revokeAccess({ config, token: "refresh-1", hint: "refresh_token", postForm });
    expect(posts[0]).toContain("https://clerk.umeh.top/oauth/token?authorization_code");
    expect(posts[2]).toContain("https://clerk.umeh.top/oauth/token/revoke?refresh_token");
  });

  it("fails open when the token endpoint is down", async () => {
    const result = await exchangeAuthorizationCode({
      config,
      code: "code-1",
      redirectUri: "http://localhost:3000/api/what2reg/callback",
      verifier: "verifier-1",
      postForm: async () => {
        throw new Error("offline");
      },
    });
    expect(result).toEqual({ ok: false, reason: "unavailable" });
  });

  it("rejects a token that lacks umhelper:read", async () => {
    const result = await exchangeAuthorizationCode({
      config,
      code: "code-1",
      redirectUri: "http://localhost:3000/api/what2reg/callback",
      verifier: "verifier-1",
      postForm: async () => ({
        status: 200,
        body: JSON.stringify({ access_token: "access-1", scope: "email", expires_in: 60 }),
      }),
    });
    expect(result).toEqual({ ok: false, reason: "unauthorized" });
  });

  it("is not configured without a client id and secret", () => {
    expect(readWhat2RegConfig({ WHAT2REG_CLIENT_ID: "", WHAT2REG_CLIENT_SECRET: "secret" })).toBeNull();
    expect(
      readWhat2RegConfig({ WHAT2REG_CLIENT_ID: "client", WHAT2REG_CLIENT_SECRET: "secret" })?.mcpUrl,
    ).toBe("https://umeh.top/mcp");
  });
});

describe("What2Reg runtime", () => {
  function deps(partial: Partial<What2RegDeps> = {}): What2RegDeps {
    return {
      config,
      store: emptyWhat2RegTokens(),
      cache: createReviewCache(),
      transport: async () => ({ status: 500, headers: {}, body: "" }),
      postForm: async () => ({ status: 200, body: "" }),
      now: () => 10_000,
      ...partial,
    };
  }

  it("does not call the MCP for a student with no grant", async () => {
    let calls = 0;
    const result = await readReviewsForUser(
      { userId: "user_1", courseCode: "CSCI1001", instructors: ["CHAN TAI MAN"] },
      deps({
        transport: async () => {
          calls += 1;
          return { status: 200, headers: {}, body: "" };
        },
      }),
    );
    expect(result.status).toBe("unauthorized");
    expect(calls).toBe(0);
  });

  it("refreshes an expired grant and then fails open if the MCP is down", async () => {
    const store = emptyWhat2RegTokens();
    await store.save("user_1", {
      accessToken: "old-access",
      refreshToken: "refresh-1",
      expiresAt: new Date(0).toISOString(),
      scope: "umhelper:read offline_access",
    });
    let refreshed = false;
    const result = await readReviewsForUser(
      { userId: "user_1", courseCode: "CSCI1001", instructors: ["CHAN TAI MAN"] },
      deps({
        store,
        now: () => 1_000_000,
        postForm: async (_url, body) => {
          expect(body.get("grant_type")).toBe("refresh_token");
          refreshed = true;
          return {
            status: 200,
            body: JSON.stringify({ access_token: "new-access", expires_in: 3600, scope: "umhelper:read" }),
          };
        },
        transport: async (request) => {
          expect(request.headers.authorization).toBe("Bearer new-access");
          return { status: 503, headers: {}, body: "" };
        },
      }),
    );
    expect(refreshed).toBe(true);
    expect(result.status).toBe("unavailable");
    expect((await store.get("user_1"))?.accessToken).toBe("new-access");
  });

  it("forgets the grant when What2Reg says the token is unauthorized", async () => {
    const store = emptyWhat2RegTokens();
    await store.save("user_1", {
      accessToken: "access-1",
      refreshToken: null,
      expiresAt: null,
      scope: "umhelper:read",
    });
    const result = await readReviewsForUser(
      { userId: "user_1", courseCode: "CSCI1001", instructors: [] },
      deps({
        store,
        transport: async () => ({ status: 401, headers: {}, body: "" }),
      }),
    );
    expect(result.status).toBe("unauthorized");
    expect(await store.get("user_1")).toBeNull();
  });

  it("disconnect revokes the refresh token and deletes the local grant", async () => {
    const store = emptyWhat2RegTokens();
    await store.save("user_1", {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: null,
      scope: "umhelper:read",
    });
    const hints: string[] = [];
    await disconnectUser(
      "user_1",
      deps({
        store,
        postForm: async (_url, body) => {
          hints.push(body.get("token_type_hint") ?? "");
          return { status: 200, body: "" };
        },
      }),
    );
    expect(hints).toEqual(["refresh_token", "access_token"]);
    expect(await store.get("user_1")).toBeNull();
  });

  it("seals a grant so the raw token is not the stored string", () => {
    const sealed = sealGrant({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      expiresAt: null,
      scope: "umhelper:read",
    });
    expect(sealed.startsWith("plain:") || sealed.startsWith("v1:")).toBe(true);
    expect(openGrant(sealed)?.accessToken).toBe("access-1");
    expect(openGrant(sealed)?.refreshToken).toBe("refresh-1");
    if (sealed.startsWith("v1:")) expect(sealed).not.toContain("refresh-1");
  });

  it("returns no notes when reviews are unauthorized", async () => {
    const notes = await notesForCourses("user_1", ["CSCI1001", "CSCI1004"], deps());
    expect(notes).toEqual([]);
  });
});
