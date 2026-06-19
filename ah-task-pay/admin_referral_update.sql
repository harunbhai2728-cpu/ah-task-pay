ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS referral_bonus_amount numeric DEFAULT 5;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS referral_validation_criteria integer DEFAULT 1;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS campaign_end_date timestamp with time zone;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS target_1_referrals integer DEFAULT 0;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS target_1_reward numeric DEFAULT 0;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS target_2_referrals integer DEFAULT 0;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS target_2_reward numeric DEFAULT 0;
ALTER TABLE public.system_configuration ADD COLUMN IF NOT EXISTS referral_domain_url text DEFAULT 'https://ahtaskpay.onrender.com';

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS valid_referral_count integer DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_1_claimed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_2_claimed boolean DEFAULT false;

-- Performance Indexes for Database Query Speeds
CREATE INDEX IF NOT EXISTS idx_submissions_worker_id ON public.submissions(worker_id);
CREATE INDEX IF NOT EXISTS idx_submissions_job_id ON public.submissions(job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_author_id ON public.jobs(author_id);
