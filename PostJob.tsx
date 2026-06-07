import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PlusCircle, Send, Info, CheckCircle2, AlertCircle, Hash, Users, Banknote, FileText, Image as ImageIcon, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn } from '../lib/utils';

export function PostJob() {
  const { profile, user, systemConfig } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    thumbnail: '',
    description: '',
    screenshotCount: 1,
    requireTextProof: true,
    autoApprove: false,
    pinCode: '',
    pricePerWork: 2,
    maxWorkers: 10
  });

  const jobFeePercent = systemConfig?.jobPostingFee || 10;
  const totalCost = (formData.pricePerWork * formData.maxWorkers);
  const serviceCharge = totalCost * (jobFeePercent / 100);
  const grandTotal = totalCost + serviceCharge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    if (profile.depositBalance < grandTotal) {
      setError(`Insufficient deposit balance. You need ${formatCurrency(grandTotal)} but have ${formatCurrency(profile.depositBalance)}.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const b64Thumbnail = formData.thumbnail;

      const { data: userDoc, error: userErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (userErr || !userDoc) throw new Error("User not found");
      
      const currentDepositBalance = userDoc.depositBalance || 0;
      if (currentDepositBalance < grandTotal) throw new Error("Insufficient deposit balance at time of transaction");

      // Create Job
      const { error: jobErr } = await supabase.from('jobs').insert([{
        posterId: user.id,
        posterName: profile.displayName || user.user_metadata?.name || 'User',
        ...formData,
        thumbnail: b64Thumbnail,
        completedCount: 0,
        pendingCount: 0,
        approvedCount: 0,
        isFull: false,
        status: 'open',
        totalBudget: totalCost,
        serviceCharge: serviceCharge,
        grandTotal: grandTotal,
        createdAt: new Date().toISOString()
      }]);

      if (jobErr) throw jobErr;

      navigate('/manage-jobs');
    } catch (err: any) {
      setError(err.message || err.toString());
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="bg-indigo-600 p-3 rounded-2xl text-white">
          <PlusCircle className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100 transition-colors">Post a New Job</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium transition-colors">Define your task and reach thousands of workers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Job Title</label>
            <input
              required
              type="text"
              placeholder="e.g. Subscribe to my YouTube channel"
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all dark:text-white dark:placeholder:text-slate-500"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Thumbnail Image (Optional)</label>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-none transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    if (e.target.files && e.target.files[0]) {
                       try {
                         const { compressImage } = await import('../lib/imageCompress');
                         const compressed = await compressImage(e.target.files[0], 400);
                         setFormData(prev => ({...prev, thumbnail: compressed}));
                       } catch (err: any) {
                         alert(err.message || 'Failed to process image');
                       }
                    } else {
                       setFormData(prev => ({...prev, thumbnail: ''}));
                    }
                  }}
                  className="w-full text-sm text-gray-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-100 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-400 hover:file:bg-indigo-200 dark:hover:file:bg-indigo-900 cursor-pointer"
                />
              </div>
            </div>
            {formData.thumbnail && (
               <div className="mt-4">
                 <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Image Preview</p>
                 <img src={formData.thumbnail} alt="preview" className="h-32 rounded-2xl object-cover border border-gray-100 dark:border-slate-700 shadow-sm" />
               </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Detailed Instructions</label>
            <textarea
              required
              rows={4}
              placeholder="What should the worker do? How to provide proof?"
              className="w-full px-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none dark:text-white dark:placeholder:text-slate-500"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Proof Requirements */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Proof Requirements</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-gray-50 dark:bg-slate-700 p-4 rounded-2xl space-y-3 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-bold text-sm dark:text-slate-200">Screenshots</span>
                    </div>
                    <select 
                      value={formData.screenshotCount}
                      onChange={e => setFormData({...formData, screenshotCount: Number(e.target.value)})}
                      className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm outline-none dark:text-white transition-colors"
                    >
                      {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">How many screenshots are required for this job?</p>
               </div>

               <button
                 type="button"
                 onClick={() => setFormData({...formData, requireTextProof: !formData.requireTextProof})}
                 className={cn(
                   "p-4 rounded-2xl border-2 flex items-center justify-between transition-all group",
                   formData.requireTextProof ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400" : "border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700 text-gray-400 dark:text-slate-500 hover:border-gray-200 dark:hover:border-slate-600"
                 )}
               >
                 <div className="flex items-center gap-2">
                   <FileText className="w-5 h-5" />
                   <span className="font-bold text-sm">Text Proof</span>
                 </div>
                 <div className={cn(
                   "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                   formData.requireTextProof ? "border-indigo-600 dark:border-indigo-500 bg-indigo-600 dark:bg-indigo-500" : "border-gray-300 dark:border-slate-600"
                 )}>
                   {formData.requireTextProof && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                 </div>
               </button>
            </div>
          </div>

          {/* Auto Approve */}
          <div className={cn(
            "p-6 rounded-3xl border transition-all",
            formData.autoApprove ? "border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/10" : "border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/50"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", formData.autoApprove ? "bg-orange-500 text-white" : "bg-gray-200 dark:bg-slate-600 text-gray-400 dark:text-slate-500")}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-slate-100">Auto-Approve with P-Code</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Fast-track verification using a pin.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.autoApprove}
                  onChange={e => setFormData({...formData, autoApprove: e.target.checked})}
                />
                <div className="w-11 h-6 bg-gray-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
              </label>
            </div>

            {formData.autoApprove && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 mt-4 pt-4 border-t border-orange-100 dark:border-orange-950/30"
              >
                <label className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-widest">Set P-Code (Give this to workers)</label>
                <input
                  type="text"
                  placeholder="e.g. YT-DONE-100"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 focus:ring-2 focus:ring-orange-500 outline-none dark:text-white"
                  value={formData.pinCode}
                  onChange={e => setFormData({...formData, pinCode: e.target.value})}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Pricing & Workers */}
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm grid grid-cols-2 gap-6 transition-colors">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Price per Worker (BDT)</label>
            <div className="relative">
              <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                required
                type="number"
                min="2"
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={formData.pricePerWork}
                onChange={e => setFormData({...formData, pricePerWork: Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700 dark:text-slate-300 ml-1">Max Workers</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                required
                type="number"
                min="1"
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-gray-50 dark:bg-slate-700 border-none focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white"
                value={formData.maxWorkers}
                onChange={e => setFormData({...formData, maxWorkers: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="bg-gray-900 dark:bg-slate-950 p-8 rounded-[2.5rem] text-white space-y-4 transition-colors border border-transparent dark:border-slate-800">
          <div className="flex justify-between items-center text-sm text-gray-400 dark:text-slate-500 uppercase tracking-widest font-bold">
            <span>Payment Summary</span>
            <Info className="w-4 h-4" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-gray-300 dark:text-slate-400">
              <span>Cost of Workers</span>
              <span>{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between text-gray-300 dark:text-slate-400">
              <span>Service Charge ({jobFeePercent}%)</span>
              <span>{formatCurrency(serviceCharge)}</span>
            </div>
            <div className="h-px bg-gray-800 dark:bg-slate-800 my-2" />
            <div className="flex justify-between text-2xl font-black">
              <span>Total Amount</span>
              <span className="text-primary-400 dark:text-indigo-400">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            disabled={loading}
            className="w-full h-16 bg-white dark:bg-slate-100 text-gray-900 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-gray-100 dark:hover:bg-white transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-gray-900"></div>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Post Job Now
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

