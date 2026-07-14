-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Matches the shape src/lib/crm/demo-campaign.ts reads/writes.
--
-- Milestone 6 (mock-first CRM/calendar flow) scoped down to what's actually
-- built: leads, call_results, crm_sync_events. `campaigns` from milestone 7
-- is intentionally NOT created yet -- there is no real campaign lifecycle to
-- manage, only a single "simulate a call" action, so call_results.campaign_id
-- is a plain text placeholder ("demo-sandbox") rather than a foreign key.
-- Add a real campaigns table when campaign lifecycle management is built.
--
-- Same RLS posture as the other tables: enabled, zero policies, since all
-- access is server-side via SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  phone_number text not null,
  email text not null,
  company_name text,
  lead_source text not null,
  qualification_state text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.call_results (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  campaign_id text not null,
  lead_id uuid not null references public.leads (id),
  call_status text not null,
  qualification_result text not null,
  booked_meeting jsonb,
  transcript_ref text,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_sync_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  lead_id uuid not null references public.leads (id),
  event_type text not null,
  status text not null,
  payload_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists call_results_lead_idx on public.call_results (lead_id);
create index if not exists crm_sync_events_lead_idx on public.crm_sync_events (lead_id);

alter table public.leads enable row level security;
alter table public.call_results enable row level security;
alter table public.crm_sync_events enable row level security;
