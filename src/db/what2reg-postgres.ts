import postgres, { type Sql } from "postgres";
import { openGrant, sealGrant } from "@/db/what2reg-tokens";
import type { What2RegGrant, What2RegTokenStore } from "@/domain/what2reg/types";

type GlobalSql = typeof globalThis & {
  termPilotWhat2RegSql?: Sql;
  termPilotWhat2RegSchema?: Promise<void>;
};

function sqlClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const globalSql = globalThis as GlobalSql;
  globalSql.termPilotWhat2RegSql ??= postgres(url, { max: 1 });
  return globalSql.termPilotWhat2RegSql;
}

function schemaReady(sql: Sql): Promise<void> {
  const globalSql = globalThis as GlobalSql;
  globalSql.termPilotWhat2RegSchema ??= sql
    .unsafe(
      `create table if not exists what2reg_grants (
        user_id text primary key,
        sealed text not null,
        updated_at timestamptz not null default now()
      )`,
    )
    .then(() => undefined);
  return globalSql.termPilotWhat2RegSchema;
}

export function postgresWhat2RegTokens(sql: Sql = sqlClient()): What2RegTokenStore {
  const ready = schemaReady(sql);
  return {
    async get(userId) {
      await ready;
      const rows = await sql<{ sealed: string }[]>`
        select sealed from what2reg_grants where user_id = ${userId} limit 1
      `;
      const sealed = rows[0]?.sealed;
      return sealed ? openGrant(sealed) : null;
    },
    async save(userId, grant: What2RegGrant) {
      await ready;
      const sealed = sealGrant(grant);
      await sql`
        insert into what2reg_grants (user_id, sealed)
        values (${userId}, ${sealed})
        on conflict (user_id) do update
        set sealed = excluded.sealed, updated_at = now()
      `;
    },
    async delete(userId) {
      await ready;
      await sql`delete from what2reg_grants where user_id = ${userId}`;
    },
  };
}
