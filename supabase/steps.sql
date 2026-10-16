-- KYC portal — steps after approval
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- After the admin approves a KYC, the entry moves through:
--   DigiLocker OTP → Automatic payment → Final OTP → Completed

-- 1. Current step on each submission (empty until approved)
alter table public.kyc_submissions
  add column if not exists stage text
    check (stage in ('digilocker_otp', 'auto_payment', 'final_otp', 'completed')),
  add column if not exists stage_updated_at timestamptz;

create index if not exists kyc_submissions_stage_idx
  on public.kyc_submissions (stage);

-- 2. History of every step change: who moved it, from where, to where, and when
create table if not exists public.kyc_stage_events (
  id             bigserial primary key,
  submission_id  uuid not null references public.kyc_submissions(id) on delete cascade,
  from_stage     text,
  to_stage       text,
  by_role        text not null check (by_role in ('admin', 'agent')),
  by_agent_id    uuid references public.agents(id) on delete set null,
  is_undo        boolean not null default false,
  created_at     timestamptz not null default now()
);

create index if not exists kyc_stage_events_submission_idx
  on public.kyc_stage_events (submission_id, created_at desc);

alter table public.kyc_stage_events enable row level security;
revoke all on public.kyc_stage_events from anon, authenticated;

-- 3. Entries approved before this update start at the first step
update public.kyc_submissions
set stage = 'digilocker_otp',
    stage_updated_at = coalesce(reviewed_at, now())
where status = 'approved' and stage is null;
