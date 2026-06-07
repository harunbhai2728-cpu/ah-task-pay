-- Referral System Advanced Migration

-- 1. Add referral_code to existing profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Create referrals table to track who referred whom
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create referral_campaigns table to track milestones and time limits
CREATE TABLE IF NOT EXISTS public.referral_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    campaign_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    target_20_claimed BOOLEAN DEFAULT FALSE,
    target_50_claimed BOOLEAN DEFAULT FALSE
);

-- Note: Ensure you run this SQL in your Supabase SQL Editor.
