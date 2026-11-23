import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Info, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  Image as ImageIcon,
  Zap,
  Send,
  Lock,
  MessageCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Job } from '../types';
import { compressImage } from '../lib/imageCompress';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';

export function JobDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submissionStatus, setSubmissionStatus] = useState<string | null>(null);

  const isPoster = job && user && job.posterId === user.id;
  
  const [proofText, setProofText] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);

  useEffect(() => {
    const fetchJob = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data: jobDoc, error: jobErr } = await supabase.from('jobs').select('*').eq('id', id).single();
        if (jobDoc) {
          setJob(jobDoc as Job);
          setFetchError(null);

          // Check if user already submitted
          if (user) {
            const { data: subDoc } = await supabase.from('submissions').select('status').eq('workerId', user.id).eq('jobId', id).maybeSingle();
            if (subDoc) {
              setSubmissionStatus(subDoc.status);
            }
          }
        } else {
          setFetchError("Job not found. It may have been closed or deleted.");
        }
      } catch (err) {
        setFetchError("Failed to fetch job details. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id, user?.id]);

  const handleSingleScreenshotChange = async (file: File | null, index: number) => {
    if (!file) {
      setScreenshotUrls(prev => {
        const newUrls = [...prev];
        newUrls.splice(index, 1);
        return newUrls.filter(Boolean);
      });
      return;
    }

    try {
      const b64 = await compressImage(file, 1080, 0.05);
      setScreenshotUrls(prev => {
        const newUrls = [...prev];
        newUrls[index] = b64;
        return newUrls;
      });
    } catch (err: any) {
      alert(err.message || 'Failed to process image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !user) return;

    if (job.screenshotCount > 0 && screenshotUrls.filter(Boolean).length < job.screenshotCount) {
      setSubmitError(`Please upload at least ${job.screenshotCount} screenshots.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    let isAutoApprove = false;
    if (job.autoApprove) {
      if (!pinCode) {
        setSubmitError("This job requires a P-Code. Please enter the correct code.");
        setSubmitting(false);
        return;
      }
      if (pinCode !== job.pinCode) {
        setSubmitError("Invalid P-Code. Please try again.");
        setSubmitting(false);
        return;
      }
      isAutoApprove = true;
    }

    try {
      const reward = job.reward || job.pricePerWork;

      const { error: insertErr } = await supabase.from('submissions').insert([{
        jobId: job.id,
        jobTitle: job.title,
        workerId: user.id,
        workerName: profile?.displayName || user.user_metadata?.name || 'User',
        workerSerial: profile?.serialNumber || null,
        posterId: job.posterId,
        proofText: proofText,
        screenshots: screenshotUrls,
        status: isAutoApprove ? 'approved' : 'pending',
        reward: reward,
        submittedAt: new Date().toISOString(),
        reviewedAt: isAutoApprove ? new Date().toISOString() : null,
        pinCodeUsed: pinCode
      }]);
      if (insertErr) throw insertErr;

      setSuccess(true);
      if (isAutoApprove) {
        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setTimeout(() => navigate('/dashboard'), 3000);
      }
      setSubmitting(false);
    } catch (err: any) {
      console.error("Job Submit Error:", err);
      let errorMessage = "Something went wrong. Please try again.";
      if (err instanceof ProgressEvent) {
        errorMessage = "Network error or image load failed. Please check your connection.";
      } else if (err && err.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      setSubmitError(errorMessage);
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-24">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0B3D9E] dark:border-[#F97316]"></div>
    </div>
  );

  if (fetchError || !job) return (
    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 p-8 rounded-3xl text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
      <h2 className="text-xl font-bold text-red-900 dark:text-red-300">{fetchError || "Job not found"}</h2>
      <button onClick={() => navigate('/browse-jobs')} className="text-[#F97316] font-bold hover:underline">Back to Browsing</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold hover:text-[#0B3D9E] dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white dark:bg-[#1E293B] p-6 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-8 transition-colors">
        {job.thumbnail && (
            <div className="-mx-6 sm:-mx-10 -mt-6 sm:-mt-10 mb-8 h-64 overflow-hidden rounded-t-[2.5rem] border-b border-slate-200 dark:border-slate-700">
               <img src={job.thumbnail} alt={job.title} className="w-full h-full object-cover" />
            </div>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-3">
             <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">Active Job</span>
                {job.autoApprove && (
                   <span className="bg-orange-100 dark:bg-orange-950/60 text-[#EA580C] dark:text-[#FB923C] px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1">
                      <Zap className="w-3 h-3 saturate-150" /> Instant Payment
                   </span>
                )}
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                  ID: #{job.id.split('-')[0].toUpperCase()}
                </span>
             </div>
             <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight uppercase font-display">{job.title}</h1>
          </div>
          <div className="sm:text-right shrink-0 bg-blue-50 dark:bg-blue-950/40 px-5 py-3 rounded-2xl border border-blue-100 dark:border-blue-900/40">
             <p className="text-3xl sm:text-4xl font-black text-[#0B3D9E] dark:text-[#FB923C] leading-none tabular-nums">{formatCurrency(job.pricePerWork)}</p>
             <p className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1.5">Reward/Task</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white font-bold text-lg border-b border-slate-100 dark:border-slate-700 pb-2">
             <Info className="w-5 h-5 text-[#0B3D9E] dark:text-[#FB923C]" />
             Instructions
          </div>
          <div className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed whitespace-pre-wrap text-base sm:text-lg bg-slate-50 dark:bg-slate-800/70 p-6 rounded-3xl border border-slate-200/80 dark:border-slate-700">
            {job.description}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
           <InfoBadge label="Max Workers" value={job.maxWorkers.toString()} />
           <InfoBadge label="Submitted" value={job.completedCount.toString()} />
           {job.approvedCount !== undefined && <InfoBadge label="Approved" value={job.approvedCount.toString()} />}
           <InfoBadge label="Posted" value={format(job.createdAt ? new Date(job.createdAt as any) : new Date(), 'MMM dd, yyyy')} />
           <InfoBadge label="Status" value={job.status.toUpperCase()} />
        </div>
      </div>

      <AnimatePresence>
        {success || submissionStatus ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`text-white p-10 sm:p-12 rounded-[2.5rem] text-center space-y-4 shadow-2xl relative overflow-hidden ${
              submissionStatus === 'rejected' ? 'bg-red-600' :
              submissionStatus === 'pending' ? 'bg-amber-500' :
              'bg-emerald-600'
            }`}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <CheckCircle2 className="w-full h-full" />
            </div>
            <CheckCircle2 className="w-20 h-20 mx-auto" />
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight underline decoration-white/30 decoration-8 underline-offset-8">
              {submissionStatus 
                ? (submissionStatus === 'rejected' ? 'REJECTED' : submissionStatus === 'pending' ? 'PENDING REVIEW' : 'APPROVED') 
                : "SUBMITTED!"}
            </h2>
            <p className="text-lg sm:text-xl font-medium text-white/95">
              {submissionStatus 
                ? `You have already submitted proof for this job and it is ${submissionStatus}. Check your dashboard for more details.`
                : (job.autoApprove && pinCode === job.pinCode 
                  ? "Instant payment released to your wallet! Redirecting..." 
                  : "Your proof has been submitted and is pending review by the poster.")}
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-6 sm:p-10 rounded-[2.5rem] text-white space-y-8 shadow-2xl border border-white/10">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight flex items-center gap-3 font-display">
               <Send className="w-7 h-7 text-[#FB923C]" />
               Submit Your Proof
            </h2>
            
            <div className="space-y-6 text-left">
              {job.requireTextProof && (
                <div className="space-y-2.5">
                  <label className="text-xs font-black uppercase tracking-widest text-blue-200">
                    Text Proof / Explanation
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder={job.textProofInstruction || "Type the required information here..."}
                    className="w-full bg-white/10 border border-white/20 rounded-2xl p-5 text-white placeholder:text-blue-200/60 outline-none focus:ring-2 focus:ring-[#F97316] transition-all font-medium text-base"
                    value={proofText}
                    onChange={e => setProofText(e.target.value)}
                  />
                </div>
              )}

              {job.screenshotCount > 0 && (
                <div className="space-y-4">
                  {Array.from({ length: job.screenshotCount }).map((_, i) => (
                    <div key={i} className="space-y-2">
                       <label className="text-xs font-black uppercase tracking-widest text-blue-200">
                         {job.screenshotProofInstructions?.[i] || job.screenshotProofInstruction || `Instruction for Screenshot ${i + 1}`}
                       </label>
                      <div className="bg-white/10 border border-white/20 rounded-2xl p-4 border-dashed hover:border-white/40 transition-all flex items-center gap-4">
                        <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/15">
                          {screenshotUrls[i] ? (
                            <img src={screenshotUrls[i]} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-blue-200 font-bold">{i + 1}</span>
                          )}
                        </div>
                        <input 
                          required={!screenshotUrls[i]}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSingleScreenshotChange(e.target.files?.[0] || null, i)}
                          className="block w-full text-xs text-blue-100 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/15 file:text-white hover:file:bg-white/25 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {job.autoApprove && (
                <div className="space-y-3 p-6 bg-white/10 border border-[#FB923C]/40 rounded-3xl">
                   <div className="flex items-center gap-2 mb-2 font-black text-[#FB923C]">
                      <Lock className="w-5 h-5" />
                      INSTANT APPROVAL P-CODE (REQUIRED)
                   </div>
                   <input
                     type="text"
                     placeholder="Enter P-Code from instructions"
                     className="w-full bg-white/10 border border-white/25 rounded-xl p-4 outline-none focus:ring-2 focus:ring-[#F97316] transition-all text-xl font-bold tracking-widest text-center text-white placeholder:text-blue-200/60"
                     value={pinCode}
                     onChange={e => setPinCode(e.target.value)}
                   />
                   <p className="text-[11px] text-blue-100 mt-2">Entering the correct P-Code is required for this job to release your reward immediately.</p>
                </div>
              )}
            </div>

            {submitError && (
               <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-2xl text-red-100 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  {submitError}
               </div>
            )}

            <button
               type="submit"
               disabled={submitting || isPoster === true}
               className="w-full py-5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
               {submitting ? (
                 <div className="flex items-center gap-2">
                   <div className="animate-spin rounded-full h-7 w-7 border-t-2 border-b-2 border-white"></div>
                   <span>Processing...</span>
                 </div>
               ) : (
                 <>
                   {isPoster ? (
                     <div className="flex flex-col items-center">
                       <span className="text-xs font-black text-red-100 uppercase">You posted this job</span>
                       <span>CANNOT SUBMIT OWN JOB</span>
                     </div>
                   ) : (
                     'SUBMIT WORK'
                   )}
                 </>
               )}
            </button>
          </form>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-4 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200/80 dark:border-slate-700 transition-colors">
       <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
