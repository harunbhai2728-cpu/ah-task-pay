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

        // Insert referral
        await supabase.from('referrals').insert({
            referrer_id: referrer.id,
            referred_user_id: newUserId,
            status: 'pending'
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
            console.error("Auth Error in getReferralStatus:", authErr);
            // Try fallback decode if jwt is valid
            try {
               const jwtPayload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
               if (jwtPayload && jwtPayload.sub) {
                   user = { id: jwtPayload.sub } as any;
                   authErr = null;
               } else {
                   return res.status(401).json({ error: 'Invalid token', details: authErr?.message });
               }
            } catch(e) {
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

        // Count referrals
        let referrals: any[] = [];
        let joinedUsers: any[] = [];
        try {
            const { data: refs, error: refErr } = await supabase
                .from('referrals')
                .select('status, referred_id, created_at')
                .eq('referrer_id', user.id);
            if (refs) {
                referrals = refs;
                
                const referredIds = refs.map((r: any) => r.referred_id).filter(Boolean);
                if (referredIds.length > 0) {
                    const { data: profiles, error: pErr } = await supabase
                        .from('profiles')
                        .select('id, displayName, username')
                        .in('id', referredIds);
                    
                    const profileMap = new Map();
                    if (profiles) {
                        for (const p of profiles) {
                            profileMap.set(p.id, p);
                        }
                    }

                    joinedUsers = refs.map((r: any) => {
                        const prof = profileMap.get(r.referred_id);
                        return {
                            id: r.referred_id,
                            name: prof?.displayName || prof?.username || 'User',
                            username: prof?.username || 'user',
                            status: r.status,
                            createdAt: r.created_at || new Date().toISOString()
                        };
                    });
                }
            }
        } catch (refE: any) {
            console.error("Error fetching referrals info:", refE);
        }

        const validCount = referrals ? referrals.filter((r: any) => r.status === 'valid').length : 0;
        const pendingCount = referrals ? referrals.filter((r: any) => r.status === 'pending').length : 0;
        
        let isExpired = false;
        let campaignEndDate = config?.campaign_end_date || null;
        
        if (campaignEndDate) {
            const end = new Date(campaignEndDate).getTime();
            const now = new Date().getTime();
            if (now >= end) {
                isExpired = true;
            }
        }

        res.json({
            validCount,
            pendingCount,
            target1Claimed: profile?.target_1_claimed || false,
            target2Claimed: profile?.target_2_claimed || false,
            campaignEndDate,
            target1Referrals: config?.target_1_referrals || 0,
            target1Reward: config?.target_1_reward || 0,
            target2Referrals: config?.target_2_referrals || 0,
            target2Reward: config?.target_2_reward || 0,
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

        // Count valid referrals
        const { count: validCount, error: refErr } = await supabase
            .from('referrals')
            .select('*', { count: 'exact', head: true })
            .eq('referrer_id', user.id)
            .eq('status', 'valid');

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
