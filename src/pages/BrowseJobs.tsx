import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Search, 
  Filter, 
  Briefcase, 
  Zap, 
  Clock, 
  ArrowRight,
  MapPin,
  X,
  Tag
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Job } from '../types';
import { formatCurrency } from '../lib/utils';
import { format } from 'date-fns';
import { useAuth } from '../contexts/AuthContext';
import { Pagination } from '../components/Pagination';

const PAGE_SIZE = 20;

export function BrowseJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [userSubmissions, setUserSubmissions] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortOrder, setSortOrder] = useState<'newest' | 'price_asc' | 'price_desc'>('newest');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, sortOrder]);

  useEffect(() => {
    if (!user?.id) return;
    const fetchAllData = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

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

        const { data: jobList, error } = await query;
          
        if (error) throw error;
        
        setJobs((jobList as Job[]) || []);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching jobs:", err);
        setErrorMsg(err.message || "Failed to load jobs. Check console for details.");
        setLoading(false);
      }
    };
    fetchAllData();
  }, [user?.id, sortOrder]);

  const availableCategories = useMemo(() => {
    const cats = new Set<string>();
    jobs.forEach((job) => {
      if (job.mainCategory && job.mainCategory.trim()) {
        cats.add(job.mainCategory.trim());
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [jobs]);

  const filteredJobs = useMemo(() => {
    const tokens = searchTerm
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return jobs.filter(job => {
      // Hide jobs the user has already submitted proof for (regardless of status)
      if (userSubmissions.has(job.id)) {
        return false;
      }
      // Hide full jobs
      if (job.isFull) {
        return false;
      }
      // Filter by selected category dropdown if set
      if (selectedCategory !== 'ALL') {
        const jobMainCat = (job.mainCategory || '').trim().toLowerCase();
        if (jobMainCat !== selectedCategory.toLowerCase()) {
          return false;
        }
      }
      // Real-time keyword filtering across title & category fields
      if (tokens.length > 0) {
        const searchableText = [
          job.title || '',
          job.mainCategory || '',
          job.subCategory || '',
          job.category || '',
        ]
          .join(' ')
          .toLowerCase();

        const allMatch = tokens.every(token => searchableText.includes(token));
        if (!allMatch) {
          return false;
        }
      }
      return true;
    });
  }, [jobs, userSubmissions, selectedCategory, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedJobs = filteredJobs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Search Header */}
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-5 sm:p-8 rounded-3xl sm:rounded-[2.5rem] text-white space-y-4 sm:space-y-6 relative overflow-hidden transition-all border border-blue-800/40 shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Briefcase className="w-36 h-36 sm:w-48 sm:h-48 rotate-12" />
        </div>
        
        <div className="relative z-10 space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-4xl font-black font-display tracking-tight">Available Jobs</h1>
          <p className="text-blue-200 font-medium text-xs sm:text-base">Find tasks that match your skills and start earning BDT instantly.</p>
        </div>

          <div className="relative z-10 flex flex-col lg:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-blue-200/70" />
              <input
                type="text"
                placeholder="Search by job title or category (e.g. Gmail, TikTok, YouTube)..."
                aria-label="Search jobs by title or category keywords"
                className="w-full pl-11 sm:pl-14 pr-11 py-3.5 sm:py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 focus:bg-white/20 focus:border-white/30 focus:outline-none transition-all placeholder:text-blue-200/60 text-white text-sm sm:text-lg font-medium"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  aria-label="Clear search"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-blue-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:w-auto">
              <div className="relative min-w-0 sm:min-w-[185px]">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  aria-label="Filter by category"
                  className="w-full h-full pl-3.5 sm:pl-5 pr-9 sm:pr-11 py-3 sm:py-4 appearance-none rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 focus:bg-white/20 focus:outline-none transition-all text-xs sm:text-base font-bold text-white cursor-pointer truncate"
                >
                  <option value="ALL" className="bg-[#07266E] text-white">All Categories</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat} className="bg-[#07266E] text-white">{cat}</option>
                  ))}
                </select>
                <Tag className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none text-blue-200" />
              </div>
              <div className="relative min-w-0 sm:min-w-[205px]">
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as any)}
                  aria-label="Sort jobs"
                  className="w-full h-full pl-3.5 sm:pl-5 pr-9 sm:pr-11 py-3 sm:py-4 appearance-none rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 focus:bg-white/20 focus:outline-none transition-all text-xs sm:text-base font-bold text-white cursor-pointer truncate"
                >
                  <option value="newest" className="bg-[#07266E] text-white">Newest First</option>
                  <option value="price_asc" className="bg-[#07266E] text-white">Low Price To High</option>
                  <option value="price_desc" className="bg-[#07266E] text-white">High Price To Low</option>
                </select>
                <Filter className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 pointer-events-none text-blue-200" />
              </div>
            </div>
          </div>

          {!loading && (searchTerm.trim() !== '' || selectedCategory !== 'ALL') && (
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-blue-100/90 font-semibold pt-1">
              <span>
                Showing <strong className="text-[#FB923C] tabular-nums">{filteredJobs.length}</strong> matching {filteredJobs.length === 1 ? 'job' : 'jobs'}
                {searchTerm.trim() ? ` for "${searchTerm.trim()}"` : ''}
                {selectedCategory !== 'ALL' ? ` in ${selectedCategory}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('ALL');
                }}
                className="text-[#FB923C] hover:underline font-bold"
              >
                Reset Filters
              </button>
            </div>
          )}
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-[#07266E] dark:border-[#FB923C]"></div>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 p-6 rounded-2xl transition-colors">
          <p className="font-bold">Error loading jobs</p>
          <p className="text-sm mt-1">{errorMsg}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {filteredJobs.length === 0 ? (
            <div className="md:col-span-2 text-center py-20 sm:py-24 bg-white dark:bg-[#0A1638] rounded-3xl sm:rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 italic text-slate-500 dark:text-blue-200/60 transition-colors">
              No jobs found matching your search.
            </div>
          ) : (
            paginatedJobs.map((job, index) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
              >
                <Link to={`/job/${job.id}`}>
                  <div className="bg-white dark:bg-[#0A1638] p-5 sm:p-7 rounded-3xl sm:rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] hover:shadow-xl hover:shadow-blue-950/10 dark:hover:shadow-none hover:border-[#0B3D9E]/60 dark:hover:border-[#3B82F6]/65 transition-all group relative overflow-hidden h-full flex flex-col">
                    <div className="flex justify-between items-start gap-3 mb-4 sm:mb-6">
                      <div className="space-y-3 min-w-0">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                           <span className="bg-[#EFF4FC] dark:bg-[#0E2460] text-[#07266E] dark:text-blue-200 border border-[#CFE0FB] dark:border-blue-500/30 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                              <MapPin className="w-3 h-3" /> {!job.targetCountry || job.targetCountry === 'ALL' ? 'Global' : job.targetCountry}
                           </span>
                           {job.mainCategory && (
                            <span className="bg-[#F3F7FE] dark:bg-[#050F2B] text-[#071845] dark:text-blue-100 border border-[#DCE7FA] dark:border-[#1C3882]/60 px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider transition-colors">
                              {job.mainCategory}
                            </span>
                           )}
                           {job.autoApprove && (
                            <span className="bg-orange-50 dark:bg-orange-950/40 text-[#F97316] dark:text-[#FB923C] border border-orange-200/70 dark:border-orange-800/50 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                               <Zap className="w-3 h-3 saturate-150" /> Instant
                            </span>
                           )}
                           {user?.id && (job.posterId === user.id || job.author_id === user.id) && (
                            <span className="bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/60 transition-colors">
                               Your Post
                            </span>
                           )}
                           {userSubmissions.get(job.id) === 'pending' && (
                            <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-widest flex items-center gap-1 shadow-sm border border-amber-200 dark:border-amber-900/50 transition-colors">
                              Pending
                            </span>
                           )}
                        </div>
                        <h3 className="text-lg sm:text-2xl font-black font-display text-[#071845] dark:text-white group-hover:text-[#0B3D9E] dark:group-hover:text-[#FB923C] transition-colors uppercase leading-tight tracking-tight break-words">
                          {job.title}
                        </h3>
                      </div>
                      <div className="text-right shrink-0 bg-[#EFF4FC] dark:bg-[#050F2B] px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border border-[#D7E3F7] dark:border-[#1E3B8A]/60">
                        <p className="text-xl sm:text-3xl font-black font-display text-[#07266E] dark:text-[#FB923C] leading-none tabular-nums">
                          {formatCurrency(job.pricePerWork)}
                        </p>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-500 dark:text-blue-200/65 uppercase tracking-widest mt-1">Reward</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-3.5 sm:mb-4 bg-[#F2F6FE] dark:bg-[#050F2B] text-slate-600 dark:text-blue-100 px-3.5 py-1.5 rounded-xl w-fit border border-[#DCE7FA] dark:border-[#1C3882]/60 transition-colors">
                      <Briefcase className="w-4 h-4 text-[#0B3D9E] dark:text-blue-300" />
                      <span className="text-xs font-bold uppercase tracking-widest tabular-nums">
                        Submitted: <strong className="text-[#071845] dark:text-white">{(job.pendingCount || 0) + (job.approvedCount || 0)}</strong> / {job.maxWorkers}
                      </span>
                    </div>

                    <p className="text-slate-600 dark:text-blue-100/70 font-medium text-sm line-clamp-3 mb-5 sm:mb-8 flex-1 transition-colors">
                      {job.description}
                    </p>

                    <div className="flex items-center justify-between pt-4 sm:pt-6 border-t border-[#E3ECFA] dark:border-[#1C3882]/50 transition-colors">
                      <div className="flex items-center gap-2 text-slate-500 dark:text-blue-200/60">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs font-bold uppercase tracking-widest tabular-nums">
                          {format(job.createdAt ? new Date(job.createdAt) : new Date(), 'MMM dd')}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 group-hover:gap-4 transition-all">
                        <span className="text-[#F97316] dark:text-[#FB923C] font-black text-xs sm:text-sm uppercase tracking-widest">View Details</span>
                        <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#F97316] dark:text-[#FB923C]" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
          )}
        </div>
      )}

      {!loading && !errorMsg && filteredJobs.length > 0 && (
        <Pagination
          currentPage={safePage}
          totalItems={filteredJobs.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
          itemLabel="jobs"
        />
      )}
    </div>
  );
}
