-- Run these commands in your Supabase SQL Editor

-- 1. Add new columns for tracking
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS device_fingerprint TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_ip_address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 2. Update existing accounts to prevent null issues if needed (optional)
-- UPDATE public.profiles SET is_banned = false WHERE is_banned IS NULL;

-- 3. We do not strictly need new RLS policies for these because they are part of profiles 
-- (which is readable/updatable by owner or admin based on existing rules), 
-- but we make sure only admins can manually alter is_banned. Using the existing UPDATE policy is fine or we keep it simple.
