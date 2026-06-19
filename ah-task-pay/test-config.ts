import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.from('system_configuration').select('*');
  console.log('Select result:', data, error);

  const { data: updateData, error: updateError } = await supabase.from('system_configuration')
    .update({ global_notice: "Testing the update" }).eq('id', 1).select();
  console.log('Update result:', updateData, updateError);
}
test();
