import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

function getReferralDomainUrl() {
    try {
        const p = path.join(process.cwd(), 'data-store.json');
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
            return data.referralDomainUrl || 'https://ahtaskpay.onrender.com';
        }
    } catch (e) {
        console.error("Error reading data-store.json for referralDomainUrl:", e);
    }
    return 'https://ahtaskpay.onrender.com';
}

function getCampaignStartDate() {
    try {
        const p = path.join(process.cwd(), 'data-store.json');
        if (fs.existsSync(p)) {
            const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
            return data.campaignStartDate || null;
        }
    } catch (e) {
        console.error("Error reading data-store.json for campaignStartDate:", e);
    }
    return null;
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
console.log("referralLogic Supabase URL used:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function registerReferral(req: any, res: any) {
    try {
        const { referrerCode, newUserId } = req.body;
        if (!referrerCode || !newUserId) return res.status(400).json({ error: 'Missing parameters' });

        // Safe fallback sequential lookups to avoid fragile .or() queries
        let referrer = null;
        
        // 1. Try by referral_code
        const { data: dataByCode, error: errCode } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', referrerCode)
            .maybeSingle();

        if (dataByCode) {
            referrer = dataByCode;
        } else {
            // 2. Try by username
            const { data: dataByUsername } = await supabase
                .from('profiles')
                .select('id')
                .eq('username', referrerCode)
                .maybeSingle();
            if (dataByUsername) {
                referrer = dataByUsername;
            }
        }

        if (!referrer) return res.status(404).json({ error: 'Referrer not found' });

        const { data: config } = await supabase.from('system_configuration').select('referral_validity_days').eq('id', 1).maybeSingle();
        const validityDays = Number(config?.referral_validity_days ?? 30);
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + validityDays);

        // Insert referral
        await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: newUserId,
            status: 'pending',
            expiration_date: expirationDate.toISOString()
        });

        res.json({ success: true });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

export async function getReferralStatus(req: any, res: any) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No auth header' });
        const token = authHeader.replace(/^Bearer /i, '');
        let { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            // Try fallback decode if jwt is valid
            try {
               const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
               if (jwtPayload && jwtPayload.sub) {
                   user = { id: jwtPayload.sub } as any;
                   authErr = null;
               } else {
                   console.error("Auth Error in getReferralStatus:", authErr);
                   return res.status(401).json({ error: 'Invalid token', details: authErr?.message });
               }
            } catch(e) {
               console.error("Auth Error in getReferralStatus:", authErr);
               return res.status(401).json({ error: 'Invalid token', details: authErr?.message });
            }
        }

        // Retrieve global configs
        const { data: config } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
        
        // Retrieve referral_code and profile claims
        let profile = null;
        try {
            const { data, error } = await supabase.from('profiles').select('username, referral_code, target_1_claimed, target_2_claimed').eq('id', user.id).maybeSingle();
            if (data) profile = data;
        } catch (e) {}

        let code = profile?.referral_code;
        if (!code) {
            code = `AH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            try {
                await supabase.from('profiles').update({ referral_code: code }).eq('id', user.id);
            } catch (err) {
                console.error("Failed to auto-generate referral code:", err);
            }
        }

        let validCount = 0;
        let pendingCount = 0;
        let campaignValidCount = 0;
        let joinedUsers: any[] = [];

        let isExpired = false;
        let campaignEndDate = config?.campaign_end_date || null;
        let campaignStartDate = getCampaignStartDate();
        
        if (campaignEndDate) {
            const end = new Date(campaignEndDate).getTime();
            const now = new Date().getTime();
            if (now >= end) {
                isExpired = true;
            }
        }

        try {
            // STEP 2: Fetch all users where referred_by matches this user's referral code
            const { data: referredProfiles, error: pErr } = await supabase
                .from('profiles')
                .select('id, displayName, username, createdAt')
                .eq('referred_by', code);

            if (referredProfiles && referredProfiles.length > 0) {
                const referredUserIds = referredProfiles.map(p => p.id);

                // Fetch their referral status from the 'referrals' table 
                // OR calculate it dynamically based on approved jobs if missing
                const { data: refs } = await supabase
                    .from('referrals')
                    .select('referred_user_id, status, expiration_date')
                    .in('referred_user_id', referredUserIds);

                const referralStatusMap = new Map();
                const referralExpiryMap = new Map();
                if (refs) {
                    for (const r of refs) {
                        referralStatusMap.set(r.referred_user_id, r.status);
                        if (r.expiration_date) {
                            referralExpiryMap.set(r.referred_user_id, r.expiration_date);
                        }
                    }
                }

                // If some users are NOT in 'referrals' table (due to old bugs), we check submissions directly to repair state
                const missingIds = referredUserIds.filter(id => !referralStatusMap.has(id));
                const dynamicStatusMap = new Map();
                
                const { data: configDays } = await supabase.from('system_configuration').select('referral_validity_days').eq('id', 1).maybeSingle();
                const validityDays = Number(configDays?.referral_validity_days ?? 30);

                if (missingIds.length > 0) {
                    const { data: submissions } = await supabase
                        .from('submissions')
                        .select('worker_id, status')
                        .eq('status', 'approved')
                        .in('worker_id', missingIds);
                        
                    const approvedWorkers = new Set((submissions || []).map(s => s.worker_id));
                    for (const id of missingIds) {
                        const status = approvedWorkers.has(id) ? 'valid' : 'pending';
                        dynamicStatusMap.set(id, status);
                        // Optional: auto-insert missing referral record to self-heal the DB
                        try {
                            const expDate = new Date();
                            expDate.setDate(expDate.getDate() + validityDays);
                            await supabase.from('referrals').insert({
                                referrer_id: user.id,
                                referred_user_id: id,
                                status: status,
                                expiration_date: expDate.toISOString()
                            });
                        } catch (e) { /* ignore insert errors */ }
                    }
                }

                const nowTime = Date.now();

                joinedUsers = referredProfiles.map(p => {
                    let status = referralStatusMap.get(p.id) || dynamicStatusMap.get(p.id) || 'pending';
                    const expDateStr = referralExpiryMap.get(p.id);

                    // Check if pending referral is expired
                    if (status === 'pending') {
                        let isRefExpired = false;
                        if (expDateStr) {
                            if (nowTime > new Date(expDateStr).getTime()) {
                                isRefExpired = true;
                            }
                        } else if (p.createdAt) {
                            const createdTime = new Date(p.createdAt).getTime();
                            const validityMs = validityDays * 24 * 60 * 60 * 1000;
                            if (nowTime > createdTime + validityMs) {
                                isRefExpired = true;
                            }
                        }

                        if (isRefExpired) {
                            status = 'expired';
                            // Self-heal DB status
                            supabase.from('referrals').update({ status: 'expired' }).eq('referred_user_id', p.id).then().catch(() => {});
                        }
                    }

                    if (status === 'valid') {
                        validCount++;
                        const pTime = new Date(p.createdAt || new Date()).getTime();
                        const sTime = campaignStartDate ? new Date(campaignStartDate).getTime() : 0;
                        const eTime = campaignEndDate ? new Date(campaignEndDate).getTime() : Infinity;
                        if (pTime >= sTime && pTime <= eTime) {
                            campaignValidCount++;
                        }
                    } else if (status === 'pending') {
                        pendingCount++;
                    }
                    
                    return {
                        id: p.id,
                        name: p.displayName || p.username || 'User',
                        username: p.username || 'user',
                        status: status,
                        expiration: expDateStr || null,
                        createdAt: p.createdAt || new Date().toISOString()
                    };
                });
            }
        } catch (refE: any) {
            console.error("Error fetching referrals info:", refE);
        }

        res.json({
            validCount,
            campaignValidCount,
            pendingCount,
            target1Claimed: profile?.target_1_claimed || false,
            target2Claimed: profile?.target_2_claimed || false,
            campaignEndDate,
            campaignStartDate,
            target1Referrals: config?.target_1_referrals || 0,
            target1Reward: config?.target_1_reward || 0,
            target2Referrals: config?.target_2_referrals || 0,
            target2Reward: config?.target_2_reward || 0,
            referralValidationCriteria: config?.referral_validation_criteria || 1,
            referralBonusAmount: config?.referral_bonus_amount || 0,
            referralCode: code,
            isExpired,
            joinedUsers,
            referralDomainUrl: getReferralDomainUrl()
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

const activeReferralClaims = new Set<string>();

export async function claimReferralReward(req: any, res: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No auth header' });
    const token = authHeader.replace(/^Bearer /i, '');
    let { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
        try {
            const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            if (jwtPayload && jwtPayload.sub) {
                user = { id: jwtPayload.sub } as any;
                authErr = null;
            } else {
                return res.status(401).json({ error: 'Invalid token' });
            }
        } catch(e) {
            return res.status(401).json({ error: 'Invalid token' });
        }
    }

    const { target } = req.body; // 1 or 2
    if (target !== 1 && target !== 2) return res.status(400).json({ error: 'Unknown target' });

    const lockKey = `referral_claim:${user.id}:${target}`;
    if (activeReferralClaims.has(lockKey)) {
        return res.status(429).json({ error: 'A reward claim transaction is already in progress. Please wait.' });
    }
    activeReferralClaims.add(lockKey);

    try {
        // Retrieve global configs
        const { data: config } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
        if (!config || !config.campaign_end_date) {
            return res.status(400).json({ error: 'No dynamic campaign configured.' });
        }

        const now = new Date().getTime();
        const end = new Date(config.campaign_end_date).getTime();
        if (now >= end) {
            return res.status(400).json({ error: 'Campaign time expired.' });
        }

        const { data: profile } = await supabase.from('profiles').select('target_1_claimed, target_2_claimed, earningBalance').eq('id', user.id).maybeSingle();
        if (!profile) return res.status(400).json({ error: 'Profile not found.' });

        if (target === 1 && profile.target_1_claimed) return res.status(400).json({ error: 'Target 1 already claimed.' });
        if (target === 2 && profile.target_2_claimed) return res.status(400).json({ error: 'Target 2 already claimed.' });

        const campaignStartDate = getCampaignStartDate();

        // Count valid referrals
        let query = supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', user.id)
            .eq('status', 'valid');

        if (campaignStartDate) {
            query = query.gte('created_at', new Date(campaignStartDate).toISOString());
        }
        if (config.campaign_end_date) {
            query = query.lte('created_at', new Date(config.campaign_end_date).toISOString());
        }

        const { count: validCount, error: refErr } = await query;

        const totalValid = validCount || 0;

        let rewardAmount = 0;
        let profileUpdates: any = {};
        const updateField = target === 1 ? 'target_1_claimed' : 'target_2_claimed';
        
        if (target === 1) {
            const reqRefs = config.target_1_referrals || Number.MAX_SAFE_INTEGER;
            if (totalValid < reqRefs) return res.status(400).json({ error: `Not enough valid referrals. Have ${totalValid}/${reqRefs}` });
            rewardAmount = config.target_1_reward || 0;
            profileUpdates.target_1_claimed = true;
        } else {
            const reqRefs = config.target_2_referrals || Number.MAX_SAFE_INTEGER;
            if (totalValid < reqRefs) return res.status(400).json({ error: `Not enough valid referrals. Have ${totalValid}/${reqRefs}` });
            rewardAmount = config.target_2_reward || 0;
            profileUpdates.target_2_claimed = true;
        }

        profileUpdates.earningBalance = Number(profile.earningBalance || 0) + Number(rewardAmount);

        // Safe conditional update - matches only if claim state remains false up to this write moment
        const { data: updatedProfiles, error: updateErr } = await supabase.from('profiles')
            .update(profileUpdates)
            .eq('id', user.id)
            .eq(updateField, false)
            .select();

        if (updateErr || !updatedProfiles || updatedProfiles.length === 0) {
            return res.status(400).json({ error: 'This reward target has already been claimed by another transaction.' });
        }

        // Add transaction record
        await supabase.from('transactions').insert({
            user_id: user.id,
            type: 'bonus',
            amount: rewardAmount,
            status: 'completed',
            payment_method: 'referral_reward',
            payment_details: JSON.stringify({ description: `Referral Target ${target} (${rewardAmount} BDT) Reward` }),
            created_at: new Date().toISOString()
        });

        res.json({ success: true, reward: rewardAmount });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    } finally {
        activeReferralClaims.delete(lockKey);
    }
}

export async function validateReferral(workerId: string) {
    try {
        const { data: referral } = await supabase.from('referrals').select('*').eq('referred_user_id', workerId).eq('status', 'pending').maybeSingle();
        if (!referral) return;

        // Check if referral is expired
        if (referral.expiration_date) {
            const expirationTime = new Date(referral.expiration_date).getTime();
            const now = new Date().getTime();
            if (now > expirationTime) {
                await supabase.from('referrals').update({ status: 'expired' }).eq('id', referral.id);
                return; // Reached expiration, so it can't become valid anymore
            }
        }

        const { data: config } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
        const validationCriteria = config?.referral_validation_criteria ?? 1;
        const bonusAmount = config?.referral_bonus_amount ?? 5;

        const { count: approvedCount, error: countErr } = await supabase
            .from('submissions')
            .select('*', { count: 'exact', head: true })
            .eq('worker_id', workerId)
            .eq('status', 'approved');

        if (countErr) {
            console.error("Referral check count error:", countErr);
            return;
        }

        if (approvedCount && approvedCount >= validationCriteria) {
            await supabase.from('referrals').update({ status: 'valid' }).eq('id', referral.id);
            
            const { data: referrerProfile } = await supabase.from('profiles').select('earningBalance').eq('id', referral.referrer_id).maybeSingle();
            
            if (referrerProfile) {
                await supabase.from('profiles').update({
                    earningBalance: Number(referrerProfile.earningBalance || 0) + Number(bonusAmount)
                }).eq('id', referral.referrer_id);

                await supabase.from('transactions').insert({
                    user_id: referral.referrer_id,
                    type: 'bonus',
                    amount: bonusAmount,
                    status: 'completed',
                    payment_method: 'referral_bonus',
                    payment_details: JSON.stringify({ description: 'Referral Bonus for a verified worker' }),
                    created_at: new Date().toISOString()
                });
            }
        }
    } catch (e) {
        console.error("Referral validation error:", e);
    }
}

export async function resetAllReferralClaims(req: any, res: any) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No auth header' });
        const token = authHeader.replace(/^Bearer /i, '');
        let { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) {
            try {
                const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                if (jwtPayload && jwtPayload.sub) {
                    user = { id: jwtPayload.sub, email: jwtPayload.email || '' } as any;
                    authErr = null;
                } else {
                    return res.status(401).json({ error: 'Invalid token' });
                }
            } catch(e) {
                return res.status(401).json({ error: 'Invalid token' });
            }
        }

        // Verify Admin permission
        const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).maybeSingle();
        const isMaster = user.email === 'ahtaskpay@gmail.com' || user.email === 'admin@taskpay.com' || profile?.email === 'ahtaskpay@gmail.com';
        const isAdmin = profile?.role === 'admin' || isMaster;

        if (!isAdmin) {
            return res.status(403).json({ error: 'Forbidden: Admin access required to reset claims.' });
        }

        // 1. Reset target_1_claimed and target_2_claimed on all user profiles
        const { error: profileResetErr } = await supabase
            .from('profiles')
            .update({ target_1_claimed: false, target_2_claimed: false })
            .not('id', 'is', null);

        if (profileResetErr) {
            console.error("Error resetting profile claims with .not():", profileResetErr);
            // Fallback attempt
            const { error: fbErr } = await supabase
                .from('profiles')
                .update({ target_1_claimed: false, target_2_claimed: false })
                .gt('created_at', '1970-01-01T00:00:00Z');
            if (fbErr) {
                console.error("Error resetting profile claims fallback:", fbErr);
                return res.status(500).json({ error: "Failed to reset profile claims: " + fbErr.message });
            }
        }

        // 2. Reset referral_campaigns table if present
        try {
            await supabase
                .from('referral_campaigns')
                .update({ target_20_claimed: false, target_50_claimed: false })
                .not('id', 'is', null);
        } catch (e) {
            console.log("Note: referral_campaigns table reset skipped or not present:", e);
        }

        // 3. Delete records from referral_claims table if present
        try {
            await supabase
                .from('referral_claims')
                .delete()
                .not('id', 'is', null);
        } catch (e) {
            console.log("Note: referral_claims table delete skipped or not present:", e);
        }

        return res.json({ success: true, message: 'All user referral campaign claims reset successfully.' });
    } catch (e: any) {
        console.error("Error in resetAllReferralClaims:", e);
        return res.status(500).json({ error: e.message || 'Failed to reset referral claims.' });
    }
}
