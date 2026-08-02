import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Clock, CheckCircle2, XCircle, ExternalLink, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Submission } from '../types';
import { formatCurrency, cn } from '../lib/utils';
import { format } from 'date-fns';

export function SubmittedJobs() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);

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

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <div className="bg-primary-600 p-3 rounded-2xl text-white shadow-lg">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Submitted Jobs</h1>
          <p className="text-gray-500 font-medium">Track your work and payment status.</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-20 text-center border border-gray-100 shadow-sm space-y-4">
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
             <Clock className="w-10 h-10 text-gray-300" />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-bold text-gray-900">No submissions yet</h3>
            <p className="text-gray-500">Go find some jobs and start earning!</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {submissions.map((sub) => (
            <motion.div
              layout
              key={sub.id}
              className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-primary-200 transition-colors"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-900 uppercase tracking-tight">{sub.jobTitle || 'Job Submission'}</h3>
                <div className="flex flex-wrap gap-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                    sub.status === 'approved' ? "bg-green-100 text-green-600" :
                    sub.status === 'pending' ? "bg-yellow-100 text-yellow-600" :
                    "bg-red-100 text-red-600"
                  )}>
                    {sub.status === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                    {sub.status === 'pending' && <Clock className="w-3 h-3" />}
                    {sub.status === 'rejected' && <XCircle className="w-3 h-3" />}
                    {sub.status}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500">
                    ID: #{sub.jobId.split('-')[0].toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-gray-100 rounded-full text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {format(sub.submittedAt ? new Date(sub.submittedAt as any) : new Date(), 'MMM dd, h:mm a')}
                  </span>
                </div>
                {sub.rejectionReason && (
                   <div className="p-3 bg-red-50 rounded-xl text-xs text-red-600 font-bold border border-red-100">
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
                        className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Zap className="w-3 h-3" /> Claim 7-Day Auto Approve
                      </button>
                    );
                  }
                  return (
                    <div className="text-[10px] text-gray-500 font-bold mt-2">
                       ⏳ Auto-approves in {Math.max(0, Math.ceil(7 - daysPassed))} days if not reviewed
                    </div>
                  );
                })()}
              </div>

              <div className="text-left md:text-right flex flex-col items-start md:items-end gap-2 shrink-0">
                <p className="text-xl font-black text-gray-900">{formatCurrency(sub.reward)}</p>
                <div className="flex gap-2">
                   {sub.screenshots && sub.screenshots.length > 0 && (
                      <span className="text-[10px] font-bold text-gray-400">{sub.screenshots.length} Screens</span>
                   )}
                   {sub.proofText && (
                      <span className="text-[10px] font-bold text-gray-400">Text Proof</span>
                   )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
