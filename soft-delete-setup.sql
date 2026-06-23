-- 1. Add new columns for tracking account deletion status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- 2. Update existing accounts to prevent null issues if needed
-- UPDATE public.profiles SET account_status = 'active' WHERE account_status IS NULL;
