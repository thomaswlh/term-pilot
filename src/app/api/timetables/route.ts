import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";

export async function GET() {
  try {
    const userId = await requireUserId();
    const timetables = await appStore.listTimetables(userId);
    return NextResponse.json({ timetables });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    let title: string | undefined;
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body: unknown = await req.json().catch(() => null);
      if (
        typeof body === "object" &&
        body !== null &&
        "title" in body &&
        typeof (body as { title: unknown }).title === "string"
      ) {
        const trimmed = (body as { title: string }).title.trim();
        if (trimmed) title = trimmed;
      }
    }
    const timetable = await appStore.createTimetable(userId, title);
    return NextResponse.json({ timetable }, { status: 201 });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
