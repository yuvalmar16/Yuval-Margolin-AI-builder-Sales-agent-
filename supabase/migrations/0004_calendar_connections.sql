-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Matches the shape src/lib/calendar/google-calendar-adapter.ts reads/writes.
--
-- Single-user MVP: one row per workspace holding the Google OAuth refresh
-- token needed to create real Calendar events on the connected account.
-- Same RLS posture as the other tables: enabled, zero policies, since all
-- access is server-side via SUPABASE_SERVICE_ROLE_KEY. The refresh token is
-- stored as plain text, consistent with this MVP's current security
-- posture (no encryption-at-rest layer yet) -- treat this table as
-- sensitive if you ever expand beyond a single trusted operator.

create table if not exists public.calendar_connections (
  workspace_id text primary key,
  provider text not null default 'google',
  refresh_token text not null,
  google_account_email text,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_connections enable row level security;
