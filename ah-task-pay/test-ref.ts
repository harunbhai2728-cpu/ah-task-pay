import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'harunbhai2728@gmail.com',
    password: 'password123'
  });
  
  if (error || !data.session) {
    console.log("Could not log in. Trying signup or skip", error);
    // Let's just create a test user
    const { data: d2, error: e2 } = await supabase.auth.signUp({
      email: 'test_referral12@example.com',
      password: 'password123'
    });
    if (d2 && d2.session) {
      run(d2.session.access_token);
    } else {
      console.log('signup err', e2);
    }
  } else {
    run(data.session.access_token);
  }
}

async function run(token: string) {
  const fetch = (await import('node-fetch')).default;
  console.log("Testing with token:", token.substring(0, 50));
  const res = await fetch('http://localhost:3000/api/referral/status', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status', res.status);
  console.log('Json', await res.json());
}
test();
