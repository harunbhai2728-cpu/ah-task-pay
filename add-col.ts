import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function alterTable() {
  const { data, error } = await supabase.rpc('execute_sql', { sql: 'ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS referral_domain_url TEXT;' });
  console.log('RPC result:', data, error);
}
alterTable();
