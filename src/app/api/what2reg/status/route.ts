import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { what2RegConfigured } from "@/domain/what2reg/config";
import { resolveRuntimeDeps } from "@/domain/what2reg/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = await requireUserId();
    const deps = await resolveRuntimeDeps();
    const grant = await deps.store.get(userId);
    return NextResponse.json({
      configured: what2RegConfigured(),
      connected: grant !== null,
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw error;
  }
}
