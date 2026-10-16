-- KYC portal — phase 1 schema
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- Safe to re-run: every statement checks before creating.

-- ─────────────────────────────────────────────────────────────
-- 1. Submissions
-- ─────────────────────────────────────────────────────────────
create table if not exists public.kyc_submissions (
  id               uuid primary key default gen_random_uuid(),
  ref_code         text not null unique,                 -- shown to the customer, e.g. KYC-7F3K9QX2
  full_name        text not null,
  mobile           text not null unique,                 -- 10 digits, Aadhaar-linked number
  file_path        text,                                  -- path inside the kyc-documents bucket
  file_size        integer,
  status           text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected')),
  rejection_reason text,
  attempts         integer not null default 1,           -- how many times the PDF was uploaded
  consent_at       timestamptz not null,
  submitted_at     timestamptz not null default now(),   -- latest upload time
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists kyc_submissions_status_idx
  on public.kyc_submissions (status, submitted_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists kyc_submissions_updated_at on public.kyc_submissions;
create trigger kyc_submissions_updated_at
  before update on public.kyc_submissions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- 2. Rate limiting (login attempts, submissions, status lookups)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.rate_limit_events (
  id         bigserial primary key,
  bucket     text not null,          -- e.g. "admin-login:1.2.3.4"
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_bucket_idx
  on public.rate_limit_events (bucket, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- 3. Lock everything down
-- The app talks to Supabase only from the server with the secret key,
-- which bypasses RLS. Enabling RLS with no policies means the public
-- (anon) key can read or write nothing, even if it leaks.
-- ─────────────────────────────────────────────────────────────
alter table public.kyc_submissions   enable row level security;
alter table public.rate_limit_events enable row level security;

revoke all on public.kyc_submissions   from anon, authenticated;
revoke all on public.rate_limit_events from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Private storage bucket for Aadhaar PDFs (4 MB max, PDF only)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kyc-documents', 'kyc-documents', false, 4194304, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
-- No storage policies are created on purpose: only the server (secret key)
-- can upload, and the admin views files through short-lived signed links.
