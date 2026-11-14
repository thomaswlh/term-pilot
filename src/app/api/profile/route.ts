import { NextResponse } from "next/server";
import { loadCatalogue } from "@/domain/catalogue";
import { mergeLegacyCompleted, parseProfileInput } from "@/domain/profile-input";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body: unknown = await req.json();
    const catalogue = loadCatalogue();
    const majorCodes = catalogue.majors.map((major) => major.code);
    const parsed = parseProfileInput(body, majorCodes);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { majorCode, yearOfStudy, admissionCohort, interests } = parsed.value;
    let courses;
    if ("courses" in parsed.value) {
      courses = parsed.value.courses;
    } else {
      const existing = await appStore.getProfile(userId);
      courses =
        "completedCodes" in parsed.value
          ? mergeLegacyCompleted(existing.courses, parsed.value.completedCodes)
          : existing.courses;
    }

    const profile = await appStore.saveProfile(userId, {
      majorCode,
      courses,
      yearOfStudy,
      admissionCohort,
      interests,
    });
    return NextResponse.json({ profile });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
