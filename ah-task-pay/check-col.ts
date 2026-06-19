import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('submissions').select('*').limit(1);
  if (error) console.error("SELECT ERROR:", error);
  else console.log("DATA KEYS:", data[0] ? Object.keys(data[0]) : "NO DATA");
  
  // Try to add the column if missing via a trick or check if it exists:
  // Using SQL injection or just via checking.
}
check();
