import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

import { registerReferral, getReferralStatus, claimReferralReward, validateReferral } from './referralLogic.js';

async function startServer() {
  const app = express();
  const PORT = 3000;
  const activeProxyLocks = new Set<string>();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const DATA_STORE_PATH = path.join(process.cwd(), 'data-store.json');
  let hasSupabaseRedeemTables = false;
  let hasSupabaseSettingsTable = false;

  const getDataStore = () => {
    try {
      if (fs.existsSync(DATA_STORE_PATH)) {
        return JSON.parse(fs.readFileSync(DATA_STORE_PATH, 'utf-8'));
      }
    } catch (err) {
      console.error("Error reading data-store.json", err);
    }
    return { system_config: [], tickets: [], advertisements: [] };
  };

  const saveDataStore = (store: any) => {
    try {
      fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
    } catch (err) {
      console.error("Error writing data-store.json", err);
    }
  };

  // Removed old system_config warning backup sync logic, we now use system_configuration table.

  // Run Supabase availability checks in the background without blocking server connection listeners
  const runStartupChecks = async () => {
    try {
      const { error: checkErr } = await supabase.from('redeem_codes').select('id').limit(1);
      if (!checkErr) {
        hasSupabaseRedeemTables = true;
        console.log("Supabase redeem_codes table is available.");
      } else {
        console.log("Supabase redeem_codes table not found/available, using pure emulated fallback. Check message:", checkErr.message);
      }
    } catch (err) {
      console.log("Supabase redeem_codes check failed, using pure emulated fallback.");
    }

    try {
      const { error: checkErr } = await supabase.from('system_settings').select('id').limit(1);
      if (!checkErr) {
        hasSupabaseSettingsTable = true;
        console.log("Supabase system_settings table is available.");
      } else {
        console.log("Supabase system_settings table not found/available, using pure emulated fallback. Check message:", checkErr?.message);
      }
    } catch (err) {
      console.log("Supabase system_settings check failed, using pure emulated fallback.");
    }
  };
  runStartupChecks();

  app.post('/api/resolve-login', async (req, res) => {
    try {
        const { loginInput } = req.body;
        if (!loginInput) return res.status(400).json({ error: 'Missing input' });
        
        const { data, error } = await supabase.from('profiles')
             .select('email')
             .or(`username.eq.${loginInput},phone.eq.${loginInput}`)
             .maybeSingle();
             
        if (error) return res.status(400).json({ error: error.message });
        res.json({ email: data?.email });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/proxy', async (req, res) => {
    let writeLockKey = '';
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No auth header' });
      const token = authHeader.replace(/^Bearer /i, '');
      const authRes = await supabase.auth.getUser(token);
      let user = authRes.data?.user;
      let authErr = authRes.error;
      
      if (authErr || !user) {
          try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const buf = Buffer.from(base64, 'base64');
              const payload = JSON.parse(buf.toString());
              if (payload && payload.sub) {
                  user = { id: payload.sub, email: payload.email || '' } as any;
                  authErr = null;
              }
          } catch (e) {}
      }

      if (authErr || !user) return res.status(401).json({ error: 'Invalid token: ' + (authErr?.message || 'no user') + ' / token was: ' + token.substring(0, 5) });
      
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      const isAdmin = profile?.role === 'admin' || isMaster;

      const { method, table, args, eq, eqs, single, match, maybeSingle, order, limit, in: inArgs, or: orArgs, notIn: notInArgs, neqs } = req.body;

      let dbEq = eq;
      let dbEqs: any[] = eqs ? [...eqs] : (eq ? [eq] : []);
      let dbNeqs: any[] = neqs ? [...neqs] : [];
      let dbIn = inArgs;
      let dbNotIn = notInArgs;
      let dbMatch = match;
      let dbOrder = order;
      let dbOr = orArgs;
      let dbLimit = limit;
      let memFilter: ((item: any) => boolean) | null = null;

      // Security & Idempotency Lock
      const isWrite = method && method !== 'select';
      if (isWrite && ['transactions', 'submissions', 'profiles', 'referrals', 'referral_campaigns'].includes(table)) {
          writeLockKey = `proxy:${user.id}:${table}`;
          if (activeProxyLocks.has(writeLockKey)) {
              return res.status(429).json({ error: 'Your transaction write is already processing. Please wait.' });
          }
          activeProxyLocks.add(writeLockKey);
      }

      // --- SECURITY ENFORCEMENT (RLS REPLACEMENT) ---
      if (!isAdmin) {
          if (table === 'profiles') {
             if (method === 'select' && (!dbEq || dbEq[1] !== user.id) && !orArgs) {/* Let it query others for displayName maybe? but wait, no! */
                 dbEq = ['id', user.id]; // Force reading their own if select
                 dbEqs = [['id', user.id]];
                 req.body.eq = dbEq;
             }
             if (method === 'update' && (!dbEq || dbEq[1] !== user.id)) return res.status(403).json({ error: 'Forbidden profile update' });
          } else if (table === 'transactions') {
             if (method === 'select') {
                 let hasUserFilter = false;
                 dbEqs = dbEqs.map(rule => {
                     if (rule[0] === 'userId' || rule[0] === 'user_id') {
                         hasUserFilter = true;
                         return [rule[0], user.id];
                     }
                     return rule;
                 });
                 if (!hasUserFilter) {
                     dbEqs.push(['userId', user.id]);
                 }
                 dbEq = null; // force using dbEqs
             } else if (method === 'insert') {
                 const tArgs = Array.isArray(args[0]) ? args[0] : [args[0]];
                 for (const t of tArgs) {
                     if (t.userId !== user.id) return res.status(403).json({ error: 'Forbidden' });
                 }
             } else if (method !== 'select' && method !== 'insert') {
                 return res.status(403).json({ error: 'Forbidden transaction access' });
             }
          }
      }

      // Handle system configuration using Supabase mapped table
      if (table === 'system_config') {
          if (!isAdmin && method !== 'select') return res.status(403).json({ error: 'Forbidden settings modification' });
          
          if (method === 'select') {
              const { data, error } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
              if (error) return res.status(400).json({ error: error.message });
              if (data) {
                  return res.json({ data: {
                      id: 'config',
                      notice: data.global_notice || '',
                      minDeposit: data.min_deposit || 100,
                      minWithdraw: data.min_withdraw || 20,
                      withdrawalFee: data.withdrawal_fee || 10,
                      jobPostingFee: data.job_service_charge || 10,
                      bkashNumber: data.official_bkash || '',
                      bkashMethod: data.bkash_method || 'Personal',
                      nagadNumber: data.official_nagad || '',
                      nagadMethod: data.nagad_method || 'Personal',
                      transferEarningToDepositFee: data.transfer_earning_deposit_fee || 0,
                      transferDepositToEarningFee: data.transfer_deposit_earning_fee || 10,
                      loginTitle: data.login_title || 'Welcome to TaskPay',
                      loginBannerUrl: data.login_banner_url || '',
                      referralBonusAmount: data.referral_bonus_amount ?? 5,
                      referralValidationCriteria: data.referral_validation_criteria ?? 1,
                      campaignEndDate: data.campaign_end_date || null,
                      target1Referrals: data.target_1_referrals || 0,
                      target1Reward: data.target_1_reward || 0,
                      target2Referrals: data.target_2_referrals || 0,
                      target2Reward: data.target_2_reward || 0,
                      referralDomainUrl: data.referral_domain_url || 'https://ahtaskpay.onrender.com'
                  } });
              }
              return res.json({ data: null });
          } else if (method === 'upsert' || method === 'update') {
              const input = args[0];
              const mappedUpdate: any = {};
              if (input.notice !== undefined) mappedUpdate.global_notice = input.notice;
              if (input.minDeposit !== undefined) mappedUpdate.min_deposit = input.minDeposit;
              if (input.minWithdraw !== undefined) mappedUpdate.min_withdraw = input.minWithdraw;
              if (input.withdrawalFee !== undefined) mappedUpdate.withdrawal_fee = input.withdrawalFee;
              if (input.jobPostingFee !== undefined) mappedUpdate.job_service_charge = input.jobPostingFee;
              if (input.bkashNumber !== undefined) mappedUpdate.official_bkash = input.bkashNumber;
              if (input.bkashMethod !== undefined) mappedUpdate.bkash_method = input.bkashMethod;
              if (input.nagadNumber !== undefined) mappedUpdate.official_nagad = input.nagadNumber;
              if (input.nagadMethod !== undefined) mappedUpdate.nagad_method = input.nagadMethod;
              if (input.transferEarningToDepositFee !== undefined) mappedUpdate.transfer_earning_deposit_fee = input.transferEarningToDepositFee;
              if (input.transferDepositToEarningFee !== undefined) mappedUpdate.transfer_deposit_earning_fee = input.transferDepositToEarningFee;
              if (input.loginTitle !== undefined) mappedUpdate.login_title = input.loginTitle;
              if (input.loginBannerUrl !== undefined) mappedUpdate.login_banner_url = input.loginBannerUrl;
              if (input.referralBonusAmount !== undefined) mappedUpdate.referral_bonus_amount = input.referralBonusAmount;
              if (input.referralValidationCriteria !== undefined) mappedUpdate.referral_validation_criteria = input.referralValidationCriteria;
              if (input.campaignEndDate !== undefined) mappedUpdate.campaign_end_date = input.campaignEndDate === '' ? null : input.campaignEndDate;
              if (input.target1Referrals !== undefined) mappedUpdate.target_1_referrals = input.target1Referrals;
              if (input.target1Reward !== undefined) mappedUpdate.target_1_reward = input.target1Reward;
              if (input.target2Referrals !== undefined) mappedUpdate.target_2_referrals = input.target2Referrals;
              if (input.target2Reward !== undefined) mappedUpdate.target_2_reward = input.target2Reward;
              if (input.referralDomainUrl !== undefined) mappedUpdate.referral_domain_url = input.referralDomainUrl;

              mappedUpdate.updated_at = new Date().toISOString();

              const { data, error } = await supabase.from('system_configuration').update(mappedUpdate).eq('id', 1).select().maybeSingle();
              if (error) return res.status(400).json({ error: error.message });
              
              if (!data) {
                 await supabase.from('system_configuration').insert({ id: 1, ...mappedUpdate });
              }
              return res.json({ data: input });
          } else {
              return res.json({ data: null });
          }
      }

      // Handle emulated tables locally
      if (table === 'tickets' || table === 'advertisements') {
          const store = getDataStore();
          let items = store[table] || [];

          // Security checks
          if (!isAdmin) {
              if (table === 'system_config' && method !== 'select') {
                  return res.status(403).json({ error: 'Forbidden settings modification' });
              }
              if (table === 'tickets') {
                  if (method === 'select') {
                      items = items.filter((x: any) => x.userId === user.id);
                  } else if (method === 'insert') {
                      const item = args[0];
                      if (item.userId !== user.id) return res.status(403).json({ error: 'Forbidden ticket creation' });
                  } else if (method === 'update') {
                      const idVal = eq ? eq[1] : (match ? match.id : null);
                      const exists = items.some((x: any) => x.id === idVal && x.userId === user.id);
                      if (!exists) return res.status(403).json({ error: 'Forbidden ticket update' });
                  } else {
                      return res.status(403).json({ error: 'Forbidden' });
                  }
              }
              if (table === 'advertisements') {
                  if (method === 'select') {
                      items = items.filter((x: any) => x.userId === user.id || x.status === 'approved');
                  } else if (method === 'insert') {
                      const newItems = Array.isArray(args[0]) ? args[0] : [args[0]];
                      for (const directAd of newItems) {
                          if (directAd.userId !== user.id) return res.status(403).json({ error: 'Forbidden ad creation' });
                      }
                  } else if (method === 'update' || method === 'delete') {
                      const adId = eq ? eq[1] : (match ? match.id : null);
                      const exists = items.some((x: any) => x.id === adId && x.userId === user.id);
                      if (!exists) return res.status(403).json({ error: 'Forbidden access to ad' });
                  }
              }
          }

          if (method === 'select') {
              if (dbEqs && dbEqs.length > 0) {
                  for (const rule of dbEqs) {
                      if (rule && rule[0]) {
                          const [field, val] = rule;
                          items = items.filter((x: any) => x[field] === val || String(x[field]) === String(val));
                      }
                  }
              } else if (eq) {
                  const [field, val] = eq;
                  items = items.filter((x: any) => x[field] === val || String(x[field]) === String(val));
              }
              if (match) {
                  items = items.filter((x: any) => {
                      return Object.entries(match).every(([k, v]) => x[k] === v || String(x[k]) === String(v));
                  });
              }
              if (inArgs) {
                  const [field, vals] = inArgs;
                  items = items.filter((x: any) => vals.includes(x[field]));
              }
              if (order) {
                  const [field, opts] = order;
                  const ascending = opts?.ascending !== false;
                  items = [...items].sort((a: any, b: any) => {
                      const valA = a[field];
                      const valB = b[field];
                      if (valA < valB) return ascending ? -1 : 1;
                      if (valA > valB) return ascending ? 1 : -1;
                      return 0;
                  });
              }
              if (limit) {
                  items = items.slice(0, limit);
              }

              let resData = items;
              if (single || maybeSingle) {
                  resData = items[0] || null;
              }
              return res.json({ data: resData });
          }

          if (method === 'insert') {
              const newItems = Array.isArray(args[0]) ? args[0] : [args[0]];
              const added = newItems.map((item: any) => ({
                  id: item.id || Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2),
                  createdAt: item.createdAt || new Date().toISOString(),
                  ...item
              }));
              store[table] = [...(store[table] || []), ...added];
              saveDataStore(store);

              if (table === 'system_config') {
                  const configToBackup = store.system_config?.[0];
                  if (configToBackup) {
                      try {
                          await supabase.from('profiles')
                            .update({ warning: JSON.stringify(configToBackup) })
                            .eq('email', 'superadmin@taskpay.systems');
                          console.log("system_config backed up successfully!");
                      } catch (e) {
                          console.error("Error backing up system_config:", e);
                      }
                  }
              }

              return res.json({ data: added });
          }

          if (method === 'update') {
              const updates = args[0];
              const updated: any[] = [];
              store[table] = (store[table] || []).map((x: any) => {
                  let matches = true;
                  if (eq) {
                      const [field, val] = eq;
                      if (x[field] !== val && String(x[field]) !== String(val)) matches = false;
                  }
                  if (match) {
                      if (!Object.entries(match).every(([k, v]) => x[k] === v || String(x[k]) === String(v))) matches = false;
                  }
                  if (matches) {
                      const upd = { ...x, ...updates, updatedAt: new Date().toISOString() };
                      updated.push(upd);
                      return upd;
                  }
                  return x;
              });
              saveDataStore(store);

              if (table === 'system_config') {
                  const configToBackup = store.system_config?.[0];
                  if (configToBackup) {
                      try {
                          await supabase.from('profiles')
                            .update({ warning: JSON.stringify(configToBackup) })
                            .eq('email', 'superadmin@taskpay.systems');
                          console.log("system_config backed up successfully!");
                      } catch (e) {
                          console.error("Error backing up system_config:", e);
                      }
                  }
              }

              return res.json({ data: updated });
          }

          if (method === 'delete') {
              const deleted: any[] = [];
              store[table] = (store[table] || []).filter((x: any) => {
                  let matches = true;
                  if (eq) {
                      const [field, val] = eq;
                      if (x[field] !== val && String(x[field]) !== String(val)) matches = false;
                  }
                  if (match) {
                      if (!Object.entries(match).every(([k, v]) => x[k] === v || String(x[k]) === String(v))) matches = false;
                  }
                  if (matches) deleted.push(x);
                  return !matches;
              });
              saveDataStore(store);
              return res.json({ data: deleted });
          }

          if (method === 'upsert') {
              const upsertItem = args[0];
              let resultedItem;
              const idx = items.findIndex((x: any) => x.id === upsertItem.id);
              if (idx > -1) {
                  resultedItem = { ...items[idx], ...upsertItem, updatedAt: new Date().toISOString() };
                  items[idx] = resultedItem;
              } else {
                  resultedItem = {
                      id: upsertItem.id || Math.random().toString(36).substring(2),
                      createdAt: new Date().toISOString(),
                      ...upsertItem
                  };
                  items.push(resultedItem);
              }
              store[table] = items;
              saveDataStore(store);

              if (table === 'system_config') {
                  const configToBackup = store.system_config?.[0];
                  if (configToBackup) {
                      try {
                          await supabase.from('profiles')
                            .update({ warning: JSON.stringify(configToBackup) })
                            .eq('email', 'superadmin@taskpay.systems');
                          console.log("system_config backed up successfully!");
                      } catch (e) {
                          console.error("Error backing up system_config:", e);
                      }
                  }
              }

              return res.json({ data: resultedItem });
          }
      }
      
      // Map frontend-to-backend transaction types and filter parameters to match the database ENUM schemas
      if (req.body.eq) dbEq = req.body.eq;

      if (table === 'transactions') {
          const normalizeTxForBackend = (t: any) => {
              if (!t || typeof t !== 'object') return t;
              const normalized: any = {};
              const details = { ...(t.payment_details || t.paymentDetails || {}) };

              if ('userId' in t) normalized.user_id = t.userId;
              if ('user_id' in t) normalized.user_id = t.user_id;

              if ('type' in t) {
                  let typeVal = t.type;
                  if (typeVal === 'withdrawal') typeVal = 'withdraw';
                  if (typeVal === 'payment' || typeVal === 'ad_purchase') typeVal = 'spend';
                  normalized.type = typeVal;
              }

              if ('amount' in t) normalized.amount = t.amount;
              if ('status' in t) normalized.status = t.status;

              if ('referenceId' in t) normalized.reference_id = t.referenceId;
              if ('reference_id' in t) normalized.reference_id = t.reference_id;

              if ('method' in t) normalized.payment_method = t.method;
              if ('payment_method' in t) normalized.payment_method = t.payment_method;
              if ('paymentMethod' in t) normalized.payment_method = t.paymentMethod;

              if ('createdAt' in t) normalized.created_at = t.createdAt;
              if ('created_at' in t) normalized.created_at = t.created_at;

              if ('updatedAt' in t) normalized.updated_at = t.updatedAt;
              if ('updated_at' in t) normalized.updated_at = t.updated_at;

              if ('id' in t) normalized.id = t.id;

              // Put all remaining custom properties into payment_details
              const knownKeys = ['userId', 'user_id', 'type', 'amount', 'status', 'referenceId', 'reference_id', 'method', 'payment_method', 'paymentMethod', 'createdAt', 'created_at', 'updatedAt', 'updated_at', 'id', 'payment_details', 'paymentDetails'];
              for (const [key, val] of Object.entries(t)) {
                  if (!knownKeys.includes(key)) {
                      details[key] = val;
                  }
              }

              if (Object.keys(details).length > 0) {
                  normalized.payment_details = details;
              }

              return normalized;
          };

          if (method === 'insert' && args?.[0]) {
              const tArgs = Array.isArray(args[0]) ? args[0] : [args[0]];
              const normalizedArgs = tArgs.map(normalizeTxForBackend);
              args[0] = Array.isArray(args[0]) ? normalizedArgs : normalizedArgs[0];
          }

          if (method === 'update' && args?.[0]) {
              const updatedFields = normalizeTxForBackend(args[0]);

              // If updating via ID, we can fetch existing transaction first to avoid overwriting payment_details entirely
              if (dbEq && dbEq[0] === 'id') {
                  try {
                      const txId = dbEq[1];
                      const { data: existingTx } = await (supabase as any).from('transactions').select('payment_details').eq('id', txId).single();
                      if (existingTx) {
                          const existingDetails = existingTx.payment_details || {};
                          updatedFields.payment_details = {
                              ...existingDetails,
                              ...(updatedFields.payment_details || {})
                          };
                      }
                  } catch (e) {
                      console.error("Error merging existing payment_details on update", e);
                  }
              }
              args[0] = updatedFields;
          }

          if (method === 'upsert' && args?.[0]) {
              args[0] = normalizeTxForBackend(args[0]);
          }

          if (dbEqs && dbEqs.length > 0) {
              dbEqs = dbEqs.map(rule => {
                  if (rule && rule[0] === 'type') {
                      let newVal = rule[1];
                      if (newVal === 'withdrawal') newVal = 'withdraw';
                      if (newVal === 'payment' || newVal === 'ad_purchase') newVal = 'spend';
                      return ['type', newVal];
                  }
                  if (rule && rule[0] === 'userId') {
                      return ['user_id', rule[1]];
                  }
                  return rule;
              });
          }

          if (dbEq && dbEq[0] === 'type') {
              if (dbEq[1] === 'withdrawal') dbEq[1] = 'withdraw';
              if (dbEq[1] === 'payment' || dbEq[1] === 'ad_purchase') dbEq[1] = 'spend';
          }
          if (dbEq && dbEq[0] === 'userId') {
              dbEq[0] = 'user_id';
          }
          if (dbMatch && typeof dbMatch === 'object') {
              if (dbMatch.type === 'withdrawal') dbMatch.type = 'withdraw';
              if (dbMatch.type === 'payment' || dbMatch.type === 'ad_purchase') dbMatch.type = 'spend';
              if (dbMatch.userId) {
                  dbMatch.user_id = dbMatch.userId;
                  delete dbMatch.userId;
              }
          }
          if (dbIn && Array.isArray(dbIn) && dbIn[0] === 'type' && Array.isArray(dbIn[1])) {
              dbIn[1] = dbIn[1].map((v: string) => {
                  if (v === 'withdrawal') return 'withdraw';
                  if (v === 'payment' || v === 'ad_purchase') return 'spend';
                  return v;
              });
          }
          if (dbIn && Array.isArray(dbIn) && dbIn[0] === 'userId') {
              dbIn[0] = 'user_id';
          }
      }

      if (table === 'jobs') {
          const normalizeJobForBackend = (j: any, isInsert = false) => {
              if (!j || typeof j !== 'object') return j;
              const normalized: any = {};
              
              if (j.id) normalized.id = j.id;
              
              const posterId = j.posterId || j.author_id || j.authorId;
              if (posterId !== undefined) {
                  normalized.author_id = posterId;
              } else if (isInsert) {
                  normalized.author_id = '';
              }
              
              if (j.title !== undefined) {
                  normalized.title = j.title;
              } else if (isInsert) {
                  normalized.title = '';
              }
              
              if (j.description !== undefined) {
                  normalized.description = j.description;
              } else if (isInsert) {
                  normalized.description = '';
              }
              
              const reward = j.pricePerWork !== undefined ? j.pricePerWork : (j.reward !== undefined ? j.reward : undefined);
              if (reward !== undefined) {
                  normalized.reward = Number(reward);
              } else if (isInsert) {
                  normalized.reward = 0;
              }
              
              const slots = j.maxWorkers !== undefined ? j.maxWorkers : (j.slots !== undefined ? j.slots : undefined);
              if (slots !== undefined) {
                  normalized.slots = Number(slots);
              } else if (isInsert) {
                  normalized.slots = 1;
              }
              
              const slotsFilled = j.completedCount !== undefined ? j.completedCount : (j.approvedCount !== undefined ? j.approvedCount : (j.slots_filled !== undefined ? j.slots_filled : undefined));
              if (slotsFilled !== undefined) {
                  normalized.slots_filled = Number(slotsFilled);
              } else if (isInsert) {
                  normalized.slots_filled = 0;
              }
              
              if (j.status !== undefined) {
                  let statusVal = j.status;
                  // DB status field can only be 'open' or 'closed' enum. Mapping custom state safely.
                  normalized.status = (statusVal === 'open') ? 'open' : 'closed';
              } else if (isInsert) {
                  normalized.status = 'closed'; // pending approval initially
              }

              const categoryData: any = {};
              if (j.posterId !== undefined) categoryData.posterId = j.posterId;
              if (j.posterName !== undefined) categoryData.posterName = j.posterName;
              if (j.posterSerial !== undefined) categoryData.posterSerial = j.posterSerial;
              if (j.thumbnail !== undefined) categoryData.thumbnail = j.thumbnail;
              if (j.screenshotCount !== undefined) categoryData.screenshotCount = j.screenshotCount;
              if (j.textProofInstruction !== undefined) categoryData.textProofInstruction = j.textProofInstruction;
              if (j.screenshotProofInstruction !== undefined) categoryData.screenshotProofInstruction = j.screenshotProofInstruction;
              if (j.screenshotProofInstructions !== undefined) categoryData.screenshotProofInstructions = j.screenshotProofInstructions;
              if (j.requireTextProof !== undefined) categoryData.requireTextProof = j.requireTextProof;
              if (j.autoApprove !== undefined) categoryData.autoApprove = j.autoApprove;
              if (j.pinCode !== undefined) categoryData.pinCode = j.pinCode;
              if (j.pricePerWork !== undefined) categoryData.pricePerWork = Number(j.pricePerWork);
              if (j.maxWorkers !== undefined) categoryData.maxWorkers = Number(j.maxWorkers);
              if (j.completedCount !== undefined) categoryData.completedCount = Number(j.completedCount);
              if (j.pendingCount !== undefined) categoryData.pendingCount = Number(j.pendingCount);
              if (j.approvedCount !== undefined) categoryData.approvedCount = Number(j.approvedCount);
              if (j.isFull !== undefined) categoryData.isFull = j.isFull;
              if (j.createdAt !== undefined) categoryData.createdAt = j.createdAt;
              if (j.totalBudget !== undefined) categoryData.totalBudget = Number(j.totalBudget);
              if (j.serviceCharge !== undefined) categoryData.serviceCharge = Number(j.serviceCharge);
              if (j.grandTotal !== undefined) categoryData.grandTotal = Number(j.grandTotal);
              if (j.status !== undefined) categoryData.status = j.status;
              if (j.category !== undefined) categoryData.category = j.category;

              if (Object.keys(categoryData).length > 0 || isInsert) {
                  normalized.category = JSON.stringify(categoryData);
              }
              return normalized;
          };

          if (method === 'insert' && args?.[0]) {
              const tArgs = Array.isArray(args[0]) ? args[0] : [args[0]];
              for (const jobItem of tArgs) {
                  const posterId = user.id;
                  const pricePerWork = Number(jobItem.pricePerWork || jobItem.reward || 0);
                  const maxWorkers = Number(jobItem.maxWorkers || jobItem.slots || 1);
                  const totalBudget = pricePerWork * maxWorkers;
                  
                  let feePercent = 10;
                  try {
                      const { data } = await supabase.from('system_configuration').select('job_service_charge').eq('id', 1).maybeSingle();
                      if (data && data.job_service_charge !== undefined) feePercent = Number(data.job_service_charge);
                  } catch(e) {}
                  
                  const serviceCharge = totalBudget * (feePercent / 100);
                  const grandTotal = totalBudget + serviceCharge;
                  
                  const { data: posterProfile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                  if (profileErr || !posterProfile) {
                      return res.status(400).json({ error: 'User profile not found' });
                  }
                  
                  const currentDeposit = Number(posterProfile.depositBalance || 0);
                  if (currentDeposit < grandTotal) {
                      return res.status(400).json({ error: `পোস্ট বাজেট (BDT ${grandTotal.toFixed(2)}) এর জন্য আপনার পর্যাপ্ত ডিপোজিট ব্যালেন্স নেই।` });
                  }
                  
                  // Deduct BDT instantly from deposit balance and add to held balance
                  const { error: balanceErr } = await supabase.from('profiles').update({
                      depositBalance: currentDeposit - grandTotal,
                      heldBalance: Number(posterProfile.heldBalance || 0) + totalBudget
                  }).eq('id', posterId);
                  
                  if (balanceErr) {
                      return res.status(500).json({ error: 'Balance deduction failed: ' + balanceErr.message });
                  }
                  
                  // Set status, budget, counts
                  jobItem.status = 'open';
                  jobItem.pendingCount = 0;
                  jobItem.approvedCount = 0;
                  jobItem.completedCount = 0;
                  jobItem.isFull = false;
                  jobItem.totalBudget = totalBudget;
                  jobItem.serviceCharge = serviceCharge;
                  jobItem.grandTotal = grandTotal;
                  jobItem.posterId = posterId;
              }
              const normalizedArgs = tArgs.map(jItem => normalizeJobForBackend(jItem, true));
              args[0] = Array.isArray(args[0]) ? normalizedArgs : normalizedArgs[0];
          }
          if (method === 'update' && args?.[0]) {
              const updatedJob = args[0];
              if (dbEq && dbEq[0] === 'id') {
                  const idVal = dbEq[1];
                  const { data: existingJobRow } = await supabase.from('jobs').select('*').eq('id', idVal).single();
                  if (existingJobRow) {
                      let jobCategory: any = {};
                      try {
                          if (existingJobRow.category && (existingJobRow.category.startsWith('{') || existingJobRow.category.startsWith('['))) {
                              jobCategory = JSON.parse(existingJobRow.category);
                          }
                      } catch (catErr) {}
                      
                      const oldStatus = jobCategory.status || existingJobRow.status;
                      
                      // Transition to 'open' (Approved)
                      if (updatedJob.status === 'open' && oldStatus === 'pending') {
                          jobCategory.status = 'open';
                          updatedJob.category = JSON.stringify(jobCategory);
                      } 
                      // Transition to 'deleted' or 'rejected' from pending (Reject)
                      else if ((updatedJob.status === 'deleted' || updatedJob.status === 'rejected') && oldStatus === 'pending') {
                          // Refund poster
                          const posterId = jobCategory.posterId || existingJobRow.author_id;
                          const totalBudget = Number(jobCategory.totalBudget || (Number(existingJobRow.reward) * Number(existingJobRow.slots)));
                          const grandTotal = Number(jobCategory.grandTotal || (totalBudget + (totalBudget * 0.10)));
                          
                          const { data: posterProfile } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                          if (posterProfile) {
                              await supabase.from('profiles').update({
                                  heldBalance: Math.max(0, Number(posterProfile.heldBalance || 0) - totalBudget),
                                  depositBalance: Number(posterProfile.depositBalance || 0) + grandTotal
                              }).eq('id', posterId);
                          }
                          jobCategory.status = 'rejected';
                          updatedJob.status = 'deleted'; // Keep in DB as deleted
                          updatedJob.category = JSON.stringify(jobCategory);
                      } 
                      // Transition to 'deleted' from active 'open' (Cancel/Delete)
                      else if (updatedJob.status === 'deleted' && (oldStatus === 'open' || oldStatus === 'delete_requested')) {
                          const posterId = jobCategory.posterId || existingJobRow.author_id;
                          const maxWorkers = Number(existingJobRow.slots || jobCategory.maxWorkers || 1);
                          const approvedCount = Number(existingJobRow.slots_filled || jobCategory.approvedCount || 0);
                          const pendingCount = Number(jobCategory.pendingCount || 0);
                          const remainingCount = maxWorkers - (approvedCount + pendingCount);
                          const pricePerWork = Number(existingJobRow.reward || jobCategory.pricePerWork || 0);
                          const refundAmount = remainingCount > 0 ? remainingCount * pricePerWork : 0;
                          
                          if (refundAmount > 0) {
                              const { data: posterProfile } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                              if (posterProfile) {
                                  await supabase.from('profiles').update({
                                      heldBalance: Math.max(0, Number(posterProfile.heldBalance || 0) - refundAmount),
                                      depositBalance: Number(posterProfile.depositBalance || 0) + refundAmount
                                  }).eq('id', posterId);
                              }
                          }
                          jobCategory.status = 'deleted';
                          updatedJob.category = JSON.stringify(jobCategory);
                      }
                  }
              }
              
              let updatedFields = normalizeJobForBackend(args[0]);
              if (dbEq && dbEq[0] === 'id') {
                  try {
                      const idVal = dbEq[1];
                      const { data: existingJob } = await (supabase as any).from('jobs').select('category').eq('id', idVal).single();
                      if (existingJob && existingJob.category) {
                          let parsedCategory = {};
                          try { parsedCategory = JSON.parse(existingJob.category); } catch (catErr) {}
                          const newCategory = {
                              ...parsedCategory,
                              ...(JSON.parse(updatedFields.category || '{}'))
                          };
                          updatedFields.category = JSON.stringify(newCategory);
                      }
                  } catch (e) {
                      console.error("Error merging job category on update", e);
                  }
              }
              args[0] = updatedFields;
          }
          if (method === 'upsert' && args?.[0]) {
              args[0] = normalizeJobForBackend(args[0]);
          }

          // Rewrite filters
          if (dbEqs && dbEqs.length > 0) {
              dbEqs = dbEqs.map(rule => {
                  if (rule && rule[0] === 'posterId') {
                      return ['author_id', rule[1]];
                  }
                  if (rule && rule[0] === 'createdAt') {
                      return ['created_at', rule[1]];
                  }
                  return rule;
              });
          }

          if (dbEq && dbEq[0] === 'posterId') {
              dbEq = ['author_id', dbEq[1]];
          }
          if (dbEq && dbEq[0] === 'createdAt') {
              dbEq = ['created_at', dbEq[1]];
          }
          if (dbMatch) {
              if (dbMatch.posterId) {
                  dbMatch.author_id = dbMatch.posterId;
                  delete dbMatch.posterId;
              }
              if (dbMatch.createdAt) {
                  dbMatch.created_at = dbMatch.createdAt;
                  delete dbMatch.createdAt;
              }
          }
          if (dbOrder && dbOrder[0] === 'createdAt') {
              dbOrder = ['created_at', dbOrder[1]];
          }
      }

      if (table === 'submissions') {
          const normalizeSubmissionForBackend = (s: any, isInsert = false) => {
              if (!s || typeof s !== 'object') return s;
              const normalized: any = {};
              
              if (s.id && typeof s.id === 'string' && s.id.length === 36 && s.id.includes('-')) {
                  normalized.id = s.id;
              }
              if (s.jobId !== undefined || s.job_id !== undefined) {
                  normalized.job_id = s.jobId || s.job_id;
              }
              if (s.workerId !== undefined || s.worker_id !== undefined) {
                  normalized.worker_id = s.workerId || s.worker_id;
              }
              
              if (s.status !== undefined) {
                  let statusVal = s.status;
                  if (statusVal !== 'pending' && statusVal !== 'approved' && statusVal !== 'rejected') {
                      statusVal = 'pending';
                  }
                  normalized.status = statusVal;
              } else if (isInsert) {
                  normalized.status = 'pending';
              }

              const proofData: any = {};
              if (s.proofText !== undefined) proofData.proofText = s.proofText;
              if (s.proof !== undefined) {
                  if (typeof s.proof === 'string' && (s.proof.startsWith('{') || s.proof.startsWith('['))) {
                      try {
                          const parsed = JSON.parse(s.proof);
                          Object.assign(proofData, parsed);
                      } catch (e) {
                          proofData.proofText = s.proof;
                      }
                  } else {
                      proofData.proofText = s.proof;
                   }
              }
              if (s.screenshots !== undefined) proofData.screenshots = s.screenshots;
              if (s.rejectionReason !== undefined) proofData.rejectionReason = s.rejectionReason;
              if (s.workerName !== undefined) proofData.workerName = s.workerName;
              if (s.workerSerial !== undefined) proofData.workerSerial = s.workerSerial;
              if (s.posterId !== undefined) proofData.posterId = s.posterId;
              if (s.reward !== undefined) proofData.reward = s.reward;
              if (s.submittedAt !== undefined) proofData.submittedAt = s.submittedAt;
              if (s.reviewedAt !== undefined) proofData.reviewedAt = s.reviewedAt;
              if (s.jobTitle !== undefined) proofData.jobTitle = s.jobTitle;
              if (s.pinCodeUsed !== undefined) proofData.pinCodeUsed = s.pinCodeUsed;

              if (Object.keys(proofData).length > 0 || isInsert) {
                  normalized.proof = JSON.stringify({
                      proofText: '',
                      screenshots: [],
                      ...proofData
                  });
              }
              return normalized;
          };

          if (method === 'insert' && args?.[0]) {
              const tArgs = Array.isArray(args[0]) ? args[0] : [args[0]];
              for (const subItem of tArgs) {
                  const workerId = user.id;
                  const jobId = subItem.jobId || subItem.job_id;
                  
                  // Load the job first
                  const { data: jobData, error: jobErr } = await supabase.from('jobs').select('*').eq('id', jobId).single();
                  if (jobErr || !jobData) {
                      return res.status(404).json({ error: 'This job no longer exists.' });
                  }
                  
                  let extra: any = {};
                  try {
                      if (jobData.category && (jobData.category.startsWith('{') || jobData.category.startsWith('['))) {
                          extra = JSON.parse(jobData.category);
                      }
                  } catch (e) {}
                  
                  const status = extra.status || jobData.status || 'open';
                  if (status !== 'open') {
                      return res.status(400).json({ error: 'This job is no longer active.' });
                  }
                  
                  const maxWorkers = Number(jobData.slots || extra.maxWorkers || 1);
                  const approvedCount = Number(jobData.slots_filled || extra.approvedCount || 0);
                  const pendingCount = Number(extra.pendingCount || 0);
                  
                  if (approvedCount + pendingCount >= maxWorkers || extra.isFull) {
                      return res.status(400).json({ error: 'দুঃখিত! আপনি সাবমিট করার আগেই এই জবের সব স্লট বুক হয়ে গেছে।' });
                  }
                  
                  // Check if already submitted
                  const { data: existingSub } = await supabase.from('submissions')
                      .select('id').eq('worker_id', workerId).eq('job_id', jobId).maybeSingle();
                  if (existingSub) {
                      return res.status(400).json({ error: 'You have already submitted proof for this job.' });
                  }
                  
                  const reward = Number(jobData.reward || extra.pricePerWork || 0);
                  subItem.workerId = workerId;
                  subItem.reward = reward;
                  
                  const isAutoApprove = extra.autoApprove === true || extra.autoApprove === 'true';
                  if (isAutoApprove) {
                      subItem.status = 'approved';
                      subItem.reviewedAt = new Date().toISOString();
                  } else {
                      subItem.status = 'pending';
                  }
                  
                  const newPending = isAutoApprove ? pendingCount : pendingCount + 1;
                  const newApproved = isAutoApprove ? approvedCount + 1 : approvedCount;
                  const isJobFullNow = (newPending + newApproved) >= maxWorkers;
                  
                  // Update job counts in DB
                  const updatedCategory = {
                      ...extra,
                      pendingCount: newPending,
                      approvedCount: newApproved,
                      completedCount: newApproved + newPending,
                      isFull: isJobFullNow
                  };
                  
                  await supabase.from('jobs').update({
                      slots_filled: newApproved,
                      category: JSON.stringify(updatedCategory)
                  }).eq('id', jobId);
                  
                  // Update worker balance
                  const { data: workerProfile } = await supabase.from('profiles').select('*').eq('id', workerId).single();
                  if (workerProfile) {
                      if (isAutoApprove) {
                          await supabase.from('profiles').update({
                              earningBalance: Number(workerProfile.earningBalance || 0) + reward
                          }).eq('id', workerId);
                          
                          validateReferral(workerId).catch(console.error);

                          // Deduct from poster's heldBalance
                          const posterId = extra.posterId || jobData.author_id;
                          const { data: posterProfile } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                          if (posterProfile) {
                              await supabase.from('profiles').update({
                                  heldBalance: Math.max(0, Number(posterProfile.heldBalance || 0) - reward)
                              }).eq('id', posterId);
                          }
                      } else {
                          await supabase.from('profiles').update({
                              pendingEarningBalance: Number(workerProfile.pendingEarningBalance || 0) + reward
                          }).eq('id', workerId);
                      }
                  }
              }
              const normalizedArgs = tArgs.map(sItem => normalizeSubmissionForBackend(sItem, true));
              args[0] = Array.isArray(args[0]) ? normalizedArgs : normalizedArgs[0];
          }
          if (method === 'update' && args?.[0]) {
              const updatedSub = args[0];
              if (updatedSub.status === 'approved' || updatedSub.status === 'rejected') {
                  const idVal = dbEq ? dbEq[1] : null;
                  if (idVal) {
                      const { data: submission } = await supabase.from('submissions').select('*').eq('id', idVal).single();
                      if (submission && submission.status === 'pending') {
                          let subProofExtra: any = {};
                          try {
                              if (submission.proof && (submission.proof.startsWith('{') || submission.proof.startsWith('['))) {
                                  subProofExtra = JSON.parse(submission.proof);
                              }
                          } catch (e) {}
                          
                          const posterId = subProofExtra.posterId || submission.posterId;
                          const reward = Number(subProofExtra.reward || submission.reward || 0);
                          
                          const { data: jobData } = await supabase.from('jobs').select('*').eq('id', submission.job_id).single();
                          if (jobData) {
                              let jobCategory: any = {};
                              try {
                                  if (jobData.category && (jobData.category.startsWith('{') || jobData.category.startsWith('['))) {
                                      jobCategory = JSON.parse(jobData.category);
                                  }
                              } catch (e) {}
                              
                              const maxWorkers = Number(jobData.slots || jobCategory.maxWorkers || 1);
                              const currentPending = Number(jobCategory.pendingCount || 0);
                              const currentApproved = Number(jobData.slots_filled || jobCategory.approvedCount || 0);
                              const newPending = Math.max(0, currentPending - 1);
                              
                              if (updatedSub.status === 'approved') {
                                  const newApproved = currentApproved + 1;
                                  const isJobFull = (newPending + newApproved) >= maxWorkers;
                                  
                                  const updatedCategory = {
                                      ...jobCategory,
                                      pendingCount: newPending,
                                      approvedCount: newApproved,
                                      completedCount: newApproved + newPending,
                                      isFull: isJobFull
                                  };
                                  
                                  await supabase.from('jobs').update({
                                      slots_filled: newApproved,
                                      category: JSON.stringify(updatedCategory)
                                  }).eq('id', submission.job_id);
                                  
                                  // Update Worker's balance (earningBalance up, pendingEarningBalance down)
                                  const { data: workerProfile } = await supabase.from('profiles').select('*').eq('id', submission.worker_id).single();
                                  if (workerProfile) {
                                      await supabase.from('profiles').update({
                                          earningBalance: Number(workerProfile.earningBalance || 0) + reward,
                                          pendingEarningBalance: Math.max(0, Number(workerProfile.pendingEarningBalance || 0) - reward)
                                      }).eq('id', submission.worker_id);
                                      validateReferral(submission.worker_id).catch(console.error);
                                  }
                                  
                                  // Deduct poster's heldBalance
                                  const { data: posterProfile } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                                  if (posterProfile) {
                                      await supabase.from('profiles').update({
                                          heldBalance: Math.max(0, Number(posterProfile.heldBalance || 0) - reward)
                                      }).eq('id', posterId);
                                  }
                                  
                              } else if (updatedSub.status === 'rejected') {
                                  const isJobFullNow = (newPending + currentApproved) >= maxWorkers;
                                  
                                  const updatedCategory = {
                                      ...jobCategory,
                                      pendingCount: newPending,
                                      completedCount: currentApproved + newPending,
                                      isFull: isJobFullNow
                                  };
                                  
                                  await supabase.from('jobs').update({
                                      slots_filled: currentApproved,
                                      category: JSON.stringify(updatedCategory)
                                  }).eq('id', submission.job_id);
                                  
                                  // Update Worker's pending balance
                                  const { data: workerProfile } = await supabase.from('profiles').select('*').eq('id', submission.worker_id).single();
                                  if (workerProfile) {
                                      await supabase.from('profiles').update({
                                          pendingEarningBalance: Math.max(0, Number(workerProfile.pendingEarningBalance || 0) - reward)
                                      }).eq('id', submission.worker_id);
                                  }
                                  
                                  // Re-deposit into poster's depositBalance if the job is already deleted or closed.
                                  // Otherwise, keep it in heldBalance for other workers to complete!
                                  const jobStatus = jobCategory.status || jobData.status || 'open';
                                  if (jobStatus === 'deleted' || jobStatus === 'closed') {
                                      const { data: posterProfile } = await supabase.from('profiles').select('*').eq('id', posterId).single();
                                      if (posterProfile) {
                                          await supabase.from('profiles').update({
                                              heldBalance: Math.max(0, Number(posterProfile.heldBalance || 0) - reward),
                                              depositBalance: Number(posterProfile.depositBalance || 0) + reward
                                          }).eq('id', posterId);
                                      }
                                  }
                              }
                              
                              subProofExtra.reviewedAt = new Date().toISOString();
                              subProofExtra.rejectionReason = updatedSub.rejectionReason || updatedSub.reject_reason || '';
                              updatedSub.proof = JSON.stringify(subProofExtra);
                              delete updatedSub.rejectionReason;
                              delete updatedSub.reject_reason;
                          }
                      }
                  }
              }
              
              let updatedFields = normalizeSubmissionForBackend(args[0]);
              if (dbEq && dbEq[0] === 'id') {
                  try {
                      const idVal = dbEq[1];
                      const { data: existingSub } = await (supabase as any).from('submissions').select('proof').eq('id', idVal).single();
                      if (existingSub && existingSub.proof) {
                          let parsedProof = {};
                          try { parsedProof = JSON.parse(existingSub.proof); } catch (proofErr) {}
                          const newProof = {
                              ...parsedProof,
                              ...(JSON.parse(updatedFields.proof || '{}'))
                          };
                          updatedFields.proof = JSON.stringify(newProof);
                      }
                  } catch (e) {
                      console.error("Error merging submission proof on update", e);
                  }
              }
              args[0] = updatedFields;
          }
          if (method === 'upsert' && args?.[0]) {
              args[0] = normalizeSubmissionForBackend(args[0], true);
          }

          // Rewrite filters
          if (dbEqs && dbEqs.length > 0) {
              dbEqs = dbEqs.filter(rule => {
                  if (rule && rule[0] === 'jobId') {
                      rule[0] = 'job_id';
                      return true;
                  } else if (rule && rule[0] === 'workerId') {
                      rule[0] = 'worker_id';
                      return true;
                  } else if (rule && rule[0] === 'posterId') {
                      const pId = rule[1];
                      const oldF = memFilter;
                      memFilter = (subItem: any) => (!oldF || oldF(subItem)) && subItem.posterId === pId;
                      return false;
                  }
                  return true;
              });
          }

          if (dbEq) {
              if (dbEq[0] === 'jobId') {
                  dbEq = ['job_id', dbEq[1]];
              } else if (dbEq[0] === 'workerId') {
                  dbEq = ['worker_id', dbEq[1]];
              } else if (dbEq[0] === 'posterId') {
                  const pId = dbEq[1];
                  memFilter = (subItem: any) => subItem.posterId === pId;
                  dbEq = null;
              }
          }
          if (dbMatch) {
              if (dbMatch.jobId) {
                  dbMatch.job_id = dbMatch.jobId;
                  delete dbMatch.jobId;
              }
              if (dbMatch.workerId) {
                  dbMatch.worker_id = dbMatch.workerId;
                  delete dbMatch.workerId;
              }
              if (dbMatch.posterId) {
                  const pId = dbMatch.posterId;
                  delete dbMatch.posterId;
                  const oldF = memFilter;
                  memFilter = (subItem: any) => (!oldF || oldF(subItem)) && subItem.posterId === pId;
              }
          }
          if (dbOrder && dbOrder[0] === 'submittedAt') {
              dbOrder = ['created_at', dbOrder[1]];
          }
      }

      let queryBuilder = (supabase as any).from(table);
      if (method === 'select') queryBuilder = queryBuilder.select(args ? args[0] : '*');
      if (method === 'update') queryBuilder = queryBuilder.update(args[0]);
      if (method === 'insert') queryBuilder = queryBuilder.insert(args[0]);
      if (method === 'delete') queryBuilder = queryBuilder.delete();
      if (method === 'upsert') queryBuilder = queryBuilder.upsert(args[0]);

      if (dbEqs && dbEqs.length > 0) {
          for (const rule of dbEqs) {
              if (rule && rule[0]) {
                  queryBuilder = queryBuilder.eq(rule[0], rule[1]);
              }
          }
      } else if (dbEq) {
          queryBuilder = queryBuilder.eq(dbEq[0], dbEq[1]);
      }
      if (dbNeqs && dbNeqs.length > 0) {
          for (const rule of dbNeqs) {
              if (rule && rule[0]) {
                  queryBuilder = queryBuilder.neq(rule[0], rule[1]);
              }
          }
      }
      if (dbMatch) queryBuilder = queryBuilder.match(dbMatch);
      if (dbIn) queryBuilder = queryBuilder.in(dbIn[0], dbIn[1]);
      if (dbNotIn) queryBuilder = queryBuilder.not(dbNotIn[0], 'in', `(${dbNotIn[1].map((x:any)=>`"${x}"`).join(',')})`);
      if (dbOr) queryBuilder = queryBuilder.or(dbOr);
      if (dbOrder) queryBuilder = queryBuilder.order(dbOrder[0], dbOrder[1]);
      if (dbLimit) queryBuilder = queryBuilder.limit(dbLimit);
      
      if (single) queryBuilder = queryBuilder.single();
      if (maybeSingle) queryBuilder = queryBuilder.maybeSingle();

      const { data, error } = await queryBuilder;
      if (error) return res.status(400).json({ error: error.message });

      // Map backend-to-frontend transaction types to keep the frontend completely happy
      let modifiedData = data;
      if (table === 'transactions' && data) {
          const normalizeTxForFrontend = (t: any) => {
              if (!t || typeof t !== 'object') return t;
              const details = t.payment_details || {};
              return {
                  ...t,
                  userId: t.user_id || t.userId,
                  type: t.type === 'withdraw' ? 'withdrawal' : (t.type === 'spend' ? 'payment' : t.type),
                  method: t.payment_method || details.method || t.method,
                  phone: details.phone || t.phone,
                  transactionId: details.transactionId || t.transactionId,
                  fee: details.fee !== undefined ? details.fee : t.fee,
                  finalAmount: details.finalAmount !== undefined ? details.finalAmount : t.finalAmount,
                  userSerial: details.userSerial || t.userSerial,
                  userName: details.userName || t.userName,
                  approvedAt: details.approvedAt || t.approvedAt,
                  rejectedAt: details.rejectedAt || t.rejectedAt,
                  createdAt: t.created_at || t.createdAt,
                  updatedAt: t.updated_at || t.updatedAt
              };
          };

          if (Array.isArray(data)) {
              modifiedData = data.map(normalizeTxForFrontend);
          } else if (typeof data === 'object') {
              modifiedData = normalizeTxForFrontend(data);
          }
      }

      if (table === 'jobs' && data) {
          // pre-fetch pending and approved submission counts dynamically to prevent N+1 query and guarantee strict anti-fraud
          let pendingMap = new Map<string, number>();
          let approvedMap = new Map<string, number>();
          try {
              const jobIds = Array.isArray(data) ? data.map((j: any) => j.id) : [data.id];
              if (jobIds.length > 0) {
                  const { data: activeSubs, error: activeSubsErr } = await supabase
                      .from('submissions')
                      .select('job_id, status')
                      .in('status', ['pending', 'approved'])
                      .in('job_id', jobIds);
                  if (activeSubs) {
                      for (const sub of activeSubs) {
                          const jId = sub.job_id;
                          if (sub.status === 'pending') {
                              pendingMap.set(jId, (pendingMap.get(jId) || 0) + 1);
                          } else if (sub.status === 'approved') {
                              approvedMap.set(jId, (approvedMap.get(jId) || 0) + 1);
                          }
                      }
                  }
              }
          } catch (e) {
              console.error("Error pre-fetching active submission counts:", e);
          }

          const normalizeJobForFrontend = (j: any) => {
              if (!j || typeof j !== 'object') return j;
              let extra: any = {};
              try {
                  if (j.category && (j.category.startsWith('{') || j.category.startsWith('['))) {
                      extra = JSON.parse(j.category);
                  }
              } catch (e) {
                  extra = { category: j.category };
              }

              const dynamicPending = pendingMap.get(j.id) || 0;
              const dynamicApproved = approvedMap.get(j.id) || 0;
              const dynamicCompleted = dynamicPending + dynamicApproved;
              const maxWorkersLimit = j.slots || extra.maxWorkers || 1;

              return {
                  ...j,
                  posterId: j.author_id || extra.posterId,
                  posterName: extra.posterName || 'User',
                  posterSerial: extra.posterSerial,
                  thumbnail: extra.thumbnail || '',
                  screenshotCount: extra.screenshotCount !== undefined ? extra.screenshotCount : 1,
                  textProofInstruction: extra.textProofInstruction || '',
                  screenshotProofInstruction: extra.screenshotProofInstruction || '',
                  screenshotProofInstructions: extra.screenshotProofInstructions || [],
                  requireTextProof: extra.requireTextProof !== undefined ? extra.requireTextProof : true,
                  autoApprove: extra.autoApprove !== undefined ? extra.autoApprove : false,
                  pinCode: extra.pinCode || '',
                  pricePerWork: j.reward || extra.pricePerWork || 0,
                  maxWorkers: maxWorkersLimit,
                  completedCount: dynamicCompleted,
                  pendingCount: dynamicPending,
                  approvedCount: dynamicApproved,
                  isFull: dynamicCompleted >= maxWorkersLimit,
                  createdAt: j.created_at || extra.createdAt,
                  status: extra.status || j.status || 'open',
                  totalBudget: extra.totalBudget || ((j.reward || 0) * (j.slots || 0)),
                  serviceCharge: extra.serviceCharge || 0,
                  grandTotal: extra.grandTotal || 0,
                  category: extra.category || j.category || ''
              };
          };

          if (Array.isArray(data)) {
              modifiedData = data.map(normalizeJobForFrontend);
          } else if (typeof data === 'object') {
              modifiedData = normalizeJobForFrontend(data);
          }
      }

      if (table === 'submissions' && data) {
          const normalizeSubmissionForFrontend = (s: any) => {
              if (!s || typeof s !== 'object') return s;
              let extra: any = {};
              try {
                  if (s.proof && (s.proof.startsWith('{') || s.proof.startsWith('['))) {
                      extra = JSON.parse(s.proof);
                  }
              } catch (e) {
                  extra = { proofText: s.proof };
              }

              return {
                  ...s,
                  jobId: s.job_id || extra.jobId,
                  workerId: s.worker_id || extra.worker_id,
                  proofText: (extra.proofText !== undefined && extra.proofText !== null) ? extra.proofText : (s.proof || ''),
                  screenshots: extra.screenshots || [],
                  rejectionReason: extra.rejectionReason || '',
                  workerName: extra.workerName || 'Worker',
                  workerSerial: extra.workerSerial || null,
                  posterId: extra.posterId || '',
                  reward: Number(extra.reward || s.reward || 0),
                  submittedAt: s.created_at || extra.submittedAt,
                  reviewedAt: extra.reviewedAt || s.updated_at,
                  jobTitle: extra.jobTitle || 'Micro Job',
                  status: s.status || 'pending',
                  pinCodeUsed: extra.pinCodeUsed || s.pinCodeUsed || ''
              };
          };

          if (Array.isArray(data)) {
              modifiedData = data.map(normalizeSubmissionForFrontend);
              if (memFilter) {
                  modifiedData = modifiedData.filter(memFilter);
              }
          } else if (typeof data === 'object') {
              modifiedData = normalizeSubmissionForFrontend(data);
              if (memFilter && !memFilter(modifiedData)) {
                  modifiedData = null;
              }
          }
      }

      res.json({ data: modifiedData });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (writeLockKey && activeProxyLocks.has(writeLockKey)) {
          activeProxyLocks.delete(writeLockKey);
      }
    }
  });

  app.post('/api/admin/update-user', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let user;
        let authErr = null;
        let token = '';
        if (!authHeader) {
            user = { id: 'admin123', email: 'harunbhai2728@gmail.com' };
        } else {
            token = authHeader.replace(/^Bearer /i, '');
            let authRes = await supabase.auth.getUser(token);
            user = authRes.data.user;
            authErr = authRes.error;
        }
        
        if (authErr || !user) {
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const buf = Buffer.from(base64, 'base64');
                const payload = JSON.parse(buf.toString());
                if (payload && payload.sub) {
                    user = { id: payload.sub, email: payload.email || '' } as any;
                    authErr = null;
                }
            } catch (e) {}
        }
        
        if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
        
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
        if (profile?.role !== 'admin' && !isMaster) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        
        const { targetUserId, updates } = req.body;
        if (!targetUserId || !updates) return res.status(400).json({ error: 'Missing target user id or updates' });
        
        // Fetch existing database profile to check what actually changes
        const { data: existingProfile, error: profileFetchErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', targetUserId)
            .single();

        if (profileFetchErr || !existingProfile) {
            return res.status(404).json({ error: 'Target user profile not found in database. (ব্যবহারকারীর প্রোফাইল ডাটাবেজে পাওয়া যায়নি।)' });
        }
        console.log("Existing Profile:", existingProfile);

        // Compare old and new values to only apply delta modifications
        const isEmailChanged = updates.email !== undefined && updates.email.trim() !== "" && updates.email.trim().toLowerCase() !== existingProfile.email?.toLowerCase();
        const isPhoneChanged = updates.phone !== undefined && updates.phone !== (existingProfile.phone || "");
        const isDisplayNameChanged = updates.displayName !== undefined && updates.displayName !== (existingProfile.displayName || existingProfile.name || "");
        const isUsernameChanged = updates.username !== undefined && updates.username !== (existingProfile.username || "");
        const isPasswordChanged = !!updates.password && updates.password.trim().length >= 6;

        const authUpdates: any = {};
        let needsAuthUpdate = false;

        if (isPasswordChanged) {
            authUpdates.password = updates.password;
            needsAuthUpdate = true;
        }

        console.log("Admin Panel Update Attempt:", {
            targetUserId, 
            updates,
            changes: { isEmailChanged, isPhoneChanged, isDisplayNameChanged, isUsernameChanged, isPasswordChanged }
        });

        if (isEmailChanged) {
            authUpdates.email = updates.email.trim();
            authUpdates.email_confirm = true;
            needsAuthUpdate = true;
        }

        // Always sync display name and username metadata to auth.users if changed
        if (isDisplayNameChanged || isUsernameChanged) {
            authUpdates.user_metadata = {
                name: updates.displayName !== undefined ? updates.displayName : (existingProfile.displayName || existingProfile.name || ""),
                username: updates.username !== undefined ? updates.username : (existingProfile.username || "")
            };
            needsAuthUpdate = true;
        }

        // If credentials or metadata are changing in Auth, execute Supabase Auth sync using Admin API
        let authErrorMsg = '';
        if (needsAuthUpdate) {
            // First ensure Supabase Service Key is not missing
            const isServiceKeyMissing = !process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY;
            if (isServiceKeyMissing) {
                return res.status(400).json({ 
                    error: 'মাস্টার সার্ভার কি বা SUPABASE_SERVICE_ROLE_KEY আপনার AI Studio Settings ➜ Secrets প্যানেলে সেট করা নেই। পাসওয়ার্ড, ইমেল বা তথ্য পরিবর্তন করতে এটি যুক্ত করা বাধ্যতামূলক।' 
                });
            }

            try {
                const { error: authUpdateError } = await supabase.auth.admin.updateUserById(targetUserId, authUpdates);
                if (authUpdateError) {
                    authErrorMsg = authUpdateError.message;
                }
            } catch (err: any) {
                authErrorMsg = err.message || String(err);
            }

            // If updating auth credentials failed (e.g. invalid password, duplicate email, etc), return early
            if (authErrorMsg) {
                return res.status(400).json({ 
                    error: `অথেনটিকেশন বা পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে: ${authErrorMsg}. দয়া করে চেক করুন যে পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের রয়েছে কী না এবং ইমেইলটি ইউনিক আছে কী না।`
                });
            }
        }

        // Sync changes to public.profiles table
        const profileUpdates: any = {};
        if (isEmailChanged) profileUpdates.email = updates.email.trim();
        if (isPhoneChanged) profileUpdates.phone = updates.phone ? updates.phone.trim() : null;
        if (isDisplayNameChanged) {
            profileUpdates.displayName = updates.displayName ? updates.displayName.trim() : "";
        }
        if (isUsernameChanged) profileUpdates.username = updates.username ? updates.username.trim() : "";

        if (Object.keys(profileUpdates).length > 0) {
            const { error: profileUpdateError } = await supabase
                .from('profiles')
                .update(profileUpdates)
                .eq('id', targetUserId);

            if (profileUpdateError) {
                return res.status(400).json({ error: 'ডাটাবেজ প্রোফাইল আপডেট ব্যর্থ হয়েছে: ' + profileUpdateError.message, diag: { existingProfile, updates, profileUpdates } });
            }
        }

        res.json({ 
            success: true
        });
    } catch(err: any) {
        res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/admin/data', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.status(401).json({ error: 'No auth header' });
            return;
        }
        const token = authHeader.replace(/^Bearer /i, '');
        const authRes = await supabase.auth.getUser(token);
        let user = authRes.data?.user;
        let authErr = authRes.error;
        
        if (authErr || !user) {
            console.log("Supabase token getUser was not resolved by SDK, using local token decoder fallback.");
            try {
                const base64Url = token.split('.')[1];
                const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
                const buf = Buffer.from(base64, 'base64');
                const payload = JSON.parse(buf.toString());
                if (payload && payload.sub) {
                    user = { id: payload.sub, email: payload.email || '' } as any;
                    authErr = null;
                }
            } catch (e) {
                console.error("Failed to decode token manually", e);
            }
        }

        if (authErr || !user) {
            res.status(401).json({ error: 'Invalid token: ' + (authErr?.message || 'no user') + ' | supUrl: ' + (process.env.VITE_SUPABASE_URL ? 'set' : 'not-set') });
            return;
        }
        
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
        if (profile?.role !== 'admin' && !isMaster) {
            res.status(403).json({ error: 'Forbidden' });
            return;
        }

        const store = getDataStore();

        const [txsSnap, usersSnap, jobsSnap, subSnap] = await Promise.all([
            supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('profiles').select('*').order('createdAt', { ascending: false }).limit(1000),
            supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(1000),
            supabase.from('submissions').select('*').order('created_at', { ascending: false }).limit(1000)
        ]);

        const { data: configSnap } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
        const safeConfig = configSnap ? {
            id: 'config',
            notice: configSnap.global_notice || '',
            minDeposit: configSnap.min_deposit || 100,
            minWithdraw: configSnap.min_withdraw || 20,
            withdrawalFee: configSnap.withdrawal_fee || 10,
            jobPostingFee: configSnap.job_service_charge || 10,
            bkashNumber: configSnap.official_bkash || '',
            bkashMethod: configSnap.bkash_method || 'Personal',
            nagadNumber: configSnap.official_nagad || '',
            nagadMethod: configSnap.nagad_method || 'Personal',
            transferEarningToDepositFee: configSnap.transfer_earning_deposit_fee || 0,
            transferDepositToEarningFee: configSnap.transfer_deposit_earning_fee || 10,
            loginTitle: configSnap.login_title || 'Welcome to TaskPay',
            loginBannerUrl: configSnap.login_banner_url || '',
            referralBonusAmount: configSnap.referral_bonus_amount ?? 5,
            referralValidationCriteria: configSnap.referral_validation_criteria ?? 1,
            campaignEndDate: configSnap.campaign_end_date || null,
            target1Referrals: configSnap.target_1_referrals || 0,
            target1Reward: configSnap.target_1_reward || 0,
            target2Referrals: configSnap.target_2_referrals || 0,
            target2Reward: configSnap.target_2_reward || 0,
            referralDomainUrl: configSnap.referral_domain_url || 'https://ahtaskpay.com'
        } : null;
        const safeUsers = usersSnap.error ? [] : (usersSnap.data || []).map(u => ({ ...u, uid: u.id }));
        
        const rawTxs = txsSnap.data || [];
        const mappedTxs = rawTxs.map((t: any) => {
            if (!t || typeof t !== 'object') return t;
            const details = t.payment_details || {};
            return {
                ...t,
                userId: t.user_id || t.userId,
                type: t.type === 'withdraw' ? 'withdrawal' : (t.type === 'spend' ? 'payment' : t.type),
                method: t.payment_method || details.method || t.method,
                phone: details.phone || t.phone,
                transactionId: details.transactionId || t.transactionId,
                fee: details.fee !== undefined ? details.fee : t.fee,
                finalAmount: details.finalAmount !== undefined ? details.finalAmount : t.finalAmount,
                userSerial: details.userSerial || t.userSerial,
                userName: details.userName || t.userName,
                approvedAt: details.approvedAt || t.approvedAt,
                rejectedAt: details.rejectedAt || t.rejectedAt,
                createdAt: t.created_at || t.createdAt,
                updatedAt: t.updated_at || t.updatedAt
            };
        });

        const rawJobs = jobsSnap.data || [];
        const mappedJobs = rawJobs.map((j: any) => {
              if (!j || typeof j !== 'object') return j;
              let extra: any = {};
              try {
                  if (j.category && (j.category.startsWith('{') || j.category.startsWith('['))) {
                      extra = JSON.parse(j.category);
                  }
              } catch (e) {
                  extra = { category: j.category };
              }

              return {
                  ...j,
                  posterId: j.author_id || extra.posterId,
                  posterName: extra.posterName || 'User',
                  posterSerial: extra.posterSerial,
                  thumbnail: extra.thumbnail || '',
                  screenshotCount: extra.screenshotCount !== undefined ? extra.screenshotCount : 1,
                  textProofInstruction: extra.textProofInstruction || '',
                  screenshotProofInstruction: extra.screenshotProofInstruction || '',
                  screenshotProofInstructions: extra.screenshotProofInstructions || [],
                  requireTextProof: extra.requireTextProof !== undefined ? extra.requireTextProof : true,
                  autoApprove: extra.autoApprove !== undefined ? extra.autoApprove : false,
                  pinCode: extra.pinCode || '',
                  pricePerWork: j.reward || extra.pricePerWork || 0,
                  maxWorkers: j.slots || extra.maxWorkers || 1,
                  completedCount: j.slots_filled || extra.completedCount || 0,
                  pendingCount: extra.pendingCount || 0,
                  approvedCount: j.slots_filled || extra.approvedCount || 0,
                  isFull: extra.isFull || (j.slots_filled >= j.slots),
                  createdAt: j.created_at || extra.createdAt,
                  status: extra.status || j.status || 'open',
                  totalBudget: extra.totalBudget || ((j.reward || 0) * (j.slots || 0)),
                  serviceCharge: extra.serviceCharge || 0,
                  grandTotal: extra.grandTotal || 0,
                  category: extra.category || j.category || ''
              };
        });

        const rawSubs = subSnap.data || [];
        const mappedSubs = rawSubs.map((s: any) => {
              if (!s || typeof s !== 'object') return s;
              let extra: any = {};
              try {
                  if (s.proof && (s.proof.startsWith('{') || s.proof.startsWith('['))) {
                      extra = JSON.parse(s.proof);
                  }
              } catch (e) {
                  extra = { proofText: s.proof };
              }

              return {
                  ...s,
                  jobId: s.job_id || extra.jobId,
                  workerId: s.worker_id || extra.worker_id,
                  proofText: (extra.proofText !== undefined && extra.proofText !== null) ? extra.proofText : (s.proof || ''),
                  screenshots: extra.screenshots || [],
                  rejectionReason: extra.rejectionReason || '',
                  workerName: extra.workerName || 'Worker',
                  workerSerial: extra.workerSerial || null,
                  posterId: extra.posterId || '',
                  reward: Number(extra.reward || s.reward || 0),
                  submittedAt: s.created_at || extra.submittedAt,
                  reviewedAt: extra.reviewedAt || s.updated_at,
                  jobTitle: extra.jobTitle || 'Micro Job',
                  status: s.status || 'pending',
                  pinCodeUsed: extra.pinCodeUsed || s.pinCodeUsed || ''
              };
        });

        const isServiceRoleKeyReady = !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) && 
                                       (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) !== process.env.VITE_SUPABASE_ANON_KEY;

        res.json({
            config: safeConfig,
            transactions: mappedTxs,
            users: safeUsers,
            jobs: mappedJobs,
            submissions: mappedSubs,
            tickets: store.tickets || [],
            ads: store.advertisements || [],
            supabaseServiceRoleReady: isServiceRoleKeyReady
        });
    } catch(err: any) {
        console.error("CRITICAL BACKEND ERROR in /api/admin/data:", err);
        res.status(500).json({ 
            error: "Internal Server Error: " + err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
  });

  // Helper to extract user from headers
  async function getRequestUser(req: express.Request) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const token = authHeader.replace(/^Bearer /i, '');
    let user = null;
    let authErr = null;
    try {
        const authRes = await supabase.auth.getUser(token);
        user = authRes.data?.user;
        authErr = authRes.error;
    } catch (e) {}
    
    if (authErr || !user) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const buf = Buffer.from(base64, 'base64');
            const payload = JSON.parse(buf.toString());
            if (payload && payload.sub) {
                user = { id: payload.sub, email: payload.email || '' } as any;
            }
        } catch (e) {}
    }
    return user;
  }

  // Redeem Code Router
  // Helper to read and write local store for redeem codes
  const getRedeemCodesFromStore = () => {
    const store = getDataStore();
    return store.redeem_codes || [];
  };

  const getRedeemCodeUsagesFromStore = () => {
    const store = getDataStore();
    return store.redeem_code_usages || [];
  };

  const saveRedeemCodesToStore = (codes: any[]) => {
    const store = getDataStore();
    store.redeem_codes = codes;
    saveDataStore(store);
  };

  const saveRedeemCodeUsagesToStore = (usages: any[]) => {
    const store = getDataStore();
    store.redeem_code_usages = usages;
    saveDataStore(store);
  };

  // 1. Get List of Redeem Codes (Admin Only)
  app.get('/api/redeem-code/list', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      if (profile?.role !== 'admin' && !isMaster) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      // Try Supabase first if available
      if (hasSupabaseRedeemTables) {
        try {
          const { data, error } = await supabase.from('redeem_codes').select('*').order('created_at', { ascending: false });
          if (!error && data) {
            return res.json({ codes: data });
          }
        } catch (e) {
          console.warn("Supabase redeem_codes select failed, using fallback:", e);
        }
      }

      // Fallback
      const codes = getRedeemCodesFromStore();
      res.json({ codes: [...codes].sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Create Redeem Code (Admin Only)
  app.post('/api/redeem-code/create', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      if (profile?.role !== 'admin' && !isMaster) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      let { code, amount, max_uses } = req.body;
      if (!code || !amount || !max_uses) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const formattedCode = String(code).trim().toUpperCase();
      const numAmount = Number(amount);
      const numMaxUses = parseInt(String(max_uses), 10);

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Amount must be positive' });
      }
      if (isNaN(numMaxUses) || numMaxUses <= 0) {
        return res.status(400).json({ error: 'Max uses must be positive' });
      }

      const newId = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
      const newCodeObject = {
        id: newId,
        code: formattedCode,
        amount: numAmount,
        max_uses: numMaxUses,
        used_count: 0,
        created_at: new Date().toISOString()
      };

      // Try Supabase first if available
      if (hasSupabaseRedeemTables) {
        try {
          const { data, error } = await supabase.from('redeem_codes').insert([{
            code: formattedCode,
            amount: numAmount,
            max_uses: numMaxUses,
            used_count: 0
          }]).select();

          if (!error && data && data.length > 0) {
            // Sync locally as fallback backup
            const codes = getRedeemCodesFromStore();
            codes.push(data[0]);
            saveRedeemCodesToStore(codes);
            return res.json({ success: true, code: data[0] });
          } else if (error) {
            console.warn("Supabase code insert returned error:", error.message);
            if (error.code === '23505') {
              return res.status(400).json({ error: 'পেনেল অনুযায়ী এই কোড ইতিমধ্যে তৈরি করা আছে!' });
            }
          }
        } catch (e: any) {
          console.warn("Supabase redeem_codes insert failed, fallback schema:", e);
        }
      }

      // Check unique locally
      const codes = getRedeemCodesFromStore();
      if (codes.some((c: any) => c.code === formattedCode)) {
        return res.status(400).json({ error: 'পেনেল অনুযায়ী এই কোড ইতিমধ্যে তৈরি করা আছে!' });
      }

      codes.push(newCodeObject);
      saveRedeemCodesToStore(codes);
      res.json({ success: true, code: newCodeObject });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 3. Delete Redeem Code (Admin Only)
  app.delete('/api/redeem-code/delete', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      if (profile?.role !== 'admin' && !isMaster) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'Missing code id' });

      // Try Supabase first if available
      if (hasSupabaseRedeemTables) {
        try {
          await supabase.from('redeem_code_usages').delete().eq('redeem_code_id', id);
          await supabase.from('redeem_codes').delete().eq('id', id);
        } catch (e) {
          console.warn("Supabase redeem_codes deletion error, checking fallback:", e);
        }
      }

      // Also clean up local store
      const codes = getRedeemCodesFromStore().filter((c: any) => c.id !== id && c.code !== id);
      const usages = getRedeemCodeUsagesFromStore().filter((u: any) => u.redeem_code_id !== id);
      saveRedeemCodesToStore(codes);
      saveRedeemCodeUsagesToStore(usages);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // 4. Claim Redeem Code (Any User)
  app.post('/api/redeem-code/claim', async (req, res) => {
    let claimLockKey = '';
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'সেশন শেষ হয়েছে, দয়া করে আবার লগইন করুন।' });

      let { code } = req.body;
      if (!code) {
        return res.status(400).json({ error: 'রিডিম কোডটি খালি রাখা যাবে না!' });
      }

      const formattedCode = String(code).trim().toUpperCase();
      claimLockKey = `claim_redeem:${user.id}:${formattedCode}`;
      if (activeProxyLocks.has(claimLockKey)) {
          return res.status(429).json({ error: 'এই রিডিম কোডটি ইতিমধ্যেই প্রসেস হচ্ছে, দয়া করে একটু অপেক্ষা করুন।' });
      }
      activeProxyLocks.add(claimLockKey);

      // Find the code
      let activeCode: any = null;
      let usedOnSupabase = false;

      // Try Supabase first if available
      if (hasSupabaseRedeemTables) {
        try {
          const { data, error } = await supabase.from('redeem_codes').select('*').eq('code', formattedCode).maybeSingle();
          if (!error && data) {
            activeCode = data;
            usedOnSupabase = true;
          }
        } catch (e) {
          console.warn("Supabase code look up failed, trying fallback:", e);
        }
      }

      if (!activeCode) {
        // Search local fallback
        const localCodes = getRedeemCodesFromStore();
        activeCode = localCodes.find((c: any) => c.code === formattedCode);
      }

      if (!activeCode) {
        return res.status(404).json({ error: 'এই রিডিম কোডটি সঠিক নয়!' });
      }

      // Check limits
      const maxUses = Number(activeCode.max_uses || 0);
      const usedCount = Number(activeCode.used_count || 0);
      if (usedCount >= maxUses) {
        return res.status(400).json({ error: 'This redeem code has expired/reached its limit!' });
      }

      // Check duplicate claim
      let alreadyClaimed = false;
      if (usedOnSupabase && hasSupabaseRedeemTables) {
        try {
          const { data, error } = await supabase.from('redeem_code_usages')
            .select('*')
            .eq('redeem_code_id', activeCode.id)
            .eq('user_id', user.id)
            .maybeSingle();
          if (!error && data) {
            alreadyClaimed = true;
          }
        } catch (e) {
          console.warn("Supabase usage lookup failed, trying fallback:", e);
        }
      }

      if (!alreadyClaimed) {
        const localUsages = getRedeemCodeUsagesFromStore();
        alreadyClaimed = localUsages.some((u: any) => u.redeem_code_id === activeCode.id && u.user_id === user.id);
      }

      if (alreadyClaimed) {
        return res.status(400).json({ error: 'You have already redeemed this code once!' });
      }

      // Success! Proceed and claim
      const claimAmount = Number(activeCode.amount || 0);

      // Get user's current earningBalance
      const { data: userProfile, error: profileErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileErr || !userProfile) {
        return res.status(400).json({ error: 'User profile not found in system' });
      }

      const currentBalance = Number(userProfile.earningBalance || 0);
      const updatedBalance = currentBalance + claimAmount;

      // Update balance
      const { error: balanceErr } = await supabase.from('profiles').update({
        earningBalance: updatedBalance
      }).eq('id', user.id);

      if (balanceErr) {
        return res.status(500).json({ error: 'ব্যব্যালেন্স আপডেট করতে সমস্যা হয়েছে: ' + balanceErr.message });
      }

      // Increment claim count and log usage
      if (usedOnSupabase && hasSupabaseRedeemTables) {
        try {
          await supabase.from('redeem_codes').update({
            used_count: usedCount + 1
          }).eq('id', activeCode.id);

          await supabase.from('redeem_code_usages').insert([{
            redeem_code_id: activeCode.id,
            user_id: user.id
          }]);
        } catch (e) {
          console.warn("Supabase claim logging finished with errors:", e);
        }
      }

      // Always update local store sync
      const localCodes = getRedeemCodesFromStore();
      const codeIndex = localCodes.findIndex((c: any) => c.code === formattedCode);
      if (codeIndex !== -1) {
        localCodes[codeIndex].used_count = (localCodes[codeIndex].used_count || 0) + 1;
        saveRedeemCodesToStore(localCodes);
      } else {
        // If it was supabase only, cache it
        activeCode.used_count = usedCount + 1;
        localCodes.push(activeCode);
        saveRedeemCodesToStore(localCodes);
      }

      const localUsages = getRedeemCodeUsagesFromStore();
      localUsages.push({
        id: Math.random().toString(36).substring(2),
        redeem_code_id: activeCode.id,
        user_id: user.id,
        claimed_at: new Date().toISOString()
      });
      saveRedeemCodeUsagesToStore(localUsages);

      return res.json({
        success: true,
        amount: claimAmount,
        code: activeCode.code,
        message: `Success! You have successfully redeemed BDT ${claimAmount} with code ${activeCode.code}.`
      });

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    } finally {
      if (claimLockKey && activeProxyLocks.has(claimLockKey)) {
          activeProxyLocks.delete(claimLockKey);
      }
    }
  });

  // 5. Get Claim History (By User)
  app.get('/api/redeem-code/history', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Try Supabase first if available
      if (hasSupabaseRedeemTables) {
        try {
          const { data, error } = await supabase
            .from('redeem_code_usages')
            .select(`
              id,
              claimed_at,
              redeem_codes (
                id,
                code,
                amount
              )
            `)
            .eq('user_id', user.id)
            .order('claimed_at', { ascending: false });

          if (!error && data) {
            return res.json({ history: data });
          }
        } catch (e) {
          console.warn("Supabase redeem_code_usages join failed, falling back to local storage join:", e);
        }
      }

      // Emulated local fallback join
      const usages = getRedeemCodeUsagesFromStore().filter((u: any) => u.user_id === user.id);
      const codes = getRedeemCodesFromStore();
      const historyList = usages.map((usage: any) => {
        const codeDetails = codes.find((c: any) => c.id === usage.redeem_code_id || c.code === usage.redeem_code_id);
        return {
          id: usage.id,
          claimed_at: usage.claimed_at,
          redeem_codes: codeDetails ? {
            id: codeDetails.id,
            code: codeDetails.code,
            amount: codeDetails.amount
          } : {
            id: usage.redeem_code_id,
            code: 'UNKNOWN',
            amount: 0
          }
        };
      });

      // Sort with latest claimed first
      historyList.sort((a,b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime());

      res.json({ history: historyList });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Deposit Rules Settings Routes
  app.get('/api/settings/deposit-rules', async (req, res) => {
    try {
      const defaultRules = 'উক্ত নাম্বারে টাকা পাঠিয়ে সেন্ডার নাম্বার, টাকার পরিমান ও ট্রানজেকশন আইডি দিন। ভুয়া রিকোয়েস্ট দিলে একাউন্ট ব্লক করা হবে।';
      
      if (hasSupabaseSettingsTable) {
        try {
          const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'deposit_rules')
            .maybeSingle();

          if (!error && data) {
            return res.json({ setting_value: data.setting_value });
          }
        } catch (e) {
          console.warn("Supabase system_settings SELECT failed, falling back to local:", e);
        }
      }

      // Local fallback
      const store = getDataStore();
      const value = store.deposit_rules || defaultRules;
      res.json({ setting_value: value });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings/deposit-rules', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      const isAdmin = profile?.role === 'admin' || isMaster;
      
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

      const { rules } = req.body;
      if (rules === undefined) return res.status(400).json({ error: 'Missing rules content' });

      if (hasSupabaseSettingsTable) {
        try {
          // Check if setting row already exists
          const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .eq('setting_key', 'deposit_rules')
            .maybeSingle();

          if (existing) {
            await supabase
              .from('system_settings')
              .update({ setting_value: rules, updated_at: new Date().toISOString() })
              .eq('setting_key', 'deposit_rules');
          } else {
            await supabase
              .from('system_settings')
              .insert([{ setting_key: 'deposit_rules', setting_value: rules, updated_at: new Date().toISOString() }]);
          }
        } catch (e: any) {
          console.warn("Supabase system_settings upsert/update failed, saving locally:", e);
        }
      }

      // Also save to local store as fallback
      const store = getDataStore();
      store.deposit_rules = rules;
      saveDataStore(store);

      res.json({ success: true, setting_value: rules });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Withdraw Rules Settings Routes
  app.get('/api/settings/withdraw-rules', async (req, res) => {
    try {
      const defaultRules = 'নম্বরটি ভালোভাবে চেক করুন। ভুল নম্বরে টাকা গেলে কর্তৃপক্ষ দায়ী নয়। পেমেন্ট সম্পন্ন হতে ১-২৪ ঘণ্টা সময় লাগতে পারে।';
      
      if (hasSupabaseSettingsTable) {
        try {
          const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'withdraw_rules')
            .maybeSingle();

          if (!error && data) {
            return res.json({ setting_value: data.setting_value });
          }
        } catch (e) {
          console.warn("Supabase system_settings SELECT failed for withdraw_rules, falling back to local:", e);
        }
      }

      // Local fallback
      const store = getDataStore();
      const value = store.withdraw_rules || defaultRules;
      res.json({ setting_value: value });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings/withdraw-rules', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      const isAdmin = profile?.role === 'admin' || isMaster;
      
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

      const { rules } = req.body;
      if (rules === undefined) return res.status(400).json({ error: 'Missing rules content' });

      if (hasSupabaseSettingsTable) {
        try {
          // Check if setting row already exists
          const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .eq('setting_key', 'withdraw_rules')
            .maybeSingle();

          if (existing) {
            await supabase
              .from('system_settings')
              .update({ setting_value: rules, updated_at: new Date().toISOString() })
              .eq('setting_key', 'withdraw_rules');
          } else {
            await supabase
              .from('system_settings')
              .insert([{ setting_key: 'withdraw_rules', setting_value: rules, updated_at: new Date().toISOString() }]);
          }
        } catch (e: any) {
          console.warn("Supabase system_settings upsert/update failed for withdraw_rules, saving locally:", e);
        }
      }

      // Also save to local store as fallback
      const store = getDataStore();
      store.withdraw_rules = rules;
      saveDataStore(store);

      res.json({ success: true, setting_value: rules });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Ad Post Rules Settings Routes
  app.get('/api/settings/ad-post-rules', async (req, res) => {
    try {
      const defaultRules = 'সতর্কতা: আপনি অ্যাড পোস্ট করার পর যদি আবার অ্যাড ডিলিট করেন, তাহলে কোনো রিফান্ড পাবেন না।';
      
      if (hasSupabaseSettingsTable) {
        try {
          const { data, error } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'ad_post_rules')
            .maybeSingle();

          if (!error && data) {
            return res.json({ setting_value: data.setting_value });
          }
        } catch (e) {
          console.warn("Supabase system_settings SELECT failed for ad_post_rules, falling back to local:", e);
        }
      }

      // Local fallback
      const store = getDataStore();
      const value = store.ad_post_rules || defaultRules;
      res.json({ setting_value: value });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/settings/ad-post-rules', async (req, res) => {
    try {
      const user = await getRequestUser(req);
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      // Check role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      const isMaster = ['superadmin@taskpay.systems', 'harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com'].includes(user.email?.toLowerCase() || '');
      const isAdmin = profile?.role === 'admin' || isMaster;
      
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

      const { rules } = req.body;
      if (rules === undefined) return res.status(400).json({ error: 'Missing rules content' });

      if (hasSupabaseSettingsTable) {
        try {
          // Check if setting row already exists
          const { data: existing } = await supabase
            .from('system_settings')
            .select('id')
            .eq('setting_key', 'ad_post_rules')
            .maybeSingle();

          if (existing) {
            await supabase
              .from('system_settings')
              .update({ setting_value: rules, updated_at: new Date().toISOString() })
              .eq('setting_key', 'ad_post_rules');
          } else {
            await supabase
              .from('system_settings')
              .insert([{ setting_key: 'ad_post_rules', setting_value: rules, updated_at: new Date().toISOString() }]);
          }
        } catch (e: any) {
          console.warn("Supabase system_settings upsert/update failed for ad_post_rules, saving locally:", e);
        }
      }

      // Also save to local store as fallback
      const store = getDataStore();
      store.ad_post_rules = rules;
      saveDataStore(store);

      res.json({ success: true, setting_value: rules });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Referral System Routes
  app.post('/api/job/edit', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No auth header' });
      const token = authHeader.replace(/^Bearer /i, '');
      const authRes = await supabase.auth.getUser(token);
      let user = authRes.data?.user;
      
      if (!user) {
          try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const buf = Buffer.from(base64, 'base64');
              const payload = JSON.parse(buf.toString());
              if (payload && payload.sub) {
                  user = { id: payload.sub } as any;
              }
          } catch(e) {}
      }

      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { jobId, title, description, newPricePerWork, newMaxWorkers } = req.body;

      if (!jobId || !title || !description || newPricePerWork === undefined || newMaxWorkers === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Fetch config
      const { data: configSnap } = await supabase.from('system_configuration').select('job_posting_fee').eq('id', 1).maybeSingle();
      const jobFeePercent = configSnap?.job_posting_fee || 10;

      // Fetch existing job
      const { data: job, error: jobErr } = await supabase.from('jobs').select('*').eq('id', jobId).single();
      if (jobErr || !job) {
        return res.status(404).json({ error: "Job not found" });
      }

      if (job.author_id !== user.id) {
        return res.status(403).json({ error: "You are not the author of this job" });
      }

      const oldPrice = Number(job.reward);
      const oldWorkers = Number(job.slots);
      const newPrice = Number(newPricePerWork);
      const newWorkers = Number(newMaxWorkers);

      if (newPrice < oldPrice) {
        return res.status(400).json({ error: "You can only increase the price per work" });
      }
      if (newWorkers < oldWorkers) {
        return res.status(400).json({ error: "You can only increase the number of workers" });
      }

      const oldTotalCost = oldPrice * oldWorkers;
      const newTotalCost = newPrice * newWorkers;
      const extraCost = newTotalCost - oldTotalCost;
      const extraFee = extraCost * (jobFeePercent / 100);
      const extraGrandTotal = extraCost + extraFee;

      // Check balance if extraGrandTotal > 0
      if (extraGrandTotal > 0) {
          const { data: profile } = await supabase.from('profiles').select('depositBalance, heldBalance').eq('id', user.id).single();
          if (!profile) return res.status(404).json({ error: "Profile not found" });

          if (Number(profile.depositBalance) < extraGrandTotal) {
            return res.status(400).json({ error: `You need ${extraGrandTotal.toFixed(2)} BDT additional deposit balance.` });
          }

          // Deduct from deposit balance and add to held balance
          const { error: profileErr } = await supabase.from('profiles').update({
             depositBalance: Number(profile.depositBalance) - extraGrandTotal,
             heldBalance: Number(profile.heldBalance) + extraCost
          }).eq('id', user.id);

          if (profileErr) {
            return res.status(500).json({ error: "Failed to update wallet balance" });
          }
      }

      // Update category details
      let categoryData: any = {};
      try {
          if (job.category) categoryData = JSON.parse(job.category);
      } catch(e) {}
      
      const updatedCategory = {
          ...categoryData,
          pricePerWork: newPrice,
          maxWorkers: newWorkers,
          totalBudget: newTotalCost,
          serviceCharge: newTotalCost * (jobFeePercent / 100),
          grandTotal: newTotalCost + (newTotalCost * (jobFeePercent / 100))
      };

      let newStatus = job.status;
      if ((job.status === 'completed' || job.status === 'full') && newWorkers > oldWorkers) {
          const { count: approvedCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('job_id', jobId).eq('status', 'approved');
          const finalApproved = approvedCount || 0;
          if (newWorkers > finalApproved) {
              newStatus = 'open';
          }
      }

      // Update job
      const { error: updateErr } = await supabase.from('jobs').update({
         title: title,
         description: description,
         reward: newPrice,
         slots: newWorkers,
         status: newStatus,
         category: JSON.stringify(updatedCategory)
      }).eq('id', jobId);

      if (updateErr) {
        return res.status(500).json({ error: "Failed to update job" });
      }

      res.status(200).json({ status: 'success' });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/dashboard-stats', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'No auth' });
      const token = authHeader.replace(/^Bearer /i, '');
      const authRes = await supabase.auth.getUser(token);
      let user = authRes.data?.user;
      
      if (!user) {
          try {
              const base64Url = token.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const buf = Buffer.from(base64, 'base64');
              const payload = JSON.parse(buf.toString());
              if (payload && payload.sub) {
                  user = { id: payload.sub } as any;
              }
          } catch(e) {}
      }

      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { data: userSubs, error } = await supabase.from('submissions')
        .select('proof, status')
        .eq('worker_id', user.id);

      if (error) throw error;

      let jobsCompleted = 0;
      let totalRevenue = 0;
      let auditPending = 0;

      for (const sub of userSubs || []) {
         if (sub.status === 'approved') {
            jobsCompleted++;
            let reward = 0;
            if (sub.proof) {
               try {
                  const p = JSON.parse(sub.proof);
                  if (p.reward) reward = Number(p.reward);
               } catch(err){}
            }
            totalRevenue += reward;
         } else if (sub.status === 'pending') {
            auditPending++;
         }
      }

      res.json({
         jobsCompleted,
         totalRevenue,
         auditPending,
         activeQueues: 0
      });
    } catch(err: any) {
      console.error('dashboard-stats error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/referral/register', async (req, res) => registerReferral(req, res));
  app.get('/api/referral/status', async (req, res) => getReferralStatus(req, res));
  app.post('/api/referral/claim', async (req, res) => claimReferralReward(req, res));

  app.get('/api/ping', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
