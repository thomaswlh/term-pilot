import { readFileSync } from "node:fs";
import path from "node:path";
import postgres, { type Sql } from "postgres";
import { postgresStore } from "./postgres";
import { memoryStore } from "./store";
import type { ProposalStatus, Store } from "./store";

type GlobalForStore = typeof globalThis & {
  termPilotAppStore?: Store;
  termPilotSql?: Sql;
  termPilotSchema?: Promise<void>;
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

function schemaPath(): string {
  return path.join(process.cwd(), "src/db/schema.sql");
}

function ensureSchema(sql: Sql): Promise<void> {
  if (!globalForStore.termPilotSchema) {
    const schema = readFileSync(schemaPath(), "utf8");
    const pending = sql.unsafe(schema).then(
      () => undefined,
      (error: unknown) => {
        if (globalForStore.termPilotSchema === pending) {
          globalForStore.termPilotSchema = undefined;
        }
        throw error;
      },
    );
    globalForStore.termPilotSchema = pending;
  }
  return globalForStore.termPilotSchema;
}

function createStore(sql: Sql | null): Store {
  if (sql) {
    return postgresStore(sql);
  }
  return memoryStore();
}

async function resolveStore(): Promise<Store> {
  const sql = resolveSql();
  const ready = sql ? ensureSchema(sql) : Promise.resolve();
  const cached = globalForStore.termPilotAppStore;
  if (cached && isStoreCurrent(cached)) {
    await ready;
    return cached;
  }
  const store = createStore(sql);
  globalForStore.termPilotAppStore = store;
  await ready;
  return store;
}

/**
 * Lazily resolves to postgres when DATABASE_URL is set so test imports never open a DB.
 * The store is pinned on globalThis so API routes and server components share one instance in dev.
 * Replaces a stale cached store when hot reload leaves an instance without newer Store methods.
 * When Postgres is configured, the idempotent schema file is applied once before the first query.
 */
export const appStore: Store = {
  async getProfile(userId) {
    const store = await resolveStore();
    return store.getProfile(userId);
  },
  async saveProfile(userId, input) {
    const store = await resolveStore();
    return store.saveProfile(userId, input);
  },
  async listTimetables(userId) {
    const store = await resolveStore();
    return store.listTimetables(userId);
  },
  async createTimetable(userId, title) {
    const store = await resolveStore();
    return store.createTimetable(userId, title);
  },
  async getTimetable(userId, id) {
    const store = await resolveStore();
    return store.getTimetable(userId, id);
  },
  async renameTimetable(userId, id, title) {
    const store = await resolveStore();
    return store.renameTimetable(userId, id, title);
  },
  async deleteTimetable(userId, id) {
    const store = await resolveStore();
    return store.deleteTimetable(userId, id);
  },
  async writeSections(userId, id, sectionKeys, revision) {
    const store = await resolveStore();
    return store.writeSections(userId, id, sectionKeys, revision);
  },
  async createProposal(input) {
    const store = await resolveStore();
    return store.createProposal(input);
  },
  async getProposal(userId, id) {
    const store = await resolveStore();
    return store.getProposal(userId, id);
  },
  async listProposals(userId, timetableId) {
    const store = await resolveStore();
    return store.listProposals(userId, timetableId);
  },
  async setProposalStatus(userId, id, status: ProposalStatus) {
    const store = await resolveStore();
    return store.setProposalStatus(userId, id, status);
  },
  async getShareStatus(userId, id) {
    const store = await resolveStore();
    return store.getShareStatus(userId, id);
  },
  async enableShare(userId, id) {
    const store = await resolveStore();
    return store.enableShare(userId, id);
  },
  async disableShare(userId, id) {
    const store = await resolveStore();
    return store.disableShare(userId, id);
  },
  async getSharedTimetable(token) {
    const store = await resolveStore();
    return store.getSharedTimetable(token);
  },
};
