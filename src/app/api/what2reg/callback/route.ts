import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { readWhat2RegConfig } from "@/domain/what2reg/config";
import { exchangeAuthorizationCode, openOauthState } from "@/domain/what2reg/oauth";
import { resolveRuntimeDeps } from "@/domain/what2reg/runtime";
import { readStateCookie, WHAT2REG_STATE_COOKIE } from "@/domain/what2reg/session";

export const dynamic = "force-dynamic";

function page(req: Request, query: string): URL {
  return new URL(`/what2reg?${query}`, req.url);
}

function clearCookie(response: NextResponse) {
  response.cookies.set(WHAT2REG_STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const config = readWhat2RegConfig();
    if (!config) return NextResponse.redirect(page(req, "error=not-configured"));
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const oauthError = url.searchParams.get("error");
    if (oauthError || !code || !state) return clearCookie(NextResponse.redirect(page(req, "error=denied")));
    const sealed = readStateCookie(req);
    const payload = sealed ? openOauthState(sealed, config.clientSecret, Date.now()) : null;
    if (!payload || payload.state !== state || payload.userId !== userId) {
      return clearCookie(NextResponse.redirect(page(req, "error=state")));
    }
    const deps = await resolveRuntimeDeps();
    const exchanged = await exchangeAuthorizationCode({
      config,
      code,
      redirectUri: payload.redirectUri,
      verifier: payload.verifier,
      postForm: deps.postForm,
    });
    if (!exchanged.ok) return clearCookie(NextResponse.redirect(page(req, "error=exchange")));
    try {
      await deps.store.save(userId, exchanged.grant);
    } catch {
      return clearCookie(NextResponse.redirect(page(req, "error=not-configured")));
    }
    return clearCookie(NextResponse.redirect(page(req, "connected=1")));
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
