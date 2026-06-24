-- Drop existing policies
DROP POLICY IF EXISTS "Tickets viewable by owner and admin" ON public.tickets;
DROP POLICY IF EXISTS "Tickets insertable by owner" ON public.tickets;
DROP POLICY IF EXISTS "Tickets updatable by owner and admin" ON public.tickets;
DROP POLICY IF EXISTS "Tickets deletable by owner and admin" ON public.tickets;
DROP POLICY IF EXISTS "Enable read access for users based on user_id" ON public.tickets;
DROP POLICY IF EXISTS "Enable insert access for users based on user_id" ON public.tickets;
DROP POLICY IF EXISTS "Enable update access for users based on user_id" ON public.tickets;

-- Ensure RLS is enabled
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Recreate policies correctly using role = 'admin'
CREATE POLICY "Tickets viewable by owner and admin" 
ON public.tickets FOR SELECT 
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Tickets insertable by owner" 
ON public.tickets FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Tickets updatable by owner and admin" 
ON public.tickets FOR UPDATE 
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));

CREATE POLICY "Tickets deletable by owner and admin" 
ON public.tickets FOR DELETE 
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'admin'));
