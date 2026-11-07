import { NextResponse } from "next/server";
import { UnauthorizedError, requireUserId } from "@/auth";
import { appStore } from "@/db/server-store";
import { loadCatalogue } from "@/domain/catalogue";
import { applyProposalDecision, type ProposalAction } from "@/domain/proposal-flow";
import type { Catalogue } from "@/domain/types";

let catalogueCache: Catalogue | null = null;

function catalogue(): Catalogue {
  catalogueCache ??= loadCatalogue();
  return catalogueCache;
}

type RouteContext = { params: Promise<{ id: string }> };

function readAction(body: unknown): ProposalAction | null {
  if (typeof body !== "object" || body === null || !("action" in body)) return null;
  const action = (body as { action: unknown }).action;
  if (action === "apply" || action === "save-as-new" || action === "discard") return action;
  return null;
}

function statusFor(reason: string): number {
  if (reason === "forbidden") return 403;
  if (reason === "missing") return 404;
  return 409;
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const userId = await requireUserId();
    const { id } = await context.params;
    const action = readAction(await req.json().catch(() => null));
    if (!action) {
      return NextResponse.json({ error: "Missing action." }, { status: 400 });
    }

    const result = await applyProposalDecision({
      store: appStore,
      actorId: userId,
      proposalId: id,
      action,
      catalogue: catalogue(),
    });
    if (!result.ok) {
      return NextResponse.json(
        result.detail ? { reason: result.reason, detail: result.detail } : { reason: result.reason },
        { status: statusFor(result.reason) },
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
