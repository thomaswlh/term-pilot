import { randomUUID } from "node:crypto";
import { newShareToken } from "@/domain/share-token";

export type Profile = {
  userId: string;
  majorCode: string | null;
  completed: string[];
  saved: boolean;
};

export type Timetable = {
  id: string;
  userId: string;
  title: string;
  revision: number;
  sectionKeys: string[];
  updatedAt: string;
};

export type ProposalStatus = "open" | "applied" | "saved-as-new" | "discarded";

export type SharedTimetable = {
  title: string;
  sectionKeys: string[];
  updatedAt: string;
};

export type Proposal = {
  id: string;
  userId: string;
  timetableId: string;
  baseRevision: number;
  sectionKeys: string[];
  droppedWishes: string[];
  warnings: { rule: string; sectionKey: string; groupNo: string; requiredCount: number }[];
  summary: string;
  status: ProposalStatus;
  createdAt: string;
};

export type Store = {
  getProfile(userId: string): Promise<Profile>;
  saveProfile(userId: string, input: { majorCode: string; completed: string[] }): Promise<Profile>;
  listTimetables(userId: string): Promise<Timetable[]>;
  createTimetable(userId: string, title?: string): Promise<Timetable>;
  getTimetable(userId: string, id: string): Promise<Timetable | null>;
  renameTimetable(userId: string, id: string, title: string): Promise<Timetable | null>;
  deleteTimetable(userId: string, id: string): Promise<boolean>;
  writeSections(
    userId: string,
    id: string,
    sectionKeys: string[],
    revision: number,
  ): Promise<Timetable | null>;
  createProposal(input: Omit<Proposal, "id" | "status" | "createdAt">): Promise<Proposal>;
  getProposal(userId: string, id: string): Promise<Proposal | null>;
  listProposals(userId: string, timetableId: string): Promise<Proposal[]>;
  setProposalStatus(userId: string, id: string, status: ProposalStatus): Promise<Proposal | null>;
  getShareStatus(userId: string, id: string): Promise<string | null>;
  enableShare(userId: string, id: string): Promise<string | null>;
  disableShare(userId: string, id: string): Promise<boolean>;
  getSharedTimetable(token: string): Promise<SharedTimetable | null>;
};

function nowIso(): string {
  return new Date().toISOString();
}

export function memoryStore(): Store {
  type ProfileRow = { majorCode: string | null; completed: string[]; saved: boolean };
  const profiles = new Map<string, ProfileRow>();
  const timetables = new Map<string, Timetable>();
  const proposals = new Map<string, Proposal>();
  const shareTokenByTimetableId = new Map<string, string>();
  const timetableIdByShareToken = new Map<string, string>();

  function clearShareForTimetable(timetableId: string) {
    const previous = shareTokenByTimetableId.get(timetableId);
    if (previous) {
      timetableIdByShareToken.delete(previous);
    }
    shareTokenByTimetableId.delete(timetableId);
  }

  return {
    async getProfile(userId) {
      const row = profiles.get(userId);
      if (!row) {
        return { userId, majorCode: null, completed: [], saved: false };
      }
      return { userId, ...row, completed: [...row.completed] };
    },

    async saveProfile(userId, input) {
      const row: ProfileRow = {
        majorCode: input.majorCode,
        completed: [...input.completed],
        saved: true,
      };
      profiles.set(userId, row);
      return { userId, majorCode: row.majorCode, completed: [...row.completed], saved: true };
    },

    async listTimetables(userId) {
      return [...timetables.values()]
        .filter((row) => row.userId === userId)
        .map((row) => ({
          ...row,
          sectionKeys: [...row.sectionKeys],
        }));
    },

    async createTimetable(userId, title) {
      const id = randomUUID();
      const row: Timetable = {
        id,
        userId,
        title: title ?? "Untitled timetable",
        revision: 1,
        sectionKeys: [],
        updatedAt: nowIso(),
      };
      timetables.set(id, row);
      return { ...row, sectionKeys: [...row.sectionKeys] };
    },

    async getTimetable(userId, id) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return null;
      return { ...row, sectionKeys: [...row.sectionKeys] };
    },

    async renameTimetable(userId, id, title) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return null;
      const next: Timetable = { ...row, title, updatedAt: nowIso() };
      timetables.set(id, next);
      return { ...next, sectionKeys: [...next.sectionKeys] };
    },

    async deleteTimetable(userId, id) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return false;
      clearShareForTimetable(id);
      timetables.delete(id);
      const toRemove: string[] = [];
      for (const [proposalId, proposal] of proposals) {
        if (proposal.timetableId === id) {
          toRemove.push(proposalId);
        }
      }
      for (const proposalId of toRemove) {
        proposals.delete(proposalId);
      }
      return true;
    },

    async writeSections(userId, id, sectionKeys, revision) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return null;
      const next: Timetable = {
        ...row,
        sectionKeys: [...sectionKeys],
        revision,
        updatedAt: nowIso(),
      };
      timetables.set(id, next);
      return { ...next, sectionKeys: [...next.sectionKeys] };
    },

    async createProposal(input) {
      const id = randomUUID();
      const proposal: Proposal = {
        ...input,
        id,
        status: "open",
        createdAt: nowIso(),
        sectionKeys: [...input.sectionKeys],
        droppedWishes: [...input.droppedWishes],
        warnings: input.warnings.map((w) => ({ ...w })),
      };
      proposals.set(id, proposal);
      return { ...proposal, sectionKeys: [...proposal.sectionKeys], droppedWishes: [...proposal.droppedWishes] };
    },

    async getProposal(userId, id) {
      const row = proposals.get(id);
      if (!row || row.userId !== userId) return null;
      return {
        ...row,
        sectionKeys: [...row.sectionKeys],
        droppedWishes: [...row.droppedWishes],
        warnings: row.warnings.map((w) => ({ ...w })),
      };
    },

    async listProposals(userId, timetableId) {
      return [...proposals.values()]
        .filter((row) => row.userId === userId && row.timetableId === timetableId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id))
        .map((row) => ({
          ...row,
          sectionKeys: [...row.sectionKeys],
          droppedWishes: [...row.droppedWishes],
          warnings: row.warnings.map((w) => ({ ...w })),
        }));
    },

    async setProposalStatus(userId, id, status) {
      const row = proposals.get(id);
      if (!row || row.userId !== userId) return null;
      const next: Proposal = { ...row, status };
      proposals.set(id, next);
      return {
        ...next,
        sectionKeys: [...next.sectionKeys],
        droppedWishes: [...next.droppedWishes],
        warnings: next.warnings.map((w) => ({ ...w })),
      };
    },

    async getShareStatus(userId, id) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return null;
      return shareTokenByTimetableId.get(id) ?? null;
    },

    async enableShare(userId, id) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return null;
      clearShareForTimetable(id);
      const token = newShareToken();
      shareTokenByTimetableId.set(id, token);
      timetableIdByShareToken.set(token, id);
      return token;
    },

    async disableShare(userId, id) {
      const row = timetables.get(id);
      if (!row || row.userId !== userId) return false;
      clearShareForTimetable(id);
      return true;
    },

    async getSharedTimetable(token) {
      const timetableId = timetableIdByShareToken.get(token);
      if (!timetableId) return null;
      const row = timetables.get(timetableId);
      if (!row || shareTokenByTimetableId.get(timetableId) !== token) return null;
      return {
        title: row.title,
        sectionKeys: [...row.sectionKeys],
        updatedAt: row.updatedAt,
      };
    },
  };
}
