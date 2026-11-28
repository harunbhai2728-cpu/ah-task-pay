import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realSupabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { CheckCircle, Clock, Copy, Gift, Share2, Target, Users, Zap, Terminal, AlertCircle } from 'lucide-react';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function ReferralDashboard() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });
  const [currentPage, setCurrentPage] = useState(1);
  const networkSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authLoading) return;
    fetchData();
  }, [user?.id, authLoading]);

  useEffect(() => {
    if (!data?.campaignEndDate || data?.isExpired || data?.tablesMissing) {
       setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
       return;
    }
    
    const interval = setInterval(() => {
        const start = new Date(data.campaignEndDate).getTime();
        const now = new Date().getTime();
        const diff = start - now;
        
        if (diff <= 0) {
           setTimeLeft({ days: 0, hours: 0, mins: 0, secs: 0 });
           clearInterval(interval);
        } else {
           setTimeLeft({
              days: Math.floor(diff / (1000 * 60 * 60 * 24)),
              hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
              mins: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
              secs: Math.floor((diff % (1000 * 60)) / 1000)
           });
        }
    }, 1000);
    return () => clearInterval(interval);
  }, [data]);

  const fetchData = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    try {
      setLoading(true);
      setErrorMsg(null);
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: { session } } = await realSupabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setErrorMsg("Session expired or unavailable. Please refresh or login again.");
        setLoading(false);
        return;
      }

      const res = await fetch('/api/referral/status', {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });
      
      if (!res.ok) {
        throw new Error(`Server responded with status ${res.status}. Please try again.`);
      }

      const json = await res.json();
      if (json.error) {
        console.error("Referral status response error:", json.error);
        setErrorMsg(json.error);
      } else {
        setData(json);
      }
    } catch (e: any) {
      console.error("Failed to load referral data pipeline:", e);
      if (e?.name === 'AbortError') {
        setErrorMsg("Request timed out while loading referral data. Please tap Retry Connection.");
      } else {
        setErrorMsg(e.message || "An unexpected error occurred while fetching your referral dashboard.");
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const handleClaim = async (target: number) => {
    try {
      setClaimLoading(true);
      const { data: { session } } = await realSupabase.auth.getSession();
      const token = session?.access_token;
      
      const res = await fetch('/api/referral/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target })
      });
      const json = await res.json();
      if (json.error) {
        alert(json.error);
      } else {
        alert(`Success! You earned ${json.reward} BDT!`);
        fetchData(); // refresh data
        if (refreshProfile) refreshProfile(); // Refresh global balance
      }
    } catch (e: any) {
      console.error("Error claiming referral reward:", e);
      alert("Error: " + e.message);
    } finally {
      setClaimLoading(false);
    }
  };

  const handleCopy = () => {
    if (!data?.referralCode) return;
    const domain = data?.referralDomainUrl || 'https://ahtaskpay.onrender.com';
    const cleanedDomain = domain.replace(/\/+$/, '');
    const link = `${cleanedDomain}/register?ref=${data.referralCode}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!data?.referralCode) return;
    const domain = data?.referralDomainUrl || 'https://ahtaskpay.onrender.com';
    const cleanedDomain = domain.replace(/\/+$/, '');
    const link = `${cleanedDomain}/register?ref=${data.referralCode}`;
    const message = `Earn daily by doing small jobs! Sign up using my link: ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const sqlQuery = `-- Referral System Schema Setup
-- 1. Add referral_code to existing profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- 2. Create referrals table to track who referred whom
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create referral_campaigns table to track milestones and 15-day limits
CREATE TABLE IF NOT EXISTS public.referral_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
    campaign_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    target_20_claimed BOOLEAN DEFAULT FALSE,
    target_50_claimed BOOLEAN DEFAULT FALSE
);

-- 4. Disable Row Level Security (RLS) dynamically
ALTER TABLE public.referrals DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_campaigns DISABLE ROW LEVEL SECURITY;`;

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlQuery);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0B3D9E] dark:border-[#F97316]"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-6 bg-red-50 dark:bg-red-950/30 rounded-[2rem] border border-red-200 dark:border-red-900/40">
        <div className="inline-flex p-4 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-full">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-red-900 dark:text-red-300">Database Pipeline Interruption</h2>
        <p className="text-red-700 dark:text-red-400 font-medium text-sm">
          {errorMsg}
        </p>
        <button
          onClick={fetchData}
          className="px-6 py-3 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl font-bold uppercase text-xs tracking-wider transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  // Gracefully handle missing database tables state
  if (data?.tablesMissing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-8 text-white relative overflow-hidden shadow-xl shadow-blue-950/15 border border-blue-400/20">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#F97316] opacity-15 rounded-full blur-3xl"></div>
          <div className="relative z-10 space-y-2">
            <h1 className="text-3xl font-black flex items-center gap-2 font-display">
              <Terminal className="w-8 h-8 text-[#FB923C]" /> One-Time Database Setup Required
            </h1>
            <p className="text-blue-100 font-semibold">
              The Referral System requires auxiliary database tables before you can track rewards.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0A1638] p-6 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-4">
          <h2 className="text-lg font-black text-[#071845] dark:text-white">Migration Instructions</h2>
          <p className="text-sm text-slate-600 dark:text-blue-200/80 font-semibold leading-relaxed">
            Please copy the PostgreSQL migration script below and execute it in your **Supabase dashboard SQL Editor**:
          </p>
          
          <div className="relative">
            <pre className="bg-slate-900 text-slate-100 p-5 rounded-2xl text-xs overflow-x-auto font-mono max-h-80 leading-relaxed border border-slate-700">
              {sqlQuery}
            </pre>
            <button
              onClick={copySqlToClipboard}
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 p-2.5 rounded-xl transition flex items-center gap-1.5 focus:outline-none"
            >
              {sqlCopied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{sqlCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              onClick={fetchData}
              className="flex-1 py-3.5 bg-[#F97316] text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-[#EA580C] transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
            >
              I Completed the Setup - Recheck Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validCount = data?.validCount || 0;
  const campaignValidCount = data?.campaignValidCount || 0;
  const joinedUsers = Array.isArray(data?.joinedUsers) ? data.joinedUsers : [];
  const totalPages = Math.max(1, Math.ceil(joinedUsers.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = joinedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-7 sm:p-8 text-white relative overflow-hidden shadow-xl shadow-blue-950/15 border border-blue-400/20">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#F97316] opacity-15 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5 font-display tracking-tight">
              <Gift className="w-8 h-8 text-[#FB923C]" /> Refer & Earn Substantial Rewards
            </h1>
            <p className="text-blue-100 font-medium text-sm sm:text-base">
              Invite your friends and earn a guaranteed <span className="text-[#FB923C] font-extrabold">{data?.referralBonusAmount || 0} BDT</span> for every valid referral!
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl text-center min-w-[200px] border border-white/20 shrink-0">
            <div className="flex items-center justify-center gap-2 text-blue-100 font-semibold text-xs uppercase tracking-wider mb-1">
              <Clock className="w-4 h-4 text-[#FB923C]" /> Remaining Time
            </div>
            <div className="text-xl md:text-2xl font-black text-white flex justify-center gap-2 tabular-nums">
              {data?.isExpired ? (
                <span>Expired</span>
              ) : (
                <>
                  <div className="text-center"><span>{timeLeft.days}</span><span className="text-[10px] block font-medium opacity-80">Days</span></div>:
                  <div className="text-center"><span>{timeLeft.hours.toString().padStart(2, '0')}</span><span className="text-[10px] block font-medium opacity-80">Hrs</span></div>:
                  <div className="text-center"><span>{timeLeft.mins.toString().padStart(2, '0')}</span><span className="text-[10px] block font-medium opacity-80">Min</span></div>:
                  <div className="text-center"><span>{timeLeft.secs.toString().padStart(2, '0')}</span><span className="text-[10px] block font-medium opacity-80">Sec</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#0A1638] p-6 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 transition-colors">
          <h2 className="text-xl font-black text-[#071845] dark:text-white flex items-center gap-2 font-display">
            <Share2 className="w-6 h-6 text-[#0B3D9E] dark:text-[#FB923C]" /> Share Referral Link
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-[#F2F6FE] dark:bg-[#050F2B] p-4 rounded-xl border border-[#DCE7FA] dark:border-[#1C3882]/60">
              <input
                type="text"
                readOnly
                value={`${(data?.referralDomainUrl || 'https://ahtaskpay.onrender.com').replace(/\/+$/, '')}/register?ref=${data?.referralCode || ''}`}
                className="bg-transparent border-none outline-none font-semibold text-[#07266E] dark:text-blue-200 w-full text-sm"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-xl font-bold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 focus:outline-none cursor-pointer shadow-md"
              >
                {copied ? <CheckCircle className="w-4 h-4 text-[#FB923C]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-xs tracking-wider transition flex items-center justify-center gap-2 shadow-md focus:outline-none cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Share WhatsApp
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200/70 dark:border-orange-900/40 text-orange-900 dark:text-orange-200 space-y-2">
            <h3 className="font-bold flex items-center gap-1.5 text-[#EA580C] dark:text-[#FB923C] text-sm"><Zap className="w-4 h-4" /> Important Rules</h3>
            <ul className="list-disc pl-4 text-xs font-semibold space-y-1">
              <li>A referral counts as <strong className="text-orange-950 dark:text-white">Valid</strong> only when the referred user completes and gets paid for <strong className="text-orange-950 dark:text-white">{data?.referralValidationCriteria || 1} microjob(s)</strong>.</li>
              <li>Fake accounts or multiple accounts result in a permanent ban.</li>
              <li>Pending referrals will automatically expire if they are not validated within 1 month (30 days) of joining.</li>
            </ul>
          </div>
        </div>

        <div className="bg-white dark:bg-[#0A1638] rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] p-6 space-y-6 flex flex-col justify-between transition-colors">
            <div>
              <h2 className="text-xl font-black text-[#071845] dark:text-white flex items-center gap-2 mb-4 font-display">
                <Users className="w-6 h-6 text-[#0B3D9E] dark:text-[#FB923C]" /> Your Referrals
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl p-5 border border-emerald-200/70 dark:border-emerald-900/40 text-center space-y-1">
                  <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 tabular-nums">{validCount}</div>
                  <div className="text-xs font-bold text-emerald-600 dark:text-emerald-300 uppercase tracking-wider">Valid</div>
                </div>
                <div className="bg-[#F2F6FE] dark:bg-[#050F2B] rounded-2xl p-5 border border-[#DCE7FA] dark:border-[#1C3882]/60 text-center space-y-1">
                  <div className="text-3xl font-black text-[#071845] dark:text-white tabular-nums">{data?.pendingCount || 0}</div>
                  <div className="text-xs font-bold text-slate-500 dark:text-blue-200/70 uppercase tracking-wider">Pending Tasks</div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0A1638] rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] overflow-hidden transition-colors">
        <div className="px-6 py-4 bg-[#F2F6FE] dark:bg-[#06102B]/80 border-b border-[#D7E3F7] dark:border-[#1C3882]/55 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#071845] dark:text-white flex items-center gap-2 font-display">
            <Target className="w-5 h-5 text-[#F97316]" /> Milestones & Rewards
          </h2>
        </div>
        <div className="p-6 space-y-8">
          
          {/* Target 1 */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold text-[#071845] dark:text-white">Target 1: {data?.target1Referrals || 0} Valid Referrals</h3>
                <p className="text-sm text-slate-500 dark:text-blue-200/70 font-medium">Reward: {data?.target1Reward || 0} BDT added to your balance.</p>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-2xl font-black text-[#0B3D9E] dark:text-blue-400">{campaignValidCount}</span>
                <span className="text-slate-400 dark:text-blue-200/50 font-bold">/{data?.target1Referrals || 0}</span>
              </div>
            </div>
            <div className="h-4 bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/50 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((campaignValidCount / Math.max(data?.target1Referrals || 1, 1)) * 100, 100)}%` }}
                className="h-full bg-gradient-to-r from-[#07266E] to-[#0B3D9E] rounded-full"
              />
            </div>
            <button
               onClick={() => handleClaim(1)}
               disabled={campaignValidCount < (data?.target1Referrals || 0) || data?.target1Claimed || data?.isExpired || claimLoading}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all cursor-pointer ${
                 data?.target1Claimed
                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 cursor-not-allowed border border-emerald-200 dark:border-emerald-900/50'
                  : campaignValidCount < (data?.target1Referrals || 0) || data?.isExpired
                    ? 'bg-[#EFF4FC] dark:bg-[#050F2B] text-slate-400 dark:text-blue-200/40 border border-[#DCE7FA] dark:border-[#1C3882]/40 cursor-not-allowed'
                    : 'bg-[#07266E] hover:bg-[#0B3D9E] text-white shadow-lg'
               }`}
            >
              {claimLoading ? 'Processing...' : data?.target1Claimed ? 'Claimed' : data?.isExpired ? 'Expired' : `Claim ${data?.target1Reward || 0} BDT`}
            </button>
          </div>

          <hr className="border-[#E4ECFA] dark:border-[#1C3882]/45" />

          {/* Target 2 */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold text-[#071845] dark:text-white">Target 2: {data?.target2Referrals || 0} Valid Referrals</h3>
                <p className="text-sm text-slate-500 dark:text-blue-200/70 font-medium">Reward: {data?.target2Reward || 0} BDT added to your balance.</p>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-2xl font-black text-[#F97316]">{campaignValidCount}</span>
                <span className="text-slate-400 dark:text-blue-200/50 font-bold">/{data?.target2Referrals || 0}</span>
              </div>
            </div>
            <div className="h-4 bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/50 rounded-full overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((campaignValidCount / Math.max(data?.target2Referrals || 1, 1)) * 100, 100)}%` }}
                className="h-full bg-gradient-to-r from-[#EA580C] to-[#F97316] rounded-full"
              />
            </div>
            <button
               onClick={() => handleClaim(2)}
               disabled={campaignValidCount < (data?.target2Referrals || 0) || data?.target2Claimed || data?.isExpired || claimLoading}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all cursor-pointer ${
                 data?.target2Claimed
                  ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 cursor-not-allowed border border-emerald-200 dark:border-emerald-900/50'
                  : campaignValidCount < (data?.target2Referrals || 0) || data?.isExpired
                    ? 'bg-[#EFF4FC] dark:bg-[#050F2B] text-slate-400 dark:text-blue-200/40 border border-[#DCE7FA] dark:border-[#1C3882]/40 cursor-not-allowed'
                    : 'bg-[#F97316] hover:bg-[#EA580C] text-white shadow-lg shadow-orange-500/20'
               }`}
            >
              {claimLoading ? 'Processing...' : data?.target2Claimed ? 'Claimed' : data?.isExpired ? 'Expired' : `Claim ${data?.target2Reward || 0} BDT`}
            </button>
          </div>

        </div>
      </div>

      {/* My Network Section */}
      <div ref={networkSectionRef} className="bg-white dark:bg-[#0A1638] rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] overflow-hidden transition-colors scroll-mt-6">
        <div className="px-6 py-4 bg-[#F2F6FE] dark:bg-[#06102B]/80 border-b border-[#D7E3F7] dark:border-[#1C3882]/55 flex items-center justify-between">
          <h2 className="text-lg font-black text-[#071845] dark:text-white flex items-center gap-2 font-display">
            <Users className="w-5 h-5 text-[#0B3D9E] dark:text-[#FB923C]" /> My Network
          </h2>
          <span className="bg-blue-100 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-300 px-3 py-1 rounded-full text-xs font-black tabular-nums">
            Total Joined: {joinedUsers.length}
          </span>
        </div>
        <div className="p-6">
          {joinedUsers.length === 0 ? (
            <div className="text-center py-10 text-slate-500 dark:text-blue-200/70 font-bold">
              No one has registered using your referral code yet. Reach out to friends!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-[#D7E3F7] dark:border-[#1C3882]/55 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-blue-200/60">
                    <th className="pb-3 text-left pl-2 w-12">#</th>
                    <th className="pb-3 text-left">Name</th>
                    <th className="pb-3 text-left">Join Date</th>
                    <th className="pb-3 text-right pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E4ECFA] dark:divide-[#1C3882]/45">
                  {paginatedUsers.map((item: any, idx: number) => (
                    <tr key={item.id || idx} className="hover:bg-[#F2F6FE] dark:hover:bg-[#102255]/50 transition text-sm">
                      <td className="py-4 pl-2 font-bold text-slate-500 dark:text-blue-200/60 tabular-nums">
                        {(safePage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="py-4 font-black text-[#071845] dark:text-white">
                        {item.name} <span className="text-xs text-slate-500 dark:text-blue-200/60 font-medium">(@{item.username})</span>
                      </td>
                      <td className="py-4 text-slate-500 dark:text-blue-200/70 font-bold">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right pr-2">
                        {item.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                              <CheckCircle className="w-3.5 h-3.5" /> Validated
                            </span>
                        ) : item.status === 'expired' || item.status === 'cropped' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                              <Clock className="w-3.5 h-3.5" /> Expired
                            </span>
                        ) : (
                            <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                                  <Clock className="w-3.5 h-3.5" /> Pending Job
                                </span>
                                {item.expiration && (
                                    <span className="text-[10px] text-slate-500 dark:text-blue-200/60 font-bold uppercase mt-1">Exp: {new Date(item.expiration).toLocaleDateString()}</span>
                                )}
                            </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {joinedUsers.length > 0 && (
          <Pagination
            currentPage={safePage}
            totalItems={joinedUsers.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
            itemLabel="referrals"
            variant="embedded"
            scrollTargetRef={networkSectionRef}
          />
        )}
      </div>
    </div>
  );
}
