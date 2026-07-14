-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Matches the shape src/lib/builder/assistant-workspace.ts already reads/writes.
--
-- This is scoped to what the code uses today (workspace_id/assistant_id as
-- plain text, no real workspaces/assistants tables yet). The fuller schema in
-- docs/milestone-7-database-storage-design.md (users, workspaces, assistants,
-- campaigns, leads, etc.) is not implemented yet -- add those tables when
-- those features are actually built, not before.

create table if not exists public.assistant_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  assistant_id text not null,
  version_number integer not null,
  status text not null check (status in ('draft', 'approved')),
  config_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_versions_workspace_version_idx
  on public.assistant_versions (workspace_id, version_number desc);

-- Row-Level Security, no policies added on purpose: the app has no
-- Supabase Auth / client-side access yet -- every read and write goes
-- through the Next.js server using SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS. Enabling RLS with zero policies means the anon/authenticated
-- roles get denied by default, so this table stays unreachable from any
-- future client-side Supabase call until a real auth-scoped policy is
-- deliberately added.
alter table public.assistant_versions enable row level security;
