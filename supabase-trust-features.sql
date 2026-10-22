-- Bharat Vyapaar trust features
-- Run this script once in Supabase Dashboard > SQL Editor > New query.
-- This adds a verified badge and a public "Report business" submission form.
-- It does not change or delete existing business listings.

alter table public.business_directory
  add column if not exists verification_status text not null default 'pending';

alter table public.business_directory
  drop constraint if exists business_directory_verification_status_check;

alter table public.business_directory
  add constraint business_directory_verification_status_check
  check (verification_status in ('pending', 'verified', 'rejected'));

create table if not exists public.business_reports (
  id uuid primary key default gen_random_uuid(),
  business_id text not null,
  business_name text not null,
  reason text not null check (reason in (
    'Incorrect business details',
    'Business may be fake',
    'Suspicious activity',
    'Website or contact does not work',
    'Other'
  )),
  details text,
  reporter_email text,
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

alter table public.business_reports enable row level security;

drop policy if exists "Public can submit business reports" on public.business_reports;
create policy "Public can submit business reports"
on public.business_reports
for insert to anon, authenticated
with check (
  char_length(trim(business_name)) between 1 and 200
  and char_length(trim(business_id)) between 1 and 100
  and char_length(trim(reason)) between 1 and 80
  and (details is null or char_length(details) <= 2000)
  and (reporter_email is null or char_length(reporter_email) <= 254)
);

drop policy if exists "Admins can read business reports" on public.business_reports;
create policy "Admins can read business reports"
on public.business_reports
for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update business reports" on public.business_reports;
create policy "Admins can update business reports"
on public.business_reports
for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.business_directory to anon, authenticated;
grant insert on public.business_reports to anon, authenticated;
grant select, update on public.business_reports to authenticated;

-- Verification is a manual review decision. Only set a badge after checks are completed.
-- Example:
-- update public.business_directory
-- set verification_status = 'verified'
-- where id = 'PASTE_BUSINESS_ID_HERE';
