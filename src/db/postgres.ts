import { randomUUID } from "node:crypto";
import type { Sql } from "postgres";
import { newShareToken } from "@/domain/share-token";
import { type Proposal, type ProposalStatus, type SharedTimetable, type Store } from "./store";

function splitSectionKey(sectionKey: string): { courseCode: string; section: string } {
  const idx = sectionKey.indexOf(":");
  if (idx === -1) {
    return { courseCode: sectionKey, section: "" };
  }
  return { courseCode: sectionKey.slice(0, idx), section: sectionKey.slice(idx + 1) };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function postgresStore(sql: Sql): Store {
  const store: Store = {
    async getProfile(userId) {
      const rows = await sql<{
        user_id: string;
        major_code: string | null;
        completed: string[];
        saved: boolean;
      }[]>`
        select user_id, major_code, completed, saved
        from profiles
        where user_id = ${userId}
        limit 1
      `;
      const row = rows[0];
      if (!row) {
        return { userId, majorCode: null, completed: [], saved: false };
      }
      return {
        userId: row.user_id,
        majorCode: row.major_code,
        completed: [...row.completed],
        saved: row.saved,
      };
    },

    async saveProfile(userId, input) {
      const rows = await sql<{
        user_id: string;
        major_code: string | null;
        completed: string[];
        saved: boolean;
      }[]>`
        insert into profiles (user_id, major_code, completed, saved)
        values (${userId}, ${input.majorCode}, ${input.completed}, true)
        on conflict (user_id) do update
        set major_code = excluded.major_code,
            completed = excluded.completed,
            saved = true,
            updated_at = now()
        returning user_id, major_code, completed, saved
      `;
      const row = rows[0]!;
      return {
        userId: row.user_id,
        majorCode: row.major_code,
        completed: [...row.completed],
        saved: row.saved,
      };
    },

    async listTimetables(userId) {
      const rows = await sql<
        {
          id: string;
          user_id: string;
          title: string;
          revision: number;
          updated_at: Date;
          section_keys: string[] | null;
        }[]
      >`
        select
          t.id,
          t.user_id,
          t.title,
          t.revision,
          t.updated_at,
          coalesce(
            array_agg(ts.course_code || ':' || ts.section order by ts.course_code, ts.section)
              filter (where ts.course_code is not null),
            '{}'
          ) as section_keys
        from timetables t
        left join timetable_sections ts on ts.timetable_id = t.id
        where t.user_id = ${userId}
        group by t.id, t.user_id, t.title, t.revision, t.updated_at
      `;
      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        revision: row.revision,
        sectionKeys: [...(row.section_keys ?? [])],
        updatedAt: toIsoString(row.updated_at),
      }));
    },

    async createTimetable(userId, title) {
      const id = randomUUID();
      const rows = await sql<
        {
          id: string;
          user_id: string;
          title: string;
          revision: number;
          updated_at: Date;
        }[]
      >`
        insert into timetables (id, user_id, title, revision)
        values (${id}, ${userId}, ${title ?? "Untitled timetable"}, 1)
        returning id, user_id, title, revision, updated_at
      `;
      const row = rows[0]!;
      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        revision: row.revision,
        sectionKeys: [],
        updatedAt: toIsoString(row.updated_at),
      };
    },

    async getTimetable(userId, id) {
      const found = await sql<{ one: number }[]>`
        select 1 as one
        from timetables
        where id = ${id} and user_id = ${userId}
        limit 1
      `;
      if (found.length === 0) return null;

      const meta = await sql<
        {
          id: string;
          user_id: string;
          title: string;
          revision: number;
          updated_at: Date;
        }[]
      >`
        select id, user_id, title, revision, updated_at
        from timetables
        where id = ${id} and user_id = ${userId}
        limit 1
      `;
      const row = meta[0]!;

      const sections = await sql<{ course_code: string; section: string }[]>`
        select ts.course_code, ts.section
        from timetable_sections ts
        inner join timetables t on t.id = ts.timetable_id and t.user_id = ${userId}
        where ts.timetable_id = ${id}
        order by ts.course_code, ts.section
      `;

      return {
        id: row.id,
        userId: row.user_id,
        title: row.title,
        revision: row.revision,
        sectionKeys: sections.map((item) => `${item.course_code}:${item.section}`),
        updatedAt: toIsoString(row.updated_at),
      };
    },

    async renameTimetable(userId, id, title) {
      const rows = await sql<
        {
          id: string;
          user_id: string;
          title: string;
          revision: number;
          updated_at: Date;
        }[]
      >`
        update timetables
        set title = ${title}, updated_at = now()
        where id = ${id} and user_id = ${userId}
        returning id, user_id, title, revision, updated_at
      `;
      const row = rows[0];
      if (!row) return null;
      return store.getTimetable(userId, id);
    },

    async deleteTimetable(userId, id) {
      const rows = await sql<{ id: string }[]>`
        delete from timetables
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      return rows.length > 0;
    },

    async writeSections(userId, id, sectionKeys, revision) {
      class WriteSectionsAbort extends Error {
        override name = "WriteSectionsAbort";
      }

      try {
        await sql.begin(async (tx) => {
          const locked = await tx<{ id: string }[]>`
            update timetables
            set updated_at = timetables.updated_at
            where id = ${id} and user_id = ${userId}
            returning id
          `;
          if (locked.length !== 1) {
            throw new WriteSectionsAbort();
          }

          await tx`
            delete from timetable_sections
            where timetable_id = ${id}
          `;
          for (const key of sectionKeys) {
            const { courseCode, section } = splitSectionKey(key);
            await tx`
              insert into timetable_sections (timetable_id, course_code, section)
              values (${id}, ${courseCode}, ${section})
            `;
          }
          const updated = await tx<{ id: string }[]>`
            update timetables
            set revision = ${revision}, updated_at = now()
            where id = ${id} and user_id = ${userId}
            returning id
          `;
          if (updated.length !== 1) {
            throw new WriteSectionsAbort();
          }
        });
      } catch (err) {
        if (err instanceof WriteSectionsAbort) {
          return null;
        }
        throw err;
      }

      return store.getTimetable(userId, id);
    },

    async createProposal(input) {
      const id = randomUUID();
      const rows = await sql<
        {
          id: string;
          user_id: string;
          timetable_id: string;
          base_revision: number;
          section_keys: string[];
          dropped_wishes: string[];
          warnings: unknown;
          summary: string;
          status: ProposalStatus;
          created_at: Date;
        }[]
      >`
        insert into proposals (
          id,
          user_id,
          timetable_id,
          base_revision,
          section_keys,
          dropped_wishes,
          warnings,
          summary,
          status
        )
        values (
          ${id},
          ${input.userId},
          ${input.timetableId},
          ${input.baseRevision},
          ${input.sectionKeys},
          ${input.droppedWishes},
          ${sql.json(input.warnings)},
          ${input.summary},
          'open'
        )
        returning
          id,
          user_id,
          timetable_id,
          base_revision,
          section_keys,
          dropped_wishes,
          warnings,
          summary,
          status,
          created_at
      `;
      return mapProposalRow(rows[0]!);
    },

    async getProposal(userId, id) {
      const rows = await sql<
        {
          id: string;
          user_id: string;
          timetable_id: string;
          base_revision: number;
          section_keys: string[];
          dropped_wishes: string[];
          warnings: unknown;
          summary: string;
          status: ProposalStatus;
          created_at: Date;
        }[]
      >`
        select
          id,
          user_id,
          timetable_id,
          base_revision,
          section_keys,
          dropped_wishes,
          warnings,
          summary,
          status,
          created_at
        from proposals
        where id = ${id} and user_id = ${userId}
        limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      return mapProposalRow(row);
    },

    async listProposals(userId, timetableId) {
      const rows = await sql<
        {
          id: string;
          user_id: string;
          timetable_id: string;
          base_revision: number;
          section_keys: string[];
          dropped_wishes: string[];
          warnings: unknown;
          summary: string;
          status: ProposalStatus;
          created_at: Date;
        }[]
      >`
        select
          id,
          user_id,
          timetable_id,
          base_revision,
          section_keys,
          dropped_wishes,
          warnings,
          summary,
          status,
          created_at
        from proposals
        where user_id = ${userId} and timetable_id = ${timetableId}
        order by created_at desc, id desc
      `;
      return rows.map((row) => mapProposalRow(row));
    },

    async getShareStatus(userId, id) {
      const rows = await sql<{ share_token: string | null }[]>`
        select share_token
        from timetables
        where id = ${id} and user_id = ${userId}
        limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      return row.share_token;
    },

    async enableShare(userId, id) {
      const token = newShareToken();
      const rows = await sql<{ id: string }[]>`
        update timetables
        set share_token = ${token}
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      if (rows.length === 0) return null;
      return token;
    },

    async disableShare(userId, id) {
      const rows = await sql<{ id: string }[]>`
        update timetables
        set share_token = null
        where id = ${id} and user_id = ${userId}
        returning id
      `;
      return rows.length > 0;
    },

    async getSharedTimetable(token) {
      const rows = await sql<
        {
          title: string;
          updated_at: Date;
          section_keys: string[] | null;
        }[]
      >`
        select
          t.title,
          t.updated_at,
          coalesce(
            array_agg(ts.course_code || ':' || ts.section order by ts.course_code, ts.section)
              filter (where ts.course_code is not null),
            '{}'
          ) as section_keys
        from timetables t
        left join timetable_sections ts on ts.timetable_id = t.id
        where t.share_token = ${token}
        group by t.id, t.title, t.updated_at
        limit 1
      `;
      const row = rows[0];
      if (!row) return null;
      const shared: SharedTimetable = {
        title: row.title,
        sectionKeys: [...(row.section_keys ?? [])],
        updatedAt: toIsoString(row.updated_at),
      };
      return shared;
    },

    async setProposalStatus(userId, id, status) {
      const rows = await sql<
        {
          id: string;
          user_id: string;
          timetable_id: string;
          base_revision: number;
          section_keys: string[];
          dropped_wishes: string[];
          warnings: unknown;
          summary: string;
          status: ProposalStatus;
          created_at: Date;
        }[]
      >`
        update proposals
        set status = ${status}
        where id = ${id} and user_id = ${userId}
        returning
          id,
          user_id,
          timetable_id,
          base_revision,
          section_keys,
          dropped_wishes,
          warnings,
          summary,
          status,
          created_at
      `;
      const row = rows[0];
      if (!row) return null;
      return mapProposalRow(row);
    },
  };

  return store;
}

function mapProposalRow(row: {
  id: string;
  user_id: string;
  timetable_id: string;
  base_revision: number;
  section_keys: string[];
  dropped_wishes: string[];
  warnings: unknown;
  summary: string;
  status: ProposalStatus;
  created_at: Date;
}): Proposal {
  return {
    id: row.id,
    userId: row.user_id,
    timetableId: row.timetable_id,
    baseRevision: row.base_revision,
    sectionKeys: [...row.section_keys],
    droppedWishes: [...row.dropped_wishes],
    warnings: row.warnings as Proposal["warnings"],
    summary: row.summary,
    status: row.status,
    createdAt: toIsoString(row.created_at),
  };
}
