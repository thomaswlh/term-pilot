import type { Proposal, Store, Timetable } from "../db/store";
import { decideConfirm, decideDiscard } from "./confirm";
import { validateSections } from "./rules";
import type { Catalogue } from "./types";

export type ProposalAction = "apply" | "save-as-new" | "discard";

export type ProposalFlowResult =
  | { ok: true; effect: "apply"; timetable: Timetable; proposal: Proposal }
  | { ok: true; effect: "save-as-new"; timetable: Timetable; proposal: Proposal }
  | { ok: true; effect: "already-applied" }
  | { ok: true; effect: "discard"; proposal: Proposal }
  | { ok: false; reason: "forbidden" | "missing" | "discarded" | "stale" | "illegal"; detail?: string };

export async function applyProposalDecision(input: {
  store: Store;
  actorId: string;
  proposalId: string;
  action: ProposalAction;
  catalogue: Catalogue;
}): Promise<ProposalFlowResult> {
  const proposal = await input.store.getProposal(input.actorId, input.proposalId);

  if (input.action === "discard") {
    const decision = decideDiscard({ actorId: input.actorId, proposal });
    if (!decision.ok || !proposal) {
      return decision.ok ? { ok: false, reason: "missing" } : decision;
    }
    if (proposal.status !== "open") {
      return { ok: true, effect: "discard", proposal };
    }
    const updated = await input.store.setProposalStatus(input.actorId, proposal.id, "discarded");
    if (!updated) return { ok: false, reason: "missing" };
    return { ok: true, effect: "discard", proposal: updated };
  }

  const timetable = proposal
    ? await input.store.getTimetable(input.actorId, proposal.timetableId)
    : null;
  const profile = await input.store.getProfile(input.actorId);
  const report = validateSections(
    proposal?.sectionKeys ?? [],
    { majorCode: profile.majorCode ?? "", completed: profile.completed },
    input.catalogue,
  );
  const decision = decideConfirm({
    actorId: input.actorId,
    mode: input.action,
    proposal,
    timetable: timetable ? { userId: timetable.userId, revision: timetable.revision } : null,
    report,
  });
  if (!decision.ok) return decision;
  if (decision.effect === "already-applied" || !proposal || !timetable) {
    return decision.effect === "already-applied"
      ? { ok: true, effect: "already-applied" }
      : { ok: false, reason: "missing" };
  }

  if (decision.effect === "apply") {
    const written = await input.store.writeSections(
      input.actorId,
      timetable.id,
      decision.sectionKeys,
      decision.revision,
    );
    if (!written) return { ok: false, reason: "missing" };
    const updated = await input.store.setProposalStatus(input.actorId, proposal.id, "applied");
    if (!updated) return { ok: false, reason: "missing" };
    return { ok: true, effect: "apply", timetable: written, proposal: updated };
  }

  const created = await input.store.createTimetable(input.actorId, `${timetable.title} proposal`);
  const written = await input.store.writeSections(input.actorId, created.id, decision.sectionKeys, 1);
  if (!written) return { ok: false, reason: "missing" };
  const updated = await input.store.setProposalStatus(input.actorId, proposal.id, "saved-as-new");
  if (!updated) return { ok: false, reason: "missing" };
  return { ok: true, effect: "save-as-new", timetable: written, proposal: updated };
}
