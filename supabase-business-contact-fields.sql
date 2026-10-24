-- Add contact person and contact details to public business listings.
-- Run this in Supabase SQL Editor before importing contact details.

ALTER TABLE public.business_directory
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS mobile_number text;

GRANT SELECT ON public.business_directory TO anon, authenticated;
