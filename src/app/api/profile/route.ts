import { NextResponse } from "next/server";
import { loadCatalogue } from "@/domain/catalogue";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body: unknown = await req.json();
    const majorCodeRaw =
      typeof body === "object" && body !== null && "majorCode" in body
        ? (body as { majorCode: unknown }).majorCode
        : undefined;
    const completedRaw =
      typeof body === "object" && body !== null && "completed" in body
        ? (body as { completed: unknown }).completed
        : undefined;

    const majorCode = typeof majorCodeRaw === "string" ? majorCodeRaw.trim().toUpperCase() : "";
    const catalogue = loadCatalogue();
    const validMajor = catalogue.majors.some((m) => m.code === majorCode);
    if (!validMajor) {
      return NextResponse.json({ error: "majorCode must be a code from the catalogue" }, { status: 400 });
    }

    const completedList = Array.isArray(completedRaw) ? completedRaw : [];
    const completed = completedList
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim().toUpperCase())
      .filter((c) => c.length > 0);

    const profile = await appStore.saveProfile(userId, { majorCode, completed });
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
