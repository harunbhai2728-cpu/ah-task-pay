import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: { user }, error } = await supabase.auth.admin.getUserById('ecc6fbcf-a5a2-4504-86bd-b003fdec8ecc'); // Or another admin
  if (error || !user) {
    console.error("No user found");
    return;
  }
  
  // We cannot get a session easily via admin API, but we can generate a mock JWT if we just use bypass
}
run();
