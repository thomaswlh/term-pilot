create table if not exists profiles (
  user_id text primary key,
  major_code text,
  completed text[] not null default '{}',
  saved boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists timetables (
  id text primary key,
  user_id text not null,
  title text not null,
  revision integer not null,
  updated_at timestamptz not null default now()
);

alter table timetables add column if not exists share_token text;

create unique index if not exists timetables_share_token_key on timetables (share_token);

create table if not exists timetable_sections (
  timetable_id text not null references timetables(id) on delete cascade,
  course_code text not null,
  section text not null,
  primary key (timetable_id, course_code, section)
);

create table if not exists proposals (
  id text primary key,
  user_id text not null,
  timetable_id text not null references timetables(id) on delete cascade,
  base_revision integer not null,
  section_keys text[] not null,
  dropped_wishes text[] not null default '{}',
  warnings jsonb not null default '[]',
  summary text not null,
  status text not null check (status in ('open', 'applied', 'saved-as-new', 'discarded')),
  created_at timestamptz not null default now()
);

alter table proposals add column if not exists created_at timestamptz not null default now();

alter table proposals drop constraint if exists proposals_status_check;
alter table proposals add constraint proposals_status_check
  check (status in ('open', 'applied', 'saved-as-new', 'discarded'));
