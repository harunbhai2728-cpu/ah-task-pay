import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUpRight, 
  Minus, 
  History,
  CheckCircle2,
  Smartphone,
  Zap,
  Clock,
  AlertCircle,
  Info,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { BkashLogo, NagadLogo, RechargeLogo, PaymentMethodLogo } from '../components/PaymentMethodLogos';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function Withdraw() {
  const { profile, user, systemConfig, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const historyRef = useRef<HTMLDivElement>(null);
  
  // Dynamic Withdraw Rules States
  const [withdrawRules, setWithdrawRules] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);

  const fetchWithdrawRules = async () => {
    try {
      const res = await fetch('/api/settings/withdraw-rules');
      if (res.ok) {
        const json = await res.json();
        if (json.setting_value) {
          setWithdrawRules(json.setting_value);
        }
      }
    } catch (e) {
      console.error("Failed to fetch withdraw rules:", e);
    } finally {
      setRulesLoading(false);
    }
  };

  const minWithdraw = Number(systemConfig?.minWithdraw);
  const withdrawalFeePercent = Number(systemConfig?.withdrawalFee);
  
  const [formData, setFormData] = useState({
    amount: '',
    method: 'bKash' as 'bKash' | 'Nagad' | 'Mobile Recharge',
    phone: '',
  });
  
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchTransactions = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/proxy', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token },
           body: JSON.stringify({
               table: 'transactions',
               method: 'select',
               args: ['*'],
               eq: ['type', 'withdrawal']
           })
      });
      const { data, error } = await res.json();
        
      if (error) throw new Error(error);
      const sorted = (data || []).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(sorted as Transaction[]);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
    fetchWithdrawRules();
  }, [user?.id]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    const amt = Number(formData.amount);
    const fee = amt * (withdrawalFeePercent / 100);
    const totalDeduction = amt + fee;

    if (amt < minWithdraw) {
      alert(`Minimum withdrawal is ${minWithdraw} BDT`);
      return;
    }
    if (totalDeduction > (Number(profile?.earningBalance) || 0)) {
      alert("পর্যাপ্ত ব্যালেন্স নাই (Insufficient Earning Balance for amount + fee)");
      return;
    }

    setSubmitting(true);
    try {
      const authArgs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token };
      const { data: userDoc, error: userErr } = await fetch('/api/proxy', {
          method: 'POST', headers: authArgs,
          body: JSON.stringify({ table: 'profiles', method: 'select', args: ['*'], eq: ['id', user.id], single: true })
      }).then(r => r.json());
        
      if (userErr || !userDoc) throw new Error("User profile not found");
      const currentEarningBalance = userDoc.earningBalance || 0;
      if (currentEarningBalance < totalDeduction) throw new Error("Insufficient funds for this operation.");

      // Create withdrawal transaction record
      const { error: txErr } = await fetch('/api/proxy', {
        method: 'POST', headers: authArgs,
        body: JSON.stringify({ table: 'transactions', method: 'insert', args: [{
            userId: user.id,
            userSerial: profile.serialNumber || null,
            userName: profile.displayName || user.user_metadata?.name || 'User',
            type: 'withdrawal',
            amount: totalDeduction,
            fee: fee,
            finalAmount: amt,
            method: formData.method,
            phone: formData.phone,
            status: 'pending',
            createdAt: new Date().toISOString()
        }]})
      }).then(r => r.json());
      if (txErr) throw new Error(txErr);

      // Immediately deduct from balance (will be refunded if rejected)
      const { error: updateErr } = await fetch('/api/proxy', {
        method: 'POST', headers: authArgs,
        body: JSON.stringify({ table: 'profiles', method: 'update', args: [{
           earningBalance: currentEarningBalance - totalDeduction,
           pendingEarningBalance: (userDoc.pendingEarningBalance || 0) + totalDeduction
        }], eq: ['id', user.id]})
      }).then(r => r.json());
      
      if (updateErr) throw updateErr;

      await refreshProfile();
      setSuccessMsg("Withdrawal request initiated! Funds deducted and queued for processing.");
      setFormData({ amount: '', method: 'bKash', phone: '' });
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchTransactions();
    } catch (err: any) {
      console.error(err);
      alert(err.message || err.toString());
    } finally {
      setSubmitting(false);
    }
  };

  if (systemConfig === null || loading || rulesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-[#CEDDF6] dark:border-[#1C3882] border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-[#0B3D9E] dark:text-[#FB923C] animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-display text-[#071845] dark:text-white">Preparing Withdrawal Gateway</h3>
          <p className="text-xs text-slate-500 dark:text-blue-200/70 font-bold uppercase tracking-widest animate-pulse">Checking withdrawal limits & fees...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = transactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-8 pb-20">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white border border-blue-400/20 shadow-xl shadow-blue-950/15 flex items-center gap-4">
        <div className="bg-white/10 border border-white/15 p-3.5 rounded-2xl text-[#FB923C] shrink-0">
           <ArrowUpRight className="w-8 h-8" />
        </div>
        <div>
           <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight">Exit Capital</h1>
           <p className="text-blue-100 font-medium text-xs sm:text-sm tracking-wide mt-0.5">Verified Payout Gateway — Cash out your earnings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
        {/* Form Section */}
        <div className="bg-white dark:bg-[#0A1638] p-5 sm:p-8 md:p-10 rounded-3xl sm:rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 sm:space-y-8 transition-colors">
           
           <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-4 sm:p-5 rounded-2xl flex items-start gap-3 transition-colors">
             <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
               {withdrawRules}
             </p>
           </div>

           <form onSubmit={handleWithdraw} className="space-y-6 sm:space-y-8">
              <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-5 sm:p-8 rounded-3xl sm:rounded-[2rem] text-white space-y-2 relative overflow-hidden group border border-blue-800/40 shadow-xl">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                   <Zap className="w-16 h-16" />
                 </div>
                 <p className="text-xs font-black text-blue-200 uppercase tracking-widest leading-none mb-1">Withdrawable Balance</p>
                 <h3 className="text-3xl sm:text-5xl font-black font-display tracking-tighter tabular-nums truncate">{formatCurrency(Number(profile?.earningBalance) || 0)}</h3>
              </div>

              <div className="space-y-6">
                 {/* Payment Method Selector Cards with Authentic Logos */}
                 <div className="space-y-3">
                   <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-wider flex items-center justify-between">
                     <span>উইথড্র মেথড সিলেক্ট করুন (Payment Method)</span>
                     <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Active Gateway</span>
                   </label>

                   {/* Gateways strictly side-by-side (পাশাপাশি) on all screens */}
                   <div className="grid grid-cols-3 gap-2 sm:gap-4">
                     {/* bKash */}
                     {systemConfig?.withdrawBkashEnabled !== false && (
                       <button
                         type="button"
                         onClick={() => setFormData({ ...formData, method: 'bKash' })}
                         className={cn(
                           "p-2 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 relative overflow-hidden group cursor-pointer",
                           formData.method === 'bKash'
                             ? "border-[#E2136E] bg-pink-50/90 dark:bg-pink-950/30 shadow-md shadow-[#E2136E]/20 ring-2 ring-[#E2136E]/20 scale-[1.02]"
                             : "border-[#DCE7FA] dark:border-[#1C3882]/60 bg-[#F2F6FE] dark:bg-[#050F2B] hover:border-pink-300 dark:hover:border-pink-900/40 opacity-85 hover:opacity-100"
                         )}
                       >
                         {formData.method === 'bKash' && (
                           <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-4 h-4 rounded-full bg-[#E2136E] text-white flex items-center justify-center shadow-sm">
                             <Check className="w-2.5 h-2.5 stroke-[3]" />
                           </div>
                         )}
                         <BkashLogo size="md" showLabel={true} labelPosition="bottom" />
                       </button>
                     )}

                     {/* Nagad */}
                     {systemConfig?.withdrawNagadEnabled !== false && (
                       <button
                         type="button"
                         onClick={() => setFormData({ ...formData, method: 'Nagad' })}
                         className={cn(
                           "p-2 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 relative overflow-hidden group cursor-pointer",
                           formData.method === 'Nagad'
                             ? "border-[#F15A24] bg-orange-50/90 dark:bg-orange-950/30 shadow-md shadow-[#F15A24]/20 ring-2 ring-[#F15A24]/20 scale-[1.02]"
                             : "border-[#DCE7FA] dark:border-[#1C3882]/60 bg-[#F2F6FE] dark:bg-[#050F2B] hover:border-orange-300 dark:hover:border-orange-900/40 opacity-85 hover:opacity-100"
                         )}
                       >
                         {formData.method === 'Nagad' && (
                           <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-4 h-4 rounded-full bg-[#F15A24] text-white flex items-center justify-center shadow-sm">
                             <Check className="w-2.5 h-2.5 stroke-[3]" />
                           </div>
                         )}
                         <NagadLogo size="md" showLabel={true} labelPosition="bottom" />
                       </button>
                     )}

                     {/* Mobile Recharge */}
                     <button
                       type="button"
                       onClick={() => setFormData({ ...formData, method: 'Mobile Recharge' })}
                       className={cn(
                         "p-2 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 relative overflow-hidden group cursor-pointer",
                         formData.method === 'Mobile Recharge'
                           ? "border-[#0284C7] bg-sky-50/90 dark:bg-sky-950/30 shadow-md shadow-[#0284C7]/20 ring-2 ring-[#0284C7]/20 scale-[1.02]"
                           : "border-[#DCE7FA] dark:border-[#1C3882]/60 bg-[#F2F6FE] dark:bg-[#050F2B] hover:border-sky-300 dark:hover:border-sky-900/40 opacity-85 hover:opacity-100"
                       )}
                     >
                       {formData.method === 'Mobile Recharge' && (
                         <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 w-4 h-4 rounded-full bg-[#0284C7] text-white flex items-center justify-center shadow-sm">
                           <Check className="w-2.5 h-2.5 stroke-[3]" />
                         </div>
                       )}
                       <RechargeLogo size="md" showLabel={true} labelPosition="bottom" />
                     </button>
                   </div>
                 </div>

                 {/* Amount Input */}
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">
                        উইথড্র এমাউন্ট (Amount - Min ৳{minWithdraw})
                      </label>
                      <span className="text-[10px] font-bold text-[#0B3D9E] dark:text-[#FB923C]">Available: ৳{profile?.earningBalance || 0}</span>
                    </div>
                    <div className="relative">
                       <input 
                         type="number" 
                         required
                         min={minWithdraw}
                         placeholder="0.00"
                         className="w-full p-4 rounded-2xl bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 font-bold outline-none focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] transition-all placeholder:text-slate-400 dark:placeholder:text-blue-200/40 text-[#071845] dark:text-white tabular-nums"
                         value={formData.amount}
                         onChange={e => setFormData({...formData, amount: e.target.value})}
                       />
                       <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-black text-[#0B3D9E] dark:text-blue-300">৳</span>
                    </div>
                 </div>

                 {formData.amount && Number(formData.amount) >= minWithdraw && (
                   <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-[#F2F6FE] dark:bg-[#050F2B] rounded-2xl border border-[#DCE7FA] dark:border-[#1C3882]/60 space-y-2 transition-colors"
                   >
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-500 dark:text-blue-200/70 font-bold">Selected Method:</span>
                         <span className="font-black text-[#071845] dark:text-white">{formData.method}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-slate-500 dark:text-blue-200/70 font-bold">Requested Amount:</span>
                         <span className="font-black text-[#071845] dark:text-white tabular-nums">{formatCurrency(Number(formData.amount))}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-rose-500 dark:text-rose-400 font-bold">Platform Fee ({withdrawalFeePercent}%):</span>
                         <span className="font-black text-rose-500 dark:text-rose-400 tabular-nums">+{formatCurrency(Number(formData.amount) * (withdrawalFeePercent / 100))}</span>
                      </div>
                      <div className="h-px bg-[#DCE7FA] dark:bg-[#1C3882]/60" />
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-[#0B3D9E] dark:text-[#FB923C] font-black uppercase tracking-widest">Total Deduction:</span>
                         <span className="font-black text-[#0B3D9E] dark:text-[#FB923C] tabular-nums">{formatCurrency(Number(formData.amount) * (1 + withdrawalFeePercent / 100))}</span>
                      </div>
                   </motion.div>
                 )}

                 {/* Phone Number Input */}
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1 flex items-center justify-between">
                     <span>
                       {formData.method === 'bKash' 
                         ? 'বিকাশ পার্সোনাল নম্বর (bKash Number)' 
                         : formData.method === 'Nagad' 
                           ? 'নগদ পার্সোনাল নম্বর (Nagad Number)' 
                           : 'মোবাইল রিচার্জ নম্বর (Any BD SIM)'}
                     </span>
                     <span className="text-[10px] text-slate-500 dark:text-blue-200/60 font-medium">11 Digits (01xxxxxxxxx)</span>
                   </label>
                   <input 
                     type="text" 
                     required
                     placeholder="01xxxxxxxxx"
                     pattern="^01[3-9][0-9]{8}$"
                     title="11 digit Bangladeshi mobile number (01xxxxxxxxx)"
                     className="w-full p-4 rounded-2xl bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 font-bold outline-none focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] transition-all placeholder:text-slate-400 dark:placeholder:text-blue-200/40 text-[#071845] dark:text-white tabular-nums"
                     value={formData.phone}
                     onChange={e => setFormData({...formData, phone: e.target.value})}
                   />
                   {formData.method === 'Mobile Recharge' && (
                     <p className="text-[11px] font-medium text-sky-600 dark:text-sky-400 pl-1">
                       সাপোর্টেড অপারেটর: Grameenphone, Robi, Banglalink, Airtel, Teletalk
                     </p>
                   )}
                 </div>
              </div>


              {successMsg ? (
                 <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-600 text-white p-5 rounded-2xl font-bold flex items-center gap-3 shadow-lg"
                 >
                    <CheckCircle2 className="w-6 h-6" /> {successMsg}
                 </motion.div>
              ) : (
                <button 
                  disabled={submitting}
                  className="w-full py-5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-[2rem] font-black text-lg transition-all shadow-xl shadow-orange-500/20 disabled:opacity-50 flex items-center justify-center gap-3 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : <ArrowUpRight className="w-6 h-6" />}
                  {submitting ? "Processing..." : "INITIATE WITHDRAWAL"}
                </button>
              )}
           </form>
        </div>

        {/* History Section */}
        <div ref={historyRef} className="space-y-6 scroll-mt-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black font-display uppercase tracking-tight flex items-center gap-2 text-[#071845] dark:text-white">
                 <History className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400" />
                 Withdrawal Logs
              </h2>
           </div>

           <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-[#DCE7FA]/60 dark:bg-[#0A1638] animate-pulse rounded-[2rem]" />
                ))
              ) : transactions.length === 0 ? (
                <div className="bg-white dark:bg-[#0A1638] p-12 rounded-[2.5rem] border border-dashed border-[#D7E3F7] dark:border-[#1C3882]/55 text-center text-slate-500 dark:text-blue-200/70 italic transition-colors">
                  No payout events found.
                </div>
              ) : (
                paginatedTransactions.map((tx) => (
                  <div key={tx.id} className="bg-white dark:bg-[#0A1638] p-6 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] flex items-center justify-between group hover:border-[#0B3D9E]/60 dark:hover:border-blue-400/50 transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-[#F2F6FE] dark:bg-[#050F2B] p-2 shrink-0 border border-[#DCE7FA] dark:border-[#1C3882]/60 shadow-sm">
                          <PaymentMethodLogo method={tx.method} size="sm" showLabel={false} />
                       </div>
                       <div>
                          <p className="font-black text-[#071845] dark:text-white uppercase tracking-tight">{tx.method || 'Withdrawal'} Payout</p>
                          <p className="text-[10px] text-slate-500 dark:text-blue-200/70 font-bold uppercase tracking-widest">{format(tx.createdAt ? new Date(tx.createdAt) : new Date(), 'MMM dd, h:mm a')}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-[#071845] dark:text-white tabular-nums">-{formatCurrency(tx.type === 'withdrawal' ? (tx.finalAmount !== undefined ? tx.finalAmount : (tx.amount - (tx.fee || 0))) : tx.amount)}</p>
                       <span className={cn(
                         "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                         tx.status === 'completed' ? "bg-emerald-500 text-white" :
                         tx.status === 'pending' ? "bg-[#0B3D9E] text-white" :
                         "bg-rose-500 text-white"
                       )}>
                         {tx.status}
                       </span>
                    </div>
                  </div>
                ))
              )}
           </div>

           {!loading && transactions.length > 0 && (
             <Pagination
               currentPage={safePage}
               totalItems={transactions.length}
               pageSize={PAGE_SIZE}
               onPageChange={setCurrentPage}
               itemLabel="withdrawals"
               scrollTargetRef={historyRef}
             />
           )}
        </div>
      </div>
    </div>
  );
}
