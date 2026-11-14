import { ruleSentence, type RuleFailure, type RuleReport } from "@/domain/rules";

const TOOL_PHASE_TITLES: Record<string, Record<"running" | "done" | "failed", string>> = {
  searchSections: {
    running: "Searching the catalogue",
    done: "Searched the catalogue",
    failed: "Could not search the catalogue",
  },
  readProfile: {
    running: "Reading the profile",
    done: "Read the profile",
    failed: "Could not read the profile",
  },
  readStudyPlan: {
    running: "Reading the study plan",
    done: "Study plan",
    failed: "Could not read the study plan",
  },
  readTimetable: {
    running: "Reading this timetable",
    done: "Read this timetable",
    failed: "Could not read this timetable",
  },
  plan: {
    running: "Drafting a proposal",
    done: "Drafted a proposal",
    failed: "Could not draft a proposal",
  },
  validate: {
    running: "Checking the rules",
    done: "Checked the rules",
    failed: "Could not check the rules",
  },
};

export function toolTitle(
  name: string,
  phase: "running" | "done" | "failed",
  view?: { proposalId: string | null; summary: string | null },
): string {
  if (name === "plan" && phase === "done" && view?.proposalId === null && view.summary) {
    return "Checked this timetable";
  }
  return TOOL_PHASE_TITLES[name]?.[phase] ?? name;
}

export type PlanToolView = {
  failed: boolean;
  detail: string | null;
  proposalId: string | null;
  summary: string | null;
};

function parseData(data: unknown): unknown {
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return null;
    }
  }
  return data;
}

function asRecord(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "object" || data === null) return null;
  return data as Record<string, unknown>;
}

function ruleReport(data: Record<string, unknown>): RuleReport | null {
  if (!("ok" in data) || typeof data.ok !== "boolean") return null;
  const failures = Array.isArray(data.failures) ? (data.failures as RuleFailure[]) : [];
  const warnings = Array.isArray(data.warnings) ? data.warnings : [];
  return { ok: data.ok, failures, warnings };
}

export function planToolView(data: unknown, errored: boolean): PlanToolView {
  const empty: PlanToolView = { failed: false, detail: null, proposalId: null, summary: null };
  if (!errored && typeof data === "string") {
    const trimmed = data.trim();
    if (trimmed.startsWith("Error:")) {
      const detail = trimmed.slice("Error:".length).trim();
      return { failed: true, detail: detail || trimmed, proposalId: null, summary: null };
    }
  }
  if (errored) {
    const detail = typeof data === "string" && data.trim() ? data : typeof data === "string" ? data : null;
    return { failed: true, detail, proposalId: null, summary: null };
  }

  const parsed = parseData(data);
  const row = asRecord(parsed);
  if (!row) return empty;

  if ("credits" in row && row.credits !== undefined && row.credits !== null) {
    const summary = typeof row.summary === "string" ? row.summary : null;
    const proposalId = typeof row.proposalId === "string" && row.proposalId ? row.proposalId : null;
    return {
      failed: false,
      detail: summary,
      proposalId,
      summary,
    };
  }

  if (row.proposalId === null && typeof row.reason === "string") {
    return { failed: true, detail: row.reason, proposalId: null, summary: null };
  }

  const report = ruleReport(row);
  if (report) {
    if (!report.ok) {
      const first = report.failures[0];
      const detail = first ? ruleSentence(first) : null;
      return { failed: true, detail, proposalId: null, summary: null };
    }
    return empty;
  }

  if (typeof row.proposalId === "string" && row.proposalId) {
    const summary = typeof row.summary === "string" && row.summary.trim() ? row.summary : "Open this proposal";
    return { failed: false, detail: null, proposalId: row.proposalId, summary };
  }

  return empty;
}
