import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { readWhat2RegConfig } from "@/domain/what2reg/config";
import { createPkce, sealOauthState, buildAuthorizeUrl } from "@/domain/what2reg/oauth";
import { WHAT2REG_STATE_COOKIE } from "@/domain/what2reg/session";

export const dynamic = "force-dynamic";

function page(req: Request, query: string): URL {
  return new URL(`/what2reg?${query}`, req.url);
}

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const config = readWhat2RegConfig();
    if (!config) return NextResponse.redirect(page(req, "error=not-configured"));
    const redirectUri = config.redirectUri ?? new URL("/api/what2reg/callback", req.url).toString();
    const { verifier, challenge } = createPkce();
    const state = crypto.randomUUID();
    const sealed = sealOauthState(
      { state, verifier, userId, redirectUri, exp: Date.now() + 10 * 60 * 1000 },
      config.clientSecret,
    );
    const destination = buildAuthorizeUrl({ config, redirectUri, state, codeChallenge: challenge });
    const response = NextResponse.redirect(destination);
    response.cookies.set(WHAT2REG_STATE_COOKIE, sealed, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
