import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";
import { loadCatalogue } from "@/domain/catalogue";
import { planRequest, type AvoidRange, type PlanRequest } from "@/domain/planner";
import type { Catalogue, Day } from "@/domain/types";

let catalogueCache: Catalogue | null = null;

function catalogue(): Catalogue {
  catalogueCache ??= loadCatalogue();
  return catalogueCache;
}

const DAYS: readonly Day[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const PROFILE_REQUIRED = "Save your profile before adding a section.";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function readPlan(body: unknown): { timetableId: string; request: PlanRequest } | null {
  if (typeof body !== "object" || body === null) return null;
  const row = body as Record<string, unknown>;
  if (typeof row.timetableId !== "string" || row.timetableId.trim() === "") return null;
  if (!isStringArray(row.topics) || !isStringArray(row.keep) || !isStringArray(row.drop)) return null;
  if (!Array.isArray(row.avoid)) return null;
  const avoid: AvoidRange[] = [];
  for (const item of row.avoid) {
    if (typeof item !== "object" || item === null) return null;
    const range = item as Record<string, unknown>;
    if (typeof range.day !== "string" || !DAYS.includes(range.day as Day)) return null;
    if (typeof range.startMinutes !== "number" || typeof range.endMinutes !== "number") return null;
    avoid.push({
      day: range.day as Day,
      startMinutes: range.startMinutes,
      endMinutes: range.endMinutes,
    });
  }
  return {
    timetableId: row.timetableId.trim(),
    request: { topics: row.topics, keep: row.keep, drop: row.drop, avoid },
  };
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const plan = readPlan(await req.json().catch(() => null));
    if (!plan) {
      return NextResponse.json({ error: "Missing plan request." }, { status: 400 });
    }

    const profile = await appStore.getProfile(userId);
    if (!profile.saved || profile.majorCode === null) {
      return NextResponse.json({ proposalId: null, reason: PROFILE_REQUIRED }, { status: 403 });
    }

    const timetable = await appStore.getTimetable(userId, plan.timetableId);
    if (!timetable) {
      return NextResponse.json({ proposalId: null, reason: "Timetable not found." }, { status: 404 });
    }

    const outcome = planRequest({
      request: plan.request,
      currentKeys: timetable.sectionKeys,
      profile: { majorCode: profile.majorCode, completed: profile.completed },
      catalogue: catalogue(),
    });
    if (outcome.proposal === null) {
      return NextResponse.json({ proposalId: null, reason: outcome.reason });
    }

    const draft = outcome.proposal;
    const created = await appStore.createProposal({
      userId,
      timetableId: timetable.id,
      baseRevision: timetable.revision,
      sectionKeys: draft.sectionKeys,
      droppedWishes: draft.droppedWishes,
      warnings: draft.warnings.map((warning) => ({
        rule: warning.rule,
        sectionKey: warning.sectionKey,
        groupNo: warning.groupNo,
        requiredCount: warning.requiredCount,
      })),
      summary: draft.summary,
    });
    return NextResponse.json({ proposalId: created.id, summary: draft.summary });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
