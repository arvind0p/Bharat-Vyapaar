-- Bharat Vyapaar Admin Panel setup
-- Run in Supabase SQL Editor after confirming the current business_directory table exists.
-- IMPORTANT: Replace the UUID placeholder in the final INSERT with your Auth user's actual UUID.

create extension if not exists pgcrypto;

-- 1) Admin allow-list. Only an existing authenticated user explicitly added here is an admin.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
drop policy if exists "Admins can read their own admin record" on public.admin_users;
create policy "Admins can read their own admin record"
on public.admin_users for select to authenticated
using (user_id = auth.uid());

-- 2) Advisory Team data. Public site only reads active rows; writes require admin allow-list membership.
create table if not exists public.team_advisory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  role text not null default 'Advisory Team Member',
  city_region text,
  bio text,
  photo_url text,
  photo_path text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.team_advisory enable row level security;

drop policy if exists "Public can read active advisory members" on public.team_advisory;
create policy "Public can read active advisory members"
on public.team_advisory for select to anon, authenticated
using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can insert advisory members" on public.team_advisory;
create policy "Admins can insert advisory members"
on public.team_advisory for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update advisory members" on public.team_advisory;
create policy "Admins can update advisory members"
on public.team_advisory for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete advisory members" on public.team_advisory;
create policy "Admins can delete advisory members"
on public.team_advisory for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.team_advisory to anon, authenticated;
grant insert, update, delete on public.team_advisory to authenticated;
grant select on public.admin_users to anon, authenticated;

-- 3) Add admin-only write policies to the existing business_directory table.
-- Keep the existing public SELECT policy that filters is_public = true.
alter table public.business_directory enable row level security;

drop policy if exists "Admins can insert business directory rows" on public.business_directory;
create policy "Admins can insert business directory rows"
on public.business_directory for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update business directory rows" on public.business_directory;
create policy "Admins can update business directory rows"
on public.business_directory for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete business directory rows" on public.business_directory;
create policy "Admins can delete business directory rows"
on public.business_directory for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.business_directory to anon, authenticated;
grant insert, update, delete on public.business_directory to authenticated;

-- 4) Photo storage bucket. Public read is required so the public team page can display photos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('team-photos', 'team-photos', true, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp'];

drop policy if exists "Public can view team photos" on storage.objects;
create policy "Public can view team photos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'team-photos');

drop policy if exists "Admins can upload team photos" on storage.objects;
create policy "Admins can upload team photos"
on storage.objects for insert to authenticated
with check (bucket_id = 'team-photos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update team photos" on storage.objects;
create policy "Admins can update team photos"
on storage.objects for update to authenticated
using (bucket_id = 'team-photos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (bucket_id = 'team-photos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete team photos" on storage.objects;
create policy "Admins can delete team photos"
on storage.objects for delete to authenticated
using (bucket_id = 'team-photos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- 5) Seed the advisory members currently hard-coded in team.html.
-- This inserts only names not already present, and uses initials as fallback until photos are uploaded.
insert into public.team_advisory (full_name, role, city_region, sort_order, is_active)
select v.full_name, v.role, v.city_region, v.sort_order, true
from (values
 ('Amit Agarwal','Advisory Team Member','Kolkata',10),
 ('Arvind Chaudhary','National Convenor','Lucknow',20),
 ('Sanjeev Oza','Advisory Team Member','Mumbai',30),
 ('Shashi Bhusan','Advisory Team Member','Ujjain',40),
 ('Chaarmi Doshi','Advisory Team Member','Mumbai',50),
 ('Omesh Sharma','Advisory Team Member','Greater Noida',60),
 ('Murali Krishna','Advisory Team Member','Hyderabad',70),
 ('Vasant Saraf','Advisory Team Member','Vapi',80),
 ('Dilip Jain','Advisory Team Member','Bangalore',90),
 ('Gurmeet Singh','Advisory Team Member','Jammu',100),
 ('Annil Suri','Advisory Team Member','Ladakh',110),
 ('Pankaj Kshatriya','Advisory Team Member','Ahmedabad',120),
 ('Jatin Gudwani','Advisory Team Member','Chandigarh',130),
 ('Shubham Awasthi','Advisory Team Member','Kanpur',140),
 ('Sanjeev Tandon','Advisory Team Member','Delhi',150),
 ('Mufaddal Husain','Advisory Team Member','Bangalore',160),
 ('Sudharshan V','Advisory Team Member','Bangalore',170)
) as v(full_name, role, city_region, sort_order)
where not exists (select 1 from public.team_advisory t where lower(t.full_name)=lower(v.full_name));

-- AFTER creating your admin account in Supabase Authentication > Users:
-- Copy that user's UUID and run the following separately, replacing the placeholder:
-- insert into public.admin_users (user_id) values ('PASTE-AUTH-USER-UUID-HERE');
-- 6) Contact enquiries submitted from the public Contact page.
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


-- 8) Core member company logos shown on the homepage.
create table if not exists public.core_member_logos (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(trim(company_name)) between 1 and 180),
  logo_url text not null,
  logo_path text not null,
  website_url text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.core_member_logos enable row level security;

drop policy if exists "Public can read active core member logos" on public.core_member_logos;
create policy "Public can read active core member logos"
on public.core_member_logos for select to anon, authenticated
using (is_active = true or exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can insert core member logos" on public.core_member_logos;
create policy "Admins can insert core member logos"
on public.core_member_logos for insert to authenticated
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update core member logos" on public.core_member_logos;
create policy "Admins can update core member logos"
on public.core_member_logos for update to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete core member logos" on public.core_member_logos;
create policy "Admins can delete core member logos"
on public.core_member_logos for delete to authenticated
using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.core_member_logos to anon, authenticated;
grant insert, update, delete on public.core_member_logos to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('core-member-logos', 'core-member-logos', true, 5242880, array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png','image/jpeg','image/webp','image/svg+xml'];

drop policy if exists "Public can view core member logos" on storage.objects;
create policy "Public can view core member logos"
on storage.objects for select to anon, authenticated
using (bucket_id = 'core-member-logos');

drop policy if exists "Admins can upload core member logos" on storage.objects;
create policy "Admins can upload core member logos"
on storage.objects for insert to authenticated
with check (bucket_id = 'core-member-logos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can update core member logos" on storage.objects;
create policy "Admins can update core member logos"
on storage.objects for update to authenticated
using (bucket_id = 'core-member-logos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
with check (bucket_id = 'core-member-logos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

drop policy if exists "Admins can delete core member logos" on storage.objects;
create policy "Admins can delete core member logos"
on storage.objects for delete to authenticated
using (bucket_id = 'core-member-logos' and exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
