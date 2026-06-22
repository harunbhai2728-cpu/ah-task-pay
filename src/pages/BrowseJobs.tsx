import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  Briefcase, 
  Zap, 
  Clock, 
  ArrowRight,
  TrendingUp,
  MapPin
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Job } from '../types';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';

export function BrowseJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');

  // Debouncing the Search Term Input gracefully
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 400);
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchAllData = async () => {
      try {
        setLoading(true);
        let submitMap = new Map<string, string>();
        let jobIdsToExclude: string[] = [];

        const { data: subData, error: subError } = await supabase
          .from('submissions')
          .select('job_id, status, jobId')
          .eq('worker_id', user.id);
          
        if (!subError && subData) {
          subData.forEach(doc => {
            const jId = doc.jobId || doc.job_id;
            if (jId) {
              submitMap.set(jId, doc.status);
              jobIdsToExclude.push(jId);
            }
          });
          setUserSubmissions(submitMap);
        }

        let query = supabase
          .from('jobs')
          .select('*')
          .eq('status', 'open');

        // Apply db-level search constraint via .ilike() as specified
        if (debouncedSearch.trim()) {
          query = query.ilike('title', `%${debouncedSearch.trim()}%`);
        }
          
        // Apply db-level sort order matching specified layout options
        if (sortOrder === 'price_asc') {
          query = query.order('reward', { ascending: true });
        } else if (sortOrder === 'price_desc') {
          query = query.order('reward', { ascending: false });
        } else {
          query = query.order('created_at', { ascending: false });
        }

        if (jobIdsToExclude.length > 0) {
          query = query.notIn('id', jobIdsToExclude);
        }
        
        // Hide user's own self-posted jobs at query level if possible
        if (user.id) {
          query = query.neq('author_id', user.id);
        }

        const { data: jobList, error } = await query;
          
        if (error) throw error;
        
        setJobs(jobList as Job[]);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching jobs:", err);
        setErrorMsg(err.message || "Failed to load jobs. Check console for details.");
        setLoading(false);
      }
    };
    fetchAllData();
  }, [user?.id, debouncedSearch, sortOrder]);

  const filteredJobs = jobs.filter(job => {
    // Hide user's own self-posted jobs
    if (user?.id && (job.posterId === user.id || job.author_id === user.id)) {
      return false;
    }
    // Hide jobs the user has already submitted proof for (regardless of status)
    if (userSubmissions.has(job.id)) {
      return false;
    }
    // Hide full jobs
    if (job.isFull) {
      return false;
    }
    return true; // Match is fully handled at database level via query!
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Search Header */}
      <div className="bg-gray-900 dark:bg-slate-950 p-8 rounded-[2.5rem] text-white space-y-6 relative overflow-hidden transition-all border border-transparent dark:border-slate-800">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Briefcase className="w-48 h-48 rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-2">
          <h1 className="text-4xl font-black tracking-tight">Available Jobs</h1>
          <p className="text-gray-400 dark:text-slate-500 font-medium">Find tasks that match your skills and start earning BDT instantly.</p>
        </div>

        <div className="relative z-10 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search tasks (e.g. YouTube, Like, Comment)"
              className="w-full pl-14 pr-6 py-4 rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/10 dark:border-white/5 focus:bg-white/20 dark:focus:bg-white/10 focus:outline-none transition-all placeholder:text-gray-500 dark:placeholder:text-slate-600 text-lg font-medium"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="relative min-w-[240px]">
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="w-full h-full px-6 py-4 appearance-none rounded-2xl bg-white/10 dark:bg-white/5 backdrop-blur-md border border-white/10 dark:border-white/5 focus:bg-white/20 dark:focus:bg-white/10 focus:outline-none transition-all text-lg font-bold text-white cursor-pointer"
            >
              <option value="newest" className="bg-gray-900 text-white">Newest First</option>
              <option value="price_asc" className="bg-gray-900 text-white">Low Price To High Price</option>
              <option value="price_desc" className="bg-gray-900 text-white">High Price To Low Price</option>
            </select>
            <Filter className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none opacity-50" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary-600 dark:border-indigo-500"></div>
        </div>
      ) : errorMsg ? (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 p-6 rounded-2xl transition-colors">
          <p className="font-bold">Error loading jobs</p>
          <p className="text-sm mt-1">{errorMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredJobs.length === 0 ? (
            <div className="md:col-span-2 text-center py-24 bg-white dark:bg-slate-800 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 italic text-gray-400 dark:text-slate-500 transition-colors">
              No jobs found matching your search.
            </div>
          ) : (
            filteredJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link to={`/job/${job.id}`}>
                  <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl dark:hover:shadow-none hover:border-indigo-100 dark:hover:border-indigo-900 transition-all group relative overflow-hidden h-full flex flex-col">
                    {job.thumbnail && (
                      <div className="mb-6 -mx-8 -mt-8 h-48 overflow-hidden rounded-t-[2.5rem]">
                        <img 
                          src={job.thumbnail} 
                          alt={job.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <span className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                              <MapPin className="w-3 h-3" /> Global
                           </span>
                           {job.autoApprove && (
                            <span className="bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 transition-colors">
                               <Zap className="w-3 h-3 saturate-150" /> Instant
                            </span>
                           )}
                           {userSubmissions.get(job.id) === 'pending' && (
                            <span className="bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border border-yellow-200 dark:border-yellow-900/50 transition-colors">
                               Pending
                            </span>
                           )}
                        </div>
                        <h3 className="text-2xl font-black text-gray-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors uppercase leading-tight tracking-tight">
                          {job.title}
                        </h3>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-primary-600 dark:text-indigo-400 leading-none">
                          {formatCurrency(job.pricePerWork)}
                        </p>
                        <p className="text-[10px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Reward</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-4 bg-gray-50 dark:bg-slate-700/50 text-gray-600 dark:text-slate-400 px-3 py-1.5 rounded-lg w-fit transition-colors">
                      <Briefcase className="w-4 h-4 text-gray-400 dark:text-slate-500" />
                      <span className="text-xs font-bold uppercase tracking-widest">
                        Submitted: <strong className="dark:text-slate-200">{(job.pendingCount || 0) + (job.approvedCount || 0)}</strong> / {job.maxWorkers}
                      </span>
                    </div>

                    <p className="text-gray-500 dark:text-slate-400 font-medium text-sm line-clamp-3 mb-8 flex-1 transition-colors">
                      {job.description}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-gray-50 dark:border-slate-700 transition-colors">
                      <div className="flex items-center gap-2 text-gray-400 dark:text-slate-500">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest">
                          {format(job.createdAt ? new Date(job.createdAt) : new Date(), 'MMM dd')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 group-hover:gap-4 transition-all">
                        <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm uppercase tracking-widest">View Details</span>
                        <ArrowRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
