import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder_key';
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
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

        // Retrieve referral_code
        let profile = null;
        try {
            const { data, error } = await supabase.from('profiles').select('username, referral_code').eq('id', user.id).maybeSingle();
            if (data) profile = data;
        } catch (e) {}

        const code = profile?.referral_code || profile?.username || user.id;

        let campaign = null;
        let referrals: any[] = [];
        let tablesMissing = false;

        try {
            // Check/create campaign
            const { data, error } = await supabase
                .from('referral_campaigns')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
                
            if (error && error.message && (error.message.includes('does not exist') || error.message.includes('not found') || error.message.includes('undefined'))) {
                tablesMissing = true;
            }
            if (data) {
                campaign = data;
            } else if (!tablesMissing) {
                // Try inserting new campaign
                const { data: newCamp } = await supabase
                   .from('referral_campaigns')
                   .insert({ user_id: user.id })
                   .select('*')
                   .maybeSingle();
                if (newCamp) campaign = newCamp;
            }
        } catch (campE: any) {
            if (campE.message && campE.message.includes('does not exist')) {
                tablesMissing = true;
            }
        }

        try {
            // Count referrals
            const { data: refs, error: refErr } = await supabase
                .from('referrals')
                .select('status')
                .eq('referrer_id', user.id);
                
            if (refErr && refErr.message && (refErr.message.includes('does not exist') || refErr.message.includes('not found') || refErr.message.includes('undefined'))) {
                tablesMissing = true;
            }
            if (refs) {
                referrals = refs;
            }
        } catch (refE: any) {
            if (refE.message && refE.message.includes('does not exist')) {
                tablesMissing = true;
            }
        }

        if (tablesMissing) {
            return res.json({
                tablesMissing: true,
                validCount: 0,
                pendingCount: 0,
                target20Claimed: false,
                target50Claimed: false,
                remainingDays: 15,
                campaignStartDate: new Date().toISOString(),
                referralCode: code,
                isExpired: false
            });
        }

        const validCount = referrals ? referrals.filter((r: any) => r.status === 'valid').length : 0;
        const pendingCount = referrals ? referrals.filter((r: any) => r.status === 'pending').length : 0;
        
        let remainingDays = 0;
        if (campaign && campaign.campaign_start_date) {
            const start = new Date(campaign.campaign_start_date).getTime();
            const now = new Date().getTime();
            const diffDays = (now - start) / (1000 * 3600 * 24);
            remainingDays = Math.max(0, 15 - diffDays);
        } else {
            remainingDays = 15;
        }

        res.json({
            tablesMissing: false,
            validCount,
            pendingCount,
            target20Claimed: campaign?.target_20_claimed || false,
            target50Claimed: campaign?.target_50_claimed || false,
            remainingDays,
            campaignStartDate: campaign?.campaign_start_date || new Date().toISOString(),
            referralCode: code,
            isExpired: remainingDays <= 0
        });

    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

export async function claimReferralReward(req: any, res: any) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) return res.status(401).json({ error: 'No auth header' });
        const token = authHeader.replace(/^Bearer /i, '');
        const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
        if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

        const { target } = req.body; // 20 or 50

        // Get campaign
        const { data: campaign } = await supabase.from('referral_campaigns').select('*').eq('user_id', user.id).maybeSingle();
        if (!campaign) return res.status(400).json({ error: 'No campaign started. Please visit the referral dashboard first.' });

        const start = new Date(campaign.campaign_start_date).getTime();
        const now = new Date().getTime();
        const diffDays = (now - start) / (1000 * 3600 * 24);
        if (diffDays > 15) {
            return res.status(400).json({ error: 'Campaign time expired (15 days over).' });
        }

        if (target === 20 && campaign.target_20_claimed) return res.status(400).json({ error: 'Target 20 already claimed.' });
        if (target === 50 && campaign.target_50_claimed) return res.status(400).json({ error: 'Target 50 already claimed.' });

        // Count valid referrals
        const { data: referrals } = await supabase
            .from('referrals')
            .select('status')
            .eq('referrer_id', user.id)
            .eq('status', 'valid');

        const validCount = referrals ? referrals.length : 0;

        let rewardAmount = 0;
        let updateCamp: any = {};
        if (target === 20) {
            if (validCount < 20) return res.status(400).json({ error: `Not enough valid referrals. Have ${validCount}/20` });
            rewardAmount = 20;
            updateCamp.target_20_claimed = true;
        } else if (target === 50) {
            if (validCount < 50) return res.status(400).json({ error: `Not enough valid referrals. Have ${validCount}/50` });
            rewardAmount = 50;
            updateCamp.target_50_claimed = true;
        } else {
            return res.status(400).json({ error: 'Unknown target' });
        }

        // Update campaign
        await supabase.from('referral_campaigns').update(updateCamp).eq('id', campaign.id);

        // Add reward
        const { data: profile } = await supabase.from('profiles').select('earningBalance').eq('id', user.id).maybeSingle();
        if (profile) {
            await supabase.from('profiles').update({
                earningBalance: Number(profile.earningBalance || 0) + rewardAmount
            }).eq('id', user.id);

            // Create transaction record
            await supabase.from('transactions').insert({
                user_id: user.id,
                type: 'bonus',
                amount: rewardAmount,
                status: 'completed',
                payment_method: 'referral_reward',
                payment_details: { description: `Referral Target ${target} BDT Reward` }
            });
        }

        res.json({ success: true, reward: rewardAmount });
    } catch (e: any) {
        res.status(500).json({ error: e.message });
    }
}

export async function validateReferral(workerId: string) {
    try {
        const { data: referral } = await supabase.from('referrals').select('id').eq('referred_user_id', workerId).eq('status', 'pending').maybeSingle();
        if (referral) {
            await supabase.from('referrals').update({ status: 'valid' }).eq('id', referral.id);
        }
    } catch (e) {
        console.error("Referral validation error:", e);
    }
}
