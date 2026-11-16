import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { normalizeCourseCode } from "@/domain/what2reg/lookup";
import { readReviewsForUser, resolveRuntimeDeps } from "@/domain/what2reg/runtime";
import { WHAT2REG_ATTRIBUTION, WHAT2REG_DISCLAIMER } from "@/domain/what2reg/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const courseCode = normalizeCourseCode(url.searchParams.get("courseCode") ?? "");
    const instructors = url.searchParams.getAll("instructor").slice(0, 4);
    if (!/^[A-Z0-9]{2,20}$/.test(courseCode)) {
      return NextResponse.json({
        status: "empty",
        courseCode,
        attribution: WHAT2REG_ATTRIBUTION,
        disclaimer: WHAT2REG_DISCLAIMER,
        instructors: [],
        understanding: null,
        mayRejectLegalCourse: false,
      });
    }
    const deps = await resolveRuntimeDeps();
    const result = await readReviewsForUser({ userId, courseCode, instructors }, deps);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.info(JSON.stringify({ tool: "what2reg", outcome: "unavailable" }));
    return NextResponse.json({
      status: "unavailable",
      courseCode: "",
      attribution: WHAT2REG_ATTRIBUTION,
      disclaimer: WHAT2REG_DISCLAIMER,
      instructors: [],
      understanding: null,
      mayRejectLegalCourse: false,
    });
  }
}
