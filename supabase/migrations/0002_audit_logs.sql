-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Matches the shape src/lib/audit/audit-log.ts reads/writes.
--
-- Scoped to what the code uses today, same posture as 0001_assistant_versions.sql:
-- no foreign keys (no real workspaces/users tables yet), RLS enabled with no
-- policies since all access is server-side via SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  entity_type text not null,
  entity_id text not null,
  action text not null,
  result text not null check (result in ('success', 'blocked', 'failure')),
  risk_level text not null,
  request_id text not null,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_workspace_created_idx
  on public.audit_logs (workspace_id, created_at desc);

alter table public.audit_logs enable row level security;
