import type { Store, Profile } from "../db/store";
import { heldCourseCodes, prerequisiteClaims, type CourseRecord } from "../domain/academic";
import { loadCreditBook } from "../domain/credit-snapshot";
import { planRequest, type PlanCreditReport, type PlanRequest } from "../domain/planner";
import { POLICY_CARDS, policyBinding, type PolicyCard } from "../domain/policy";
import { loadStudyPlan, type StudyPlan, type StudyPlanCourse } from "../domain/study-plan";
import { validateSections, type RuleReport } from "../domain/rules";
import { searchSections, type SearchHit } from "../domain/search";
import type { Catalogue } from "../domain/types";

export const TOOL_NAMES = [
  "searchSections",
  "readProfile",
  "readPolicy",
  "readStudyPlan",
  "readTimetable",
  "plan",
  "validate",
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export type ToolCaller = (name: string, args: unknown) => Promise<unknown>;

export class LimitError extends Error {
  readonly name = "LimitError";
  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenToolError extends Error {
  readonly name = "ForbiddenToolError";
  constructor(message: string) {
    super(message);
  }
}

function callLimitMessage(budget: AgentBudget): string {
  return `This turn reached its ${budget.maxCalls}-tool-call limit. Ask for a smaller change.`;
}

function timeLimitMessage(budget: AgentBudget): string {
  return `This turn reached its ${budget.maxMs / 1000}-second limit. Ask for a smaller change.`;
}

function deadlineExceeded(budget: AgentBudget, t: number): boolean {
  return budget.start === null || t - budget.start >= budget.maxMs;
}

function reserveToolCall(budget: AgentBudget, now: () => number): void {
  const t = now();
  if (budget.calls >= budget.maxCalls) {
    throw new LimitError(callLimitMessage(budget));
  }
  if (deadlineExceeded(budget, t)) {
    throw new LimitError(timeLimitMessage(budget));
  }
  budget.calls += 1;
}

function rejectIfTurnExhausted(budget: AgentBudget, now: () => number): void {
  const t = now();
  if (budget.calls >= budget.maxCalls) {
    throw new LimitError(callLimitMessage(budget));
  }
  if (deadlineExceeded(budget, t)) {
    throw new LimitError(timeLimitMessage(budget));
  }
}

function assertProposalDeadline(budget: AgentBudget, now: () => number): void {
  if (deadlineExceeded(budget, now())) {
    throw new LimitError(timeLimitMessage(budget));
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
  readProfile: () => Promise<{
    saved: boolean;
    majorCode: string | null;
    majorName: string | null;
    majorProgramme: string | null;
    courses: CourseRecord[];
    heldCourseCodes: string[];
    yearOfStudy: Profile["yearOfStudy"];
    admissionCohort: Profile["admissionCohort"];
    interests: string | null;
  }>;
  readStudyPlan: (args?: unknown) => Promise<{
    plan: StudyPlan | null;
    rows: Array<StudyPlanCourse & { offeredThisSemester: boolean; coveredByHeldRecord: boolean }>;
    message: string;
  }>;
  readPolicy: (args?: unknown) => Promise<Array<PolicyCard & { binding: string }>>;
  readTimetable: () => Promise<{ id: string; title: string; revision: number; sectionKeys: string[] } | null>;
  plan: (args: { request: PlanRequest & { baseProposalId?: string | null } }) => Promise<
    | {
        proposalId: string | null;
        summary: string;
        credits: PlanCreditReport;
        droppedWishes: string[];
      }
    | { proposalId: null; reason: string }
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
      const major =
        profile.saved && profile.majorCode
          ? (catalogue.majors.find((row) => row.code === profile.majorCode) ?? null)
          : null;
      console.info(JSON.stringify({ tool: "readProfile", outcome: "ok" }));
      return {
        saved: profile.saved,
        majorCode: profile.majorCode,
        majorName: major?.name ?? null,
        majorProgramme: major?.programme ?? null,
        courses: profile.courses,
        heldCourseCodes: heldCourseCodes(profile.courses),
        yearOfStudy: profile.yearOfStudy,
        admissionCohort: profile.admissionCohort,
        interests: profile.interests,
      };
    },

    async readStudyPlan(_args?: unknown) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      const missing = {
        plan: null,
        rows: [],
        message: "TermPilot has no reviewed study plan for the saved major.",
      };
      if (!profile.majorCode) {
        console.info(JSON.stringify({ tool: "readStudyPlan", outcome: "ok" }));
        return missing;
      }
      const plan = loadStudyPlan(profile.majorCode);
      if (!plan) {
        console.info(JSON.stringify({ tool: "readStudyPlan", outcome: "ok" }));
        return missing;
      }
      const held = new Set(heldCourseCodes(profile.courses));
      const offered = new Set(catalogue.sections.map((section) => section.courseCode));
      console.info(JSON.stringify({ tool: "readStudyPlan", outcome: "ok" }));
      return {
        plan,
        rows: plan.courses.map((course) => ({
          ...course,
          offeredThisSemester: course.catalogueCode !== null && offered.has(course.catalogueCode),
          coveredByHeldRecord:
            held.has(course.sourceCode) || (course.catalogueCode !== null && held.has(course.catalogueCode)),
        })),
        message: `Reviewed study plan: ${plan.source.title}.`,
      };
    },

    async readPolicy(_args?: unknown) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      const cohort = profile.saved ? profile.admissionCohort : null;
      console.info(JSON.stringify({ tool: "readPolicy", outcome: "ok" }));
      return POLICY_CARDS.map((card) => ({
        ...card,
        binding: policyBinding(card, cohort),
      }));
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

    async plan(args: { request: PlanRequest & { baseProposalId?: string | null } }) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      if (!profile.saved) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: "Save your profile before adding a section." };
      }
      if (!profile.majorCode?.trim()) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: "Save a major on your profile before planning." };
      }

      const timetable = await store.getTimetable(userId, timetableId);
      if (!timetable) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: "Timetable not found." };
      }

      const { baseProposalId = null, ...request } = args.request;
      let currentKeys = [...timetable.sectionKeys];
      let seedUnmet: string[] | undefined;
      if (baseProposalId) {
        const preview = await store.getProposal(userId, baseProposalId);
        if (preview && preview.status === "open" && preview.timetableId === timetableId) {
          currentKeys = [...preview.sectionKeys];
        } else {
          seedUnmet = ["Unknown or closed preview."];
        }
      }

      const outcome = planRequest({
        request,
        savedKeys: timetable.sectionKeys,
        currentKeys,
        seedUnmet,
        profile: {
          majorCode: profile.majorCode,
          courses: profile.courses,
          yearOfStudy: profile.yearOfStudy,
          interests: profile.interests,
        },
        catalogue,
        credits: loadCreditBook(),
      });

      if (outcome.proposal === null) {
        console.info(JSON.stringify({ tool: "plan", outcome: "refused" }));
        return { proposalId: null, reason: outcome.reason };
      }

      const draft = outcome.proposal;

      assertProposalDeadline(budget, now);

      const report = {
        summary: draft.summary,
        credits: draft.credits,
        droppedWishes: draft.droppedWishes,
      };
      if (!draft.storePreview) {
        console.info(JSON.stringify({ tool: "plan", outcome: "ok" }));
        return { proposalId: null, ...report };
      }

      const created = await store.createProposal({
        userId,
        timetableId,
        baseRevision: timetable.revision,
        sectionKeys: draft.sectionKeys,
        droppedWishes: draft.droppedWishes,
        warnings: draft.warnings,
        summary: draft.summary,
      });

      console.info(JSON.stringify({ tool: "plan", outcome: "ok" }));
      return { proposalId: created.id, ...report };
    },

    async validate(args: { sectionKeys: string[] }) {
      reserveToolCall(budget, now);
      const profile = await store.getProfile(userId);
      const report = validateSections(
        args.sectionKeys,
        {
          majorCode: profile.majorCode ?? "",
          claims: prerequisiteClaims(profile.courses),
          yearOfStudy: profile.yearOfStudy,
        },
        catalogue,
      );
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
        throw new ForbiddenToolError("That tool is not available.");
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
