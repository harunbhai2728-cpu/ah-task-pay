-- Run this entire script in your Supabase SQL Editor to sync your schema with the codebase.
-- It adds missing columns and renames incorrectly cased columns so the app can communicate smoothly.

DO $$
BEGIN

  -- 1. Profiles Table Updates
  -- Add missing columns
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "displayName" TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "earningBalance" NUMERIC(10, 2) DEFAULT 0.00;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "depositBalance" NUMERIC(10, 2) DEFAULT 0.00;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "heldBalance" NUMERIC(10, 2) DEFAULT 0.00;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "pendingEarningBalance" NUMERIC(10, 2) DEFAULT 0.00;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "pendingDepositBalance" NUMERIC(10, 2) DEFAULT 0.00;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "serialNumber" INTEGER;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "isBlocked" BOOLEAN DEFAULT false;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "warningCount" INTEGER DEFAULT 0;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "notifications" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

  -- Copy data from snake_case columns if they exist
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='balance') THEN
      UPDATE public.profiles SET "earningBalance" = balance;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='deposit_balance') THEN
      UPDATE public.profiles SET "depositBalance" = deposit_balance;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='is_blocked') THEN
      UPDATE public.profiles SET "isBlocked" = is_blocked;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='warning_count') THEN
      UPDATE public.profiles SET "warningCount" = warning_count;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='profiles' and column_name='created_at') THEN
      UPDATE public.profiles SET "createdAt" = created_at;
  END IF;

  -- 2. Jobs Table Updates
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "posterId" UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "thumbnail" TEXT;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "screenshotCount" INTEGER DEFAULT 1;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "requireTextProof" BOOLEAN DEFAULT false;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "autoApprove" BOOLEAN DEFAULT false;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "pinCode" TEXT;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "pricePerWork" NUMERIC(10, 2) DEFAULT 0.0;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "maxWorkers" INTEGER DEFAULT 1;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "completedCount" INTEGER DEFAULT 0;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "pendingCount" INTEGER DEFAULT 0;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "approvedCount" INTEGER DEFAULT 0;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "isFull" BOOLEAN DEFAULT false;
  ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  
  -- Transfer data for jobs
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='jobs' and column_name='author_id') THEN
      UPDATE public.jobs SET "posterId" = author_id;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='jobs' and column_name='slots') THEN
      UPDATE public.jobs SET "maxWorkers" = slots;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='jobs' and column_name='slots_filled') THEN
      UPDATE public.jobs SET "completedCount" = slots_filled;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='jobs' and column_name='reward') THEN
      UPDATE public.jobs SET "pricePerWork" = reward;
  END IF;

  -- 3. Submissions Table Updates
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "jobId" UUID;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "workerId" UUID;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "posterId" UUID;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "proofText" TEXT;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "screenshots" JSONB DEFAULT '[]'::jsonb;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP WITH TIME ZONE;
  ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS "reward" NUMERIC(10, 2) DEFAULT 0.0;

  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='submissions' and column_name='job_id') THEN
      UPDATE public.submissions SET "jobId" = job_id;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='submissions' and column_name='worker_id') THEN
      UPDATE public.submissions SET "workerId" = worker_id;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='submissions' and column_name='proof') THEN
      UPDATE public.submissions SET "proofText" = proof;
  END IF;

  -- 4. Transactions Table Updates
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "userId" UUID;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "userSerial" INTEGER;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "method" TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "phone" TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "transactionId" TEXT;
  ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW();

  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='transactions' and column_name='user_id') THEN
      UPDATE public.transactions SET "userId" = user_id;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='transactions' and column_name='payment_method') THEN
      UPDATE public.transactions SET "method" = payment_method;
  END IF;
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='transactions' and column_name='transaction_id') THEN
      UPDATE public.transactions SET "transactionId" = transaction_id;
  END IF;

END $$;
