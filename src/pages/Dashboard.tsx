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
  AlertCircle,
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
  const { profile, user, systemConfig, refreshProfile, loading } = useAuth();
  const navigate = useNavigate();

  const [dashboardStats, setDashboardStats] = useState({ jobsCompleted: 0, totalRevenue: 0, auditPending: 0, activeQueues: 0 });

  // Notice popup state
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  useEffect(() => {
    if (systemConfig?.notice && systemConfig.notice.trim() !== '') {
      const dismissed = sessionStorage.getItem(`notice_dismissed_${systemConfig.notice}`);
      if (!dismissed) {
        setShowNoticeModal(true);
      }
    }
  }, [systemConfig?.notice]);

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

  const earningToDepositFeePercent = Number(systemConfig?.transferEarningToDepositFee);
  const depositToEarningFeePercent = Number(systemConfig?.transferDepositToEarningFee);
  const currentFeePercent = convertType === 'EarningToDeposit' ? earningToDepositFeePercent : depositToEarningFeePercent;
  const parsedConvertAmount = parseFloat(convertAmount);
  const isValidConvertAmount = !isNaN(parsedConvertAmount) && parsedConvertAmount > 0;
  const calculatedConvertFee = isValidConvertAmount ? parsedConvertAmount * (currentFeePercent / 100) : 0;
  const receivableConvertAmount = isValidConvertAmount ? parsedConvertAmount - calculatedConvertFee : 0;
  
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

    const fetchStats = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/dashboard-stats', {
          headers: { Authorization: `Bearer ${session.access_token}` }
        });
        if (res.ok) {
           const json = await res.json();
           setDashboardStats(json);
        }
      } catch (err) {}
    };

    fetchTasks();
    fetchAds();
    fetchStats();
  }, [user?.id]);

  // Continuously remove expired ads in the background
  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveAds(prev => {
        const currentMs = Date.now();
        const valid = prev.filter(ad => {
           const expiresAt = ad.expiresAt ? new Date(ad.expiresAt).getTime() : 0;
           return expiresAt > currentMs;
        });
        if (valid.length !== prev.length) return valid;
        return prev;
      });
    }, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

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

  if (loading || systemConfig === null || !profile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <LayoutDashboard className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">Securing Session</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest animate-pulse">Loading system settings & wallet balances...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      {/* Dynamic Instant Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-fadeIn">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-[#1E293B] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative border border-slate-200 dark:border-slate-700/80 transition-colors text-left"
          >
            <button 
              type="button"
              onClick={() => {
                setShowNoticeModal(false);
                if (systemConfig?.notice) {
                  sessionStorage.setItem(`notice_dismissed_${systemConfig.notice}`, 'true');
                }
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-6 flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 rounded-2xl">
                <AlertCircle className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display text-slate-900 dark:text-slate-100 uppercase tracking-tight">Important Notice</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Announcement from the Administrator</p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 p-6 rounded-2xl border border-slate-200 dark:border-slate-700/70 text-left mb-6 max-h-[250px] overflow-y-auto">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-bold leading-relaxed whitespace-pre-wrap">
                {systemConfig.notice}
              </p>
            </div>

            <div>
              <button
                type="button"
                onClick={() => {
                  setShowNoticeModal(false);
                  if (systemConfig?.notice) {
                    sessionStorage.setItem(`notice_dismissed_${systemConfig.notice}`, 'true');
                  }
                }}
                className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-500/20"
              >
                I Understand & Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {systemConfig?.notice && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between gap-4 border border-blue-800/40"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/10 p-3 rounded-2xl border border-white/15">
               <Briefcase className="w-8 h-8 text-[#FB923C]" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1">Global Dashboard Notice</p>
              <p className="font-bold text-sm md:text-base leading-relaxed">{systemConfig.notice}</p>
            </div>
          </div>
        </motion.div>
      )}

      {profile?.warning && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#F97316] text-white p-6 rounded-[2rem] shadow-xl flex items-center justify-between gap-4 border border-orange-400/40"
        >
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl">
              <AlertTriangle className="w-8 h-8 animate-pulse text-white" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest opacity-90">Official System Warning</p>
              <p className="font-black text-lg">{profile.warning}</p>
            </div>
          </div>
          <button className="px-6 py-2 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black uppercase tracking-widest transition-colors">Acknowledge</button>
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
               className="block rounded-[2.5rem] overflow-hidden shadow-xl border-4 border-white dark:border-slate-700 transform hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 relative group"
             >
                <img src={ad.image} alt="Advertisement" className="w-full h-48 object-cover" />
                <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">AD</div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-6">
                  <p className="text-white font-bold tracking-widest flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#FB923C]" /> Visit Sponsor
                  </p>
                </div>
             </a>
          ))}
        </div>
      )}

      {/* Header Section */}
      <div className="bg-white dark:bg-[#1E293B] p-8 sm:p-10 rounded-[3rem] shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200 dark:border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative overflow-hidden transition-colors">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-100 dark:bg-blue-900/15 rounded-full -translate-y-1/2 translate-x-1/2 opacity-40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-orange-100 dark:bg-orange-900/10 rounded-full translate-y-1/2 -translate-x-1/2 opacity-30 blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-6 sm:gap-8 relative z-10">
          <div className="shrink-0 transform hover:scale-105 transition-all">
            <BrandLogo size="lg" />
          </div>
          <div>
            <div className="flex items-center gap-3">
               <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">Active Member</p>
               <div className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-black font-display text-slate-900 dark:text-slate-100 tracking-tight uppercase mb-1">{profile?.displayName}</h2>
            <div className="flex items-center gap-2">
               <div className="bg-blue-50 dark:bg-blue-950/50 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/60 flex items-center gap-2">
                  <span className="text-[10px] font-black text-[#0B3D9E] dark:text-blue-400">ID NO</span>
                  <p className="text-[#0B3D9E] dark:text-blue-400 font-black text-base tracking-tight tabular-nums">#{profile?.serialNumber || 'NEW'}</p>
               </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-2 gap-4 relative z-10 lg:w-max w-full">
          {/* Earning & Deposit */}
          <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] px-6 sm:px-10 py-6 sm:py-8 rounded-[2.5rem] border border-blue-800/40 shadow-xl flex flex-col justify-center min-w-[150px] sm:min-w-[240px] relative overflow-hidden group transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform text-white">
               <DollarSign className="w-20 h-20" />
            </div>
            <p className="text-blue-200 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 leading-none relative z-10 w-full truncate">Earning Balance</p>
            <div className="flex items-baseline gap-1 sm:gap-2 relative z-10">
              <span className="text-[#FB923C] font-black text-xl sm:text-2xl tracking-tighter">৳</span>
              <p className="text-3xl sm:text-5xl font-black font-display text-white tracking-tighter tabular-nums leading-none truncate">
                {(Number(profile?.earningBalance) || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-[#131C31] px-6 sm:px-10 py-6 sm:py-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col justify-center min-w-[150px] sm:min-w-[240px] overflow-hidden transition-colors">
             <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] mb-3 leading-none w-full truncate">Deposit Balance</p>
             <div className="flex items-baseline gap-1 sm:gap-2">
                <span className="text-slate-400 dark:text-slate-500 font-black text-xl">৳</span>
                <p className="text-3xl sm:text-4xl font-black font-display text-[#0B3D9E] dark:text-blue-400 tracking-tighter tabular-nums leading-none truncate">
                  {(Number(profile?.depositBalance) || 0).toFixed(2)}
                </p>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          label="Jobs Completed" 
          value={dashboardStats.jobsCompleted.toString()} 
          icon={<Briefcase className="w-8 h-8" />}
          color="bg-[#0B3D9E]"
          trend="Lifetime Data"
        />
        <StatCard 
          label="Total Revenue" 
          value={formatCurrency(dashboardStats.totalRevenue)} 
          icon={<TrendingUp className="w-8 h-8" />}
          color="bg-emerald-600"
          trend="Total Earnings"
        />
        <StatCard 
          label="Active Queues" 
          value={dashboardStats.activeQueues.toString()} 
          icon={<LayoutDashboard className="w-8 h-8" />}
          color="bg-[#F97316]"
          trend="Processing Now"
        />
        <StatCard 
          label="Audit Pending" 
          value={dashboardStats.auditPending.toString()} 
          icon={<UserCheck className="w-8 h-8" />}
          color="bg-amber-500"
          trend="Awaiting Review"
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-white dark:bg-[#1E293B] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 transition-colors">
          <h3 className="text-xl font-bold font-display flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <Briefcase className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400" />
            Active Tasks
          </h3>
          <div className="space-y-4">
            {pendingTasks.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 text-center py-8">No active tasks found. Start earning today!</p>
            ) : (
              <div className="space-y-3">
                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-center mb-2">Pending Buyer Review</p>
                {pendingTasks.map((task) => (
                   <Link key={task.id} to="/submitted-jobs" className="block p-4 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 rounded-2xl transition-colors border border-slate-200/70 dark:border-slate-700">
                     <div className="flex items-start justify-between gap-4">
                       <div className="max-w-[70%]">
                         <h4 className="font-bold text-slate-900 dark:text-slate-100 truncate uppercase tracking-tight">{task.jobTitle || 'Job Submission'}</h4>
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1 tabular-nums">Reward: {formatCurrency(task.reward)}</p>
                       </div>
                       <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-black uppercase text-[10px] tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm border border-amber-200 dark:border-amber-900/50">
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
              className="flex items-center justify-between w-full p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl hover:bg-blue-50 dark:hover:bg-slate-700/80 border border-slate-200/70 dark:border-slate-700 transition-colors group"
            >
              <span className="font-bold text-slate-900 dark:text-slate-100">Browse Available Jobs</span>
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform text-slate-400 dark:text-slate-400 group-hover:text-[#0B3D9E] dark:group-hover:text-blue-400" />
            </Link>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E293B] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 transition-colors">
          <h3 className="text-xl font-bold font-display flex items-center gap-2 text-slate-900 dark:text-slate-100">
            <TrendingUp className="w-6 h-6 text-[#F97316]" />
            Wallet Actions
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Link 
                to="/deposit" 
                className="flex flex-col items-center justify-center p-6 bg-blue-50 dark:bg-blue-950/40 rounded-3xl hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-all group border border-blue-200/70 dark:border-blue-800/50"
              >
                <Plus className="w-8 h-8 text-[#0B3D9E] dark:text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest text-[#07266E] dark:text-blue-300">Add Money</span>
              </Link>
              <Link 
                to="/withdraw" 
                className="flex flex-col items-center justify-center p-6 bg-orange-50 dark:bg-orange-950/30 rounded-3xl hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all group border border-orange-200/70 dark:border-orange-800/50"
              >
                <Minus className="w-8 h-8 text-[#F97316] dark:text-[#FB923C] mb-2 group-hover:scale-110 transition-transform" />
                <span className="font-black text-xs uppercase tracking-widest text-orange-900 dark:text-[#FB923C]">Withdraw</span>
              </Link>
            </div>
            
            <button 
              onClick={() => setShowConvert(true)}
              className="flex w-full items-center justify-between p-4 bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#0B3D9E] dark:hover:bg-blue-700 text-white rounded-2xl transition-colors group shadow-md"
            >
               <div className="flex items-center gap-3">
                 <ArrowRightLeft className="w-5 h-5 text-[#FB923C] transition-colors" />
                 <span className="font-bold">Convert Balance</span>
               </div>
               <span className="bg-white/15 px-3 py-1 rounded-lg text-xs font-bold uppercase text-blue-100 group-hover:bg-white/20 transition-colors">Rates Applied</span>
            </button>
          </div>
        </div>
      </div>

      {/* Redeem Code Claiming Card */}
      <div className="bg-white dark:bg-[#1E293B] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-2xl">
              <Gift className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black font-display text-slate-900 dark:text-slate-100 uppercase tracking-tight">Redeem Code</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Claim your research or promotion bonus instantly</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleOpenHistoryModal}
            className="flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>History</span>
          </button>
        </div>

        {claimSuccessMsg && (
          <div id="user-claim-success" className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 rounded-2xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <p>{claimSuccessMsg}</p>
          </div>
        )}

        {claimErrorMsg && (
          <div id="user-claim-error" className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 rounded-2xl flex items-center gap-3 font-semibold text-sm transition-all animate-fadeIn">
            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <p>{claimErrorMsg}</p>
          </div>
        )}

        <form onSubmit={handleClaimRedeemCode} className="flex flex-col sm:flex-row gap-4 items-stretch">
          <input 
            type="text"
            placeholder="Enter Redeem Code"
            className="flex-1 px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl font-extrabold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 uppercase tracking-wide focus:border-[#0B3D9E] dark:focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all"
            value={claimCodeInput}
            onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase().replace(/\s+/g, ''))}
          />
          <button
            type="submit"
            disabled={claimLoading}
            className="px-8 py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl disabled:opacity-50 transition-all font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 whitespace-nowrap shadow-md shadow-orange-500/20"
          >
            {claimLoading ? 'Checking...' : 'Redeem Now'}
          </button>
        </form>
      </div>

      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-[#1E293B] rounded-[2.5rem] p-8 max-w-lg w-full shadow-2xl relative border border-slate-200 dark:border-slate-700/80 transition-colors">
            <button 
              onClick={() => setShowHistoryModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="mb-6 flex items-center gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 rounded-2xl">
                <History className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black font-display text-slate-900 dark:text-slate-100 uppercase tracking-tight">Redemption History</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Your previously claimed reward codes</p>
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto pr-2 space-y-3">
              {historyLoading ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400 font-semibold text-sm">
                  Loading redemption history...
                </div>
              ) : historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 font-bold text-sm bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  No codes claimed yet. Find codes in announcements or events!
                </div>
              ) : (
                historyList.map((item: any) => {
                  const rCode = item.redeem_codes || {};
                  return (
                    <div 
                      key={item.id} 
                      className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-white dark:hover:bg-slate-800 hover:shadow-sm transition-all"
                    >
                      <div>
                        <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                          {rCode.code || 'UNKNOWN'}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mt-0.5">
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
                        <div className="font-black text-sm text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{formatCurrency(rCode.amount || 0)}
                        </div>
                        <div className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-black uppercase tracking-widest">
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
                className="w-full py-4 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
           <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/80 rounded-[3rem] p-8 max-w-md w-full shadow-2xl relative transition-colors">
              <button 
                onClick={() => setShowConvert(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 p-2 rounded-full transition-colors"
              >
                 <X className="w-5 h-5" />
              </button>
              
              <div className="mb-8">
                 <h2 className="text-2xl font-black font-display text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                   <ArrowRightLeft className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400" />
                   Convert Balance
                 </h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Easily transfer funds between your wallets.</p>
              </div>

              <form onSubmit={handleConvert} className="space-y-6">
                 {convertError && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 p-4 rounded-2xl text-sm font-bold">{convertError}</div>}
                 
                 <div className="space-y-3">
                   <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Conversion Type</label>
                   <div className="grid grid-cols-2 gap-3">
                      <button 
                         type="button"
                         onClick={() => setConvertType('EarningToDeposit')}
                         className={cn(
                           "p-4 rounded-2xl border-2 text-center transition-all",
                           convertType === 'EarningToDeposit'
                             ? "border-[#0B3D9E] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-[#07266E] dark:text-blue-300"
                             : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                         )}
                      >
                         <p className="text-xs font-black uppercase mb-1">Earning to Deposit</p>
                         <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">{systemConfig?.transferEarningToDepositFee || 0}% Fee</p>
                      </button>
                      <button 
                         type="button"
                         onClick={() => setConvertType('DepositToEarning')}
                         className={cn(
                           "p-4 rounded-2xl border-2 text-center transition-all",
                           convertType === 'DepositToEarning'
                             ? "border-[#0B3D9E] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/50 text-[#07266E] dark:text-blue-300"
                             : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400"
                         )}
                      >
                         <p className="text-xs font-black uppercase mb-1">Deposit to Earning</p>
                         <p className="text-[10px] font-bold text-[#F97316] dark:text-[#FB923C] tabular-nums">{systemConfig?.transferDepositToEarningFee || 0}% Fee</p>
                      </button>
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Amount (BDT)</label>
                   <input 
                      type="number"
                      required
                      min="1"
                      placeholder="Enter amount to convert"
                      value={convertAmount}
                      onChange={e => setConvertAmount(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xl font-black text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#0B3D9E] tabular-nums"
                   />
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mt-2 px-1">
                       <span className="text-slate-500 dark:text-slate-400">Available:</span>
                       <span className="text-[#0B3D9E] dark:text-blue-400 tabular-nums">
                          {formatCurrency(convertType === 'EarningToDeposit' ? (Number(profile?.earningBalance) || 0) : (Number(profile?.depositBalance) || 0))}
                       </span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/70 space-y-2 mt-3 text-left">
                      <div className="flex justify-between text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        <span>Fee Deducted:</span>
                        <span className="text-rose-500 dark:text-rose-400 font-extrabold tabular-nums">
                          {isValidConvertAmount ? calculatedConvertFee.toFixed(2) + ' BDT' : '0.00 BDT'} ({currentFeePercent}%)
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest border-t border-slate-200 dark:border-slate-700/70 pt-2">
                        <span>Amount to Receive:</span>
                        <span className="text-[#0B3D9E] dark:text-[#FB923C] font-extrabold tabular-nums">
                          {isValidConvertAmount ? receivableConvertAmount.toFixed(2) + ' BDT' : '0.00 BDT'}
                        </span>
                      </div>
                    </div>
                  </div>

                 <button 
                   disabled={converting}
                   className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-orange-500/20 disabled:opacity-50 mt-4 transition-colors"
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
    <div className="bg-white dark:bg-[#1E293B] p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center gap-5 group hover:shadow-lg dark:hover:bg-slate-800 transition-all">
      <div className={`${color} text-white w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-transform group-hover:scale-110 shadow-md`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">{label}</p>
        <p className="text-2xl font-black font-display text-slate-900 dark:text-slate-100 tracking-tight tabular-nums">{value}</p>
        {trend && <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mt-0.5">{trend}</p>}
      </div>
    </div>
  );
}
