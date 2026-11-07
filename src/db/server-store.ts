import postgres, { type Sql } from "postgres";
import { postgresStore } from "./postgres";
import { memoryStore } from "./store";
import type { ProposalStatus, Store } from "./store";

type GlobalForStore = typeof globalThis & {
  termPilotAppStore?: Store;
  termPilotSql?: Sql;
};

const globalForStore = globalThis as GlobalForStore;

const SHARE_STORE_METHODS = ["getShareStatus", "enableShare", "disableShare", "getSharedTimetable"] as const;

function isStoreCurrent(store: unknown): store is Store {
  if (typeof store !== "object" || store === null) {
    return false;
  }
  return SHARE_STORE_METHODS.every((method) => typeof (store as Store)[method] === "function");
}

function resolveSql(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) {
    return null;
  }
  if (globalForStore.termPilotSql) {
    return globalForStore.termPilotSql;
  }
  globalForStore.termPilotSql = postgres(url, { max: 1 });
  return globalForStore.termPilotSql;
}

function createStore(): Store {
  const sql = resolveSql();
  if (sql) {
    return postgresStore(sql);
  }
  return memoryStore();
}

function resolveStore(): Store {
  const cached = globalForStore.termPilotAppStore;
  if (cached && isStoreCurrent(cached)) {
    return cached;
  }
  const store = createStore();
  globalForStore.termPilotAppStore = store;
  return store;
}

/**
 * Lazily resolves to postgres when DATABASE_URL is set so test imports never open a DB.
 * The store is pinned on globalThis so API routes and server components share one instance in dev.
 * Replaces a stale cached store when hot reload leaves an instance without newer Store methods.
 */
export const appStore: Store = {
  getProfile(userId) {
    return resolveStore().getProfile(userId);
  },
  saveProfile(userId, input) {
    return resolveStore().saveProfile(userId, input);
  },
  listTimetables(userId) {
    return resolveStore().listTimetables(userId);
  },
  createTimetable(userId, title) {
    return resolveStore().createTimetable(userId, title);
  },
  getTimetable(userId, id) {
    return resolveStore().getTimetable(userId, id);
  },
  renameTimetable(userId, id, title) {
    return resolveStore().renameTimetable(userId, id, title);
  },
  deleteTimetable(userId, id) {
    return resolveStore().deleteTimetable(userId, id);
  },
  writeSections(userId, id, sectionKeys, revision) {
    return resolveStore().writeSections(userId, id, sectionKeys, revision);
  },
  createProposal(input) {
    return resolveStore().createProposal(input);
  },
  getProposal(userId, id) {
    return resolveStore().getProposal(userId, id);
  },
  listProposals(userId, timetableId) {
    return resolveStore().listProposals(userId, timetableId);
  },
  setProposalStatus(userId, id, status: ProposalStatus) {
    return resolveStore().setProposalStatus(userId, id, status);
  },
  getShareStatus(userId, id) {
    return resolveStore().getShareStatus(userId, id);
  },
  enableShare(userId, id) {
    return resolveStore().enableShare(userId, id);
  },
  disableShare(userId, id) {
    return resolveStore().disableShare(userId, id);
  },
  getSharedTimetable(token) {
    return resolveStore().getSharedTimetable(token);
  },
};
