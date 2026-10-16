-- KYC portal — agents update
-- Run once in Supabase: SQL Editor → New query → paste → Run.
-- Safe to re-run. Existing submissions are kept (they become "Individual").

-- 1. Agents created by the admin
create table if not exists public.agents (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  phone            text not null unique,          -- 10 digits, used to sign in
  password_hash    text not null,                 -- scrypt hash, never the password
  active           boolean not null default true,
  session_version  integer not null default 1,    -- bumped on reset/deactivate to sign the agent out everywhere
  last_login_at    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists agents_updated_at on public.agents;
create trigger agents_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- 2. Link each submission to the agent who made it (null = individual customer)
alter table public.kyc_submissions
  add column if not exists agent_id uuid references public.agents(id) on delete set null;

create index if not exists kyc_submissions_agent_idx
  on public.kyc_submissions (agent_id, submitted_at desc);

-- 3. Same lock-down as before: only the server (secret key) can touch these tables
alter table public.agents enable row level security;
revoke all on public.agents from anon, authenticated;
