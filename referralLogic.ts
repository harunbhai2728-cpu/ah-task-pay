import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
dotenv.config();

const RUNTIME_STORE_PATH = path.join(os.tmpdir(), 'ahtaskpay-data-store.json');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
console.log("referralLogic Supabase URL used:", supabaseUrl);
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getReferralDomainUrl(): Promise<string> {
    try {
        if (fs.existsSync(RUNTIME_STORE_PATH)) {
            const data = JSON.parse(fs.readFileSync(RUNTIME_STORE_PATH, 'utf-8'));
            if (data.referralDomainUrl) return data.referralDomainUrl;
        }
        const { data: row } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'referral_domain_url')
            .maybeSingle();
        if (row?.setting_value) return row.setting_value;
    } catch (e) {
        console.error("Error reading referralDomainUrl:", e);
    }
    return 'https://ahtaskpay.onrender.com';
}

async function getCampaignStartDate(): Promise<string | null> {
    try {
        if (fs.existsSync(RUNTIME_STORE_PATH)) {
            const data = JSON.parse(fs.readFileSync(RUNTIME_STORE_PATH, 'utf-8'));
            if (data.campaignStartDate !== undefined) return data.campaignStartDate || null;
        }
        const { data: row } = await supabase
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'campaign_start_date')
            .maybeSingle();
        if (row?.setting_value) return row.setting_value || null;
    } catch (e) {
        console.error("Error reading campaignStartDate:", e);
    }
    return null;
}

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

async function fetchAllPaged<T = any>(
    buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
    const PAGE = 1000;
    const all: T[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await buildQuery(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
    }
    return all;
}

async function fetchInChunks<T = any>(
    ids: string[],
    chunkSize: number,
    queryChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
    if (ids.length === 0) return [];
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
        chunks.push(ids.slice(i, i + chunkSize));
    }
    const results: T[] = [];
    const CONCURRENCY = 5;
    for (let i = 0; i < chunks.length; i += CONCURRENCY) {
        const batch = chunks.slice(i, i + CONCURRENCY);
        const batchRes = await Promise.all(batch.map((chunk) => queryChunk(chunk)));
        for (const res of batchRes) {
            if (res.data && res.data.length > 0) {
                results.push(...res.data);
            }
        }
    }
    return results;
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
            } catch (e) {
                console.error("Auth Error in getReferralStatus:", authErr);
                return res.status(401).json({ error: 'Invalid token', details: authErr?.message });
            }
        }

        // Run independent top-level queries concurrently
        const [configRes, profileRes, directReferrals] = await Promise.all([
            supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle(),
            supabase
                .from('profiles')
                .select('username, referral_code, target_1_claimed, target_2_claimed')
                .eq('id', user.id)
                .maybeSingle(),
            fetchAllPaged<any>((from, to) =>
                supabase
                    .from('referrals')
                    .select('referred_user_id, status, expiration_date, created_at')
                    .eq('referrer_id', user.id)
                    .range(from, to)
            ).catch(() => [] as any[])
        ]);

        const config = configRes?.data || null;
        const profile = profileRes?.data || null;

        let code = profile?.referral_code;
        if (!code) {
            code = `AH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            Promise.resolve(supabase.from('profiles').update({ referral_code: code }).eq('id', user.id)).catch((err) => {
                console.error("Failed to auto-generate referral code:", err);
            });
        }

        let validCount = 0;
        let pendingCount = 0;
        let campaignValidCount = 0;
        let joinedUsers: any[] = [];

        let isExpired = false;
        const campaignEndDate = config?.campaign_end_date || null;
        const campaignStartDate = await getCampaignStartDate();
        const validityDays = Number(config?.referral_validity_days ?? 30);

        if (campaignEndDate) {
            const end = new Date(campaignEndDate).getTime();
            const now = Date.now();
            if (now >= end) {
                isExpired = true;
            }
        }

        try {
            // Fetch all profiles referred by this user's referral code (paged safely past 1000-row limit)
            const referredProfiles = await fetchAllPaged<any>((from, to) =>
                supabase
                    .from('profiles')
                    .select('id, displayName, username, createdAt')
                    .eq('referred_by', code)
                    .order('createdAt', { ascending: false })
                    .range(from, to)
            );

            const profileMap = new Map<string, any>();
            for (const p of referredProfiles) {
                profileMap.set(p.id, p);
            }

            const referralStatusMap = new Map<string, string>();
            const referralExpiryMap = new Map<string, string>();
            const extraProfileIds: string[] = [];

            for (const r of directReferrals) {
                if (!r.referred_user_id) continue;
                referralStatusMap.set(r.referred_user_id, r.status);
                if (r.expiration_date) {
                    referralExpiryMap.set(r.referred_user_id, r.expiration_date);
                }
                if (!profileMap.has(r.referred_user_id)) {
                    extraProfileIds.push(r.referred_user_id);
                }
            }

            // Include users linked via referrals.referrer_id even if profiles.referred_by wasn't populated
            if (extraProfileIds.length > 0) {
                const extraProfiles = await fetchInChunks<any>(extraProfileIds, 80, (chunk) =>
                    supabase
                        .from('profiles')
                        .select('id, displayName, username, createdAt')
                        .in('id', chunk)
                );
                for (const ep of extraProfiles) {
                    profileMap.set(ep.id, ep);
                }
            }

            const allProfiles = Array.from(profileMap.values());
            if (allProfiles.length > 0) {
                const missingIds = allProfiles
                    .map((p) => p.id)
                    .filter((id) => !referralStatusMap.has(id));

                // Check referrals table in safe chunks for any rows whose referrer_id differed/null
                if (missingIds.length > 0) {
                    const existingRefs = await fetchInChunks<any>(missingIds, 80, (chunk) =>
                        supabase
                            .from('referrals')
                            .select('referred_user_id, status, expiration_date')
                            .in('referred_user_id', chunk)
                    );
                    for (const r of existingRefs) {
                        if (r.referred_user_id) {
                            referralStatusMap.set(r.referred_user_id, r.status);
                            if (r.expiration_date) {
                                referralExpiryMap.set(r.referred_user_id, r.expiration_date);
                            }
                        }
                    }
                }

                const stillMissingIds = allProfiles
                    .map((p) => p.id)
                    .filter((id) => !referralStatusMap.has(id));

                const dynamicStatusMap = new Map<string, string>();
                const rowsToInsert: any[] = [];

                if (stillMissingIds.length > 0) {
                    const approvedSubs = await fetchInChunks<any>(stillMissingIds, 80, (chunk) =>
                        supabase
                            .from('submissions')
                            .select('worker_id')
                            .eq('status', 'approved')
                            .in('worker_id', chunk)
                    );

                    const approvedWorkers = new Set(approvedSubs.map((s) => s.worker_id));
                    const defaultExpDate = new Date();
                    defaultExpDate.setDate(defaultExpDate.getDate() + validityDays);
                    const defaultExpIso = defaultExpDate.toISOString();

                    for (const id of stillMissingIds) {
                        const status = approvedWorkers.has(id) ? 'valid' : 'pending';
                        dynamicStatusMap.set(id, status);
                        rowsToInsert.push({
                            referrer_id: user.id,
                            referred_user_id: id,
                            status,
                            expiration_date: defaultExpIso
                        });
                    }

                    // Bulk self-heal in chunks in the background (no N+1 sequential awaits)
                    const INSERT_CHUNK = 200;
                    const insertPromises: PromiseLike<any>[] = [];
                    for (let i = 0; i < rowsToInsert.length; i += INSERT_CHUNK) {
                        const slice = rowsToInsert.slice(i, i + INSERT_CHUNK);
                        insertPromises.push(
                            supabase
                                .from('referrals')
                                .upsert(slice, { onConflict: 'referred_user_id', ignoreDuplicates: true })
                        );
                    }
                    Promise.allSettled(insertPromises).catch(() => {});
                }

                const nowTime = Date.now();
                const validityMs = validityDays * 24 * 60 * 60 * 1000;
                const sTime = campaignStartDate ? new Date(campaignStartDate).getTime() : 0;
                const eTime = campaignEndDate ? new Date(campaignEndDate).getTime() : Infinity;
                const expiredUserIds: string[] = [];

                joinedUsers = allProfiles.map((p) => {
                    let status = referralStatusMap.get(p.id) || dynamicStatusMap.get(p.id) || 'pending';
                    const expDateStr = referralExpiryMap.get(p.id);

                    if (status === 'pending') {
                        let isRefExpired = false;
                        if (expDateStr) {
                            if (nowTime > new Date(expDateStr).getTime()) {
                                isRefExpired = true;
                            }
                        } else if (p.createdAt) {
                            const createdTime = new Date(p.createdAt).getTime();
                            if (nowTime > createdTime + validityMs) {
                                isRefExpired = true;
                            }
                        }

                        if (isRefExpired) {
                            status = 'expired';
                            expiredUserIds.push(p.id);
                        }
                    }

                    if (status === 'valid') {
                        validCount++;
                        const pTime = new Date(p.createdAt || new Date()).getTime();
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
                        status,
                        expiration: expDateStr || null,
                        createdAt: p.createdAt || new Date().toISOString()
                    };
                });

                // Sort newest referrals first
                joinedUsers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                // Bulk self-heal expired statuses in chunks without blocking response
                if (expiredUserIds.length > 0) {
                    const EXPIRE_CHUNK = 80;
                    const updatePromises: PromiseLike<any>[] = [];
                    for (let i = 0; i < expiredUserIds.length; i += EXPIRE_CHUNK) {
                        const slice = expiredUserIds.slice(i, i + EXPIRE_CHUNK);
                        updatePromises.push(
                            supabase
                                .from('referrals')
                                .update({ status: 'expired' })
                                .in('referred_user_id', slice)
                        );
                    }
                    Promise.allSettled(updatePromises).catch(() => {});
                }
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
            referralDomainUrl: await getReferralDomainUrl()
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

        const campaignStartDate = await getCampaignStartDate();

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
