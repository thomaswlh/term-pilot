import { NextResponse } from "next/server";
import { applyExample, type ExampleStudent } from "@/domain/examples";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";

function isExampleId(value: string): value is ExampleStudent["id"] {
  return value === "computer-science" || value === "chinese" || value === "japanese";
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body: unknown = await req.json();
    const exampleId =
      typeof body === "object" && body !== null && "exampleId" in body
        ? (body as { exampleId: unknown }).exampleId
        : undefined;
    if (typeof exampleId !== "string" || !isExampleId(exampleId)) {
      return NextResponse.json({ error: "Invalid exampleId" }, { status: 400 });
    }
    await applyExample(appStore, userId, exampleId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
