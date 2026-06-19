import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const mappedUpdate = {
    global_notice: 'test',
    min_deposit: 100,
    min_withdraw: 20,
    withdrawal_fee: 10,
    job_service_charge: 10,
    official_bkash: '123',
    bkash_method: 'Personal',
    official_nagad: '123',
    nagad_method: 'Personal',
    transfer_earning_deposit_fee: 0,
    transfer_deposit_earning_fee: 10,
    login_title: 'test',
    login_banner_url: 'test',
    referral_bonus_amount: 5,
    referral_validation_criteria: 1,
    campaign_end_date: null,
    target_1_referrals: 0,
    target_1_reward: 0,
    target_2_referrals: 0,
    target_2_reward: 0,
    referral_domain_url: 'test',
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase.from('system_configuration').update(mappedUpdate).eq('id', 1).select().maybeSingle();
  console.log('Update result:', data, error);
}
test();
