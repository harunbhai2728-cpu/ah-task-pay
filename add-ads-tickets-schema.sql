-- Add advertisements table
CREATE TABLE IF NOT EXISTS public.advertisements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    user_serial INTEGER,
    image TEXT,
    link TEXT,
    duration_days INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    status TEXT DEFAULT 'pending',
    transaction_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejected_at TIMESTAMP WITH TIME ZONE
);

-- Add tickets table
CREATE TABLE IF NOT EXISTS public.tickets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    user_serial INTEGER,
    subject TEXT NOT NULL,
    status TEXT DEFAULT 'open',
    replies JSONB DEFAULT '[]'::jsonb,
    admin_reply TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    resolved_at TIMESTAMP WITH TIME ZONE
);

-- Row Level Security (RLS) policies for advertisements
ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public ads viewable by everyone" ON public.advertisements FOR SELECT USING (true);
CREATE POLICY "Users can insert own ads" ON public.advertisements FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ads/admins can update all" ON public.advertisements FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Users can delete own ads/admins can delete all" ON public.advertisements FOR DELETE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

-- Row Level Security (RLS) policies for tickets
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tickets viewable by owner and admin" ON public.tickets FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Tickets insertable by owner" ON public.tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Tickets updatable by owner and admin" ON public.tickets FOR UPDATE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
CREATE POLICY "Tickets deletable by owner and admin" ON public.tickets FOR DELETE USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
