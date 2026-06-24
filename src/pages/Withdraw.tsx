import React, { useState, useEffect } from 'react';
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
  Info
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';

export function Withdraw() {
  const { profile, user, systemConfig, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    method: 'bKash' as 'bKash' | 'Nagad',
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
    if (totalDeduction > (profile?.earningBalance || 0)) {
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
          <div className="w-16 h-16 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Zap className="w-6 h-6 text-orange-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Preparing Withdrawal Gateway</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest animate-pulse">Checking withdrawal limits & fees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center gap-4">
        <div className="bg-orange-600 p-4 rounded-3xl text-white shadow-xl shadow-orange-100 dark:shadow-none transition-all">
           <ArrowUpRight className="w-8 h-8" />
        </div>
        <div>
           <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 uppercase tracking-tighter">Exit Capital</h1>
           <p className="text-gray-400 dark:text-slate-500 font-bold text-xs tracking-widest uppercase italic">Verified Payout Gateway</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Form Section */}
        <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[3rem] border border-gray-100 dark:border-slate-700 shadow-2xl shadow-gray-50 dark:shadow-none space-y-8 transition-colors">
           
           <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl flex items-start gap-3 transition-colors">
             <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
             <p className="text-sm text-amber-900 dark:text-amber-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
               {withdrawRules}
             </p>
           </div>

           <form onSubmit={handleWithdraw} className="space-y-8">
              <div className="bg-indigo-600 p-8 rounded-[2rem] text-white space-y-2 relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                   <Zap className="w-16 h-16" />
                 </div>
                 <p className="text-xs font-black text-indigo-300 uppercase tracking-widest leading-none mb-1">Withdrawable Balance</p>
                 <h3 className="text-5xl font-black tracking-tighter tabular-nums">{formatCurrency(profile?.earningBalance || 0)}</h3>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                       <select 
                         className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-orange-50 dark:focus:ring-orange-950/20 transition-all dark:text-white"
                         value={formData.method}
                         onChange={e => setFormData({...formData, method: e.target.value as any})}
                       >
                          {systemConfig?.withdrawBkashEnabled !== false && <option value="bKash" className="dark:bg-slate-800">bKash</option>}
                          {systemConfig?.withdrawNagadEnabled !== false && <option value="Nagad" className="dark:bg-slate-800">Nagad</option>}
                          {(systemConfig?.withdrawBkashEnabled === false && systemConfig?.withdrawNagadEnabled === false) && (
                            <option value="" disabled className="dark:bg-slate-800">No payment methods</option>
                          )}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Amount (Min ৳{minWithdraw})</label>
                       <div className="relative">
                          <input 
                            type="number" 
                            required
                            min={minWithdraw}
                            placeholder="0.00"
                            className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-orange-50 dark:focus:ring-orange-950/20 transition-all placeholder:text-gray-300 dark:placeholder:text-slate-500 dark:text-white"
                            value={formData.amount}
                            onChange={e => setFormData({...formData, amount: e.target.value})}
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-400 dark:text-slate-500">৳</span>
                       </div>
                    </div>
                 </div>

                 {formData.amount && Number(formData.amount) >= 20 && (
                   <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="p-4 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/50 space-y-2 transition-colors"
                   >
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-gray-500 dark:text-slate-400 font-bold">Requested Amount:</span>
                         <span className="font-black text-gray-900 dark:text-slate-100">{formatCurrency(Number(formData.amount))}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                         <span className="text-red-500 dark:text-red-400 font-bold">Platform Fee ({withdrawalFeePercent}%):</span>
                         <span className="font-black text-red-500 dark:text-red-400">+{formatCurrency(Number(formData.amount) * (withdrawalFeePercent / 100))}</span>
                      </div>
                      <div className="h-px bg-orange-200 dark:bg-orange-900/50" />
                      <div className="flex justify-between items-center text-sm">
                         <span className="text-indigo-600 dark:text-indigo-400 font-black uppercase tracking-widest">Total Deduction:</span>
                         <span className="font-black text-indigo-600 dark:text-indigo-400">{formatCurrency(Number(formData.amount) * (1 + withdrawalFeePercent / 100))}</span>
                      </div>
                   </motion.div>
                 )}

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Recipient Mobile Number</label>
                   <input 
                     type="text" 
                     required
                     placeholder="01xxxxxxxxx"
                     className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-orange-50 dark:focus:ring-orange-950/20 transition-all placeholder:text-gray-300 dark:placeholder:text-slate-500 dark:text-white"
                     value={formData.phone}
                     onChange={e => setFormData({...formData, phone: e.target.value})}
                   />
                 </div>
              </div>


              {successMsg ? (
                 <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-500 text-white p-5 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-green-100 dark:shadow-none"
                 >
                    <CheckCircle2 className="w-6 h-6" /> {successMsg}
                 </motion.div>
              ) : (
                <button 
                  disabled={submitting}
                  className="w-full py-5 bg-orange-600 text-white rounded-[2rem] font-black text-lg hover:bg-orange-700 transition-all shadow-xl shadow-orange-100 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-3 transition-colors"
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
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 dark:text-slate-100">
                 <History className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                 Withdrawal Logs
              </h2>
           </div>

           <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[2rem]" />
                ))
              ) : transactions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border border-dashed border-gray-200 dark:border-slate-700 text-center text-gray-400 dark:text-slate-500 italic transition-colors">
                  No payout events found.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:shadow-xl dark:hover:shadow-none transition-all">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl flex items-center justify-center",
                         tx.status === 'completed' ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400" :
                         tx.status === 'pending' ? "bg-indigo-100 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400" :
                         "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                       )}>
                          {tx.status === 'pending' ? <Clock className="w-6 h-6" /> : 
                           tx.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : 
                           <AlertCircle className="w-6 h-6" />}
                       </div>
                       <div>
                          <p className="font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">{tx.method} Payout</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">{format(tx.createdAt ? new Date(tx.createdAt) : new Date(), 'MMM dd, h:mm a')}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-gray-900 dark:text-slate-100">-{formatCurrency(tx.type === 'withdrawal' ? (tx.finalAmount !== undefined ? tx.finalAmount : (tx.amount - (tx.fee || 0))) : tx.amount)}</p>
                       <span className={cn(
                         "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                         tx.status === 'completed' ? "bg-green-500 text-white" :
                         tx.status === 'pending' ? "bg-indigo-500 text-white" :
                         "bg-red-500 text-white"
                       )}>
                         {tx.status}
                       </span>
                    </div>
                  </div>
                ))
              )}
           </div>
        </div>
      </div>
    </div>
  );
}
