import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import { Trash2, Link2, Clock, CheckCircle2, AlertCircle, EyeOff, RefreshCw } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

const AD_PRICING = [
  { days: 1, label: '১ দিন', price: 50 },
  { days: 3, label: '৩ দিন', price: 100 },
  { days: 5, label: '৫ দিন', price: 150 },
  { days: 7, label: '৭ দিন', price: 200 },
  { days: 30, label: '১ মাস', price: 600 },
];

export function ManageAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [renewAd, setRenewAd] = useState<any | null>(null);
  const [renewPlan, setRenewPlan] = useState(AD_PRICING[0].days);
  const [renewing, setRenewing] = useState(false);

  useEffect(() => {
    fetchAds();
  }, [user?.id]);

  const fetchAds = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.from('advertisements').select('*').eq('userId', user.id);
      if (error) throw error;
      setAds(data || []);
    } catch (err) {
      console.error("Error fetching ads:", err);
    } finally {
      setLoading(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteId) return;
    try {
      await supabase.from('advertisements').delete().eq('id', deleteId);
      fetchAds();
      setDeleteId(null);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRenew = async () => {
    if (!renewAd || !user) return;
    try {
      setRenewing(true);
      const selectedPricing = AD_PRICING.find(p => p.days === renewPlan) || AD_PRICING[0];
      const grandTotal = selectedPricing.price;

      // Check balance
      const { data: userDoc, error: userErr } = await supabase.from('profiles').select('depositBalance, serialNumber').eq('id', user.id).single();
      if (!userDoc || userErr) throw new Error("User not found");
      const currentDepositBalance = userDoc.depositBalance || 0;
      if (currentDepositBalance < grandTotal) {
        alert("Insufficient deposit balance. Please recharge.");
        return;
      }

      // Calculate new expiry date
      const currentExpiry = renewAd.expiresAt ? new Date(renewAd.expiresAt) : new Date();
      const newExpiry = new Date(currentExpiry.getTime());
      if (newExpiry < new Date()) {
          newExpiry.setTime(new Date().getTime() + (selectedPricing.days * 24 * 60 * 60 * 1000));
      } else {
          newExpiry.setDate(newExpiry.getDate() + selectedPricing.days);
      }

      // Update Ad
      const { error: adErr } = await supabase.from('advertisements').update({
        durationDays: renewAd.durationDays + selectedPricing.days,
        price: renewAd.price + grandTotal,
        expiresAt: newExpiry.toISOString()
      }).eq('id', renewAd.id);
      if (adErr) throw adErr;

      // Deduct balance
      const { error: updateErr } = await supabase.from('profiles').update({
        depositBalance: currentDepositBalance - grandTotal
      }).eq('id', user.id);
      if (updateErr) throw updateErr;

      // Record Transaction
      await supabase.from('transactions').insert([{
        userId: user.id,
        userSerial: userDoc.serialNumber || null,
        type: 'ad_purchase',
        amount: grandTotal,
        status: 'completed',
        createdAt: new Date().toISOString()
      }]);

      alert("Ad renewed successfully!");
      setRenewAd(null);
      fetchAds();
    } catch (err: any) {
      alert(err.message || 'Error renewing ad');
    } finally {
      setRenewing(false);
    }
  };

  if (loading) {

     return (
       <div className="flex justify-center p-12">
         <div className="w-8 h-8 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
       </div>
     );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-100 border border-gray-100">
        <h1 className="text-3xl font-black mb-4 uppercase tracking-tight text-gray-900">Posted Ads</h1>
        <p className="text-gray-500 font-medium">Manage your submitted advertisements. Note that deleting an ad will not refund the fee.</p>
      </div>

      {ads.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-12 text-center border border-gray-100 shadow-xl">
           <EyeOff className="w-12 h-12 text-gray-300 mx-auto mb-4" />
           <p className="text-xl font-bold text-gray-500">No ads found</p>
           <p className="text-sm text-gray-400 mt-2">You haven't posted any advertisements yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {ads.map(ad => (
            <div key={ad.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-xl overflow-hidden flex flex-col relative group">
              <div className="relative h-40 bg-gray-100 shrink-0">
                 <img src={ad.image} alt="Ad banner" className="w-full h-full object-cover" />
                 <div className="absolute top-4 right-4 flex gap-2">
                   <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md",
                      ad.status === 'approved' ? "bg-green-500/90 text-white" :
                      ad.status === 'rejected' ? "bg-red-500/90 text-white" :
                      "bg-yellow-500/90 text-white"
                   )}>
                     {ad.status}
                   </span>
                 </div>
              </div>
              <div className="p-6 flex-1 space-y-4">
                 <div className="space-y-2">
                   <p className="text-sm font-bold text-gray-500 flex items-center gap-2">
                     <Link2 className="w-4 h-4 shrink-0" />
                     <a href={ad.link} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline line-clamp-1">{ad.link}</a>
                   </p>
                   <p className="text-sm font-bold text-gray-500 flex items-center gap-2">
                     <Clock className="w-4 h-4 shrink-0" />
                     {ad.durationDays} Days Duration
                   </p>
                   {ad.status === 'approved' && ad.expiresAt && (
                      <p className="text-xs font-black text-gray-400 bg-gray-50 p-2 rounded-xl border border-gray-100">
                         EXPIRES: {new Date(ad.expiresAt?.toMillis ? ad.expiresAt.toMillis() : ad.expiresAt).toLocaleString()}
                      </p>
                   )}
                 </div>
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto flex gap-2">
                 <button 
                   onClick={() => setRenewAd(ad)}
                   className="flex-1 py-3 bg-indigo-100 text-indigo-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-indigo-200 transition-colors flex items-center justify-center gap-2"
                 >
                   <RefreshCw className="w-4 h-4" /> Renew
                 </button>
                 <button 
                   onClick={() => setDeleteId(ad.id)}
                   className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                 >
                   <Trash2 className="w-4 h-4" /> Delete
                 </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Delete Advertisement"
        message="Are you sure you want to delete this ad? This action cannot be undone and you will NOT get any refund."
        onConfirm={executeDelete}
        onCancel={() => setDeleteId(null)}
        confirmText="Delete Ad"
      />

      {/* Renew Modal */}
      {renewAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-2xl font-black uppercase tracking-tight text-gray-900">Renew Ad</h2>
              <p className="text-sm font-medium text-gray-500 mt-1">Select a package to extend your ad duration</p>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                {AD_PRICING.map((plan) => (
                  <button
                    key={plan.days}
                    onClick={() => setRenewPlan(plan.days)}
                    className={cn(
                      "p-4 rounded-2xl text-left transition-all border-2",
                      renewPlan === plan.days 
                        ? "bg-indigo-50 border-indigo-500" 
                        : "bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-200"
                    )}
                  >
                    <p className={cn(
                      "text-xl font-black uppercase tracking-tight",
                      renewPlan === plan.days ? "text-indigo-900" : "text-gray-900"
                    )}>{plan.label}</p>
                    <p className={cn(
                      "text-sm font-bold mt-1",
                      renewPlan === plan.days ? "text-indigo-600" : "text-gray-500"
                    )}>{formatCurrency(plan.price)}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button 
                disabled={renewing}
                onClick={() => setRenewAd(null)}
                className="px-6 py-3 bg-white text-gray-600 font-bold rounded-xl border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button 
                disabled={renewing}
                onClick={handleRenew}
                className="px-6 py-3 bg-indigo-600 text-white font-bold tracking-wide rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {renewing && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Confirm Renew
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
