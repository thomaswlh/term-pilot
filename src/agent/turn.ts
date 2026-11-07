import type { Store } from "../db/store";
import { planRequest, type PlanRequest } from "../domain/planner";
import { validateSections, type RuleReport } from "../domain/rules";
import { searchSections, type SearchHit } from "../domain/search";
import type { Catalogue } from "../domain/types";

export const TOOL_NAMES = ["searchSections", "readProfile", "readTimetable", "plan", "validate"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolCaller = (name: string, args: unknown) => Promise<unknown>;

export class LimitError extends Error {
  readonly name = "LimitError";
}

export class ForbiddenToolError extends Error {
  readonly name = "ForbiddenToolError";
}

function deadlineExceeded(budget: AgentBudget, t: number): boolean {
  return budget.start === null || t - budget.start >= budget.maxMs;
}

function reserveToolCall(budget: AgentBudget, now: () => number): void {
  const t = now();
  if (budget.calls >= budget.maxCalls || deadlineExceeded(budget, t)) {
    throw new LimitError();
  }
  budget.calls += 1;
}

function rejectIfTurnExhausted(budget: AgentBudget, now: () => number): void {
  const t = now();
  if (budget.calls >= budget.maxCalls || deadlineExceeded(budget, t)) {
    throw new LimitError();
  }
}

function assertProposalDeadline(budget: AgentBudget, now: () => number): void {
  const t = now();
  const start = budget.start;
  if (start === null || t - start >= budget.maxMs) {
    throw new LimitError();
  }
}

export type AgentBudget = {
  calls: number;
  start: number | null;
  maxCalls: number;
  maxMs: number;
};

export function createTools(input: {
  store: Store;
  userId: string;
  timetableId: string;
  catalogue: Catalogue;
  now: () => number;
  budget: AgentBudget;
}): {
  searchSections: (args: { query: string }) => Promise<SearchHit[]>;
  readProfile: () => Promise<{ saved: boolean; majorCode: string | null; completed: string[] }>;
  readTimetable: () => Promise<{ id: string; title: string; revision: number; sectionKeys: string[] } | null>;
  plan: (args: { request: PlanRequest }) => Promise<
    { proposalId: string; summary: string } | { proposalId: null; reason: string }
  >;
  validate: (args: { sectionKeys: string[] }) => Promise<RuleReport>;
} {
  const { store, userId, timetableId, catalogue, now, budget } = input;

  return {
    async searchSections(args: { query: string }) {
      reserveToolCall(budget, now);
      const hits = searchSections(catalogue, args.query, 10);
      console.info(JSON.stringify({ tool: "searchSections", outcome: "ok" }));
      return hits;
    },

    async readProfile() {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      console.info(JSON.stringify({ tool: "readProfile", outcome: "ok" }));
      return { saved: profile.saved, majorCode: profile.majorCode, completed: [...profile.completed] };
    },

    async readTimetable() {
      reserveToolCall(budget, now);
      const row = await store.getTimetable(userId, timetableId);
      if (!row) {
        console.info(JSON.stringify({ tool: "readTimetable", outcome: "ok" }));
        return null;
      }
      console.info(JSON.stringify({ tool: "readTimetable", outcome: "ok" }));
      return {
        id: row.id,
        title: row.title,
        revision: row.revision,
        sectionKeys: [...row.sectionKeys],
      };
    },

    async plan(args: { request: PlanRequest }) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      if (!profile.saved) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: "Save your profile before adding a section." };
      }

      const timetable = await store.getTimetable(userId, timetableId);
      if (!timetable) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: "Timetable not found." };
      }

      const outcome = planRequest({
        request: args.request,
        currentKeys: [...timetable.sectionKeys],
        profile: { majorCode: profile.majorCode ?? "", completed: [...profile.completed] },
        catalogue,
      });

      if ("proposal" in outcome && outcome.proposal === null) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: outcome.reason };
      }

      const draft = outcome.proposal!;

      assertProposalDeadline(budget, now);

      const created = await store.createProposal({
        userId,
        timetableId,
        baseRevision: timetable.revision,
        sectionKeys: draft.sectionKeys,
        droppedWishes: draft.droppedWishes,
        warnings: draft.warnings.map((w) => ({
          rule: w.rule,
          sectionKey: w.sectionKey,
          groupNo: w.groupNo,
          requiredCount: w.requiredCount,
        })),
        summary: draft.summary,
      });

      console.info(JSON.stringify({ tool: "plan", outcome: "ok" }));
      return { proposalId: created.id, summary: draft.summary };
    },

    async validate(args: { sectionKeys: string[] }) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      const report = validateSections(args.sectionKeys, { majorCode: profile.majorCode ?? "", completed: [...profile.completed] }, catalogue);
      console.info(JSON.stringify({ tool: "validate", outcome: "ok" }));
      return report;
    },
  };
}

export async function runTurn(input: {
  message: string;
  model: (input: { message: string; callTool: ToolCaller }) => Promise<{ text: string }>;
  callTool: ToolCaller;
  now: () => number;
  maxCalls?: number;
  maxMs?: number;
  budget?: AgentBudget;
}): Promise<{ text: string }> {
  const maxCalls = input.maxCalls ?? 8;
  const maxMs = input.maxMs ?? 30_000;
  const budget =
    input.budget ??
    ({
      calls: 0,
      start: null,
      maxCalls,
      maxMs,
    } satisfies AgentBudget);
  budget.maxCalls = maxCalls;
  budget.maxMs = maxMs;
  budget.start = input.now();

  const callTool: ToolCaller = async (name, args) => {
    try {
      rejectIfTurnExhausted(budget, input.now);
      if (!TOOL_NAMES.includes(name as ToolName)) {
        console.info(JSON.stringify({ tool: name, outcome: "error" }));
        throw new ForbiddenToolError();
      }
      return await input.callTool(name, args);
    } catch (e) {
      console.info(JSON.stringify({ tool: name, outcome: "error" }));
      throw e;
    }
  };

  try {
    return await input.model({ message: input.message, callTool });
  } catch {
    return { text: "The plan did not finish." };
  }
}
