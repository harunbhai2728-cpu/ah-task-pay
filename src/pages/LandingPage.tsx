import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useInView } from 'motion/react';
import { LogIn, UserPlus, CreditCard, Users, Megaphone, TrendingUp, CheckCircle, Briefcase, Award, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { BrandLogo } from '../components/BrandLogo';

function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (isInView) {
      let startTime: number;
      let animationFrameId: number;
      const duration = 2000;
      
      const animate = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        setCount(Math.floor(easeOut * value));
        
        if (progress < 1) {
          animationFrameId = requestAnimationFrame(animate);
        } else {
          setCount(value);
        }
      };
      animationFrameId = requestAnimationFrame(animate);
      
      return () => cancelAnimationFrame(animationFrameId);
    }
  }, [isInView, value]);

  return <span ref={ref}>{count.toLocaleString()}{value > 1000 ? '+' : ''}</span>;
}

export function LandingPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, systemConfig } = useAuth();
  
  const [stats, setStats] = useState({ totalUsers: 0, totalJobs: 0, completedTasks: 0, totalWithdraw: 0 });
  const [topJobs, setTopJobs] = useState<any[]>([]);

  useEffect(() => {
    // Fetch Stats
    fetch('/api/landing/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(console.error);
      
    // Fetch Top Jobs
    fetch('/api/landing/top-jobs')
      .then(res => res.json())
      .then(data => setTopJobs(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (user && !authLoading) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading || (systemConfig === null)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary-600 mb-4"></div>
        <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">Initializing Environment...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors relative">
      {/* Decorative Header Background */}
      <div className="absolute top-0 inset-x-0 h-[40vh] bg-gradient-to-b from-primary-900/10 to-transparent dark:from-primary-900/20 pointer-events-none" />

      {/* Top Auth Buttons */}
      <header className="relative z-20 w-full max-w-7xl mx-auto flex items-center justify-between p-4 md:p-6">
        <BrandLogo size="md" />
        <div className="flex items-center gap-3">
          <Link 
            to="/login"
            className="flex items-center gap-2 font-bold uppercase tracking-widest text-xs md:text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-xl px-4 py-2 md:py-2.5 transition-all shadow-sm"
          >
            <LogIn className="w-4 h-4 hidden sm:block" />
            Login
          </Link>
          <Link 
            to="/register"
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-bold uppercase tracking-widest text-xs md:text-sm px-4 md:px-5 py-2 md:py-2.5 rounded-xl shadow-lg shadow-primary-200 dark:shadow-none transition-all"
          >
            <UserPlus className="w-4 h-4 hidden sm:block" />
            Sign Up
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full py-10 md:py-16 px-6 overflow-hidden">
        <div className="absolute top-10 -left-20 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute top-20 -right-20 w-96 h-96 bg-primary-400/20 rounded-full blur-3xl" />
        
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center space-y-8 md:space-y-10">
            <div className="space-y-6 relative z-10 flex flex-col items-center">
              <div className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-md border border-gray-200 dark:border-slate-700/50 rounded-full px-4 py-1.5 text-xs font-semibold text-gray-800 dark:text-slate-200 shadow-sm inline-flex items-center gap-1.5">
                <span>⚡</span>
                <span>#1 Trusted Micro-Task Marketplace in Bangladesh</span>
              </div>
              
              <h2 className="text-4xl sm:text-5xl lg:text-7xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                {systemConfig?.loginTitle ? (
                  <span dangerouslySetInnerHTML={{ __html: systemConfig.loginTitle }} />
                ) : (
                  <>Marketplace for <br/><span className="text-primary-600 dark:text-primary-400">Micro Jobs</span></>
                )}
              </h2>
              <p className="text-lg md:text-xl text-gray-500 dark:text-slate-400 font-medium max-w-2xl mx-auto">
                The most trusted platform in Bangladesh. Join thousands of workers earning daily or promote your business with real people.
              </p>
            </div>
            
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col items-center gap-6 relative z-10 w-full"
            >
               <div className="flex flex-row items-center justify-center gap-3.5 w-full">
                 <Link 
                    to="/register"
                    className="py-3 px-5 md:py-4 md:px-8 bg-primary-600 text-white rounded-xl font-bold md:font-black text-xs md:text-base shadow-xl shadow-primary-200 dark:shadow-none hover:bg-primary-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest whitespace-nowrap"
                 >
                   <UserPlus className="w-5 h-5 hidden sm:block" />
                   Get Started Now
                 </Link>
                 <Link 
                    to="/login"
                    className="py-3 px-5 md:py-4 md:px-8 bg-white/40 dark:bg-slate-800/40 backdrop-blur-md text-gray-900 dark:text-white border border-gray-200 dark:border-slate-700 rounded-xl font-bold md:font-black text-xs md:text-base hover:bg-white/60 dark:hover:bg-slate-700/60 transition-all flex items-center justify-center gap-2 uppercase tracking-widest whitespace-nowrap shadow-sm"
                 >
                   <LogIn className="w-5 h-5 hidden sm:block" />
                   User Login
                 </Link>
               </div>

               {/* Feature Highlight Pills */}
               <div className="flex flex-wrap justify-center gap-3 mt-2">
                 <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5">
                   ⚡ Instant Payouts
                 </div>
                 <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5">
                   🛡️ 100% Verified Tasks
                 </div>
                 <div className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-medium text-gray-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5">
                   🤝 Active Community
                 </div>
               </div>
            </motion.div>

            {/* Live Platform Activity Cards */}
            <div className="mt-10 max-w-5xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
              
              {/* Card 1: Earning Activity */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="rounded-2xl p-5 border shadow-xl bg-white border-slate-200 dark:bg-slate-800/70 dark:border-slate-700/60 backdrop-blur-md flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                    User Earning Activity
                  </h3>
                  <div className="flex h-2 w-2 relative" title="Live updates">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-3xl font-black tracking-tight text-primary-700 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
                      ৳ 2,45,580 <span className="text-lg text-gray-400 dark:text-slate-500 font-bold ml-1">Total</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xl shrink-0">
                    ৳
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { title: "YouTube Video Watch & Subscribe", time: "2 mins ago", amount: "+৳ 40.00" },
                    { title: "App Download & Review", time: "12 mins ago", amount: "+৳ 150.00" },
                    { title: "Facebook Page Engagement", time: "25 mins ago", amount: "+৳ 25.00" },
                    { title: "Website Registration Task", time: "42 mins ago", amount: "+৳ 65.00" }
                  ].map((task, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + (idx * 0.1) }}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        <div className="text-left truncate">
                          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{task.title}</p>
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-slate-400 font-medium">{task.time}</p>
                        </div>
                      </div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 shrink-0 ml-2">
                        {task.amount}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Card 2: Withdrawal Activity */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl p-5 border shadow-xl bg-white border-slate-200 dark:bg-slate-800/70 dark:border-slate-700/60 backdrop-blur-md flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
                    Recent Withdrawal Activity
                  </h3>
                  <div className="flex h-2 w-2 relative" title="Live updates">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-3xl font-black tracking-tight text-primary-700 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-indigo-400 dark:via-purple-400 dark:to-pink-400">
                      ৳ 1,85,200 <span className="text-lg text-gray-400 dark:text-slate-500 font-bold ml-1">Paid Out</span>
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                </div>

                <div className="space-y-2">
                  {[
                    { title: "bKash Personal Cashout", time: "5 mins ago", amount: "-৳ 500.00" },
                    { title: "Nagad Account Payout", time: "18 mins ago", amount: "-৳ 1,200.00" },
                    { title: "Rocket Mobile Banking", time: "34 mins ago", amount: "-৳ 350.00" },
                    { title: "bKash Personal Cashout", time: "50 mins ago", amount: "-৳ 800.00" }
                  ].map((task, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + (idx * 0.1) }}
                      className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="flex flex-col text-left truncate">
                          <p className="text-sm font-bold text-gray-900 dark:text-slate-100 truncate">{task.title}</p>
                          <p className="text-[10px] md:text-xs text-gray-500 dark:text-slate-400 font-medium">{task.time}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end shrink-0 ml-2">
                        <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                          {task.amount}
                        </span>
                        <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded uppercase mt-0.5">
                          Completed
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>

            {systemConfig?.loginBannerUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-12 rounded-3xl overflow-hidden shadow-2xl max-w-5xl w-full mx-auto relative z-10"
              >
                <img 
                  src={systemConfig.loginBannerUrl + '?t=' + new Date().getTime()} 
                  alt="Promo Banner" 
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-cover max-h-[500px]"
                />
              </motion.div>
            )}
        </div>
      </section>

      {/* Animated Statistics Section */}
      <section className="w-full max-w-7xl mx-auto py-16 px-6 relative z-10">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Platform Statistics</h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium mt-2">See how our community is growing rapidly.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          <StatCard 
            icon={<Users className="w-8 h-8 text-blue-500" />} 
            label="Total Users" 
            value={stats.totalUsers} 
            suffix="" 
            description="Our growing community of active freelancers & employers working daily."
          />
          <StatCard 
            icon={<Briefcase className="w-8 h-8 text-indigo-500" />} 
            label="Total Jobs" 
            value={stats.totalJobs} 
            suffix="" 
            description="Fresh micro-tasks, campaigns, and simple jobs posted continuously."
          />
          <StatCard 
            icon={<CheckCircle className="w-8 h-8 text-emerald-500" />} 
            label="Completed Tasks" 
            value={stats.completedTasks} 
            suffix="" 
            description="Tasks successfully submitted, reviewed, and approved on the platform."
          />
          <StatCard 
            icon={<Award className="w-8 h-8 text-amber-500" />} 
            label="Total Withdraw" 
            value={stats.totalWithdraw} 
            prefix="৳ "
            suffix="" 
            description="Reliable, secure, and fast payouts processed for our community."
          />
        </div>
      </section>

      {/* Top Live Jobs Section */}
      {topJobs.length > 0 && (
        <section className="w-full max-w-7xl mx-auto py-20 px-6 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <h2 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight uppercase">Top Live Opportunities</h2>
              <p className="text-gray-500 dark:text-slate-400 font-medium mt-2">Complete these high-paying jobs before they run out!</p>
            </div>
            <Link to="/register" className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-black uppercase tracking-widest text-sm hover:opacity-80 transition-opacity">
              View All Jobs <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topJobs.map((job, idx) => {
               const progress = Math.min((job.completedCount / job.maxWorkers) * 100, 100);
               return (
                 <motion.div 
                   key={job.id}
                   initial={{ opacity: 0, y: 20 }}
                   whileInView={{ opacity: 1, y: 0 }}
                   viewport={{ once: true }}
                   transition={{ delay: idx * 0.1 }}
                   className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800 transition-all flex flex-col justify-between"
                 >
                   <div>
                     <div className="flex justify-between items-start gap-4 mb-4">
                       <h3 className="font-bold text-gray-900 dark:text-white line-clamp-2 leading-tight">{job.title}</h3>
                       <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-xl font-black text-sm whitespace-nowrap">
                         {job.pricePerWork} ৳
                       </div>
                     </div>
                     <div className="space-y-2 mb-6">
                       <div className="flex justify-between text-xs font-bold text-gray-500 dark:text-slate-400">
                         <span>Progress</span>
                         <span>{job.completedCount} / {job.maxWorkers}</span>
                       </div>
                       <div className="w-full bg-gray-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                         <div className="bg-primary-500 h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                       </div>
                     </div>
                   </div>
                   <Link 
                     to="/login"
                     className="w-full py-3 bg-gray-50 hover:bg-primary-50 dark:bg-slate-700 dark:hover:bg-primary-900/20 text-gray-900 dark:text-white text-center rounded-xl font-black uppercase tracking-wider text-xs transition-colors border border-gray-200 dark:border-slate-600 hover:border-primary-200 dark:hover:border-primary-700 hover:text-primary-600 dark:hover:text-primary-400"
                   >
                     Apply Now
                   </Link>
                 </motion.div>
               );
            })}
          </div>
        </section>
      )}

      {/* Demo Sections / Ads */}
      <section className="w-full max-w-7xl mx-auto py-20 px-6 space-y-20 relative z-10">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight uppercase">Platform Features</h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Why AH Task Pay is the leading platform in Bangladesh.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
           <FeatureCard 
             icon={<CreditCard className="w-10 h-10 text-primary-600 dark:text-primary-400" />}
             title="Bkash & Nagad"
             description="Instant withdrawal to bKash and Nagad with minimum 20 BDT limit."
           />
           <FeatureCard 
             icon={<Users className="w-10 h-10 text-blue-600 dark:text-blue-400" />}
             title="Real Workers"
             description="Every job is completed by real verified users, no bots or fake traffic."
           />
           <FeatureCard 
             icon={<Megaphone className="w-10 h-10 text-orange-600 dark:text-orange-400" />}
             title="Boost Business"
             description="Promote your YouTube, Facebook, or Website with real human interaction."
           />
           <FeatureCard 
             icon={<TrendingUp className="w-10 h-10 text-green-600 dark:text-green-400" />}
             title="Expert Support"
             description="Direct WhatsApp support from the AH Task Pay team for all your queries."
           />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-primary-600 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-primary-200"
            >
              <div className="relative z-10 space-y-6">
                <div className="bg-white/20 w-fit p-4 rounded-2xl">
                  <Megaphone className="w-10 h-10" />
                </div>
                <h3 className="text-4xl font-black leading-tight">Need Real People <br/> to Grow your Brand?</h3>
                <p className="text-primary-100 font-medium text-lg">Post tasks and get real reviews, subscriptions, and follows from verified Bangladeshi users.</p>
                <div className="flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">100% Secure</div>
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Real Humans</div>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gray-900 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-gray-200"
            >
              <div className="relative z-10 space-y-6">
                <div className="bg-white/10 w-fit p-4 rounded-2xl">
                  <CreditCard className="w-10 h-10" />
                </div>
                <h3 className="text-4xl font-black leading-tight">Earning Money <br/> is Now Easier.</h3>
                <p className="text-gray-400 font-medium text-lg">Complete simple tasks like visiting websites or watching videos and get paid instantly to your wallet.</p>
                <div className="flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Low Fee</div>
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Fast Approved</div>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary-600/30 rounded-full blur-3xl" />
            </motion.div>
        </div>
      </section>

      {/* Bottom Auth Buttons */}
      <section className="w-full max-w-4xl mx-auto py-16 px-6 relative z-10 text-center space-y-8">
        <h2 className="text-3xl font-black text-gray-900 dark:text-white uppercase tracking-tight">Ready to get started?</h2>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
           <Link 
              to="/register"
              className="w-full sm:w-auto py-4 px-10 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-200 dark:shadow-none hover:bg-primary-700 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
           >
             <UserPlus className="w-5 h-5" />
             Sign Up
           </Link>
           <Link 
              to="/login"
              className="w-full sm:w-auto py-4 px-10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white border-2 border-gray-100 dark:border-slate-700 rounded-2xl font-black text-lg hover:border-gray-300 dark:hover:border-slate-500 transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
           >
             <LogIn className="w-5 h-5" />
             Login
           </Link>
        </div>
      </section>

      <footer className="w-full bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 py-12 px-6 transition-colors relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
           <BrandLogo size="md" />
           <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">© 2026 AH Task Pay. All rights reserved.</p>
           <div className="flex gap-6 text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
              <Link to="/terms-privacy" className="hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors">Terms & Privacy</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, prefix, description }: { icon: React.ReactNode, label: string, value: number, suffix: string, prefix?: string, description: string }) {
  return (
    <div className="rounded-2xl p-5 md:p-6 border bg-white border-slate-200 dark:bg-slate-800/80 dark:border-slate-700/60 shadow-sm hover:-translate-y-1 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center gap-5">
      <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-2xl shrink-0">
        {icon}
      </div>
      <div className="flex flex-col text-left">
        <h4 className="text-4xl font-black text-gray-900 dark:text-white tracking-tighter mb-1">
          {prefix}<AnimatedNumber value={value} />{suffix}
        </h4>
        <p className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm text-gray-500 dark:text-slate-400 font-medium leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm text-left hover:border-primary-200 dark:hover:border-primary-900 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-slate-700 w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 mb-2 uppercase tracking-tight">{title}</h3>
      <p className="text-gray-500 dark:text-slate-400 font-medium text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
