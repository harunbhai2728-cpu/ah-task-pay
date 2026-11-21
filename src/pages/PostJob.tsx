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
    textProofInstruction: '',
    screenshotProofInstruction: '',
    screenshotProofInstructions: [''],
    autoApprove: false,
    pinCode: '',
    pricePerWork: 2,
    maxWorkers: 10
  });

  const jobFeePercent = Number(systemConfig?.jobPostingFee);
  const totalCost = (formData.pricePerWork * formData.maxWorkers);
  const serviceCharge = totalCost * (jobFeePercent / 100);
  const grandTotal = totalCost + serviceCharge;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !user) return;

    if ((Number(profile.depositBalance) || 0) < grandTotal) {
      setError(`Insufficient deposit balance. You need ${formatCurrency(grandTotal)} but have ${formatCurrency(Number(profile.depositBalance) || 0)}.`);
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
        posterSerial: profile.serialNumber,
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

  if (systemConfig === null) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-blue-200 dark:border-slate-700 border-t-[#0B3D9E] dark:border-t-[#F97316] rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <PlusCircle className="w-6 h-6 text-[#0B3D9E] dark:text-blue-400 animate-pulse" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-xl font-bold font-display text-slate-900 dark:text-slate-100">Preparing Job Gateway</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest animate-pulse">Checking service fees & rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-12">
      <div className="flex items-center gap-4">
        <div className="bg-gradient-to-br from-[#041645] to-[#0B3D9E] p-3 rounded-2xl text-white shadow-lg">
          <PlusCircle className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-black font-display text-slate-900 dark:text-slate-100 transition-colors">Post a New Job</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium transition-colors">Define your task and reach thousands of workers.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-[#1E293B] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-6 transition-colors">
          {/* Title */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Job Title</label>
            <input
              required
              type="text"
              placeholder="e.g. Subscribe to my YouTube channel"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#0B3D9E] outline-none transition-all text-slate-900 dark:text-white dark:placeholder:text-slate-500"
              value={formData.title}
              onChange={e => setFormData({...formData, title: e.target.value})}
            />
          </div>

          {/* Thumbnail */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Thumbnail Image (Optional)</label>
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    if (e.target.files && e.target.files[0]) {
                       try {
                         const { compressImage } = await import('../lib/imageCompress');
                         const compressed = await compressImage(e.target.files[0], 800, 0.05);
                         setFormData(prev => ({...prev, thumbnail: compressed}));
                       } catch (err: any) {
                         alert(err.message || 'Failed to process image');
                       }
                    } else {
                       setFormData(prev => ({...prev, thumbnail: ''}));
                    }
                  }}
                  className="w-full text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-blue-100 dark:file:bg-blue-950/60 file:text-[#0B3D9E] dark:file:text-blue-400 hover:file:bg-blue-200 dark:hover:file:bg-blue-900/60 cursor-pointer"
                />
              </div>
            </div>
            {formData.thumbnail && (
               <div className="mt-4">
                 <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Image Preview</p>
                 <img src={formData.thumbnail} alt="preview" className="h-32 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow-sm" />
               </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Detailed Instructions</label>
            <textarea
              required
              rows={4}
              placeholder="What should the worker do? How to provide proof?"
              className="w-full px-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#0B3D9E] outline-none transition-all resize-none text-slate-900 dark:text-white dark:placeholder:text-slate-500"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>

          {/* Proof Requirements */}
          <div className="space-y-4">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Proof Requirements</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl space-y-3 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-[#0B3D9E] dark:text-blue-400" />
                      <span className="font-bold text-sm text-slate-900 dark:text-slate-200">Screenshots</span>
                    </div>
                    <select 
                      value={formData.screenshotCount}
                      onChange={e => setFormData({...formData, screenshotCount: Number(e.target.value)})}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 text-sm outline-none text-slate-900 dark:text-white transition-colors"
                    >
                      {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">How many screenshots are required for this job?</p>
               </div>

               <button
                 type="button"
                 onClick={() => setFormData({...formData, requireTextProof: !formData.requireTextProof})}
                 className={cn(
                   "p-4 rounded-2xl border-2 flex items-center justify-between transition-all group",
                   formData.requireTextProof
                     ? "border-[#0B3D9E] dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#0B3D9E] dark:text-blue-400"
                     : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 text-slate-400 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                 )}
               >
                 <div className="flex items-center gap-2">
                   <FileText className="w-5 h-5" />
                   <span className="font-bold text-sm">Text Proof</span>
                 </div>
                 <div className={cn(
                   "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                   formData.requireTextProof ? "border-[#0B3D9E] dark:border-blue-500 bg-[#0B3D9E] dark:bg-blue-500" : "border-slate-300 dark:border-slate-600"
                 )}>
                   {formData.requireTextProof && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                 </div>
               </button>
            </div>

            {/* Custom Proof Instructions */}
            <div className="space-y-4 pt-2">
              {formData.screenshotCount > 0 && Array.from({ length: formData.screenshotCount }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                    Instruction for Screenshot {i + 1}
                  </label>
                  <input
                    type="text"
                    placeholder={`#${i + 1} submit screenshot proof requirement`}
                    value={formData.screenshotProofInstructions[i] || ''}
                    onChange={e => {
                      const newInstructions = [...(formData.screenshotProofInstructions || [])];
                      newInstructions[i] = e.target.value;
                      setFormData({ ...formData, screenshotProofInstructions: newInstructions });
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#0B3D9E] font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              ))}
              
              {formData.requireTextProof && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Text Proof Description</label>
                  <input
                    type="text"
                    placeholder="Submit text proof requirement"
                    value={formData.textProofInstruction}
                    onChange={e => setFormData({ ...formData, textProofInstruction: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-[#0B3D9E] font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Auto Approve */}
          <div className={cn(
            "p-6 rounded-3xl border transition-all",
            formData.autoApprove ? "border-[#F97316]/40 bg-orange-50 dark:bg-orange-950/20" : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
          )}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-xl", formData.autoApprove ? "bg-[#F97316] text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400")}>
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100">Auto-Approve with P-Code</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Fast-track verification using a pin.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer" 
                  checked={formData.autoApprove}
                  onChange={e => setFormData({...formData, autoApprove: e.target.checked})}
                />
                <div className="w-11 h-6 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#F97316]"></div>
              </label>
            </div>

            {formData.autoApprove && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2 mt-4 pt-4 border-t border-orange-200/70 dark:border-orange-900/40"
              >
                <label className="text-xs font-bold text-[#F97316] dark:text-[#FB923C] uppercase tracking-widest">Set P-Code (Give this to workers)</label>
                <input
                  type="text"
                  placeholder="e.g. YT-DONE-100"
                  className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-900/50 focus:ring-2 focus:ring-[#F97316] outline-none text-slate-900 dark:text-white"
                  value={formData.pinCode}
                  onChange={e => setFormData({...formData, pinCode: e.target.value})}
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Pricing & Workers */}
        <div className="bg-white dark:bg-[#1E293B] p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-6 transition-colors">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Price per Worker (BDT)</label>
            <div className="relative">
              <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                required
                type="number"
                min="1"
                step="0.01"
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#0B3D9E] outline-none text-slate-900 dark:text-white tabular-nums"
                value={formData.pricePerWork === 0 ? '' : formData.pricePerWork}
                onChange={e => setFormData({...formData, pricePerWork: e.target.value === '' ? 0 : Number(e.target.value)})}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Max Workers</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
              <input
                required
                type="number"
                min="1"
                className="w-full pl-12 pr-5 py-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-[#0B3D9E] outline-none text-slate-900 dark:text-white tabular-nums"
                value={formData.maxWorkers}
                onChange={e => setFormData({...formData, maxWorkers: Number(e.target.value)})}
              />
            </div>
          </div>
        </div>

        {/* Total Summary */}
        <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-8 rounded-[2.5rem] text-white space-y-4 transition-colors border border-blue-800/40 shadow-xl">
          <div className="flex justify-between items-center text-sm text-blue-200 uppercase tracking-widest font-bold">
            <span>Payment Summary</span>
            <Info className="w-4 h-4" />
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-blue-100">
              <span>Cost of Workers</span>
              <span className="tabular-nums font-semibold">{formatCurrency(totalCost)}</span>
            </div>
            <div className="flex justify-between text-blue-100">
              <span>Service Charge ({jobFeePercent}%)</span>
              <span className="tabular-nums font-semibold">{formatCurrency(serviceCharge)}</span>
            </div>
            <div className="h-px bg-white/15 my-2" />
            <div className="flex justify-between text-2xl font-black font-display">
              <span>Total Amount</span>
              <span className="text-[#FB923C] tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-400/50 text-red-100 p-4 rounded-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}

          <button
            disabled={loading}
            className="w-full h-16 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-50 shadow-lg shadow-orange-500/20"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-white"></div>
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

