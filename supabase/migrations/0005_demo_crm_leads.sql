-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- A small, pre-seeded prospect directory for the demo: lets the user pick an
-- existing lead to call instead of typing lead details by hand every time.
-- Distinct from `leads` (src/lib/crm/demo-campaign.ts), which records the
-- outcome of a call attempt -- this table is the browsable "who to call"
-- list that exists *before* any call happens.
--
-- Same RLS posture as the other tables: enabled, zero policies, since all
-- access is server-side via SUPABASE_SERVICE_ROLE_KEY.

create table if not exists public.demo_crm_leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id text not null,
  name text not null,
  company_name text not null,
  employee_count integer not null,
  phone_number text not null,
  email text not null,
  lead_source text not null,
  status text not null default 'new',
  last_contacted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.demo_crm_leads enable row level security;

insert into public.demo_crm_leads
  (workspace_id, name, company_name, employee_count, phone_number, email, lead_source, status)
values
  ('personal-workspace', 'Yuval Margolin', 'CloudFlow', 45, '+1-555-0101', 'yuval@cloudflow.example', 'Website form', 'new'),
  ('personal-workspace', 'Sarah Cohen', 'DataNest', 120, '+1-555-0102', 'sarah@datanest.example', 'Webinar', 'not_contacted'),
  ('personal-workspace', 'Daniel Levi', 'MicroStack', 8, '+1-555-0103', 'daniel@microstack.example', 'Landing page', 'new'),
  ('personal-workspace', 'Emma Stone', 'SalesPilot', 70, '+1-555-0104', 'emma@salespilot.example', 'Demo request', 'follow_up'),
  ('personal-workspace', 'Alex Morgan', 'DevSync', 30, '+1-555-0105', 'alex@devsync.example', 'Campaign', 'contacted')
on conflict do nothing;
