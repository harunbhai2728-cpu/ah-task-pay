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
  MessageCircle,
  Maximize2,
  X,
  MapPin
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
  const [showFullThumbnail, setShowFullThumbnail] = useState(false);

  const isPoster = Boolean(job && user && (job.posterId === user.id || job.author_id === user.id));
  const safeThumbnail =
    job?.thumbnail &&
    (job.thumbnail.startsWith('https://') ||
      job.thumbnail.startsWith('http://') ||
      job.thumbnail.startsWith('data:image/'))
      ? job.thumbnail
      : '';
  
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
    if (isPoster) {
      setSubmitError("You cannot submit proof for your own posted job.");
      return;
    }

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
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 pb-12">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#0A1638] border border-[#D7E3F7] dark:border-[#1C3882]/60 rounded-xl text-[#07266E] dark:text-blue-100 font-bold hover:border-[#0B3D9E] dark:hover:text-white transition-colors shadow-sm cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="bg-white dark:bg-[#0A1638] p-5 sm:p-10 rounded-3xl sm:rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 sm:space-y-8 transition-colors">
        {safeThumbnail && (
            <button
              type="button"
              onClick={() => setShowFullThumbnail(true)}
              className="group relative block w-[calc(100%+2.5rem)] sm:w-[calc(100%+5rem)] -mx-5 sm:-mx-10 -mt-5 sm:-mt-10 mb-6 sm:mb-8 h-52 sm:h-64 overflow-hidden rounded-t-3xl sm:rounded-t-[2.5rem] border-b border-[#D7E3F7] dark:border-[#1C3882]/60 cursor-zoom-in text-left"
            >
               <img src={safeThumbnail} alt={job.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
               <span className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#041645]/85 text-white text-xs font-bold backdrop-blur-sm border border-white/20 shadow-lg">
                 <Maximize2 className="w-3.5 h-3.5" />
                 <span>Click to view full thumbnail</span>
               </span>
            </button>
        )}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="space-y-3 min-w-0">
             <div className="flex flex-wrap items-center gap-2">
                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest">Active Job</span>
                <span className="bg-[#EFF4FC] dark:bg-[#0E2460] text-[#07266E] dark:text-blue-200 border border-[#CFE0FB] dark:border-blue-500/30 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {!job.targetCountry || job.targetCountry === 'ALL' ? 'Global' : job.targetCountry}
                </span>
                {job.mainCategory && (
                  <span className="bg-[#F3F7FE] dark:bg-[#050F2B] text-[#071845] dark:text-blue-100 border border-[#DCE7FA] dark:border-[#1C3882]/60 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider">
                    {job.mainCategory}{job.subCategory ? ` · ${job.subCategory}` : ''}
                  </span>
                )}
                {job.autoApprove && (
                   <span className="bg-orange-100 dark:bg-orange-950/60 text-[#EA580C] dark:text-[#FB923C] px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1">
                      <Zap className="w-3 h-3 saturate-150" /> Instant Payment
                   </span>
                )}
                <span className="bg-[#F3F7FE] dark:bg-[#050F2B] text-slate-600 dark:text-blue-200 border border-[#DCE7FA] dark:border-[#1C3882]/60 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest tabular-nums">
                  ID: #{job.id.split('-')[0].toUpperCase()}
                </span>
             </div>
             <h1 className="text-2xl sm:text-4xl font-black text-[#071845] dark:text-white tracking-tight leading-tight uppercase font-display break-words">{job.title}</h1>
          </div>
          <div className="sm:text-right shrink-0 bg-gradient-to-br from-[#041645] to-[#0B3D9E] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-blue-400/25 shadow-lg shadow-blue-950/15">
             <p className="text-2xl sm:text-4xl font-black text-white leading-none tabular-nums">{formatCurrency(job.pricePerWork)}</p>
             <p className="text-[10px] sm:text-[11px] font-black text-[#FB923C] uppercase tracking-widest mt-1.5">Reward/Task</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[#071845] dark:text-white font-bold text-lg border-b border-[#E3ECFA] dark:border-[#1C3882]/50 pb-2">
             <Info className="w-5 h-5 text-[#0B3D9E] dark:text-[#FB923C]" />
             Instructions
          </div>
          <div className="text-[#071845] dark:text-blue-100 font-medium leading-relaxed whitespace-pre-wrap text-base sm:text-lg bg-[#F2F6FE] dark:bg-[#050F2B] p-6 rounded-3xl border border-[#DCE7FA] dark:border-[#1C3882]/60">
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
        ) : isPoster ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-8 sm:p-10 rounded-[2.5rem] text-white text-center space-y-5 shadow-2xl border border-white/10"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto">
              <Lock className="w-8 h-8 text-[#FB923C]" />
            </div>
            <div className="space-y-2 max-w-lg mx-auto">
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight font-display">
                You Posted This Job
              </h2>
              <p className="text-sm sm:text-base text-blue-100/90 font-medium">
                You can view all details of your posted job here, but you cannot submit work on your own job.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate('/manage-jobs')}
                className="px-6 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-500/25 transition-all"
              >
                Manage My Jobs
              </button>
              <button
                type="button"
                onClick={() => navigate('/browse-jobs')}
                className="px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-bold text-sm border border-white/15 transition-all"
              >
                Browse Other Jobs
              </button>
            </div>
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

      {/* Full Thumbnail Lightbox Modal */}
      <AnimatePresence>
        {showFullThumbnail && safeThumbnail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowFullThumbnail(false)}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <button
              type="button"
              onClick={() => setShowFullThumbnail(false)}
              className="fixed top-4 right-4 z-50 w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center border border-white/25 transition-colors"
              aria-label="Close full thumbnail"
            >
              <X className="w-6 h-6" />
            </button>
            <motion.img
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              src={safeThumbnail}
              alt={job.title}
              onClick={(e) => e.stopPropagation()}
              className="max-w-[95vw] max-h-[90vh] w-auto h-auto object-contain rounded-2xl shadow-2xl border border-white/15"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoBadge({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-4 bg-[#F2F6FE] dark:bg-[#050F2B] rounded-2xl border border-[#DCE7FA] dark:border-[#1C3882]/60 transition-colors">
       <p className="text-[10px] font-black text-slate-500 dark:text-blue-200/60 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-bold text-[#071845] dark:text-white tracking-tight tabular-nums">{value}</p>
    </div>
  );
}
