import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Briefcase, 
  Users, 
  CheckCircle, 
  Clock, 
  MoreVertical,
  ExternalLink,
  ChevronRight,
  Eye,
  Settings,
  Image as ImageIcon,
  Zap,
  X,
  CheckCircle2,
  XCircle,
  ArrowLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Job, Submission } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { ConfirmModal } from '../components/ConfirmModal';

export function ManageJobs() {
  const { user, systemConfig, refreshProfile } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  
  // Job Edit Modal States
  const [editJobData, setEditJobData] = useState<{
    job: Job;
    title: string;
    description: string;
    pricePerWork: number;
    maxWorkers: number;
  } | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [pendingJobIds, setPendingJobIds] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const fetchJobs = async () => {
    if (!user) return;
    try {
      const { data: jobList, error: jobErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('posterId', user.id)
        .order('created_at', { ascending: false });

      if (jobErr) throw jobErr;
      const activeJobs = (jobList as Job[] || []).filter(j => j.status !== 'deleted' && j.status !== 'rejected');
      setJobs(activeJobs);

      if (activeJobs && activeJobs.length > 0) {
        const { data: subSnap } = await supabase
          .from('submissions')
          .select('jobId')
          .eq('posterId', user.id)
          .eq('status', 'pending');
          
        const pendingIds = new Set<string>();
        if (subSnap) {
          subSnap.forEach(d => pendingIds.add(d.jobId));
        }
        setPendingJobIds(pendingIds);
      }
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("Failed to load jobs. Check console for details.");
      setLoading(false);
    }
  };

  const fetchSubmissions = async (jobId: string) => {
    try {
      const { data: subList, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('jobId', jobId)
        .eq('status', 'pending')
        .order('submittedAt', { ascending: false });
        
      if (error) throw error;
      setSubmissions(subList as Submission[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user?.id]);

  useEffect(() => {
    if (!selectedJob) {
      setSubmissions([]);
      return;
    }
    fetchSubmissions(selectedJob.id);
  }, [selectedJob?.id]);

  const handleApprove = async (sub: Submission) => {
    if (!selectedJob) return;
    try {
      setReviewing(true);

      // Update Submission - backend transaction engine manages counts, worker balances and held balances safely!
      await supabase.from('submissions').update({
        status: 'approved',
        reviewedAt: new Date().toISOString()
      }).eq('id', sub.id);

      setReviewing(false);
      fetchSubmissions(selectedJob.id);
      fetchJobs();
    } catch (error) {
      console.error(error);
      setReviewing(false);
    }
  };

  const [rejectionReason, setRejectionReason] = useState<{[key: string]: string}>({});

  const handleReject = async (sub: Submission) => {
    const reason = rejectionReason[sub.id];
    if (!reason || !reason.trim()) {
      return;
    }
    try {
      setReviewing(true);
      if (!selectedJob) return;

      // Update Submission - backend transaction engine releases slots and adjusts worker balances automatically!
      await supabase.from('submissions').update({
        status: 'rejected',
        rejectionReason: reason,
        reviewedAt: new Date().toISOString()
      }).eq('id', sub.id);

      setRejectionReason(prev => {
        const next = {...prev};
        delete next[sub.id];
        return next;
      });
      setReviewing(false);
      fetchSubmissions(selectedJob.id);
      fetchJobs();
    } catch (error) {
      console.error(error);
      setReviewing(false);
    }
  };

  const handleRequestDelete = async (job: Job) => {
    setJobToDelete(job);
  };

  const confirmRequestDelete = async () => {
    if (!jobToDelete) return;
    try {
      const nextStatus = jobToDelete.status === 'pending' ? 'deleted' : 'delete_requested';
      await supabase.from('jobs').update({ status: nextStatus }).eq('id', jobToDelete.id);
      setJobToDelete(null);
      // reload
      if (nextStatus === 'deleted') {
        setJobs(prev => prev.filter(j => j.id !== jobToDelete.id));
        alert("জবটি বাতিল করা হয়েছে এবং সম্পূর্ণ অংক আপনার ওয়ালেটে ফেরত দেওয়া হয়েছে।");
      } else {
        setJobs(prev => prev.map(j => j.id === jobToDelete.id ? { ...j, status: 'delete_requested' } : j));
        alert("জব ডিলিট রিকোয়েস্ট এডমিনের কাছে পাঠানো হয়েছে। রিভিউ শেষে সমাধান করা হবে।");
      }
    } catch (err) {
      console.error(err);
      setJobToDelete(null);
      alert("জব ডিলিট করতে ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।");
    }
  };

  const handleOpenEditModal = (job: Job) => {
    setEditError(null);
    setEditJobData({
      job,
      title: job.title,
      description: job.description || '',
      pricePerWork: job.pricePerWork,
      maxWorkers: job.maxWorkers
    });
  };

  const handleSaveEditJob = async () => {
    if (!editJobData || !user) return;
    setEditError(null);

    const oldPrice = editJobData.job.pricePerWork;
    const oldWorkers = editJobData.job.maxWorkers;
    const newPrice = editJobData.pricePerWork;
    const newWorkers = editJobData.maxWorkers;

    if (newPrice < oldPrice) {
      setEditError("You can only increase the price per work, cannot decrease.");
      return;
    }
    if (newWorkers < oldWorkers) {
      setEditError("You can only increase the number of workers, cannot decrease.");
      return;
    }

    try {
      setIsEditing(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Authentication error");

      const response = await fetch('/api/job/edit', {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
         },
         body: JSON.stringify({
            jobId: editJobData.job.id,
            title: editJobData.title,
            description: editJobData.description,
            newPricePerWork: newPrice,
            newMaxWorkers: newWorkers
         })
      });

      const json = await response.json();
      if (!response.ok) {
         throw new Error(json.error || "Failed to update job.");
      }

      alert("Job updated successfully.");
      setEditJobData(null);
      refreshProfile(); // Refresh balance if deducted
      fetchJobs();
    } catch(err: any) {
      setEditError(err.message || "Failed to update job");
    } finally {
      setIsEditing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Manage Your Jobs</h1>
          <p className="text-gray-500 font-medium">Track performance and review worker submissions.</p>
        </div>
        <Link 
          to="/post-job" 
          className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-colors shadow-lg"
        >
          Post New Job
        </Link>
      </div>

      {/* Jobs List Full-Width layout */}
      <div className="w-full space-y-4">
        {loading || (systemConfig === null) ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center">
            <p className="font-bold">Error loading jobs</p>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white p-12 rounded-[2.5rem] border border-dashed border-gray-200 text-center space-y-4">
            <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Briefcase className="w-8 h-8" />
            </div>
            <p className="text-gray-500 font-medium">You haven't posted any jobs yet.</p>
          </div>
        ) : (
          jobs.map((job) => (
            <motion.div
              layout
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={cn(
                "bg-white p-6 rounded-[2rem] border transition-all cursor-pointer group",
                selectedJob?.id === job.id ? "border-indigo-600 shadow-md ring-4 ring-indigo-50" : "border-gray-100 shadow-sm hover:border-gray-200"
              )}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                     <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      job.approvedCount >= job.maxWorkers || job.status === 'completed' ? "bg-purple-100 text-purple-600" :
                      job.status === 'open' ? "bg-green-100 text-green-600" :
                      job.status === 'pending' ? "bg-amber-100 text-amber-700" :
                      "bg-red-100 text-red-600"
                    )}>
                      {job.approvedCount >= job.maxWorkers || job.status === 'completed' ? 'Completed' : job.status === 'pending' ? 'পেন্ডিং এপ্রুভাল' : job.status}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                      ID: #{job.id.split('-')[0].toUpperCase()}
                    </span>
                    {job.pendingCount > 0 && (
                       <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm shadow-amber-200">
                          <Clock className="w-3 h-3 animate-pulse" /> Pending Review: {job.pendingCount}
                       </span>
                    )}
                    {job.autoApprove && (
                       <span className="bg-orange-100 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Auto
                       </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{job.title}</h3>
                  <p className="text-xs text-gray-400 font-medium">Posted on {format(job.createdAt ? new Date(job.createdAt as any) : new Date(), 'MMM dd, h:mm a')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-500">Price/Work</p>
                  <p className="text-xl font-black text-gray-900">{formatCurrency(job.pricePerWork)}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-4 border-t border-gray-50">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-bold text-gray-600">{job.completedCount} / {job.maxWorkers} Submitted</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(job.completedCount / job.maxWorkers) * 100}%` }}
                      className="h-full bg-indigo-500" 
                    />
                  </div>
                </div>
                
                {job.status === 'open' && (
                  <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    {job.pendingCount > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                        className="px-4 py-2 bg-amber-500 text-white hover:bg-amber-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md shadow-amber-200 animate-pulse"
                      >
                        <Clock className="w-3.5 h-3.5" /> রিভিউ করুন
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(job); }}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-xs font-bold transition-all"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRequestDelete(job); }}
                      className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {job.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-4 sm:mt-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRequestDelete(job); }}
                      className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel / Delete
                    </button>
                  </div>
                )}
                {job.status === 'delete_requested' && (
                  <div className="px-4 py-2 bg-yellow-50 text-yellow-600 rounded-xl text-[10px] font-black uppercase tracking-widest mt-4 sm:mt-0">
                     Delete Pending
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Dedicated Review Page Modal Overlay */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col border border-gray-100"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-gray-100 pb-5 mb-5 flex-shrink-0">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-widest">
                     Job Proof review
                  </span>
                  <h2 className="text-2xl font-black text-gray-950 uppercase tracking-tight break-words mt-1">
                    {selectedJob.title}
                  </h2>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-widest pl-0.5 mt-1">
                    Price/Work: <span className="text-indigo-600 font-black">{formatCurrency(selectedJob.pricePerWork)}</span> | Max workers: {selectedJob.maxWorkers}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-3 bg-gray-50 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-all shadow-sm flex items-center justify-center border border-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Submissions List */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                <div className="flex items-center justify-between pb-2">
                   <h4 className="text-xs font-black text-gray-400 uppercase tracking-widest pl-1">
                      Pending Submissions to review ({submissions.length})
                   </h4>
                </div>

                {submissions.length === 0 ? (
                  <div className="text-center py-16 space-y-4 bg-gray-50/50 rounded-3xl border border-dashed border-gray-100 p-8">
                     <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
                     <p className="text-sm font-bold text-gray-900 uppercase tracking-tight">All caught up!</p>
                     <p className="text-xs font-medium text-gray-400">There are no pending submissions for this job currently.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    {submissions.map((sub) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={sub.id}
                        className="p-5 bg-gray-50 rounded-3xl border border-gray-100/80 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                         <div className="space-y-4">
                           {/* Worker Info */}
                           <div className="flex items-center gap-3 pb-3 border-b border-gray-200/50">
                             <div className="w-10 h-10 rounded-2xl bg-indigo-100/80 flex items-center justify-center text-indigo-700 font-black text-xs tracking-tighter shadow-sm border border-indigo-200/20">
                               #{sub.workerSerial || sub.workerId.slice(0, 5).toUpperCase()}
                             </div>
                             <div>
                               <p className="font-black text-sm text-gray-900 tracking-tight">{sub.workerName || 'Worker'}</p>
                               <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                                 {sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM dd, yyyy - hh:mm a') : 'Unknown Date'}
                               </p>
                             </div>
                           </div>

                           {/* Text Proof */}
                           <div className="space-y-1 pl-1">
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Text Proof:</p>
                             <p className="text-sm font-medium text-gray-700 bg-white p-3 rounded-2xl border border-gray-100/60 leading-relaxed font-sans">{sub.proofText || 'None supplied'}</p>
                           </div>

                           {/* Screenshot Proofs */}
                           {sub.screenshots && sub.screenshots.length > 0 && sub.screenshots[0] !== "This Picture Was Expired" && (
                             <div className="space-y-1.5 pl-1">
                               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Screenshots Proof (Click to expand):</p>
                               <div className="flex flex-wrap gap-3">
                                 {sub.screenshots.map((url, i) => (
                                   <button
                                     key={i}
                                     onClick={() => setZoomImage(url)}
                                     title="Click to Zoom Screenshot"
                                     className="w-20 h-20 rounded-2xl bg-white border border-gray-200 overflow-hidden hover:ring-4 hover:ring-indigo-100 hover:border-indigo-500 transition-all flex items-center justify-center p-1 cursor-zoom-in group shadow-sm shrink-0"
                                   >
                                     {url.startsWith('data:image') ? (
                                       <img src={url} className="w-full h-full object-cover rounded-xl" alt="Proof" />
                                     ) : (
                                       <div className="flex flex-col items-center justify-center h-full w-full">
                                         <ImageIcon className="w-5 h-5 text-indigo-500 mb-1" />
                                         <span className="text-[8px] font-black uppercase text-indigo-600">View</span>
                                       </div>
                                     )}
                                   </button>
                                 ))}
                               </div>
                             </div>
                           )}
                           {sub.screenshots && sub.screenshots[0] === "This Picture Was Expired" && (
                              <div className="mt-2 text-sm font-bold text-gray-500 bg-gray-50 border border-gray-200 dark:bg-slate-800 dark:border-slate-700 p-3 rounded-xl flex items-center gap-2">
                                <ImageIcon className="w-4 h-4" />
                                (This Picture Was Expired)
                              </div>
                           )}
                         </div>

                         {/* Actions & Reason */}
                         <div className="space-y-3 pt-3 border-t border-gray-200/50 mt-4">
                            <input
                              type="text"
                              placeholder="Type reason for rejection..."
                              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-2xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-gray-400"
                              value={rejectionReason[sub.id] || ''}
                              onChange={e => setRejectionReason(prev => ({...prev, [sub.id]: e.target.value}))}
                            />
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApprove(sub)}
                                disabled={reviewing}
                                className="flex-1 py-3 bg-green-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-green-100 hover:bg-green-600 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {reviewing ? "Processing..." : <><CheckCircle2 className="w-4 h-4" /> Approve</>}
                              </button>
                              <button
                                onClick={() => handleReject(sub)}
                                disabled={reviewing}
                                className="flex-1 py-3 bg-red-50 text-red-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                              >
                                {reviewing ? "Processing..." : <><XCircle className="w-4 h-4" /> Reject</>}
                              </button>
                            </div>
                         </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Image Preview Magnifier Tool Modal */}
      <AnimatePresence>
        {zoomImage && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-transparent rounded-3xl"
            >
              <button
                onClick={() => setZoomImage(null)}
                className="absolute top-4 right-4 z-10 p-3 bg-black/60 text-white rounded-full hover:bg-black/80 transition-all flex items-center justify-center shadow-lg"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={zoomImage}
                alt="Enlarged Proof"
                className="max-h-[85vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Job Modal */}
      <AnimatePresence>
        {editJobData && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">Edit Job</h2>
                  <button onClick={() => setEditJobData(null)} className="p-3 bg-gray-50 border border-gray-100 rounded-full hover:bg-gray-100 transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
               </div>
               
               {editError && (
                  <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-2">
                     <span className="shrink-0"><XCircle className="w-5 h-5"/></span>
                     <span>{editError}</span>
                  </div>
               )}

               <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Job Title</label>
                    <input type="text" className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-bold text-gray-900 outline-none" value={editJobData.title} onChange={e => setEditJobData({...editJobData, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Job Description</label>
                    <textarea rows={4} className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 outline-none resize-none" value={editJobData.description} onChange={e => setEditJobData({...editJobData, description: e.target.value})}></textarea>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Price per work (BDT)</label>
                       <input 
                         type="number" 
                         step="0.1" 
                         min={editJobData.job.pricePerWork}
                         className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-black text-xl text-gray-900 outline-none" 
                         value={editJobData.pricePerWork === 0 ? '' : editJobData.pricePerWork} 
                         onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setEditJobData({...editJobData, pricePerWork: val });
                         }} 
                       />
                       <p className="text-[10px] text-indigo-500 font-black mt-1.5 uppercase tracking-widest pl-1">Min: {editJobData.job.pricePerWork}</p>
                     </div>
                     <div>
                       <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 pl-1">Total Workers</label>
                       <input 
                         type="number" 
                         min={editJobData.job.maxWorkers}
                         className="w-full px-5 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 font-black text-xl text-gray-900 outline-none" 
                         value={editJobData.maxWorkers === 0 ? '' : editJobData.maxWorkers} 
                         onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setEditJobData({...editJobData, maxWorkers: val });
                         }} 
                       />
                       <p className="text-[10px] text-indigo-500 font-black mt-1.5 uppercase tracking-widest pl-1">Min: {editJobData.job.maxWorkers}</p>
                     </div>
                  </div>

                  {(() => {
                     const oldTotal = editJobData.job.pricePerWork * editJobData.job.maxWorkers;
                     const newTotal = editJobData.pricePerWork * editJobData.maxWorkers;
                     const diff = newTotal - oldTotal;
                     const fee = diff * (Number(systemConfig?.jobPostingFee) / 100);
                     const extraGrandTotal = diff + fee;
                     
                     if (extraGrandTotal > 0) {
                        return (
                           <div className="mt-2 p-6 bg-indigo-50 border border-indigo-100 rounded-3xl">
                              <h4 className="text-xs font-black text-indigo-800 uppercase tracking-widest mb-4">Upgrade Cost</h4>
                              <div className="flex justify-between items-center text-sm font-bold text-indigo-900 mb-2">
                                 <span>Extra Worker Cost:</span>
                                 <span>{diff.toFixed(2)} BDT</span>
                              </div>
                              <div className="flex justify-between items-center text-sm font-bold text-indigo-900 mb-4 pb-4 border-b border-indigo-200/50">
                                 <span>Additional Fee ({systemConfig?.jobPostingFee}%):</span>
                                 <span>{fee.toFixed(2)} BDT</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Will be deducted from deposit</span>
                                 <span className="text-xl font-black text-indigo-700">{extraGrandTotal.toFixed(2)} BDT</span>
                              </div>
                           </div>
                        );
                     }
                     return null;
                  })()}

                  <button 
                     onClick={handleSaveEditJob}
                     disabled={isEditing}
                     className="w-full py-5 mt-2 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-indigo-200"
                  >
                     {isEditing ? <span className="animate-pulse">Saving Changes...</span> : <span>Save Changes</span>}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={!!jobToDelete}
        title={jobToDelete?.status === 'pending' ? "Cancel Job & Refund" : "Request Delete Job"}
        message={jobToDelete ? (jobToDelete.status === 'pending' ? `আপনি কি নিশ্চিত যে আপনি "${jobToDelete.title}" জবটি বাতিল করতে চান? আপনার অনুষ্ঠিত বাজেট সম্পূর্ণ সাথে সাথে রিফান্ড করে দেওয়া হবে।` : `Are you sure you want to request deletion for "${jobToDelete.title}"? Admin will review it and refund your unspent deposit.`) : ''}
        onConfirm={confirmRequestDelete}
        onCancel={() => setJobToDelete(null)}
        confirmText={jobToDelete?.status === 'pending' ? "Cancel & Refund" : "Request Delete"}
      />
    </div>
  );
}
