import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('submissions').select('id, status').limit(1);
  console.log("SELECT:", data, error);
  if (data && data[0]) {
    const { error: updError } = await supabase.from('submissions').update({ status: 'rejected' }).eq('id', data[0].id);
    console.log("UPDATE result:", updError);
  }
}
check();
