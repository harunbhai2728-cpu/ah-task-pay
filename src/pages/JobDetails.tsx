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
      const b64 = await compressImage(file, 300);
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
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
    </div>
  );

  if (fetchError || !job) return (
    <div className="bg-red-50 p-8 rounded-3xl text-center space-y-4">
      <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
      <h2 className="text-xl font-bold text-red-900">{fetchError || "Job not found"}</h2>
      <button onClick={() => navigate('/browse-jobs')} className="text-red-600 font-bold hover:underline">Back to Browsing</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-bold hover:text-gray-900 transition-colors">
        <ArrowLeft className="w-5 h-5" /> Back
      </button>

      <div className="bg-white p-8 md:p-12 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-8">
        {job.thumbnail && (
            <div className="-mx-8 md:-mx-12 -mt-8 md:-mt-12 mb-8 h-64 overflow-hidden rounded-t-[2.5rem]">
               <img src={job.thumbnail} alt={job.title} className="w-full h-full object-cover" />
            </div>
        )}
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-4">
             <div className="flex items-center gap-2">
                <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">Active Job</span>
                {job.autoApprove && (
                   <span className="bg-orange-100 text-orange-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1">
                      <Zap className="w-3 h-3 saturate-150" /> Instant Payment
                   </span>
                )}
                <span className="bg-gray-100 text-gray-500 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                  ID: #{job.id.split('-')[0].toUpperCase()}
                </span>
             </div>
             <h1 className="text-4xl font-black text-gray-900 tracking-tight leading-tight uppercase">{job.title}</h1>
          </div>
          <div className="text-right shrink-0">
             <p className="text-4xl font-black text-primary-600 leading-none">{formatCurrency(job.pricePerWork)}</p>
             <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Reward/Task</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-gray-900 font-bold text-lg border-b border-gray-100 pb-2">
             <Info className="w-5 h-5 text-indigo-500" />
             Instructions
          </div>
          <div className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap text-lg italic bg-gray-50 p-6 rounded-3xl border border-gray-100">
            {job.description}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
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
            className={`text-white p-12 rounded-[2.5rem] text-center space-y-4 shadow-2xl relative overflow-hidden ${
              submissionStatus === 'rejected' ? 'bg-red-600' :
              submissionStatus === 'pending' ? 'bg-yellow-500' :
              'bg-green-600'
            }`}
          >
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <CheckCircle2 className="w-full h-full" />
            </div>
            <CheckCircle2 className="w-20 h-20 mx-auto" />
            <h2 className="text-4xl font-black tracking-tight underline decoration-white/30 decoration-8 underline-offset-8">
              {submissionStatus 
                ? (submissionStatus === 'rejected' ? 'REJECTED' : submissionStatus === 'pending' ? 'PENDING REVIEW' : 'APPROVED') 
                : "SUBMITTED!"}
            </h2>
            <p className="text-xl font-medium text-white/90">
              {submissionStatus 
                ? `You have already submitted proof for this job and it is ${submissionStatus}. Check your dashboard for more details.`
                : (job.autoApprove && pinCode === job.pinCode 
                  ? "Instant payment released to your wallet! Redirecting..." 
                  : "Your proof has been submitted and is pending review by the poster.")}
            </p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-gray-900 p-8 md:p-12 rounded-[2.5rem] text-white space-y-8 shadow-2xl">
            <h2 className="text-3xl font-black tracking-tight flex items-center gap-3">
               <Send className="w-8 h-8 text-primary-400" />
               Submit Your Proof
            </h2>
            
            <div className="space-y-6 text-left">
              {job.requireTextProof && (
                <div className="space-y-3">
                  <label className="text-sm font-black uppercase tracking-widest text-gray-400">
                    Text Proof / Explanation
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder={job.textProofInstruction || "Type the required information here..."}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 outline-none focus:ring-2 focus:ring-primary-500 transition-all font-medium text-lg"
                    value={proofText}
                    onChange={e => setProofText(e.target.value)}
                  />
                </div>
              )}

              {job.screenshotCount > 0 && (
                <div className="space-y-4">
                  {Array.from({ length: job.screenshotCount }).map((_, i) => (
                    <div key={i} className="space-y-2">
                       <label className="text-sm font-black uppercase tracking-widest text-gray-400">
                         {job.screenshotProofInstructions?.[i] || job.screenshotProofInstruction || `Instruction for Screenshot ${i + 1}`}
                       </label>
                      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 border-dashed hover:border-white/20 transition-all flex items-center gap-4">
                        <div className="shrink-0 w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden border border-white/10">
                          {screenshotUrls[i] ? (
                            <img src={screenshotUrls[i]} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-gray-500 font-bold">{i + 1}</span>
                          )}
                        </div>
                        <input 
                          required={!screenshotUrls[i]}
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleSingleScreenshotChange(e.target.files?.[0] || null, i)}
                          className="block w-full text-xs text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white/10 file:text-white hover:file:bg-white/20 cursor-pointer"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {job.autoApprove && (
                <div className="space-y-3 p-6 bg-primary-500/10 border border-primary-500/20 rounded-3xl">
                   <div className="flex items-center gap-2 mb-2 font-black text-primary-400">
                      <Lock className="w-5 h-5" />
                      INSTANT APPROVAL P-CODE (REQUIRED)
                   </div>
                   <input
                     type="text"
                     placeholder="Enter P-Code from instructions"
                     className="w-full bg-white/10 border border-white/20 rounded-xl p-4 outline-none focus:ring-2 focus:ring-primary-500 transition-all text-xl font-bold tracking-widest text-center"
                     value={pinCode}
                     onChange={e => setPinCode(e.target.value)}
                   />
                   <p className="text-[10px] text-gray-400 mt-2">Entering the correct P-Code is required for this job to release your reward immediately.</p>
                </div>
              )}
            </div>

            {submitError && (
               <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl text-red-200 text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  {submitError}
               </div>
            )}

            <button
               type="submit"
               disabled={submitting || isPoster === true}
               className="w-full h-20 bg-white text-gray-900 rounded-3xl font-black text-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
               {submitting ? (
                 <div className="flex items-center gap-2">
                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-100"></div>
                   <span>Processing...</span>
                 </div>
               ) : (
                 <>
                   {isPoster ? (
                     <div className="flex flex-col items-center">
                       <span className="text-sm font-black text-red-500 uppercase">You posted this job</span>
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
    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
       <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
       <p className="text-lg font-bold text-gray-900 tracking-tight">{value}</p>
    </div>
  );
}
