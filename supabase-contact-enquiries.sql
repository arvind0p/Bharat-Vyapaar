-- Bharat Vyapaar contact enquiries table
-- Run this script once in Supabase Dashboard > SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 1 and 180),
  email text not null check (char_length(trim(email)) between 3 and 254),
  phone text,
  subject text not null check (char_length(trim(subject)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 5000),
  status text not null default 'new' check (status in ('new','contacted','closed')),
  created_at timestamptz not null default now()
);

alter table public.contact_enquiries enable row level security;
drop policy if exists "Public can submit contact enquiries" on public.contact_enquiries;
create policy "Public can submit contact enquiries"
on public.contact_enquiries for insert to anon, authenticated
with check (
  char_length(trim(full_name)) between 1 and 180
  and char_length(trim(email)) between 3 and 254
  and char_length(trim(subject)) between 1 and 120
  and char_length(trim(message)) between 1 and 5000
  and status = 'new'
);

drop policy if exists "Admins can read contact enquiries" on public.contact_enquiries;
create policy "Admins can read contact enquiries"
on public.contact_enquiries for select to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update contact enquiries" on public.contact_enquiries;
create policy "Admins can update contact enquiries"
on public.contact_enquiries for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant insert on public.contact_enquiries to anon, authenticated;
grant select, update on public.contact_enquiries to authenticated;
