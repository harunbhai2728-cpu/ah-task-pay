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
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [subPage, setSubPage] = useState(1);

  const fetchJobs = async () => {
    if (!user) return;
    try {
      const { data: jobList, error: jobErr } = await supabase
        .from('jobs')
        .select('*')
        .eq('posterId', user.id)
        .order('created_at', { ascending: false });

      if (jobErr) throw jobErr;
      const activeJobs = (jobList as Job[] || []).filter(j => j.status !== 'deleted');
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

  const [subFilter, setSubFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const fetchSubmissions = async (jobId: string) => {
    try {
      const { data: subList, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('jobId', jobId)
        .order('submittedAt', { ascending: false });
        
      if (error) throw error;
      setSubmissions((subList || []) as Submission[]);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [user?.id]);

  useEffect(() => {
    setSubPage(1);
    setSubFilter('all');
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

  const totalPages = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = jobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const subCounts = {
    all: submissions.length,
    pending: submissions.filter(s => s.status === 'pending').length,
    approved: submissions.filter(s => s.status === 'approved').length,
    rejected: submissions.filter(s => s.status === 'rejected').length,
  };
  const filteredSubmissions = subFilter === 'all'
    ? submissions
    : submissions.filter(s => s.status === subFilter);

  const totalSubPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));
  const safeSubPage = Math.min(subPage, totalSubPages);
  const paginatedSubmissions = filteredSubmissions.slice((safeSubPage - 1) * PAGE_SIZE, safeSubPage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white border border-blue-400/20 shadow-xl shadow-blue-950/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white/10 border border-white/15 p-3.5 rounded-2xl text-[#FB923C] shrink-0">
            <Briefcase className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">Manage Your Jobs</h1>
            <p className="text-blue-100 font-medium text-sm mt-1">Track performance and review worker submissions.</p>
          </div>
        </div>
        <Link 
          to="/post-job" 
          className="px-6 py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-wider text-xs transition-all shadow-lg shadow-orange-500/25 text-center shrink-0"
        >
          Post New Job
        </Link>
      </div>

      {/* Jobs List Responsive Grid */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {loading || (systemConfig === null) ? (
          <div className="lg:col-span-2 flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0B3D9E] dark:border-[#F97316]"></div>
          </div>
        ) : errorMsg ? (
          <div className="lg:col-span-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300 p-6 rounded-2xl text-center">
            <p className="font-bold">Error loading jobs</p>
            <p className="text-sm mt-1">{errorMsg}</p>
          </div>
        ) : jobs.length === 0 ? (
          <div className="lg:col-span-2 bg-white dark:bg-[#0A1638] p-12 rounded-[2.5rem] border border-dashed border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] text-center space-y-4 transition-colors">
            <div className="bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-[#0B3D9E] dark:text-blue-300">
              <Briefcase className="w-8 h-8" />
            </div>
            <p className="text-slate-500 dark:text-blue-200/70 font-medium">You haven't posted any jobs yet.</p>
          </div>
        ) : (
          paginatedJobs.map((job) => (
            <motion.div
              layout
              key={job.id}
              onClick={() => setSelectedJob(job)}
              className={cn(
                "bg-white dark:bg-[#0A1638] p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] border transition-all cursor-pointer group shadow-sm shadow-blue-950/[0.04] flex flex-col justify-between",
                selectedJob?.id === job.id ? "border-[#0B3D9E] dark:border-[#F97316] shadow-md ring-4 ring-blue-500/15" : "border-[#D7E3F7] dark:border-[#1C3882]/55 hover:border-[#0B3D9E]/60 dark:hover:border-blue-400/50"
              )}
            >
              <div className="flex justify-between items-start gap-3 sm:gap-4 mb-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                     <span className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                      job.approvedCount >= job.maxWorkers || job.status === 'completed' ? "bg-blue-100 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-300" :
                      job.status === 'open' ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" :
                      job.status === 'pending' ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400" :
                      "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                    )}>
                      {job.approvedCount >= job.maxWorkers || job.status === 'completed' ? 'Completed' : job.status === 'pending' ? 'পেন্ডিং এপ্রুভাল' : job.status}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 text-[#071845] dark:text-blue-200 text-[10px] font-black uppercase tracking-widest">
                      ID: #{job.id.split('-')[0].toUpperCase()}
                    </span>
                    {job.pendingCount > 0 && (
                       <span className="bg-[#F97316] text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                          <Clock className="w-3 h-3 animate-pulse" /> Pending Review: {job.pendingCount}
                       </span>
                    )}
                    {job.autoApprove && (
                       <span className="bg-orange-100 dark:bg-orange-950/50 text-[#EA580C] dark:text-orange-400 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Auto
                       </span>
                    )}
                  </div>
                  <h3 className="text-xl font-bold text-[#071845] dark:text-white group-hover:text-[#0B3D9E] dark:group-hover:text-[#FB923C] transition-colors uppercase tracking-tight">{job.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-blue-200/70 font-medium">Posted on {format(job.createdAt ? new Date(job.createdAt as any) : new Date(), 'MMM dd, h:mm a')}</p>
                </div>
                <div className="text-right shrink-0 bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 px-4 py-2.5 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-500 dark:text-blue-200/60 uppercase tracking-wider">Price/Work</p>
                  <p className="text-xl font-black text-[#0B3D9E] dark:text-[#FB923C] tabular-nums">{formatCurrency(job.pricePerWork)}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-6 pt-4 border-t border-[#E4ECFA] dark:border-[#1C3882]/45">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-[#0B3D9E] dark:text-blue-400" />
                      <span className="text-sm font-bold text-[#071845]/80 dark:text-blue-100 tabular-nums">{job.completedCount} / {job.maxWorkers} Submitted</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/50 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (job.completedCount / job.maxWorkers) * 100)}%` }}
                      className="h-full bg-gradient-to-r from-[#07266E] to-[#F97316]" 
                    />
                  </div>
                </div>
                
                {job.status === 'open' && (
                  <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                    {job.pendingCount > 0 && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedJob(job); }}
                        className="px-4 py-2 bg-[#F97316] text-white hover:bg-[#EA580C] rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-md animate-pulse"
                      >
                        <Clock className="w-3.5 h-3.5" /> রিভিউ করুন
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleOpenEditModal(job); }}
                      className="px-4 py-2 bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 text-[#071845] dark:text-blue-100 hover:bg-[#E2ECFC] dark:hover:bg-[#102255] rounded-xl text-xs font-bold transition-all"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRequestDelete(job); }}
                      className="px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl text-xs font-bold transition-all"
                    >
                      Delete
                    </button>
                  </div>
                )}
                {job.status === 'pending' && (
                  <div className="flex items-center gap-2 mt-2 sm:mt-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleRequestDelete(job); }}
                      className="px-4 py-2 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel / Delete
                    </button>
                  </div>
                )}
                {job.status === 'delete_requested' && (
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-xl text-[10px] font-black uppercase tracking-widest mt-2 sm:mt-0">
                     Delete Pending
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>

      {!loading && systemConfig !== null && !errorMsg && jobs.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={jobs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="jobs"
        />
      )}

      {/* Dedicated Review Page Modal Overlay */}
      <AnimatePresence>
        {selectedJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#02081B]/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="bg-white dark:bg-[#0A1638] rounded-[2.5rem] w-full max-w-4xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col border border-[#D7E3F7] dark:border-[#1E3B8A]/60"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-[#E4ECFA] dark:border-[#1C3882]/55 pb-5 mb-5 flex-shrink-0">
                <div className="space-y-1">
                  <span className="px-3 py-1 bg-[#EFF4FC] dark:bg-[#102255] border border-[#DCE7FA] dark:border-[#1C3882]/60 text-[#0B3D9E] dark:text-blue-300 rounded-full text-[10px] font-black uppercase tracking-widest">
                     Job Proof review
                  </span>
                  <h2 className="text-2xl font-black text-[#071845] dark:text-white uppercase tracking-tight break-words mt-1 font-display">
                    {selectedJob.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-blue-200/70 font-bold uppercase tracking-widest pl-0.5 mt-1">
                    Price/Work: <span className="text-[#F97316] font-black">{formatCurrency(selectedJob.pricePerWork)}</span> | Max workers: {selectedJob.maxWorkers}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="p-3 bg-[#F2F6FE] dark:bg-[#050F2B] hover:bg-[#E2ECFC] dark:hover:bg-[#102255] rounded-full text-[#071845] dark:text-blue-200 transition-all shadow-sm flex items-center justify-center border border-[#D7E3F7] dark:border-[#1C3882]/60"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Submissions List */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-2 custom-scrollbar">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
                   <div className="flex flex-wrap items-center gap-2">
                     {([
                       { id: 'all', label: 'All', count: subCounts.all },
                       { id: 'pending', label: 'Pending', count: subCounts.pending },
                       { id: 'approved', label: 'Approved', count: subCounts.approved },
                       { id: 'rejected', label: 'Rejected', count: subCounts.rejected },
                     ] as const).map((tab) => (
                       <button
                         key={tab.id}
                         type="button"
                         onClick={() => {
                           setSubFilter(tab.id);
                           setSubPage(1);
                         }}
                         className={cn(
                           "px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border",
                           subFilter === tab.id
                             ? "bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] dark:from-[#F97316] dark:to-[#EA580C] text-white border-transparent shadow-sm"
                             : "bg-[#F2F6FE] dark:bg-[#050F2B] text-[#071845] dark:text-blue-200 border-[#DCE7FA] dark:border-[#1C3882]/60 hover:bg-[#E2ECFC] dark:hover:bg-[#102255]"
                         )}
                       >
                         {tab.label} ({tab.count})
                       </button>
                     ))}
                   </div>
                   <p className="text-[11px] font-semibold text-slate-500 dark:text-blue-200/70">
                     Proof images auto-delete 24h after approve/reject
                   </p>
                </div>

                {filteredSubmissions.length === 0 ? (
                  <div className="text-center py-16 space-y-4 bg-[#F2F6FE] dark:bg-[#050F2B] rounded-3xl border border-dashed border-[#CEDDF6] dark:border-[#1C3882]/60 p-8">
                     <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                     <p className="text-sm font-bold text-[#071845] dark:text-white uppercase tracking-tight">
                       {subFilter === 'all' ? 'No submissions yet' : `No ${subFilter} submissions`}
                     </p>
                     <p className="text-xs font-medium text-slate-500 dark:text-blue-200/70">
                       {subFilter === 'all'
                         ? 'Worker submissions for this job will appear here.'
                         : `There are currently no ${subFilter} submissions for this job.`}
                     </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4">
                    {paginatedSubmissions.map((sub) => (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={sub.id}
                        className="p-5 bg-[#F2F6FE] dark:bg-[#050F2B] rounded-3xl border border-[#DCE7FA] dark:border-[#1C3882]/60 shadow-sm space-y-4 hover:shadow-md transition-all flex flex-col justify-between"
                      >
                         <div className="space-y-4">
                           {/* Worker Info & Status */}
                           <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#DCE7FA] dark:border-[#1C3882]/55">
                             <div className="flex items-center gap-3 min-w-0">
                               <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#041645] to-[#0B3D9E] flex items-center justify-center text-white font-black text-xs tracking-tighter shadow-sm shrink-0">
                                 #{sub.workerSerial || sub.workerId.slice(0, 5).toUpperCase()}
                               </div>
                               <div className="min-w-0">
                                 <p className="font-black text-sm text-[#071845] dark:text-white tracking-tight truncate">{sub.workerName || 'Worker'}</p>
                                 <p className="text-[9px] text-slate-500 dark:text-blue-200/60 font-bold uppercase tracking-widest">
                                   {sub.submittedAt ? format(new Date(sub.submittedAt), 'MMM dd, yyyy - hh:mm a') : 'Unknown Date'}
                                 </p>
                               </div>
                             </div>
                             <span className={cn(
                               "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shrink-0",
                               sub.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" :
                               sub.status === 'rejected' ? "bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400" :
                               "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400"
                             )}>
                               {sub.status}
                             </span>
                           </div>

                           {/* Text Proof */}
                           <div className="space-y-1 pl-1">
                             <p className="text-[10px] text-slate-500 dark:text-blue-200/60 font-bold uppercase tracking-widest">Text Proof:</p>
                             <p className="text-sm font-medium text-[#071845] dark:text-blue-100 bg-white dark:bg-[#0A1638] p-3 rounded-2xl border border-[#DCE7FA] dark:border-[#1C3882]/60 leading-relaxed font-sans">{sub.proofText || 'None supplied'}</p>
                           </div>

                           {/* Screenshot Proofs */}
                           {sub.imageDeleted ? (
                             <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0A1638] border border-dashed border-[#CEDDF6] dark:border-[#1C3882]/60 flex items-center gap-2.5 text-slate-500 dark:text-blue-200/70">
                               <ImageIcon className="w-4 h-4 shrink-0 opacity-70" />
                               <span className="text-xs font-semibold">
                                 Proof image automatically deleted from database (24h after review).
                               </span>
                             </div>
                           ) : sub.screenshots && sub.screenshots.length > 0 && (
                             <div className="space-y-1.5 pl-1">
                               <div className="flex items-center justify-between gap-2">
                                 <p className="text-[10px] text-slate-500 dark:text-blue-200/60 font-bold uppercase tracking-widest">Screenshots Proof (Click to expand):</p>
                                 {sub.status !== 'pending' && (
                                   <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400">Deletes 24h after review</span>
                                 )}
                               </div>
                               <div className="flex flex-wrap gap-3">
                                 {sub.screenshots.map((url, i) => {
                                   const isSafeUrl = typeof url === 'string' && (url.startsWith('data:image') || url.startsWith('https://') || url.startsWith('http://'));
                                   if (!isSafeUrl) return null;
                                   return (
                                     <button
                                       key={i}
                                       type="button"
                                       onClick={() => setZoomImage(url)}
                                       title="Click to Zoom Screenshot"
                                       className="w-20 h-20 rounded-2xl bg-white dark:bg-[#0A1638] border border-[#CEDDF6] dark:border-[#1C3882]/60 overflow-hidden hover:ring-4 hover:ring-blue-500/20 hover:border-[#0B3D9E] transition-all flex items-center justify-center p-1 cursor-zoom-in group shadow-sm shrink-0"
                                     >
                                       <img src={url} className="w-full h-full object-cover rounded-xl" alt="Proof" />
                                     </button>
                                   );
                                 })}
                               </div>
                             </div>
                           )}
                         </div>

                         {/* Actions & Reason or Reviewed Status */}
                         {sub.status === 'pending' ? (
                           <div className="space-y-3 pt-3 border-t border-[#DCE7FA] dark:border-[#1C3882]/55 mt-4">
                              <input
                                type="text"
                                placeholder="Type reason for rejection..."
                                className="w-full px-4 py-3 bg-white dark:bg-[#0A1638] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl text-xs font-semibold text-[#071845] dark:text-white outline-none focus:ring-2 focus:ring-[#0B3D9E] dark:focus:border-[#3B82F6] placeholder:text-slate-400 dark:placeholder:text-blue-200/40"
                                value={rejectionReason[sub.id] || ''}
                                onChange={e => setRejectionReason(prev => ({...prev, [sub.id]: e.target.value}))}
                              />
                              <div className="flex gap-3">
                                <button
                                  onClick={() => handleApprove(sub)}
                                  disabled={reviewing}
                                  className="flex-1 py-3 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  {reviewing ? "Processing..." : <><CheckCircle2 className="w-4 h-4" /> Approve</>}
                                </button>
                                <button
                                  onClick={() => handleReject(sub)}
                                  disabled={reviewing}
                                  className="flex-1 py-3 bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/60 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                                >
                                  {reviewing ? "Processing..." : <><XCircle className="w-4 h-4" /> Reject</>}
                                </button>
                              </div>
                           </div>
                         ) : (
                           <div className="space-y-2 pt-3 border-t border-[#DCE7FA] dark:border-[#1C3882]/55 mt-4">
                             {sub.status === 'rejected' && sub.rejectionReason && (
                               <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                 Reason: {sub.rejectionReason}
                               </div>
                             )}
                             <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-blue-200/60">
                               {sub.status === 'approved' ? 'Approved' : 'Rejected'}
                               {sub.reviewedAt ? ` · ${format(new Date(sub.reviewedAt), 'MMM dd, yyyy - hh:mm a')}` : ''}
                             </p>
                           </div>
                         )}
                      </motion.div>
                    ))}
                  </div>
                )}

                {filteredSubmissions.length > 0 && (
                  <Pagination
                    currentPage={safeSubPage}
                    totalItems={filteredSubmissions.length}
                    pageSize={PAGE_SIZE}
                    onPageChange={setSubPage}
                    itemLabel="submissions"
                    scrollToTop={false}
                    className="mt-2"
                  />
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
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#02081B]/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[#0A1638] border border-[#D7E3F7] dark:border-[#1E3B8A]/60 rounded-[2.5rem] w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto"
            >
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-[#071845] dark:text-white uppercase tracking-tight font-display">Edit Job</h2>
                  <button onClick={() => setEditJobData(null)} className="p-3 bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#D7E3F7] dark:border-[#1C3882]/60 rounded-full hover:bg-[#E2ECFC] dark:hover:bg-[#102255] transition-colors">
                    <X className="w-5 h-5 text-[#071845] dark:text-blue-200" />
                  </button>
               </div>
               
               {editError && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 rounded-2xl text-sm font-bold border border-red-200 dark:border-red-900/40 flex items-center gap-2">
                     <span className="shrink-0"><XCircle className="w-5 h-5"/></span>
                     <span>{editError}</span>
                  </div>
               )}

               <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest mb-2 pl-1">Job Title</label>
                    <input type="text" className="w-full px-5 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] font-bold text-[#071845] dark:text-white outline-none transition-all" value={editJobData.title} onChange={e => setEditJobData({...editJobData, title: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest mb-2 pl-1">Job Description</label>
                    <textarea rows={4} className="w-full px-5 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] font-medium text-[#071845] dark:text-blue-100 outline-none resize-none transition-all" value={editJobData.description} onChange={e => setEditJobData({...editJobData, description: e.target.value})}></textarea>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div>
                       <label className="block text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest mb-2 pl-1">Price per work (BDT)</label>
                       <input 
                         type="number" 
                         step="0.1" 
                         min={editJobData.job.pricePerWork}
                         className="w-full px-5 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] font-black text-xl text-[#071845] dark:text-white outline-none tabular-nums transition-all" 
                         value={editJobData.pricePerWork === 0 ? '' : editJobData.pricePerWork} 
                         onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setEditJobData({...editJobData, pricePerWork: val });
                         }} 
                       />
                       <p className="text-[10px] text-[#0B3D9E] dark:text-[#FB923C] font-black mt-1.5 uppercase tracking-widest pl-1">Min: {editJobData.job.pricePerWork}</p>
                     </div>
                     <div>
                       <label className="block text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest mb-2 pl-1">Total Workers</label>
                       <input 
                         type="number" 
                         min={editJobData.job.maxWorkers}
                         className="w-full px-5 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] font-black text-xl text-[#071845] dark:text-white outline-none tabular-nums transition-all" 
                         value={editJobData.maxWorkers === 0 ? '' : editJobData.maxWorkers} 
                         onChange={e => {
                            const val = e.target.value === '' ? 0 : Number(e.target.value);
                            setEditJobData({...editJobData, maxWorkers: val });
                         }} 
                       />
                       <p className="text-[10px] text-[#0B3D9E] dark:text-[#FB923C] font-black mt-1.5 uppercase tracking-widest pl-1">Min: {editJobData.job.maxWorkers}</p>
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
                           <div className="mt-2 p-6 bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 rounded-3xl">
                              <h4 className="text-xs font-black text-[#07266E] dark:text-blue-300 uppercase tracking-widest mb-4">Upgrade Cost</h4>
                              <div className="flex justify-between items-center text-sm font-bold text-[#071845] dark:text-blue-100 mb-2">
                                 <span>Extra Worker Cost:</span>
                                 <span className="tabular-nums">{diff.toFixed(2)} BDT</span>
                              </div>
                              <div className="flex justify-between items-center text-sm font-bold text-[#071845] dark:text-blue-100 mb-4 pb-4 border-b border-[#DCE7FA] dark:border-[#1C3882]/60">
                                 <span>Additional Fee ({systemConfig?.jobPostingFee}%):</span>
                                 <span className="tabular-nums">{fee.toFixed(2)} BDT</span>
                              </div>
                              <div className="flex justify-between items-center">
                                 <span className="text-[10px] font-black uppercase tracking-widest text-[#0B3D9E] dark:text-blue-300">Will be deducted from deposit</span>
                                 <span className="text-xl font-black text-[#F97316] tabular-nums">{extraGrandTotal.toFixed(2)} BDT</span>
                              </div>
                           </div>
                        );
                     }
                     return null;
                  })()}

                  <button 
                     onClick={handleSaveEditJob}
                     disabled={isEditing}
                     className="w-full py-5 mt-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25"
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
