import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import crypto from 'crypto';

// ==========================================
// CONFIGURATION (READ FROM ENV)
// ==========================================

// 2. Supabase Settings
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function migrate() {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  } catch (err) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_PATH environment variable as JSON.', err);
    return;
  }

  initializeApp({
    credential: cert(serviceAccount)
  });

  const db = getFirestore("ai-studio-fe3669c8-b28b-46f7-bcb5-1792d3c2c327");
  const auth = getAuth();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  console.log('--- Starting Migration ---');

  // UID Map: Firebase UID => Supabase UUID
  const uidMap = {};

  // Helper to get or create a Supabase user by email
  async function getOrCreateSupabaseUser(email, defaultPass = 'ChangeMe123!') {
    if (!email) return null;
    
    // First check if profile exists (which means user exists)
    const { data: profiles } = await supabase.from('profiles').select('id').eq('email', email);
    if (profiles && profiles.length > 0) {
      return profiles[0].id; // Return existing UUID
    }

    // Attempt to create user in Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      password: defaultPass,
    });

    if (error) {
      // If error is "already exists" but not in profiles, try to list users (paginated) to find them
      // In a real scenario, this happens if auth exists but profile dropped.
      console.warn(`Could not create auth user for ${email}:`, error.message);
      return null; // Skip
    }
    
    return data?.user?.id;
  }

  // 1. Fetch Firebase Users and build the Map
  console.log('Migrating users...');
  let usersList = [];
  try {
    let listUsersResult = await auth.listUsers(1000);
    usersList = usersList.concat(listUsersResult.users);
    while (listUsersResult.pageToken) {
      listUsersResult = await auth.listUsers(1000, listUsersResult.pageToken);
      usersList = usersList.concat(listUsersResult.users);
    }
  } catch (err) {
    console.error('Error fetching users:', err);
  }
  console.log(`Found ${usersList.length} users in Firebase Auth.`);

  for (const user of usersList) {
    if (user.email) {
      const supaId = await getOrCreateSupabaseUser(user.email);
      if (supaId) {
        uidMap[user.uid] = { supaId, email: user.email };
      }
    }
  }

  // Helper to translate UIDs safely
  function getSupaId(fbUid) {
    if (!fbUid) return null;
    return uidMap[fbUid]?.supaId || null;
  }
  function getFbEmail(fbUid) {
    if (!fbUid) return null;
    return uidMap[fbUid]?.email || null;
  }

  // 2. Migrate Profiles
  console.log('Migrating Profiles...');
  const profilesSnap = await db.collection('users').get();
  const profiles = profilesSnap.docs.map(doc => ({ fbId: doc.id, ...doc.data() }));

  for (const p of profiles) {
    const sId = getSupaId(p.fbId);
    if (!sId) {
      console.log(`Skipping profile ${p.email || p.fbId} (No Supabase Auth mapping)`);
      continue;
    }

    const resolvedEmail = p.email || getFbEmail(p.fbId) || `missing-${p.fbId}@example.com`;
    let createdAt = new Date().toISOString();
    if (p.createdAt?._seconds) {
      createdAt = new Date(p.createdAt._seconds * 1000).toISOString();
    } else if (typeof p.createdAt === 'string') {
      createdAt = p.createdAt;
    }

    const { error } = await supabase.from('profiles').upsert({
      id: sId,
      email: resolvedEmail,
      displayName: p.name || resolvedEmail.split('@')[0],
      username: p.username || resolvedEmail.split('@')[0],
      phone: p.phone || '',
      role: p.role || 'user',
      earningBalance: p.earningBalance || p.balance || 0,
      depositBalance: p.depositBalance || 0,
      heldBalance: p.heldBalance || 0,
      createdAt: createdAt,
      isBlocked: p.isBlocked || false,
      warningCount: p.warningCount || 0,
      warning: p.warning || null
    });
    if (error) console.error(`Error migrating profile ${resolvedEmail}:`, error.message);
  }

  // 3. Migrate Jobs
  console.log('Migrating Jobs...');
  const jobsSnap = await db.collection('jobs').get();
  const jobIdMap = {}; // fbJobId -> supaJobId (UUID)
  
  for (const doc of jobsSnap.docs) {
    const j = doc.data();
    const posterSupaId = getSupaId(j.posterId || j.author_id);
    if (!posterSupaId) continue;
    
    // Generate deterministic UUID for the job so related submissions can map to it
    // Or just create a random one and map it
    const newJobId = crypto.randomUUID();
    jobIdMap[doc.id] = newJobId;

    let createdAt = new Date().toISOString();
    if (j.createdAt?._seconds) createdAt = new Date(j.createdAt._seconds * 1000).toISOString();
    else if (typeof j.createdAt === 'string') createdAt = j.createdAt;

    const { error } = await supabase.from('jobs').upsert({
      id: newJobId,
      title: j.title || '',
      category: j.category || '',
      description: j.description || '',
      proofInstruction: j.proofInstruction || '',
      pricePerWork: j.pricePerWork || j.reward || 0.0,
      maxWorkers: j.maxWorkers || j.slots || 1,
      completedCount: j.completedCount || j.slots_filled || 0,
      pendingCount: j.pendingCount || 0,
      approvedCount: j.approvedCount || 0,
      isFull: j.isFull || false,
      posterId: posterSupaId,
      createdAt: createdAt,
      thumbnail: j.thumbnail || null,
      screenshotCount: j.screenshotCount || 1,
      requireTextProof: j.requireTextProof || false,
      autoApprove: j.autoApprove || false,
      pinCode: j.pinCode || null
    });
    if (error) console.error(`Error migrating job ${j.title}:`, error.message);
  }

  // 4. Migrate Submissions
  console.log('Migrating Submissions...');
  const subsSnap = await db.collection('submissions').get();
  for (const doc of subsSnap.docs) {
    const s = doc.data();
    const workerSupaId = getSupaId(s.workerId || s.worker_id);
    const posterSupaId = getSupaId(s.posterId);
    const supaJobId = jobIdMap[s.jobId || s.job_id];
    
    if (!workerSupaId || !supaJobId) continue;

    let submittedAt = new Date().toISOString();
    if (s.submittedAt?._seconds) submittedAt = new Date(s.submittedAt._seconds * 1000).toISOString();
    else if (typeof s.submittedAt === 'string') submittedAt = s.submittedAt;

    const { error } = await supabase.from('submissions').insert({
      id: crypto.randomUUID(),
      jobId: supaJobId,
      job_id: supaJobId,
      workerId: workerSupaId,
      worker_id: workerSupaId,
      posterId: posterSupaId || null,
      poster_id: posterSupaId || null,
      status: s.status || 'pending',
      proofText: s.proofText || s.proof || '',
      screenshots: s.screenshots || [],
      rejectionReason: s.rejectionReason || null,
      submittedAt: submittedAt,
      reward: s.reward || 0.0
    });
    if (error && error.code !== '23505') console.error(`Error migrating submission for job ${supaJobId}:`, error.message);
  }

  // 5. Migrate Transactions
  console.log('Migrating Transactions...');
  const txSnap = await db.collection('transactions').get();
  for (const doc of txSnap.docs) {
    const t = doc.data();
    const supaUserId = getSupaId(t.userId || t.user_id);
    if (!supaUserId) continue;
    
    let createdAt = new Date().toISOString();
    if (t.createdAt?._seconds) createdAt = new Date(t.createdAt._seconds * 1000).toISOString();
    else if (typeof t.createdAt === 'string') createdAt = t.createdAt;

    // Map transaction fields
    let normalizedType = t.type;
    if (t.type === 'withdrawal') normalizedType = 'withdraw';
    if (t.type === 'ad_purchase') normalizedType = 'spend'; 

    let normalizedStatus = t.status;
    if (t.status === 'failed') normalizedStatus = 'rejected';

    const { error } = await supabase.from('transactions').insert({
      id: crypto.randomUUID(),
      userId: supaUserId,
      user_id: supaUserId,
      type: normalizedType,
      amount: t.amount || 0.0,
      status: normalizedStatus,
      method: t.method || t.payment_method || null,
      phone: t.phone || null,
      transactionId: t.transactionId || t.transaction_id || null,
      createdAt: createdAt
    });
    if (error && error.code !== '23505') console.error(`Error migrating tx ${t.transactionId}:`, error.message);
  }

  console.log('--- Migration Complete ---');
}

migrate();
