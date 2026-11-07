import type { Proposal, ProposalStatus } from "../db/store";
import type { RuleReport } from "./rules";
import { ruleSentence } from "./rules";

export type ManualDecision =
  | { ok: true; sectionKeys: string[]; revision: number }
  | { ok: false; reason: string };

const PROFILE_UNSAVED = "Save your profile before adding a section.";
const REMOVE_ABSENT = "That section is not on this timetable.";

export function decideManualAdd(input: {
  profileSaved: boolean;
  timetable: { revision: number; sectionKeys: string[] };
  sectionKey: string;
  report: RuleReport;
}): ManualDecision {
  if (!input.profileSaved) {
    return { ok: false, reason: PROFILE_UNSAVED };
  }
  if (!input.report.ok) {
    const first = input.report.failures[0];
    if (!first) {
      return { ok: false, reason: "Validation failed." };
    }
    return { ok: false, reason: ruleSentence(first) };
  }

  const keys = input.timetable.sectionKeys;
  if (keys.includes(input.sectionKey)) {
    return {
      ok: true,
      sectionKeys: [...keys],
      revision: input.timetable.revision + 1,
    };
  }
  return {
    ok: true,
    sectionKeys: [...keys, input.sectionKey],
    revision: input.timetable.revision + 1,
  };
}

export function decideManualRemove(input: {
  timetable: { revision: number; sectionKeys: string[] };
  sectionKey: string;
}): ManualDecision {
  const keys = input.timetable.sectionKeys;
  if (!keys.includes(input.sectionKey)) {
    return { ok: false, reason: REMOVE_ABSENT };
  }
  return {
    ok: true,
    sectionKeys: keys.filter((k) => k !== input.sectionKey),
    revision: input.timetable.revision + 1,
  };
}

export type ConfirmDecision =
  | { ok: true; effect: "already-applied" }
  | { ok: true; effect: "apply"; sectionKeys: string[]; revision: number }
  | { ok: true; effect: "save-as-new"; sectionKeys: string[] }
  | {
      ok: false;
      reason: "forbidden" | "missing" | "discarded" | "stale" | "illegal";
      detail?: string;
    };

export function decideConfirm(input: {
  actorId: string;
  mode: "apply" | "save-as-new";
  proposal: Proposal | null;
  timetable: { userId: string; revision: number } | null;
  report: RuleReport;
}): ConfirmDecision {
  if (input.proposal === null || input.timetable === null) {
    return { ok: false, reason: "missing" };
  }
  if (input.proposal.userId !== input.actorId) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.timetable.userId !== input.actorId) {
    return { ok: false, reason: "forbidden" };
  }
  if (input.proposal.status === "applied" || input.proposal.status === "saved-as-new") {
    return { ok: true, effect: "already-applied" };
  }
  if (input.proposal.status === "discarded") {
    return { ok: false, reason: "discarded" };
  }
  if (input.timetable.revision !== input.proposal.baseRevision) {
    return { ok: false, reason: "stale" };
  }
  if (!input.report.ok) {
    const first = input.report.failures[0];
    return {
      ok: false,
      reason: "illegal",
      detail: first ? ruleSentence(first) : undefined,
    };
  }
  if (input.mode === "apply") {
    return {
      ok: true,
      effect: "apply",
      sectionKeys: [...input.proposal.sectionKeys],
      revision: input.proposal.baseRevision + 1,
    };
  }
  return {
    ok: true,
    effect: "save-as-new",
    sectionKeys: [...input.proposal.sectionKeys],
  };
}

export function decideDiscard(input: {
  actorId: string;
  proposal: Proposal | null;
}): { ok: true; status: ProposalStatus } | { ok: false; reason: "forbidden" | "missing" } {
  if (input.proposal === null) {
    return { ok: false, reason: "missing" };
  }
  if (input.proposal.userId !== input.actorId) {
    return { ok: false, reason: "forbidden" };
  }
  return { ok: true, status: "discarded" };
}
