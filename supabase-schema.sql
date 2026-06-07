-- Phase 1: Supabase PostgreSQL DDL Schema

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE job_status AS ENUM ('open', 'closed');
CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdraw', 'earn', 'spend', 'fee', 'bonus', 'refund');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'rejected', 'approved');

-- 3. Profiles Table (Extends auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    phone TEXT UNIQUE,
    role user_role DEFAULT 'user'::user_role NOT NULL,
    earningBalance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (earningBalance >= 0),
    depositBalance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (depositBalance >= 0),
    heldBalance NUMERIC(10, 2) DEFAULT 0.00 NOT NULL CHECK (heldBalance >= 0),
    serialNumber INTEGER,
    pendingEarningBalance NUMERIC(10, 2) DEFAULT 0.00,
    pendingDepositBalance NUMERIC(10, 2) DEFAULT 0.00,
    isBlocked BOOLEAN DEFAULT false,
    warning TEXT,
    warningCount INTEGER DEFAULT 0,
    notifications JSONB DEFAULT '[]'::jsonb,
    createdAt TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Notifications Table
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Jobs Table
CREATE TABLE public.jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    reward NUMERIC(10, 2) NOT NULL CHECK (reward > 0),
    slots INTEGER NOT NULL CHECK (slots > 0),
    slots_filled INTEGER DEFAULT 0 NOT NULL CHECK (slots_filled <= slots),
    status job_status DEFAULT 'open'::job_status NOT NULL,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Submissions Table
CREATE TABLE public.submissions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
    worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    proof TEXT NOT NULL,
    status submission_status DEFAULT 'pending'::submission_status NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(job_id, worker_id) -- Assuming one submission per job per user
);

-- 7. Transactions Table
CREATE TABLE public.transactions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    type transaction_type NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status transaction_status DEFAULT 'pending'::transaction_status NOT NULL,
    reference_id UUID, -- Optional: links to a job, submission, etc.
    payment_method TEXT,
    payment_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Row Level Security (RLS) setup

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Notifications Policies
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notifications" ON public.notifications FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Jobs Policies
CREATE POLICY "Jobs are viewable by everyone" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create jobs" ON public.jobs FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own jobs" ON public.jobs FOR UPDATE USING (auth.uid() = author_id);

-- Submissions Policies
CREATE POLICY "Authors of jobs can view submissions" ON public.submissions FOR SELECT USING (
    auth.uid() IN (SELECT author_id FROM public.jobs WHERE id = job_id) OR auth.uid() = worker_id
);
CREATE POLICY "Workers can create submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = worker_id);
CREATE POLICY "Workers can update own submissions" ON public.submissions FOR UPDATE USING (auth.uid() = worker_id);

-- Transactions Policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert deposit/withdraw" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 9. Triggers

-- Trigger to create profile after user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username, phone)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)), 
    new.raw_user_meta_data->>'phone'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Trigger to update `updated_at` columns
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_jobs_updated_at BEFORE UPDATE ON public.jobs FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER set_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
CREATE TRIGGER set_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE PROCEDURE update_updated_at();
