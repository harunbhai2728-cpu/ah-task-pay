-- Create system_configuration table
CREATE TABLE IF NOT EXISTS public.system_configuration (
  id integer PRIMARY KEY DEFAULT 1,
  global_notice text,
  min_deposit numeric DEFAULT 100,
  min_withdraw numeric DEFAULT 20,
  withdrawal_fee numeric DEFAULT 10,
  job_service_charge numeric DEFAULT 10,
  official_bkash text,
  bkash_method text DEFAULT 'Personal',
  official_nagad text,
  nagad_method text DEFAULT 'Personal',
  transfer_earning_deposit_fee numeric DEFAULT 0,
  transfer_deposit_earning_fee numeric DEFAULT 10,
  login_title text DEFAULT 'Welcome to TaskPay',
  login_banner_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Seed initial configuration
INSERT INTO public.system_configuration (
  id, global_notice, min_deposit, min_withdraw, withdrawal_fee, 
  job_service_charge, official_bkash, bkash_method, official_nagad, nagad_method, 
  transfer_earning_deposit_fee, transfer_deposit_earning_fee, login_title, login_banner_url
)
VALUES (
  1, '', 100, 20, 10, 10, 
  '', 'Personal', '', 'Personal', 
  0, 10, 'Welcome to TaskPay', ''
)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_configuration ENABLE ROW LEVEL SECURITY;

-- Allow public read access to system configuration
CREATE POLICY "Allow public read access" ON public.system_configuration FOR SELECT USING (true);

-- Allow admins/service role to manage system configuration
CREATE POLICY "Allow service role all" ON public.system_configuration FOR ALL USING (true) WITH CHECK (true);
