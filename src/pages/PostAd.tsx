import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Send, Image as ImageIcon, Link2, Calendar, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import { compressImage } from '../lib/imageCompress';

const AD_PRICING = [
  { days: 1, label: '১ দিন', price: 50 },
  { days: 3, label: '৩ দিন', price: 100 },
  { days: 5, label: '৫ দিন', price: 150 },
  { days: 7, label: '৭ দিন', price: 200 },
  { days: 30, label: '১ মাস', price: 600 },
];

export function PostAd() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    image: '',
    link: '',
    durationDays: 1,
  });

  const [adPostRules, setAdPostRules] = useState('');
  const [rulesLoading, setRulesLoading] = useState(true);

  React.useEffect(() => {
    const fetchAdPostRules = async () => {
      try {
        const res = await fetch('/api/settings/ad-post-rules');
        if (res.ok) {
          const json = await res.json();
          if (json.setting_value) {
            setAdPostRules(json.setting_value);
          }
        }
      } catch (e) {
        console.error("Failed to fetch ad post rules:", e);
      } finally {
        setRulesLoading(false);
      }
    };
    fetchAdPostRules();
  }, []);

  const selectedPricing = AD_PRICING.find(p => p.days === formData.durationDays) || AD_PRICING[0];
  const grandTotal = selectedPricing.price;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    if ((Number(profile.depositBalance) || 0) < grandTotal) {
      setError(`Insufficient deposit balance. You need ${formatCurrency(grandTotal)} but have ${formatCurrency(Number(profile.depositBalance) || 0)}.`);
      return;
    }

    if (!formData.image) {
      setError("Please upload an image for the advertisement.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: userDoc, error: userErr } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      
      if (!userDoc || userErr) throw new Error("User not found");
      
      const currentDepositBalance = userDoc.depositBalance || 0;
      if (currentDepositBalance < grandTotal) throw new Error("Insufficient deposit balance.");

      // Create Ad
      const { error: adErr } = await supabase.from('advertisements').insert([{
        userId: user.id,
        userSerial: profile.serialNumber || null,
        image: formData.image,
        link: formData.link,
        durationDays: formData.durationDays,
        price: grandTotal,
        status: 'pending', // Pending admin approval
        createdAt: new Date().toISOString(),
        expiresAt: null
      }]);
      if (adErr) throw adErr;

      // Deduct balance
      const { error: updateErr } = await supabase.from('profiles').update({
        depositBalance: currentDepositBalance - grandTotal
      }).eq('id', user.id);
      if (updateErr) throw updateErr;

      // Record Transaction
      await supabase.from('transactions').insert([{
        userId: user.id,
        userSerial: profile.serialNumber || null,
        type: 'ad_purchase',
        amount: grandTotal,
        status: 'completed',
        createdAt: new Date().toISOString()
      }]);

      alert("Advertisement submitted successfully! It will be live after admin approval.");
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to submit advertisement");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <h1 className="text-4xl font-black mb-4 uppercase tracking-tight">Post Advertisement</h1>
          <p className="text-blue-100 font-medium">Broadcast your product or service right onto the dashboard.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center gap-3 border border-red-100 dark:border-red-900/50 transition-colors">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-bold text-sm tracking-wide">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-xl shadow-gray-50 dark:shadow-none space-y-6 transition-colors">
          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4" />
              Ad Banner Image
            </label>
            <div className="relative group rounded-3xl overflow-hidden bg-gray-50 dark:bg-slate-700 border-2 border-dashed border-gray-200 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors">
              {formData.image ? (
                <div className="relative">
                  <img src={formData.image} alt="Ad Preview" className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-bold tracking-widest text-sm">CLICK TO CHANGE</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-gray-400 dark:text-slate-500 cursor-pointer">
                  <ImageIcon className="w-12 h-12 mb-4 text-gray-300 dark:text-slate-600 group-hover:text-indigo-400 dark:group-hover:text-indigo-500 transition-colors" />
                  <p className="font-bold tracking-wide">Upload ad banner</p>
                  <p className="text-xs mt-2 text-gray-400 dark:text-slate-500 text-center px-4">Recommended size is horizontal (e.g. 1200x600)</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async e => {
                  if (e.target.files && e.target.files[0]) {
                     try {
                       const compressed = await compressImage(e.target.files[0], 800);
                       setFormData(prev => ({...prev, image: compressed}));
                     } catch (err: any) {
                       alert(err.message || 'Failed to process image');
                     }
                  } else {
                     setFormData(prev => ({...prev, image: ''}));
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Destination Link
            </label>
            <input 
              type="url"
              required
              placeholder="https://example.com"
              className="w-full p-4 bg-gray-50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl font-bold focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-950/20 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all outline-none dark:text-white"
              value={formData.link}
              onChange={e => setFormData({...formData, link: e.target.value})}
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 font-bold ml-1">Users will be directed to this link when they click your ad</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Duration & Pricing
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {AD_PRICING.map((plan) => (
                <button
                  type="button"
                  key={plan.days}
                  onClick={() => setFormData({...formData, durationDays: plan.days})}
                  className={cn(
                    "p-4 rounded-2xl text-left transition-all border-2",
                    formData.durationDays === plan.days 
                      ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-500 dark:border-indigo-500" 
                      : "bg-gray-50 dark:bg-slate-700 border-transparent dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-600 hover:border-gray-200 dark:hover:border-slate-500"
                  )}
                >
                  <p className={cn(
                    "text-xl font-black uppercase tracking-tight",
                    formData.durationDays === plan.days ? "text-indigo-900 dark:text-white" : "text-gray-900 dark:text-slate-100"
                  )}>{plan.label}</p>
                  <p className={cn(
                    "text-sm font-bold mt-1",
                    formData.durationDays === plan.days ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-slate-400"
                  )}>{formatCurrency(plan.price)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ad Post Rules Notice */}
        {!rulesLoading && adPostRules && (
          <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900/50 p-6 rounded-[2rem] flex items-start gap-4 transition-colors">
             <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400 shrink-0 mt-1" />
             <p className="text-sm md:text-base text-yellow-800 dark:text-yellow-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
               {adPostRules}
             </p>
          </div>
        )}

        <div className="bg-gray-900 dark:bg-slate-950 p-8 rounded-[2rem] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-2xl transition-colors border border-transparent dark:border-slate-800">
          <div>
            <p className="text-gray-400 dark:text-slate-500 font-bold mb-1">Total Cost</p>
            <p className="text-4xl font-black">{formatCurrency(grandTotal)}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-slate-400 mt-2">Will be deducted from Deposit Balance</p>
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-8 py-4 bg-indigo-500 dark:bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-600 dark:hover:bg-indigo-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 transition-all"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                Submit Advertisement
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
