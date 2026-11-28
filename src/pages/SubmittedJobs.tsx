import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Clock, CheckCircle2, XCircle, ExternalLink, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Submission } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function SubmittedJobs() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchSubmissions = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select('*')
        .eq('workerId', user.id)
        .order('submittedAt', { ascending: false });

      if (error) throw error;
      setSubmissions((data || []) as Submission[]);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
    
    // Silent trigger for smart optimization image cleanup
    fetch('/api/cleanup-images', { method: 'POST' }).catch(() => {});
  }, [user?.id]);

  const handleClaimAutoApprove = async (sub: Submission) => {
    if (claiming) return;
    setClaiming(true);
    
    try {
      // Our server proxy handles all counts, worker balance deposit, and poster held-release atomically!
      const { error: updSubErr } = await supabase.from('submissions').update({
        status: 'approved',
        reviewedAt: new Date().toISOString(),
        paymentNote: '7-days Auto Approved'
      }).eq('id', sub.id);
      if (updSubErr) throw updSubErr;

      alert("Successfully auto-approved! Funds added to your earning balance.");
      fetchSubmissions();
    } catch (err: any) {
      alert("Failed to claim: " + err.message);
    }
    setClaiming(false);
  };

  const totalPages = Math.max(1, Math.ceil(submissions.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSubmissions = submissions.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white border border-blue-400/20 shadow-xl shadow-blue-950/15 flex items-center gap-4">
        <div className="bg-white/10 border border-white/15 p-3.5 rounded-2xl text-[#FB923C]">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-display tracking-tight">Submitted Jobs</h1>
          <p className="text-blue-100 font-medium text-sm mt-0.5">Track your work and payment status.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#0B3D9E] dark:border-[#F97316]"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white dark:bg-[#0A1638] rounded-[2.5rem] p-16 sm:p-20 text-center border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-4 transition-colors">
          <div className="bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
             <Clock className="w-10 h-10 text-[#0B3D9E] dark:text-blue-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-[#071845] dark:text-white">No submissions yet</h3>
            <p className="text-slate-500 dark:text-blue-200/70">Go find some jobs and start earning!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {paginatedSubmissions.map((sub) => (
            <motion.div
              layout
              key={sub.id}
              className="bg-white dark:bg-[#0A1638] p-6 rounded-[2rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-[#0B3D9E] dark:hover:border-[#F97316] transition-colors"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#071845] dark:text-white uppercase tracking-tight">{sub.jobTitle || 'Job Submission'}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                    sub.status === 'approved' ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" :
                    sub.status === 'pending' ? "bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400" :
                    "bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400"
                  )}>
                    {sub.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                    {sub.status === 'pending' && <Clock className="w-3 h-3" />}
                    {sub.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {sub.status}
                  </span>
                  <span className="px-3 py-1 bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 rounded-full text-[10px] font-black uppercase tracking-widest text-[#071845] dark:text-blue-200">
                    ID: #{sub.jobId.split('-')[0].toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-[#EFF4FC] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-blue-200/80">
                    {format(sub.submittedAt ? new Date(sub.submittedAt as any) : new Date(), 'MMM dd, h:mm a')}
                  </span>
                </div>
                {sub.rejectionReason && (
                   <div className="p-3 bg-red-50 dark:bg-red-950/40 rounded-xl text-xs text-red-600 dark:text-red-400 font-bold border border-red-200 dark:border-red-900/40">
                      Reason: {sub.rejectionReason}
                   </div>
                )}
                {sub.status === 'pending' && (() => {
                  const daysPassed = ((new Date().getTime() - (sub.submittedAt ? new Date(sub.submittedAt as any).getTime() : Date.now())) / (1000 * 3600 * 24));
                  if (daysPassed >= 7) {
                    return (
                      <button 
                        onClick={() => handleClaimAutoApprove(sub)}
                        disabled={claiming}
                        className="mt-2 px-4 py-2 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 shadow-md"
                      >
                        <Zap className="w-3 h-3" /> Claim 7-Day Auto Approve
                      </button>
                    );
                  }
                  return (
                    <div className="text-[11px] text-slate-500 dark:text-blue-200/70 font-bold mt-2">
                       ⏳ Auto-approves in {Math.max(0, Math.ceil(7 - daysPassed))} days if not reviewed
                    </div>
                  );
                })()}
              </div>

              <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2 shrink-0 bg-[#F2F6FE] dark:bg-[#050F2B] border border-[#DCE7FA] dark:border-[#1C3882]/60 px-4 py-3 rounded-2xl">
                <p className="text-xl font-black text-[#0B3D9E] dark:text-[#FB923C] tabular-nums">{formatCurrency(sub.reward)}</p>
                <div className="flex gap-2">
                   {sub.screenshots && sub.screenshots.length > 0 && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-blue-200/70">{sub.screenshots.length} Screens</span>
                   )}
                   {sub.proofText && (
                      <span className="text-[10px] font-bold text-slate-500 dark:text-blue-200/70">Text Proof</span>
                   )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {!loading && submissions.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={submissions.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="submissions"
        />
      )}
    </div>
  );
}
