import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { disconnectUser, resolveRuntimeDeps } from "@/domain/what2reg/runtime";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const deps = await resolveRuntimeDeps();
    await disconnectUser(userId, deps);
    const accepts = req.headers.get("accept") ?? "";
    if (accepts.includes("text/html")) {
      return NextResponse.redirect(new URL("/what2reg?disconnected=1", req.url), 303);
    }
    return NextResponse.json({ connected: false });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
