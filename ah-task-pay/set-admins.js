import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_ACCOUNTS = [
  { email: 'harunurrashid93427@gmail.com', password: '@harun93427@', phone: '01870866189' },
  { email: 'superadmin@taskpay.systems', password: 'superadmin' }
];

async function updateAdmins() {
  console.log('Resetting all users to "user" role...');
  await supabase.from('profiles').update({ role: 'user' }).neq('role', 'user');

  for (const acc of ADMIN_ACCOUNTS) {
    console.log(`Processing admin: ${acc.email}`);
    
    // Check if user exists in auth
    let user = null;
    
    // Look up by email in profiles to find the UUID, just in case
    const { data: profile } = await supabase.from('profiles').select('id').eq('email', acc.email).maybeSingle();
    
    if (profile) {
      user = { id: profile.id };
      console.log(`Found existing profile for ${acc.email} (ID: ${user.id}). Updating auth password...`);
      const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
        password: acc.password,
        email_confirm: true
      });
      if (updateError) {
         console.error("Auth update error:", updateError.message);
         // If auth user wasn't found for this profile, try creating it with the ID
         if (updateError.message.includes('User not found')) {
            const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
              id: user.id,
              email: acc.email,
              password: acc.password,
              email_confirm: true
            });
            if (createError) console.error('Failed to create auth user:', createError.message);
         }
      }
    } else {
      console.log(`No profile found for ${acc.email}. Creating completely new user...`);
      const { data: newUserData, error: createError } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true
      });
      if (createError) {
         console.error(createError);
      } else {
         user = newUserData.user;
      }
    }

    if (user) {
      // Set role in profile
      const updateData = { role: 'admin' };
      if (acc.phone) updateData.phone = acc.phone;
      
      const { error: profileError } = await supabase.from('profiles').update(updateData).eq('id', user.id);
      
      if (profileError) {
         console.error('Profile update failed:', profileError.message);
         // Try upsert if it didn't exist
         const { error: upsertError } = await supabase.from('profiles').upsert({
            id: user.id,
            email: acc.email,
            role: 'admin',
            ...(acc.phone ? { phone: acc.phone } : {})
         }, { onConflict: 'id' });
         if (upsertError) console.error('Upsert failed:', upsertError.message);
      } else {
         console.log(`Promoted ${acc.email} to admin successfully.`);
      }
    }
  }
}

updateAdmins();
