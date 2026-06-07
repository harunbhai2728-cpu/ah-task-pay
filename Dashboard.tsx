import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Users, 
  Briefcase, 
  TrendingUp, 
  ChevronRight,
  UserCheck,
  LayoutDashboard,
  AlertTriangle,
  Plus,
  Minus,
  DollarSign,
  ArrowRightLeft,
  X,
  Clock,
  Gift,
  CheckCircle2,
  XCircle,
  History
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { formatCurrency, cn } from '../lib/utils';
import { Submission } from '../types';

import { BrandLogo } from '../components/BrandLogo';

export function Dashboard() {
  const { profile, user, systemConfig, refreshProfile } = useAuth();
  const navigate = useNavigate();

  // ONE-TIME FIX for User 640424 (removes stuck 100 Taka pending deposit)
  useEffect(() => {
    if (user?.id && profile?.serialNumber === 640424 && profile?.pendingDepositBalance === 100) {
      console.log("Applying fix for pending deposit bug...");
      try {
        supabase.from('profiles').update({ pendingDepositBalance: 0 }).eq('id', user.id).then();
      } catch (err) {
        console.error(err);
      }
    }
  }, [user?.id, profile?.serialNumber, profile?.pendingDepositBalance]);

  const [showConvert, setShowConvert] = useState(false);
  const [convertType, setConvertType] = useState<'EarningToDeposit' | 'DepositToEarning'>('EarningToDeposit');
  const [convertAmount, setConvertAmount] = useState('');
  const [converting, setConverting] = useState(false);
  const [convertError, setConvertError] = useState<string|null>(null);
  
  const [pendingTasks, setPendingTasks] = useState<Submission[]>([]);
  const [activeAds, setActiveAds] = useState<any[]>([]);

  // Redeem code form states
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [claimSuccessMsg, setClaimSuccessMsg] = useState('');
  const [claimErrorMsg, setClaimErrorMsg] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // History modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchClaimHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch('/api/redeem-code/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setHistoryList(json.history || []);
      }
    } catch (err) {
      console.error("Failed to load redeem code history:", err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenHistoryModal = () => {
    setShowHistoryModal(true);
    fetchClaimHistory();
  };

  const handleClaimRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setClaimErrorMsg('');
    setClaimSuccessMsg('');

    if (!claimCodeInput.trim()) {
      setClaimErrorMsg('Redeem code cannot be empty!');
      return;
    }

    setClaimLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expired, please login again.');

      const res = await fetch('/api/redeem-code/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code: claimCodeInput.trim() })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to redeem code.');
      }

      setClaimSuccessMsg(json.message || `Successfully redeemed BDT ${json.amount}!`);
      setClaimCodeInput('');
      
      // Update local profile balance to reflect rewards immediately!
      if (typeof refreshProfile === 'function') {
        refreshProfile();
      }
    } catch (err: any) {
      setClaimErrorMsg(err.message || 'Redemption failed!');
    } finally {
      setClaimLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const fetchTasks = async () => {
      try {
        const { data } = await supabase
          .from('submissions')
          .select('*')
          .eq('workerId', user.id)
          .eq('status', 'pending')
          .order('submittedAt', { ascending: false })
          .limit(5);

        setPendingTasks(data || []);
      } catch (err) {
        console.error("Error fetching pending tasks:", err);
      }
    };

    const fetchAds = async () => {
      try {
        const { data: adsList } = await supabase
          .from('advertisements')
          .select('*')
          .eq('status', 'approved');
          
        const currentMs = Date.now();
        const validAds = (adsList || []).filter((ad: any) => {
           const expiresAt = ad.expiresAt ? new Date(ad.expiresAt).getTime() : 0;
           return expiresAt > currentMs;
        });
        setActiveAds(validAds);
      } catch (err) {
        console.error("Error fetching ads:", err);
      }
    };

    fetchTasks();
    fetchAds();
  }, [user?.id]);

  const handleConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const amt = parseFloat(convertAmount);
    if (isNaN(amt) || amt <= 0) {
      setConvertError("Invalid amount");
      return;
    }

    setConverting(true);
    setConvertError(null);

    try {
      const { data: userDoc, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (userError || !userDoc) throw new Error("User not found");
      
      const currentEarning = userDoc.earningBalance || 0;
      const currentDeposit = userDoc.depositBalance || 0;

      if (convertType === 'EarningToDeposit') {
        if (amt > currentEarning) throw new Error("Insufficient Earning Balance");
        const feePercent = systemConfig?.transferEarningToDepositFee || 0;
        const fee = amt * (feePercent / 100);
        const finalAmt = amt - fee;
        
        const { error: updateError } = await supabase.from('profiles').update({
          earningBalance: currentEarning - amt,
          depositBalance: currentDeposit + finalAmt
        }).eq('id', user.id);
        
        if (updateError) throw updateError;
      } else {
        if (amt > currentDeposit) throw new Error("Insufficient Deposit Balance");
        const feePercent = systemConfig?.transferDepositToEarningFee || 0;
        const fee = amt * (feePercent / 100);
        const finalAmt = amt - fee;
        
        const { error: updateError } = await supabase.from('profiles').update({
          depositBalance: currentDeposit - amt,
          earningBalance: currentEarning + finalAmt
        }).eq('id', user.id);
        
        if (updateError) throw updateError;
      }
      
      await refreshProfile();
      setShowConvert(false);
      setConvertAmount('');
    } catch (err: any) {
      setConvertError(err.message || err.toString());
    }
    setConverting(false);
  };

  return (
    <div className="space-y-10 pb-20">
      {systemConfig?.notice && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-2xl flex items-center justify-between gap-4 border-2 border-indigo-500/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-indigo-500/50 p-3 rounded-2xl">
               <Briefcase className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300 mb-1">Global Dashboard Notice</p>
              <p className="font-bold text-sm md:text-base leading-relaxed">{systemConfig.notice}</p>
            </div>
          </div>
        </motion.div>
      )}

      {profile?.warning && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-orange-500 text-white p-6 rounded-[2rem] shadow-2xl shadow-orange-200 flex items-center justify-between gap-4 border-2 border-white/20"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <AlertTriangle className="w-8 h-8 animate-pulse text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-80">Official System Warning</p>
              <p className="font-black text-lg">{profile.warning}</p>
            </div>
          </div>
          <button className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-black uppercase tracking-widest">Acknowledge</button>
        </motion.div>
      )}

      {/* Ads Slider / Display */}
      {activeAds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {activeAds.map(ad => (
             <a 
               key={ad.id}
               href={ad.link} 
               target="_blank" 
               rel="noopener noreferrer"
               className="block rounded-[2.5rem] overflow-hidden shadow-2xl border-4 border-white transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 relative group"
             >
                <img src={ad.image} alt="Advertisement" className="w-full h-48 object-cover" />
                <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">AD</div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <p className="text-white font-bold tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> Visit Sponsor
                  </p>
                </div>
             </a>
          ))}
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white dark:bg-slate-800 p-10 rounded-[3rem] shadow-2xl shadow-gray-100 dark:shadow-none border border-gray-100 dark:border-slate-700 flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary-50 dark:bg-primary-900/10 rounded-full -translate-y-1/2 translate-x-1/2 opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-indigo-50 dark:bg-indigo-900/10 rounded-full translate-y-1/2 -translate-x-1/2 opacity-20 blur-2xl" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="bg-white dark:bg-slate-700 p-4 rounded-[2.5rem] flex items-center justify-center shadow-xl border border-gray-50 dark:border-slate-600 transform hover:scale-105 transition-all overflow-hidden font-black text-4xl">
            <BrandLogo size="lg" />
          </div>
          <div>
            <div className="flex items-center gap-3">
               <p className="text-gray-400 dark:text-slate-500 font-black uppercase tracking-[0.2em] text-[10px]">Active Member</p>
               <div className="bg-green-500 w-2 h-2 rounded-full animate-pulse" />
            </div>
            <h2 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tighter uppercase mb-1">{profile?.displayName}</h2>
            <div className="flex items-center gap-2">
               <div className="bg-primary-50 dark:bg-slate-700 px-3 py-1 rounded-full border border-primary-100 dark:border-slate-600 flex items-center gap-2">
                  <span className="text-[10px] font-black text-primary-600 dark:text-primary-400">ID NO</span>
                  <p className="text-primary-600 dark:text-primary-400 font-black text-base tracking-tight">#{profile?.serialNumber || 'NEW'}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 relative z-10 lg:w-max w-full">
          {/* Earning & Deposit */}
          <div className="bg-gray-900 dark:bg-slate-950 px-6 sm:px-10 py-6 sm:py-8 rounded-[2.5rem] border border-gray-800 dark:border-slate-800 shadow-2xl flex flex-col justify-center min-w-[150px] sm:min-w-[240px] relative overflow-hidden group transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:rotate-12 transition-transform">
               <DollarSign className="w-20 h-20" />
            </div>
            <p className="text-gray-500 dark:text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 leading-none relative z-10 w-full truncate">Earning Balance</p>
            <div className="flex items-baseline gap-1 sm:gap-2 relative z-10">
              <span className="text-primary-500 font-black text-xl sm:text-2xl tracking-tighter">৳</span>
              <p className="text-3xl sm:text-5xl font-black text-white tracking-tighter tabular-nums leading-none truncate">
                {(profile?.earningBalance || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-6 sm:px-10 py-6 sm:py-8 rounded-[2.5rem] border border-white dark:border-slate-700 shadow-xl flex flex-col justify-center min-w-[150px] sm:min-w-[240px] overflow-hidden transition-colors">
             <p className="text-gray-400 dark:text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 leading-none w-full truncate">Deposit Balance</p>
             <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-gray-400 dark:text-slate-500 font-black text-xl">৳</span>
                <p className="text-3xl sm:text-4xl font-black text-blue-600 dark:text-blue-400 tracking-tighter tabular-nums leading-none truncate">
                  {(profile?.depositBalance || 0).toFixed(2)}
                </p>
             </div>
          </div>
          
          {/* Pending Equivalents Underneath */}
          {(profile?.pendingEarningBalance || 0) > 0 && (
            <div className={cn("bg-white/40 dark:bg-slate-800/40 backdrop-blur-md px-6 sm:px-8 py-4 sm:py-6 rounded-[2rem] sm:rounded-[2.5rem] border border-white dark:border-slate-700 shadow-xl flex flex-col justify-center w-full col-span-2 transition-colors")}>
               <p className="text-gray-400 dark:text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-2 leading-none">Pending</p>
               <div className="flex items-baseline gap-1 sm:gap-2">
                  <span className="text-gray-400 dark:text-slate-500 font-black text-lg">৳</span>
                  <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tighter tabular-nums leading-none">
                    {(profile?.pendingEarningBalance || 0).toFixed(2)}
                  </p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Jobs Completed" 
          value="0" 
          icon={<Briefcase className="w-8 h-8" />}
          color="bg-indigo-600"
          trend="Lifetime Data"
        />
        <StatCard 
          label="Total Revenue" 
          value={formatCurrency(0)} 
          icon={<TrendingUp className="w-8 h-8" />}
          color="bg-emerald-500"
          trend="+0.00% This Mo"
        />
        <StatCard 
          label="Active Queues" 
          value="0" 
          icon={<LayoutDashboard className="w-8 h-8" />}
          color="bg-violet-600"
          trend="Processing Now"
        />
        <StatCard 
          label="Audit Pending" 
          value="0" 
          icon={<UserCheck className="w-8 h-8" />}
          color="bg-amber-500"
          trend="Awaiting Review"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-slate-100">
            <Briefcase className="w-6 h-6 text-primary-600" />
            Active Tasks
          </h3>
          <div className="space-y-4">
            {pendingTasks.length === 0 ? (
              <p className="text-gray-500 dark:text-slate-400 text-center py-8">No active tasks found. Start earning today!</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center mb-2">Pending Buyer Review</p>
                {pendingTasks.map((task) => (
                   <Link key={task.id} to="/submitted-jobs" className="block p-4 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 rounded-2xl transition-colors border border-gray-100/50 dark:border-slate-600">
                     <div className="flex items-start justify-between gap-4">
                       <div className="max-w-[70%]">
                         <h4 className="font-bold text-gray-900 dark:text-slate-100 truncate uppercase tracking-tight">{task.jobTitle || 'Job Submission'}</h4>
                         <p className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mt-1">Reward: {formatCurrency(task.reward)}</p>
                       </div>
                       <span className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 font-black uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-yellow-200 dark:border-yellow-900/50">
                         <Clock className="w-3 h-3" />
                         Pending
                       </span>
                     </div>
                   </Link>
                ))}
              </div>
            )}
            <Link 
              to="/browse-jobs" 
              className="flex items-center justify-between w-full p-4 bg-gray-50 dark:bg-slate-700 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors group"
            >
              <span className="font-bold dark:text-slate-100">Browse Available Jobs</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform dark:text-slate-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-slate-100">
            <TrendingUp className="w-6 h-6 text-orange-600" />
            Wallet Actions
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Link 
                to="/deposit" 
                className="flex flex-col items-center justify-center p-6 bg-indigo-50 dark:bg-indigo-950/20 rounded-3xl hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-all group border border-indigo-100/50 dark:border-indigo-900/50"
              >
                <Plus className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest text-indigo-900 dark:text-indigo-400">Add Money</span>
              </Link>
              <Link 
                to="/withdraw" 
                className="flex flex-col items-center justify-center p-6 bg-orange-50 dark:bg-orange-950/20 rounded-3xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all group border border-orange-100/50 dark:border-orange-900/50"
              >
                <Minus className="w-8 h-8 text-orange-600 dark:text-orange-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest text-orange-900 dark:text-orange-400">Withdraw</span>
              </Link>
            </div>
            
            <button 
              onClick={() => setShowConvert(true)}
              className="flex w-full items-center justify-between p-4 bg-gray-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:bg-gray-800 dark:hover:bg-slate-200 transition-colors group"
            >
               <div className="flex items-center gap-3">
                 <ArrowRightLeft className="w-5 h-5 text-gray-400 dark:text-slate-500 group-hover:text-white dark:group-hover:text-slate-900 transition-colors" />
                 <span className="font-bold">Convert Balance</span>
               </div>
               <span className="bg-gray-800 dark:bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold uppercase text-gray-300 dark:text-slate-600 group-hover:bg-gray-700 dark:group-hover:bg-slate-200 transition-colors">Rates Applied</span>
            </button>
          </div>
        </div>
      </div>

      {/* Redeem Code Claiming Card */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Gift className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">Redeem Code</h3>
              <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-wider">Claim your research or promotion bonus instantly</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleOpenHistoryModal}
            className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-2xl border border-gray-150 dark:border-slate-600 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-gray-500 dark:text-slate-400" />
            <span>History</span>
          </button>
        </div>

        {claimSuccessMsg && (
          <div id="user-claim-success" className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p>{claimSuccessMsg}</p>
          </div>
        )}

        {claimErrorMsg && (
          <div id="user-claim-error" className="p-4 bg-rose-50 dark:bg-rose-950/20 border-l-4 border-rose-500 text-rose-800 dark:text-rose-300 rounded-2xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p>{claimErrorMsg}</p>
          </div>
        )}

        <form onSubmit={handleClaimRedeemCode} className="flex flex-col sm:flex-row gap-4 items-stretch">
          <input 
            type="text"
            placeholder="Enter Redeem Code"
            className="flex-1 px-5 py-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl shadow-inner font-extrabold text-gray-800 dark:text-slate-100 placeholder:text-gray-400 uppercase tracking-wide focus:border-emerald-600 dark:focus:border-emerald-400 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all"
            value={claimCodeInput}
            onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
          />
          <button
            type="submit"
            disabled={claimLoading}
            className="px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:bg-gray-800 dark:hover:bg-slate-200 disabled:opacity-50 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {claimLoading ? 'Checking...' : 'Redeem Now'}
          </button>
        </form>
      </div>

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative border border-gray-150">
            <button 
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-100 p-2 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-6 flex items-center gap-3">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900 uppercase tracking-tight">Redemption History</h3>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Your previously claimed reward codes</p>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
              {historyLoading ? (
                <div className="text-center py-8 text-gray-500 font-semibold text-sm">
                  Loading redemption history...
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-12 text-gray-400 font-bold text-sm bg-gray-50 rounded-2xl border border-dashed border-gray-100">
                  No codes claimed yet. Find codes in announcements or events!
                </div>
              ) : (
                historyList.map((item: any) => {
                  const rCode = item.redeem_codes || {};
                  return (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-2xl hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div>
                        <div className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">
                          {rCode.code || 'UNKNOWN'}
                        </div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">
                          Claimed: {new Date(item.claimed_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-sm text-emerald-600">
                          +{formatCurrency(rCode.amount || 0)}
                        </div>
                        <div className="text-[9px] text-emerald-600/70 font-black uppercase tracking-widest">
                          Added to Balance
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm">
           <div className="bg-white rounded-[3rem] p-8 max-w-md w-full shadow-2xl relative">
              <button 
                onClick={() => setShowConvert(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 bg-gray-100 p-2 rounded-full"
              >
                 <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                 <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-2">
                   <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
                   Convert Balance
                 </h2>
                 <p className="text-gray-500 text-sm font-medium">Easily transfer funds between your wallets.</p>
              </div>

              <form onSubmit={handleConvert} className="space-y-6">
                 {convertError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold">{convertError}</div>}
                 
                 <div className="space-y-3">
                   <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Conversion Type</label>
                   <div className="grid grid-cols-2 gap-3">
                      <button 
                         type="button"
                         onClick={() => setConvertType('EarningToDeposit')}
                         className={cn(
                           "p-4 rounded-2xl border-2 text-center transition-all",
                           convertType === 'EarningToDeposit' ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-gray-100 hover:bg-gray-50 text-gray-500"
                         )}
                      >
                         <p className="text-xs font-black uppercase mb-1">Earning to Deposit</p>
                         <p className="text-[10px] font-bold text-gray-400">{systemConfig?.transferEarningToDepositFee || 0}% Fee</p>
                      </button>
                      <button 
                         type="button"
                         onClick={() => setConvertType('DepositToEarning')}
                         className={cn(
                           "p-4 rounded-2xl border-2 text-center transition-all",
                           convertType === 'DepositToEarning' ? "border-indigo-600 bg-indigo-50 text-indigo-900" : "border-gray-100 hover:bg-gray-50 text-gray-500"
                         )}
                      >
                         <p className="text-xs font-black uppercase mb-1">Deposit to Earning</p>
                         <p className="text-[10px] font-bold text-orange-500">{systemConfig?.transferDepositToEarningFee || 0}% Fee</p>
                      </button>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Amount (BDT)</label>
                   <input 
                      type="number"
                      required
                      min="1"
                      placeholder="Enter amount to convert"
                      value={convertAmount}
                      onChange={e => setConvertAmount(e.target.value)}
                      className="w-full px-5 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-xl font-black outline-none focus:ring-2 focus:ring-indigo-500"
                   />
                   <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mt-2 px-1">
                      <span className="text-gray-400">Available:</span>
                      <span className="text-indigo-600">
                         {formatCurrency(convertType === 'EarningToDeposit' ? (profile?.earningBalance || 0) : (profile?.depositBalance || 0))}
                      </span>
                   </div>
                 </div>

                 <button 
                   disabled={converting}
                   className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-50 mt-4"
                 >
                   {converting ? 'Processing...' : 'Confirm Conversion'}
                 </button>
              </form>
           </div>
        </div>
      )}

    </div>
  );
}

function StatCard({ label, value, icon, color, trend }: { label: string, value: string, icon: React.ReactNode, color: string, trend?: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-50/50 dark:shadow-none flex items-center gap-5 group hover:shadow-2xl dark:hover:bg-slate-700/50 transition-all">
      <div className={`${color} text-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-transform group-hover:scale-110 shadow-lg`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-2xl font-black text-gray-900 dark:text-slate-100 tracking-tight">{value}</p>
        {trend && <p className="text-[10px] font-bold text-green-500 dark:text-green-400 uppercase mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
