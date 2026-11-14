import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";
import { prerequisiteClaims } from "@/domain/academic";
import { loadCatalogue } from "@/domain/catalogue";
import { decideManualAdd, decideManualRemove } from "@/domain/confirm";
import { validateSections } from "@/domain/rules";
import type { Catalogue } from "@/domain/types";

let catalogueCache: Catalogue | null = null;

function catalogue(): Catalogue {
  catalogueCache ??= loadCatalogue();
  return catalogueCache;
}

const PROFILE_REQUIRED = "Save your profile before adding a section.";

type RouteContext = { params: Promise<{ id: string }> };

function readSectionKey(body: unknown): string {
  if (typeof body === "object" && body !== null && "sectionKey" in body) {
    const value = (body as { sectionKey: unknown }).sectionKey;
    if (typeof value === "string") return value.trim();
  }
  return "";
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const timetable = await appStore.getTimetable(userId, id);
    if (!timetable) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const proposals = await appStore.listProposals(userId, id);
    if (proposals.some((p) => p.status === "open")) {
      return NextResponse.json(
        { error: "Finish reviewing the open AI proposal to add courses manually." },
        { status: 409 },
      );
    }

    const sectionKey = readSectionKey(await req.json().catch(() => null));
    if (!sectionKey) {
      return NextResponse.json({ error: "Missing section." }, { status: 400 });
    }

    const profile = await appStore.getProfile(userId);
    if (!profile.saved || profile.majorCode === null) {
      const decision = decideManualAdd({
        profileSaved: false,
        timetable,
        sectionKey,
        report: { ok: true, failures: [], warnings: [] },
      });
      return NextResponse.json(
        { error: decision.ok ? PROFILE_REQUIRED : decision.reason },
        { status: 403 },
      );
    }

    const union = timetable.sectionKeys.includes(sectionKey)
      ? [...timetable.sectionKeys]
      : [...timetable.sectionKeys, sectionKey];
    const report = validateSections(
      union,
      {
        majorCode: profile.majorCode,
        claims: prerequisiteClaims(profile.courses),
        yearOfStudy: profile.yearOfStudy,
      },
      catalogue(),
    );
    const decision = decideManualAdd({
      profileSaved: profile.saved,
      timetable,
      sectionKey,
      report,
    });
    if (!decision.ok) {
      const status = decision.reason === PROFILE_REQUIRED ? 403 : 400;
      return NextResponse.json({ error: decision.reason, failures: report.failures }, { status });
    }

    const written = await appStore.writeSections(userId, id, decision.sectionKeys, decision.revision);
    if (!written) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ timetable: written, warnings: report.warnings });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const timetable = await appStore.getTimetable(userId, id);
    if (!timetable) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const proposals = await appStore.listProposals(userId, id);
    if (proposals.some((p) => p.status === "open")) {
      return NextResponse.json(
        { error: "Finish reviewing the open AI proposal to add courses manually." },
        { status: 409 },
      );
    }

    const sectionKey = readSectionKey(await req.json().catch(() => null));
    if (!sectionKey) {
      return NextResponse.json({ error: "Missing section." }, { status: 400 });
    }

    const decision = decideManualRemove({ timetable, sectionKey });
    if (!decision.ok) {
      return NextResponse.json({ error: decision.reason }, { status: 400 });
    }

    const written = await appStore.writeSections(userId, id, decision.sectionKeys, decision.revision);
    if (!written) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ timetable: written });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
