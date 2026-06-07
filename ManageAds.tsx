import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';
import { Trash2, Link2, Clock, CheckCircle2, AlertCircle, EyeOff } from 'lucide-react';
import { ConfirmModal } from '../components/ConfirmModal';

export function ManageAds() {
  const { user } = useAuth();
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
              <div className="p-4 bg-gray-50 border-t border-gray-100 mt-auto">
                 <button 
                   onClick={() => setDeleteId(ad.id)}
                   className="w-full py-3 bg-red-100 text-red-600 rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                 >
                   <Trash2 className="w-4 h-4" /> Delete Ad
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
    </div>
  );
}
