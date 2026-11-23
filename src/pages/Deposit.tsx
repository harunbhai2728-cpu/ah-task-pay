import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowDownLeft, 
  Plus, 
  History,
  CheckCircle2,
  Smartphone,
  Copy,
  Zap,
  Clock,
  AlertCircle,
  Check
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { BkashLogo, NagadLogo, PaymentMethodLogo } from '../components/PaymentMethodLogos';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function Deposit() {
  const { profile, user, systemConfig, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const historyRef = useRef<HTMLDivElement>(null);
  
  // Dynamic Deposit Rules States
  const [depositRules, setDepositRules] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);

  const fetchDepositRules = async () => {
    try {
      const res = await fetch('/api/settings/deposit-rules');
      if (res.ok) {
        const json = await res.json();
        if (json.setting_value) {
          setDepositRules(json.setting_value);
        }
      }
    } catch (e) {
      console.error("Failed to fetch deposit rules:", e);
    } finally {
      setRulesLoading(false);
    }
  };
  
  const minDeposit = Number(systemConfig?.minDeposit || 100);
  
  const [formData, setFormData] = useState({
    amount: '',
    method: 'bKash' as 'bKash' | 'Nagad',
    phone: '',
    transactionId: ''
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
               eq: ['type', 'deposit'] // Server will enforce userId=user.id
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
    fetchDepositRules();
  }, [user?.id]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (Number(formData.amount) < minDeposit) {
      alert(`Minimum deposit is ${minDeposit} BDT`);
      return;
    }
    
    setSubmitting(true);
    try {
      const authArgs = { 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session?.access_token, 'Content-Type': 'application/json' };
      const { error: insertErr } = await fetch('/api/proxy', {
           method: 'POST', headers: authArgs,
           body: JSON.stringify({ table: 'transactions', method: 'insert', args: [{
               userId: user.id,
               userSerial: profile?.serialNumber || null,
               userName: profile?.displayName || user.user_metadata?.name || 'User',
               type: 'deposit',
               amount: Number(formData.amount),
               method: formData.method,
               phone: formData.phone,
               transactionId: formData.transactionId,
               status: 'pending',
               createdAt: new Date().toISOString()
           }]})
      }).then(r => r.json());

      if (insertErr) throw new Error(insertErr);
      
      const { data: userRef } = await fetch('/api/proxy', {
           method: 'POST', headers: authArgs,
           body: JSON.stringify({ table: 'profiles', method: 'select', args: ['*'], eq: ['id', user.id], single: true })
      }).then(r => r.json());
      
      if (userRef) {
        await fetch('/api/proxy', {
           method: 'POST', headers: authArgs,
           body: JSON.stringify({ table: 'profiles', method: 'update', args: [{
              pendingDepositBalance: (userRef.pendingDepositBalance || 0) + Number(formData.amount)
           }], eq: ['id', user.id] })
        });
      }

      await refreshProfile();
      setSuccessMsg("Deposit request submitted! Our team will verify it soon.");
      setFormData({ amount: '', method: 'bKash', phone: '', transactionId: '' });
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchTransactions();
    } catch (err) {
      console.error(err);
      alert("Failed to submit deposit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const copyNumber = () => {
    const defaultNum = formData.method === 'Nagad' ? (systemConfig?.nagadNumber || '01870866189') : (systemConfig?.bkashNumber || '01870866189');
    navigator.clipboard.writeText(defaultNum);
    alert("Number copied to clipboard!");
  };

  if (systemConfig === null || loading || rulesLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-fadeIn">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Plus className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">Preparing Deposit Gateway</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest animate-pulse">Fetching official payment accounts...</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(transactions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = transactions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-[#041645] to-[#0B3D9E] p-4 rounded-3xl text-white shadow-xl shadow-blue-900/15 dark:shadow-none transition-all">
           <Plus className="w-8 h-8" />
        </div>
        <div>
           <h1 className="text-3xl font-black font-display text-slate-900 dark:text-slate-100 uppercase tracking-tighter">Add Liquidity</h1>
           <p className="text-slate-500 dark:text-slate-400 font-bold text-xs tracking-widest uppercase italic">Secure Deposit Gateway</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Form Section */}
        <div className="bg-white dark:bg-[#1E293B] p-8 md:p-10 rounded-[3rem] border border-slate-200 dark:border-slate-700/80 shadow-lg shadow-slate-200/40 dark:shadow-none space-y-8 transition-colors">
           
           <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl flex items-start gap-3 transition-colors">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
                {depositRules}
              </p>
            </div>

           <form onSubmit={handleDeposit} className="space-y-8">
              {/* Account Number Box with Active Brand Logo */}
              <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-6 sm:p-8 rounded-[2rem] text-white space-y-4 relative overflow-hidden group border border-blue-800/40 transition-colors shadow-xl">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                   <Smartphone className="w-16 h-16" />
                 </div>
                 
                 <div className="flex items-center justify-between gap-3">
                   <div>
                     <p className="text-xs font-black text-blue-200 uppercase tracking-widest">
                       {formData.method} ({formData.method === 'Nagad' ? (systemConfig?.nagadMethod || 'Personal') : (systemConfig?.bkashMethod || 'Personal')}) Number
                     </p>
                     <div className="flex items-center gap-3 sm:gap-4 mt-2">
                        <p className="text-2xl sm:text-4xl font-black font-display tracking-tighter tabular-nums">
                          {formData.method === 'Nagad' ? (systemConfig?.nagadNumber || '01870866189') : (systemConfig?.bkashNumber || '01870866189')}
                        </p>
                        <button 
                         type="button" 
                         onClick={copyNumber} 
                         title="Copy number"
                         className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                     </div>
                   </div>
                   
                   {/* Official Brand Logo of Selected Method */}
                   <div className="p-2 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10 shrink-0 shadow-md">
                     {formData.method === 'Nagad' ? (
                       <NagadLogo size="sm" showLabel={false} />
                     ) : (
                       <BkashLogo size="sm" showLabel={false} />
                     )}
                   </div>
                 </div>

                 {/* Available Deposit Options Indicators */}
                 <div className="flex items-center gap-2 sm:gap-3 pt-2">
                    {systemConfig?.depositBkashEnabled !== false && (
                       <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-900/60 rounded-xl text-[11px] font-bold border border-pink-500/50">
                         <BkashLogo size="xs" showLabel={false} />
                         <span>bKash (বিকাশ)</span>
                       </div>
                    )}
                    {systemConfig?.depositNagadEnabled !== false && (
                       <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-900/60 rounded-xl text-[11px] font-bold border border-orange-500/50">
                         <NagadLogo size="xs" showLabel={false} />
                         <span>Nagad (নগদ)</span>
                       </div>
                    )}
                 </div>
              </div>

              <div className="space-y-6">
                 {/* Deposit Method Selector Cards with Official Logos (Side by Side) */}
                 <div className="space-y-3">
                   <label className="text-xs font-black text-gray-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                     <span>ডিপোজিট মেথড সিলেক্ট করুন (Select Method)</span>
                     <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">● Active Gateway</span>
                   </label>

                   <div className="grid grid-cols-2 gap-3 sm:gap-4">
                     {/* bKash */}
                     {systemConfig?.depositBkashEnabled !== false && (
                       <button
                         type="button"
                         onClick={() => setFormData({ ...formData, method: 'bKash' })}
                         className={cn(
                           "p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 relative overflow-hidden group cursor-pointer",
                           formData.method === 'bKash'
                             ? "border-[#E2136E] bg-pink-50/90 dark:bg-pink-950/30 shadow-md shadow-[#E2136E]/20 ring-2 ring-[#E2136E]/20 scale-[1.02]"
                             : "border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-700/40 hover:border-pink-300 dark:hover:border-pink-900/40 opacity-85 hover:opacity-100"
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
                     {systemConfig?.depositNagadEnabled !== false && (
                       <button
                         type="button"
                         onClick={() => setFormData({ ...formData, method: 'Nagad' })}
                         className={cn(
                           "p-3 sm:p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center text-center gap-1.5 sm:gap-2 relative overflow-hidden group cursor-pointer",
                           formData.method === 'Nagad'
                             ? "border-[#F15A24] bg-orange-50/90 dark:bg-orange-950/30 shadow-md shadow-[#F15A24]/20 ring-2 ring-[#F15A24]/20 scale-[1.02]"
                             : "border-gray-200 dark:border-slate-700 bg-gray-50/70 dark:bg-slate-700/40 hover:border-orange-300 dark:hover:border-orange-900/40 opacity-85 hover:opacity-100"
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
                   </div>
                 </div>

                 {/* Amount Input */}
                 <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">
                        ডিপোজিট এমাউন্ট (Amount - Min ৳{minDeposit})
                      </label>
                      <span className="text-[10px] font-bold text-gray-400">Min: ৳{minDeposit}</span>
                    </div>
                    <input 
                      type="number" 
                      required
                      min={minDeposit}
                      placeholder={`৳ ${minDeposit}.00`}
                      className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white tabular-nums"
                      value={formData.amount}
                      onChange={e => setFormData({...formData, amount: e.target.value})}
                    />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                     যে নম্বর থেকে টাকা পাঠিয়েছেন (Sender Mobile Number)
                   </label>
                   <input 
                     type="text" 
                     required
                     placeholder="01xxxxxxxxx"
                     className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white tabular-nums"
                     value={formData.phone}
                     onChange={e => setFormData({...formData, phone: e.target.value})}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">
                     ট্রানজেকশন আইডি (Transaction ID / TrxID)
                   </label>
                   <input 
                     type="text" 
                     required
                     placeholder="e.g. 8X9Y10Z2"
                     className="w-full p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 font-bold outline-none focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-white uppercase"
                     value={formData.transactionId}
                     onChange={e => setFormData({...formData, transactionId: e.target.value})}
                   />
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
                  ) : <Zap className="w-6 h-6" />}
                  {submitting ? "Processing..." : "DEPOSIT NOW"}
                </button>
              )}
           </form>
        </div>

        {/* History Section */}
        <div ref={historyRef} className="space-y-6 scroll-mt-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black font-display uppercase tracking-tight flex items-center gap-2 text-slate-900 dark:text-slate-100">
                 <History className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400" />
                 Deposit History
              </h2>
           </div>

           <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-[2rem]" />
                ))
              ) : transactions.length === 0 ? (
                <div className="bg-white dark:bg-[#1E293B] p-12 rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-700 text-center text-slate-400 dark:text-slate-500 italic transition-colors">
                  No liquidity events found.
                </div>
              ) : (
                paginatedTransactions.map((tx) => (
                  <div key={tx.id} className="bg-white dark:bg-[#1E293B] p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm flex items-center justify-between group hover:shadow-lg dark:hover:shadow-none transition-all">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-50 dark:bg-slate-800/80 p-2 shrink-0 border border-slate-200/70 dark:border-slate-700 shadow-sm">
                          <PaymentMethodLogo method={tx.method} size="sm" showLabel={false} />
                       </div>
                       <div>
                          <p className="font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight">{tx.method || 'Deposit'} Deposit</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">{format(tx.createdAt ? new Date(tx.createdAt) : new Date(), 'MMM dd, h:mm a')}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(tx.amount)}</p>
                       <span className={cn(
                         "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                         tx.status === 'completed' ? "bg-emerald-500 text-white" :
                         tx.status === 'pending' ? "bg-[#F97316] text-white" :
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
               itemLabel="deposits"
               scrollTargetRef={historyRef}
             />
           )}
        </div>
      </div>
    </div>
  );
}
