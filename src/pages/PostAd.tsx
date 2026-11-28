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
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-950/15 border border-blue-400/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
        <div className="relative z-10">
          <h1 className="text-3xl sm:text-4xl font-black font-display mb-2 uppercase tracking-tight">Post Advertisement</h1>
          <p className="text-blue-100 font-medium">Broadcast your product or service right onto the dashboard.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-2xl flex items-center gap-3 border border-red-200 dark:border-red-900/50 transition-colors">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="font-bold text-sm tracking-wide">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-[#0A1638] p-6 sm:p-8 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 transition-colors">
          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#0B3D9E] dark:text-[#FB923C]" />
              Ad Banner Image
            </label>
            <div className="relative group rounded-3xl overflow-hidden bg-[#F2F6FE] dark:bg-[#050F2B] border-2 border-dashed border-[#CEDDF6] dark:border-[#1E3B8A]/65 hover:border-[#0B3D9E] dark:hover:border-blue-400 transition-colors">
              {formData.image ? (
                <div className="relative">
                  <img src={formData.image} alt="Ad Preview" className="w-full h-48 object-cover" />
                  <div className="absolute inset-0 bg-[#02081B]/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white font-bold tracking-widest text-sm">CLICK TO CHANGE</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 text-slate-500 dark:text-blue-200/60 cursor-pointer">
                  <ImageIcon className="w-12 h-12 mb-4 text-[#0B3D9E]/40 dark:text-blue-400/50 group-hover:text-[#0B3D9E] dark:group-hover:text-blue-300 transition-colors" />
                  <p className="font-bold tracking-wide text-[#071845] dark:text-white">Upload ad banner</p>
                  <p className="text-xs mt-2 text-slate-500 dark:text-blue-200/60 text-center px-4">Recommended size is horizontal (e.g. 1200x600)</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async e => {
                  if (e.target.files && e.target.files[0]) {
                     try {
                       const compressed = await compressImage(e.target.files[0], 1080, 0.05);
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
            <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest flex items-center gap-2">
              <Link2 className="w-4 h-4 text-[#0B3D9E] dark:text-[#FB923C]" />
              Destination Link
            </label>
            <input 
              type="url"
              required
              placeholder="https://example.com"
              className="w-full p-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl font-bold focus:ring-4 focus:ring-[#0B3D9E]/15 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] transition-all outline-none text-[#071845] dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-200/40"
              value={formData.link}
              onChange={e => setFormData({...formData, link: e.target.value})}
            />
            <p className="text-xs text-slate-500 dark:text-blue-200/70 font-bold ml-1">Users will be directed to this link when they click your ad</p>
          </div>

          <div className="space-y-4">
            <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0B3D9E] dark:text-[#FB923C]" />
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
                      ? "bg-[#EFF4FC] dark:bg-[#102255] border-[#0B3D9E] dark:border-[#FB923C] shadow-sm" 
                      : "bg-[#F2F6FE] dark:bg-[#050F2B] border-[#DCE7FA] dark:border-[#1C3882]/60 hover:bg-[#E7EFFD] dark:hover:bg-[#0B1C47] hover:border-[#B6CCF4] dark:hover:border-[#2C4DA3]"
                  )}
                >
                  <p className={cn(
                    "text-xl font-black font-display uppercase tracking-tight",
                    formData.durationDays === plan.days ? "text-[#07266E] dark:text-white" : "text-[#071845] dark:text-blue-100"
                  )}>{plan.label}</p>
                  <p className={cn(
                    "text-sm font-bold mt-1 tabular-nums",
                    formData.durationDays === plan.days ? "text-[#0B3D9E] dark:text-[#FB923C]" : "text-slate-500 dark:text-blue-200/70"
                  )}>{formatCurrency(plan.price)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Ad Post Rules Notice */}
        {!rulesLoading && adPostRules && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-6 rounded-[2rem] flex items-start gap-4 transition-colors">
             <AlertCircle className="w-8 h-8 text-amber-600 dark:text-amber-400 shrink-0 mt-1" />
             <p className="text-sm md:text-base text-amber-900 dark:text-amber-200 font-extrabold leading-relaxed whitespace-pre-wrap text-left">
               {adPostRules}
             </p>
          </div>
        )}

        <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-8 rounded-[2rem] text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl shadow-blue-950/15 transition-colors border border-blue-400/20">
          <div>
            <p className="text-blue-200 font-bold mb-1">Total Cost</p>
            <p className="text-4xl font-black font-display tabular-nums">{formatCurrency(grandTotal)}</p>
            <p className="text-sm font-medium text-blue-200/80 mt-2">Will be deducted from Deposit Balance</p>
          </div>
          <button 
            type="submit"
            disabled={loading}
            className="w-full md:w-auto px-8 py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-orange-500/20"
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
