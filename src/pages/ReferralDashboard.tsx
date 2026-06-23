import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { realSupabase } from '../lib/supabase';
import { motion } from 'motion/react';
import { CheckCircle, Clock, Copy, Gift, Share2, Target, Users, Zap, Terminal, AlertCircle } from 'lucide-react';

export function ReferralDashboard() {
  const { user, refreshProfile } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimLoading, setClaimLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0, secs: 0 });

  useEffect(() => {
    fetchData();
  }, [user]);

  useEffect(() => {
    if (!data?.campaignEndDate || data.isExpired || data.tablesMissing) {
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
        console.warn("No authentication token is active.");
        setLoading(false);
        return;
      }

      const res = await fetch('/api/referral/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error(`HTTP Error Status: ${res.status}`);
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
      setErrorMsg(e.message || "An unexpected error occurred while fetching your referral dashboard.");
    } finally {
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-6 bg-red-50/50 rounded-[2rem] border border-red-100">
        <div className="inline-flex p-4 bg-red-100 text-red-700 rounded-full">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-red-900">Database Pipeline Interruption</h2>
        <p className="text-red-700 font-medium text-sm">
          {errorMsg}
        </p>
        <button
          onClick={fetchData}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-red-700 transition"
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
        <div className="bg-gradient-to-r from-orange-400 to-amber-500 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-orange-100">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <div className="relative z-10 space-y-2">
            <h1 className="text-3xl font-black flex items-center gap-2">
              <Terminal className="w-8 h-8" /> One-Time Database Setup Required
            </h1>
            <p className="text-orange-50 font-semibold">
              The Referral System requires auxiliary database tables before you can track rewards.
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-gray-800">Migration Instructions</h2>
          <p className="text-sm text-gray-600 font-semibold leading-relaxed">
            Please copy the PostgreSQL migration script below and execute it in your **Supabase dashboard SQL Editor**:
          </p>
          
          <div className="relative">
            <pre className="bg-gray-900 text-gray-150 p-5 rounded-2xl text-xs overflow-x-auto font-mono max-h-80 leading-relaxed">
              {sqlQuery}
            </pre>
            <button
              onClick={copySqlToClipboard}
              className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white border border-white/20 p-2.5 rounded-xl transition flex items-center gap-1.5 focus:outline-none"
            >
              {sqlCopied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              <span className="text-[10px] font-bold uppercase tracking-wider">{sqlCopied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <div className="pt-4 flex gap-4">
            <button
              onClick={fetchData}
              className="flex-1 py-3.5 bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-indigo-700 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-150"
            >
              I Completed the Setup - Recheck Database
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validCount = data?.validCount || 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[2rem] p-8 text-white relative overflow-hidden shadow-2xl shadow-indigo-200">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-black flex items-center gap-2">
              <Gift className="w-8 h-8" /> Refer & Earn Substantial Rewards
            </h1>
            <p className="text-indigo-100 font-medium">
              Invite friends to sign up and complete their first microjob. Earn up to 50 BDT in bonuses!
            </p>
          </div>
          <div className="bg-white/20 backdrop-blur-md px-6 py-4 rounded-xl text-center min-w-[200px] border border-white/30">
            <div className="flex items-center justify-center gap-2 text-indigo-50 font-semibold mb-1">
              <Clock className="w-4 h-4" /> Remaining Time
            </div>
            <div className="text-xl md:text-2xl font-black text-white flex justify-center gap-2">
              {data.isExpired ? (
                <span>Expired</span>
              ) : (
                <>
                  <div className="text-center"><span>{timeLeft.days}</span><span className="text-xs block font-medium opacity-80">Days</span></div>:
                  <div className="text-center"><span>{timeLeft.hours.toString().padStart(2, '0')}</span><span className="text-xs block font-medium opacity-80">Hrs</span></div>:
                  <div className="text-center"><span>{timeLeft.mins.toString().padStart(2, '0')}</span><span className="text-xs block font-medium opacity-80">Min</span></div>:
                  <div className="text-center"><span>{timeLeft.secs.toString().padStart(2, '0')}</span><span className="text-xs block font-medium opacity-80">Sec</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-[2rem] border border-indigo-50 shadow-sm space-y-6">
          <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
            <Share2 className="w-6 h-6 text-indigo-500" /> Share Referral Link
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-2 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
              <input
                type="text"
                readOnly
                value={`${(data?.referralDomainUrl || 'https://ahtaskpay.onrender.com').replace(/\/+$/, '')}/register?ref=${data?.referralCode || ''}`}
                className="bg-transparent border-none outline-none font-medium text-indigo-900 w-full"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-indigo-700 transition flex items-center justify-center gap-2 focus:outline-none cursor-pointer"
              >
                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy Link'}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold uppercase text-xs tracking-wider hover:bg-green-600 transition flex items-center justify-center gap-2 shadow-lg shadow-green-150 focus:outline-none cursor-pointer"
              >
                <Share2 className="w-4 h-4" /> Share on WhatsApp
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-orange-850 space-y-2">
            <h3 className="font-bold flex items-center gap-1 text-orange-900"><Zap className="w-4 h-4" /> Important Rules</h3>
            <ul className="list-disc pl-4 text-xs font-semibold space-y-1">
              <li>A referral counts as <strong className="text-orange-950">Valid</strong> only when the referred user completes and gets paid for <strong className="text-orange-950">{data?.referralValidationCriteria || 1} microjob(s)</strong>.</li>
              <li>Fake accounts or multiple accounts result in a permanent ban.</li>
              <li>Pending referrals will automatically expire if they are not validated within 1 month (30 days) of joining.</li>
            </ul>
          </div>
        </div>

        <div className="bg-white rounded-[2rem] border border-blue-50 shadow-sm p-6 space-y-6 flex flex-col justify-between">
            <div>
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-4">
                <Users className="w-6 h-6 text-blue-500" /> Your Referrals
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-xl p-4 border border-green-100 text-center space-y-1">
                  <div className="text-2xl font-black text-green-700">{validCount}</div>
                  <div className="text-xs font-bold text-green-600 uppercase tracking-wider">Valid</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 text-center space-y-1">
                  <div className="text-2xl font-black text-gray-700">{data?.pendingCount || 0}</div>
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Pending Tasks</div>
                </div>
              </div>
            </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-500" /> Milestones & Rewards
          </h2>
        </div>
        <div className="p-6 space-y-8">
          
          {/* Target 1 */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Target 1: {data?.target1Referrals || 0} Valid Referrals</h3>
                <p className="text-sm text-gray-500 font-medium">Reward: {data?.target1Reward || 0} BDT added to your balance.</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-indigo-600">{validCount}</span>
                <span className="text-gray-400 font-bold">/{data?.target1Referrals || 0}</span>
              </div>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((validCount / Math.max(data?.target1Referrals || 1, 1)) * 100, 100)}%` }}
                className="h-full bg-indigo-500 rounded-full"
              />
            </div>
            <button
               onClick={() => handleClaim(1)}
               disabled={validCount < (data?.target1Referrals || 0) || data.target1Claimed || data.isExpired || claimLoading}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all cursor-pointer ${
                 data.target1Claimed
                  ? 'bg-green-100 text-green-700 cursor-not-allowed border border-green-200'
                  : validCount < (data?.target1Referrals || 0) || data.isExpired
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200'
               }`}
            >
              {claimLoading ? 'Processing...' : data.target1Claimed ? 'Claimed' : data.isExpired ? 'Expired' : `Claim ${data?.target1Reward || 0} BDT`}
            </button>
          </div>

          <hr className="border-gray-100" />

          {/* Target 2 */}
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Target 2: {data?.target2Referrals || 0} Valid Referrals</h3>
                <p className="text-sm text-gray-500 font-medium">Reward: {data?.target2Reward || 0} BDT added to your balance.</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-purple-600">{validCount}</span>
                <span className="text-gray-400 font-bold">/{data?.target2Referrals || 0}</span>
              </div>
            </div>
            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
               <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min((validCount / Math.max(data?.target2Referrals || 1, 1)) * 100, 100)}%` }}
                className="h-full bg-purple-500 rounded-full"
              />
            </div>
            <button
               onClick={() => handleClaim(2)}
               disabled={validCount < (data?.target2Referrals || 0) || data.target2Claimed || data.isExpired || claimLoading}
               className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all cursor-pointer ${
                 data.target2Claimed
                  ? 'bg-green-100 text-green-700 cursor-not-allowed border border-green-200'
                  : validCount < (data?.target2Referrals || 0) || data.isExpired
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-200'
               }`}
            >
              {claimLoading ? 'Processing...' : data.target2Claimed ? 'Claimed' : data.isExpired ? 'Expired' : `Claim ${data?.target2Reward || 0} BDT`}
            </button>
          </div>

        </div>
      </div>

      {/* My Network Section */}
      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-500" /> My Network
          </h2>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-black">
            Total Joined: {data?.joinedUsers?.length || 0}
          </span>
        </div>
        <div className="p-6">
          {!data?.joinedUsers || data.joinedUsers.length === 0 ? (
            <div className="text-center py-10 text-gray-400 font-bold">
              No one has registered using your referral code yet. Reach out to friends!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-400">
                    <th className="pb-3 text-left pl-2">Name</th>
                    <th className="pb-3 text-left">Join Date</th>
                    <th className="pb-3 text-right pr-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.joinedUsers.map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50 transition text-sm">
                      <td className="py-4 pl-2 font-black text-gray-900">
                        {item.name} <span className="text-xs text-gray-400 font-medium">(@{item.username})</span>
                      </td>
                      <td className="py-4 text-gray-500 font-bold">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 text-right pr-2">
                        {item.status === 'valid' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-green-100 text-green-700">
                              <CheckCircle className="w-3.5 h-3.5" /> Validated
                            </span>
                        ) : item.status === 'expired' || item.status === 'cropped' ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-red-100 text-red-700">
                              <Clock className="w-3.5 h-3.5" /> Expired
                            </span>
                        ) : (
                            <div className="flex flex-col items-end">
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-yellow-100 text-yellow-700">
                                  <Clock className="w-3.5 h-3.5" /> Pending Job
                                </span>
                                {item.expiration && (
                                    <span className="text-[10px] text-gray-400 font-bold uppercase mt-1">Exp: {new Date(item.expiration).toLocaleDateString()}</span>
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
      </div>
    </div>
  );
}
