-- KYC portal — new step flow (replaces DigiLocker OTP / Payment mandate / Final OTP)
-- Run once in Supabase: SQL Editor → New query → paste → Run. Safe to re-run.
--
-- After approval:  Slot booking → Scanner → OTP → Active KYC → Completed (unpaid) → Paid
--   Scanner fail → back to Slot booking (new slot, retry)
--   OTP fail     → application rejected (agent re-uploads the Aadhaar)
--   Paid         → admin only

-- 1. Swap the allowed step names, moving any existing entries onto the new flow
alter table public.kyc_submissions drop constraint if exists kyc_submissions_stage_check;

update public.kyc_submissions
set stage = case stage
  when 'completed' then 'completed_unpaid'
  when 'digilocker_otp' then 'slot'
  when 'auto_payment' then 'slot'
  when 'final_otp' then 'slot'
  else stage
end
where stage is not null;

alter table public.kyc_submissions
  add constraint kyc_submissions_stage_check
  check (stage in ('slot', 'scanner', 'otp', 'active_kyc', 'completed_unpaid', 'paid'));

-- 2. The booked slot (start time; each slot lasts 20 minutes)
alter table public.kyc_submissions
  add column if not exists slot_at timestamptz;

create index if not exists kyc_submissions_agent_slot_idx
  on public.kyc_submissions (agent_id, slot_at);

-- 3. Richer history: what kind of change it was, plus a readable note
alter table public.kyc_stage_events
  add column if not exists action text,
  add column if not exists note text;

-- Allow history rows for a rejection (stage becomes empty)
alter table public.kyc_stage_events alter column to_stage drop not null;
