import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Transaction } from '../types';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

export function Deposit() {
  const { profile, user, systemConfig, refreshProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  const minDeposit = Number(systemConfig?.minDeposit);
  
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
      
      // manually sort or let server sort. wait, server doesn't sort in proxy currently.
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
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Plus className="w-6 h-6 text-indigo-600 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold text-gray-900 dark:text-slate-100">Preparing Deposit Gateway</h3>
          <p className="text-xs text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest animate-pulse">Fetching official payment accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 pb-20">
      <div className="flex items-center gap-4">
        <div className="bg-indigo-600 p-4 rounded-3xl text-white shadow-xl shadow-indigo-100 dark:shadow-none transition-all">
           <Plus className="w-8 h-8" />
        </div>
        <div>
           <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 uppercase tracking-tighter">Add Liquidity</h1>
           <p className="text-gray-400 dark:text-slate-500 font-bold text-xs tracking-widest uppercase italic">Secure Deposit Gateway</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Form Section */}
        <div className="bg-white dark:bg-slate-800 p-8 md:p-10 rounded-[3rem] border border-gray-100 dark:border-slate-700 shadow-2xl shadow-gray-50 dark:shadow-none space-y-8 transition-colors">
           
           <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-5 rounded-2xl flex items-start gap-3 transition-colors">
              <AlertCircle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-900 dark:text-amber-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
                {depositRules}
              </p>
            </div>


           <form onSubmit={handleDeposit} className="space-y-8">
              <div className="bg-gray-900 dark:bg-slate-950 p-8 rounded-[2rem] text-white space-y-4 relative overflow-hidden group border border-transparent dark:border-slate-800 transition-colors">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                   <Smartphone className="w-16 h-16" />
                 </div>
                 <div>
                   <p className="text-xs font-black text-indigo-400 dark:text-indigo-500 uppercase tracking-widest">{formData.method} ({formData.method === 'Nagad' ? (systemConfig?.nagadMethod || 'Personal') : (systemConfig?.bkashMethod || 'Personal')})</p>
                   <div className="flex items-center gap-4 mt-2">
                      <p className="text-4xl font-black tracking-tighter">{formData.method === 'Nagad' ? (systemConfig?.nagadNumber || '01870866189') : (systemConfig?.bkashNumber || '01870866189')}</p>
                      <button 
                       type="button" 
                       onClick={copyNumber} 
                       className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
                      >
                        <Copy className="w-5 h-5" />
                      </button>
                   </div>
                 </div>
                 <div className="flex gap-4 pt-2">
                    {systemConfig?.depositBkashEnabled !== false && (
                       <div className="px-4 py-2 bg-pink-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-pink-400">bKash</div>
                    )}
                    {systemConfig?.depositNagadEnabled !== false && (
                       <div className="px-4 py-2 bg-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-orange-400">Nagad</div>
                    )}
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Payment Method</label>
                       <select 
                         className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/20 transition-all dark:text-white"
                         value={formData.method}
                         onChange={e => setFormData({...formData, method: e.target.value as any})}
                       >
                          {systemConfig?.depositBkashEnabled !== false && <option value="bKash" className="dark:bg-slate-800">bKash</option>}
                          {systemConfig?.depositNagadEnabled !== false && <option value="Nagad" className="dark:bg-slate-800">Nagad</option>}
                          {(systemConfig?.depositBkashEnabled === false && systemConfig?.depositNagadEnabled === false) && (
                            <option value="" disabled className="dark:bg-slate-800">No payment methods</option>
                          )}
                       </select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Amount (Min 100)</label>
                       <input 
                         type="number" 
                         required
                         min="100"
                         placeholder="৳ 0.00"
                         className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/20 transition-all placeholder:text-gray-300 dark:placeholder:text-slate-500 dark:text-white"
                         value={formData.amount}
                         onChange={e => setFormData({...formData, amount: e.target.value})}
                       />
                    </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Sender Mobile Number</label>
                   <input 
                     type="text" 
                     required
                     placeholder="01xxxxxxxxx"
                     className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/20 transition-all placeholder:text-gray-300 dark:placeholder:text-slate-500 dark:text-white"
                     value={formData.phone}
                     onChange={e => setFormData({...formData, phone: e.target.value})}
                   />
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Transaction ID (TrxID)</label>
                   <input 
                     type="text" 
                     required
                     placeholder="8X9Y10Z..."
                     className="w-full p-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 font-bold outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/20 transition-all placeholder:text-gray-300 dark:placeholder:text-slate-500 dark:text-white"
                     value={formData.transactionId}
                     onChange={e => setFormData({...formData, transactionId: e.target.value})}
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
                  className="w-full py-5 bg-indigo-600 text-white rounded-[2rem] font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 dark:shadow-none disabled:opacity-50 flex items-center justify-center gap-3 transition-colors"
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
        <div className="space-y-6">
           <div className="flex items-center justify-between px-2">
              <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2 dark:text-slate-100">
                 <History className="w-6 h-6 text-gray-400 dark:text-slate-500" />
                 Deposit History
              </h2>
           </div>

           <div className="space-y-4">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-[2rem]" />
                ))
              ) : transactions.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 p-12 rounded-[3rem] border border-dashed border-gray-200 dark:border-slate-700 text-center text-gray-400 dark:text-slate-500 italic transition-colors">
                  No liquidity events found.
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm flex items-center justify-between group hover:shadow-xl dark:hover:shadow-none transition-all">
                    <div className="flex items-center gap-4">
                       <div className={cn(
                         "w-12 h-12 rounded-2xl flex items-center justify-center",
                         tx.status === 'completed' ? "bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400" :
                         tx.status === 'pending' ? "bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400" :
                         "bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                       )}>
                          {tx.status === 'pending' ? <Clock className="w-6 h-6" /> : 
                           tx.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : 
                           <AlertCircle className="w-6 h-6" />}
                       </div>
                       <div>
                          <p className="font-black text-gray-900 dark:text-slate-100 uppercase tracking-tight">{tx.method} Deposit</p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 font-bold uppercase tracking-widest">{format(tx.createdAt ? new Date(tx.createdAt) : new Date(), 'MMM dd, h:mm a')}</p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className="text-xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(tx.amount)}</p>
                       <span className={cn(
                         "text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md",
                         tx.status === 'completed' ? "bg-green-500 text-white" :
                         tx.status === 'pending' ? "bg-orange-500 text-white" :
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
