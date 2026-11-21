import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useInView } from 'motion/react';
import {
  ArrowRight,
  PlayCircle,
  Users,
  Zap,
  CheckCircle2,
  Image as ImageIcon,
  FileText,
  Share2,
  Languages,
  Video,
  Smartphone,
  Briefcase,
  ShieldCheck,
  Headphones,
  Globe,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  X,
  MessageCircle,
  Send,
  Mail,
  Wallet,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from '../components/BrandLogo';
import { BkashLogo, NagadLogo, RechargeLogo } from '../components/PaymentMethodLogos';

function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '100px 0px 50px 0px' });
  const hasAnimatedRef = useRef(false);

  useEffect(() => {
    if (value <= 0) {
      setCount(0);
      return;
    }

    const startAnimation = () => {
      if (hasAnimatedRef.current) {
        setCount(value);
        return;
      }
      hasAnimatedRef.current = true;

      let startTime: number | null = null;
      let animationFrameId: number;
      const duration = 1400;

      const animate = (time: number) => {
        if (!startTime) startTime = time;
        const progress = Math.min((time - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const nextValue = Math.floor(easeOut * value);

        if (progress < 1) {
          setCount(nextValue);
          animationFrameId = requestAnimationFrame(animate);
        } else {
          setCount(value);
        }
      };

      animationFrameId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrameId);
    };

    if (isInView) {
      return startAnimation();
    } else {
      const fallbackTimer = setTimeout(() => {
        startAnimation();
      }, 900);
      return () => clearTimeout(fallbackTimer);
    }
  }, [isInView, value]);

  return (
    <span ref={ref} className="inline-block tabular-nums">
      {count.toLocaleString()}
    </span>
  );
}

function getTaskVisual(title: string) {
  const lower = (title || '').toLowerCase();
  if (lower.includes('youtube') || lower.includes('video') || lower.includes('watch')) {
    return {
      icon: Video,
      bg: 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/60',
    };
  }
  if (lower.includes('image') || lower.includes('photo') || lower.includes('upload') || lower.includes('screenshot')) {
    return {
      icon: ImageIcon,
      bg: 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/60',
    };
  }
  if (lower.includes('facebook') || lower.includes('share') || lower.includes('social') || lower.includes('follow') || lower.includes('post')) {
    return {
      icon: Share2,
      bg: 'bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 border-sky-100 dark:border-sky-900/60',
    };
  }
  if (lower.includes('app') || lower.includes('install') || lower.includes('download') || lower.includes('play')) {
    return {
      icon: Smartphone,
      bg: 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/60',
    };
  }
  if (lower.includes('translate') || lower.includes('language')) {
    return {
      icon: Languages,
      bg: 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/60',
    };
  }
  if (lower.includes('article') || lower.includes('data') || lower.includes('write') || lower.includes('review')) {
    return {
      icon: FileText,
      bg: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/60',
    };
  }
  return {
    icon: Briefcase,
    bg: 'bg-blue-50 dark:bg-blue-950/50 text-[#0B3D9E] dark:text-blue-400 border-blue-100 dark:border-blue-900/60',
  };
}

const FAQ_ITEMS = [
  {
    q: 'How do I start earning money on AH Task Pay?',
    a: 'Create a free account in under a minute, browse verified micro-tasks from the marketplace, complete the simple instructions with screenshot or text proof, and receive Taka (৳) directly into your earning balance once approved.',
  },
  {
    q: 'Which withdrawal methods are supported and how fast are payouts?',
    a: 'You can withdraw your earnings anytime via bKash, Nagad, or Mobile Recharge (all Bangladeshi operators). Payout requests are reviewed promptly by our team and sent straight to your personal wallet.',
  },
  {
    q: 'Is registration completely free for workers?',
    a: 'Yes! Joining AH Task Pay as a worker is 100% free with zero hidden fees. You can begin completing available tasks immediately after signing up.',
  },
  {
    q: 'Can business owners and creators post jobs to promote their brand?',
    a: 'Yes. Switch to Advertiser mode after logging in, deposit funds via bKash or Nagad, and launch custom micro-campaigns for real YouTube watch-time, app reviews, website visits, or social engagement.',
  },
  {
    q: 'What if I face an issue with a task or withdrawal?',
    a: 'Our support team is available via WhatsApp, Telegram, Email, and the built-in Support Ticket center inside your dashboard to resolve any questions quickly.',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, systemConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [stats, setStats] = useState({
    totalUsers: 0,
    totalJobs: 0,
    completedTasks: 0,
    totalWithdraw: 0,
  });
  const [topJobs, setTopJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [showAllTopJobs, setShowAllTopJobs] = useState(false);

  const [promoBannerError, setPromoBannerError] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeGuideTab, setActiveGuideTab] = useState<'worker' | 'employer'>('worker');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  useEffect(() => {
    setPromoBannerError(false);
  }, [systemConfig?.loginBannerUrl]);

  useEffect(() => {
    fetch('/api/landing/stats')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data === 'object') {
          setStats({
            totalUsers: Number(data.totalUsers) || 0,
            totalJobs: Number(data.totalJobs) || 0,
            completedTasks: Number(data.completedTasks) || 0,
            totalWithdraw: Number(data.totalWithdraw) || 0,
          });
        }
      })
      .catch(console.error);

    const loadTopJobs = () => {
      fetch(`/api/landing/top-jobs?t=${Date.now()}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTopJobs(data);
          }
        })
        .catch(console.error)
        .finally(() => setJobsLoading(false));
    };

    loadTopJobs();
    const interval = setInterval(loadTopJobs, 15000);
    return () => clearInterval(interval);
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

  const scrollToSection = (sectionId: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (authLoading || systemConfig === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0B3D9E] dark:border-orange-500 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 font-semibold text-[1.4rem]">
          Loading AH Task Pay...
        </p>
      </div>
    );
  }

  const displayedJobs = showAllTopJobs ? topJobs : topJobs.slice(0, 4);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 transition-colors">
      {/* ===================================================================
          TOP DEEP ROYAL-BLUE HEADER & HERO BANNER
         =================================================================== */}
      <div
        id="hero"
        className="relative bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0C3FA8] text-white overflow-hidden"
      >
        {/* Subtle Architectural Background Depth Shapes */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 -left-24 w-[38rem] h-[38rem] rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute top-12 right-0 w-[44rem] h-[44rem] rounded-full bg-sky-400/10 blur-3xl" />
          <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#03133D]/40 to-transparent" />
        </div>

        {/* 3-Zone Top Navigation Bar */}
        <header className="relative z-30 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-6 lg:gap-8">
            {/* Zone 1: Brand Mark */}
            <a
              href="#hero"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('hero');
              }}
              className="shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 rounded-xl"
            >
              <BrandLogo size="md" />
            </a>

            {/* Zone 2: Single-Line Navigation Links */}
            <nav
              aria-label="Primary Navigation"
              className="hidden md:flex items-center gap-6 lg:gap-8 text-[1.4rem] font-medium text-blue-100"
            >
              <button
                type="button"
                onClick={() => scrollToSection('hero')}
                className="px-3.5 py-1.5 rounded-lg bg-white/15 text-white font-semibold whitespace-nowrap shrink-0 transition-colors hover:bg-white/20 cursor-pointer"
              >
                Home
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('popular-tasks')}
                className="hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Tasks
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                How It Works
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('faq')}
                className="hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                FAQ
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('contact')}
                className="hover:text-white underline-offset-4 hover:underline whitespace-nowrap shrink-0 transition-colors cursor-pointer"
              >
                Contact
              </button>
            </nav>

            {/* Zone 3: Theme Toggle + Auth Actions + Mobile Toggle */}
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="w-10 h-10 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <Link
                to="/login"
                className="inline-flex items-center justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl border border-white/35 bg-white/10 hover:bg-white/20 text-white font-semibold text-[1.25rem] sm:text-[1.4rem] whitespace-nowrap shrink-0 transition-colors"
              >
                Login
              </Link>

              <Link
                to="/register"
                className="inline-flex items-center justify-center px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-[1.25rem] sm:text-[1.4rem] shadow-md shadow-orange-950/30 whitespace-nowrap shrink-0 transition-all"
              >
                Register
              </Link>

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                className="md:hidden w-10 h-10 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Drawer */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-3 rounded-2xl bg-[#072160]/95 backdrop-blur-md border border-white/15 p-4 space-y-2 shadow-xl">
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Home', id: 'hero' },
                  { label: 'Popular Tasks', id: 'popular-tasks' },
                  { label: 'How It Works', id: 'how-it-works' },
                  { label: 'Features', id: 'features' },
                  { label: 'FAQ', id: 'faq' },
                  { label: 'Contact', id: 'contact' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className="text-left px-3.5 py-2.5 rounded-xl text-[1.4rem] font-medium text-blue-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-white/15 flex items-center gap-2.5">
                <Link
                  to="/login"
                  className="flex-1 text-center py-2.5 rounded-xl border border-white/30 text-white font-semibold text-[1.4rem] hover:bg-white/10"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="flex-1 text-center py-2.5 rounded-xl bg-[#F97316] text-white font-bold text-[1.4rem] hover:bg-[#EA580C]"
                >
                  Register Free
                </Link>
              </div>
            </div>
          )}
        </header>

        {/* Hero Content & Admin-Configured Login Banner Slot */}
        <section className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-24 sm:pt-10 sm:pb-28 lg:pb-32">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <h1 className="font-display font-extrabold text-[3.3rem] sm:text-[4.4rem] lg:text-[5.2rem] leading-[1.12] tracking-tight text-white [text-wrap:balance]">
              {systemConfig?.loginTitle ? (
                <span dangerouslySetInnerHTML={{ __html: systemConfig.loginTitle }} />
              ) : (
                <>
                  The Trusted Microjob Platform for{' '}
                  <span className="text-[#FB923C]">Skilled Workers</span>
                </>
              )}
            </h1>

            <p className="text-[1.55rem] sm:text-[1.8rem] text-blue-100/90 leading-relaxed max-w-2xl mx-auto">
              Earn Bangladeshi Taka (৳) through simple verified tasks, anytime and anywhere — or
              promote your business with real human engagement.
            </p>

            {/* Hero CTAs */}
            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-[1.5rem] shadow-xl shadow-orange-950/35 hover:-translate-y-0.5 transition-all whitespace-nowrap shrink-0"
              >
                <span>Get Started Free</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full border border-white/40 bg-white/10 hover:bg-white/20 text-white font-bold text-[1.5rem] transition-all whitespace-nowrap shrink-0"
              >
                <span>Login</span>
              </Link>

              <button
                type="button"
                onClick={() => scrollToSection('how-it-works')}
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full border border-white/30 bg-white/5 hover:bg-white/15 text-white font-semibold text-[1.5rem] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <PlayCircle className="w-5 h-5 text-[#FB923C]" />
                <span>How it Works</span>
              </button>
            </div>

            {/* Clean Unboxed Trust Metadata */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[1.3rem] text-blue-200/85 font-medium">
              <span>Instant bKash &amp; Nagad Payouts</span>
              <span aria-hidden="true" className="text-blue-300/60">
                ·
              </span>
              <span>100% Verified Tasks</span>
              <span aria-hidden="true" className="text-blue-300/60">
                ·
              </span>
              <span>Free to Join</span>
            </div>
          </div>

          {/* Admin-Configured Login Page Banner (Appears directly here when set in Admin Panel) */}
          {systemConfig?.loginBannerUrl && !promoBannerError && (
            <div className="mt-10 max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/20 bg-[#051F5E]">
              <img
                src={systemConfig.loginBannerUrl}
                alt="AH Task Pay Promotional Banner"
                referrerPolicy="no-referrer"
                onError={() => setPromoBannerError(true)}
                className="w-full h-auto object-cover max-h-[460px] block"
              />
            </div>
          )}
        </section>
      </div>

      {/* ===================================================================
          OVERLAPPING 3-COLUMN LIVE STATS BAR
         =================================================================== */}
      <section
        aria-label="Live Platform Statistics"
        className="relative z-30 max-w-6xl mx-auto px-4 sm:px-6 -mt-14 sm:-mt-16"
      >
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-900/10 dark:shadow-black/40 border border-slate-200/80 dark:border-slate-700/80 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200/80 dark:divide-slate-700/80">
            {/* Stat 1: Happy Members */}
            <div className="flex items-center gap-4 px-6 py-5 sm:py-6">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/50 text-[#0B3D9E] dark:text-blue-400 flex items-center justify-center shrink-0">
                <Users className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.25rem] font-semibold text-slate-500 dark:text-slate-400">
                  Register &amp; Join
                </p>
                <p className="font-display text-[2.6rem] font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums">
                  <AnimatedNumber value={stats.totalUsers} />
                  {stats.totalUsers > 0 ? '+' : ''}
                </p>
                <p className="text-[1.25rem] font-medium text-slate-500 dark:text-slate-400">
                  Happy Members
                </p>
              </div>
            </div>

            {/* Stat 2: Total Paid Out */}
            <div className="flex items-center gap-4 px-6 py-5 sm:py-6">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-100 dark:border-orange-800/50 text-[#F97316] dark:text-orange-400 flex items-center justify-center shrink-0">
                <Zap className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.25rem] font-semibold text-slate-500 dark:text-slate-400">
                  Get Paid Fast
                </p>
                <p className="font-display text-[2.6rem] font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums">
                  ৳<AnimatedNumber value={stats.totalWithdraw} />
                </p>
                <p className="text-[1.25rem] font-medium text-slate-500 dark:text-slate-400">
                  Total Paid Out
                </p>
              </div>
            </div>

            {/* Stat 3: Completed Tasks */}
            <div className="flex items-center gap-4 px-6 py-5 sm:py-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-100 dark:border-emerald-800/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.25rem] font-semibold text-slate-500 dark:text-slate-400">
                  Completed Tasks
                </p>
                <p className="font-display text-[2.6rem] font-extrabold text-slate-900 dark:text-white leading-tight tabular-nums">
                  <AnimatedNumber value={stats.completedTasks} />
                  {stats.completedTasks > 0 ? '+' : ''}
                </p>
                <p className="text-[1.25rem] font-medium text-slate-500 dark:text-slate-400">
                  Tasks Finished · {stats.totalJobs.toLocaleString()} Active Jobs
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          POPULAR TASKS (LIVE MARKETPLACE PREVIEW)
         =================================================================== */}
      <section id="popular-tasks" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-20 pb-14">
        {/* Centered Header Flanked by Subtle Orange Rules */}
        <div className="text-center max-w-2xl mx-auto mb-10 space-y-2.5">
          <div className="flex items-center justify-center gap-4">
            <span className="h-[2px] w-12 bg-gradient-to-r from-transparent to-[#F97316]" aria-hidden="true" />
            <h2 className="font-display font-extrabold text-[2.6rem] sm:text-[3.2rem] text-slate-900 dark:text-white tracking-tight">
              Popular Tasks
            </h2>
            <span className="h-[2px] w-12 bg-gradient-to-l from-transparent to-[#F97316]" aria-hidden="true" />
          </div>
          <p className="text-[1.5rem] text-slate-600 dark:text-slate-400">
            Choose from a variety of live verified micro-tasks and start earning Taka (৳) today!
          </p>
        </div>

        {/* Live Tasks Grid */}
        {jobsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl p-5 animate-pulse space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
                  </div>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full" />
                <div className="h-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
              </div>
            ))}
          </div>
        ) : displayedJobs.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {displayedJobs.map((job) => {
                const totalSlots = job.totalSlots || job.maxWorkers || 1;
                const filledSlots =
                  job.filledSlots !== undefined ? job.filledSlots : job.completedCount || 0;
                const availableSlots =
                  job.availableSlots !== undefined
                    ? job.availableSlots
                    : Math.max(0, totalSlots - filledSlots);
                const progress = Math.min(Math.round((filledSlots / totalSlots) * 100), 100);
                const isFull = job.isFull || availableSlots <= 0;
                const visual = getTaskVisual(job.title);
                const TaskIcon = visual.icon;

                return (
                  <div
                    key={job.id}
                    className="bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-5 shadow-xs hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-4">
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${visual.bg}`}
                        >
                          <TaskIcon className="w-6 h-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-display font-bold text-[1.5rem] text-slate-900 dark:text-white leading-snug line-clamp-2">
                            {job.title}
                          </h3>
                          <p className="font-display font-extrabold text-[1.85rem] text-slate-900 dark:text-orange-400 mt-1 tabular-nums">
                            ৳{Number(job.pricePerWork || 0).toFixed(2).replace(/\.00$/, '')}
                          </p>
                        </div>
                      </div>

                      {/* Slot Availability & Progress */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[1.2rem] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                          <span>{availableSlots} slots left</span>
                          <span>{progress}% filled</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              isFull
                                ? 'bg-rose-500'
                                : progress > 75
                                  ? 'bg-amber-500'
                                  : 'bg-[#0B3D9E] dark:bg-blue-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {isFull ? (
                      <span className="w-full py-2.5 text-center rounded-xl font-semibold text-[1.35rem] bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-600 cursor-not-allowed">
                        Slot Full
                      </span>
                    ) : (
                      <Link
                        to="/login"
                        className="w-full py-2.5 text-center rounded-xl font-bold text-[1.35rem] bg-[#F97316] hover:bg-[#EA580C] text-white shadow-xs transition-colors"
                      >
                        Apply Now
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {topJobs.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAllTopJobs((prev) => !prev)}
                  className="px-6 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-[1.4rem] hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                >
                  {showAllTopJobs ? 'Show Fewer Tasks' : `Show All ${topJobs.length} Top Tasks`}
                </button>
              )}
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#07266E] hover:bg-[#0B3D9E] text-white font-semibold text-[1.4rem] transition-colors"
              >
                <span>Explore Full Marketplace</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-[#07266E]/30 dark:border-slate-600 bg-white dark:bg-slate-800 text-[#07266E] dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700 font-semibold text-[1.4rem] transition-colors"
              >
                <span>Login</span>
              </Link>
            </div>
          </>
        ) : (
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-10 text-center max-w-2xl mx-auto space-y-4">
            <Briefcase className="w-10 h-10 text-[#0B3D9E] dark:text-blue-400 mx-auto" />
            <h3 className="font-display font-bold text-[1.9rem] text-slate-900 dark:text-white">
              Fresh Tasks Posted Daily
            </h3>
            <p className="text-[1.45rem] text-slate-600 dark:text-slate-400">
              Create your free account to browse all available micro-tasks or launch your own job
              campaign in minutes.
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-[1.4rem] transition-colors"
              >
                <span>Create Free Account</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-[1.4rem] transition-colors"
              >
                <span>Login</span>
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* ===================================================================
          INTERACTIVE HOW IT WORKS WALKTHROUGH
         =================================================================== */}
      <section
        id="how-it-works"
        className="bg-white dark:bg-slate-900/60 border-y border-slate-200/80 dark:border-slate-800 py-16 sm:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
            <div className="space-y-2 max-w-2xl">
              <h2 className="font-display font-extrabold text-[2.6rem] sm:text-[3.2rem] text-slate-900 dark:text-white tracking-tight">
                How AH Task Pay Works
              </h2>
              <p className="text-[1.5rem] text-slate-600 dark:text-slate-400">
                Whether you want to earn daily income or promote your brand with real people, start
                in three straightforward steps.
              </p>
            </div>

            {/* Interactive Tab Switcher */}
            <div
              role="tablist"
              aria-label="Choose guide role"
              className="inline-flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 self-start md:self-auto"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeGuideTab === 'worker'}
                onClick={() => setActiveGuideTab('worker')}
                className={`px-4 py-2 rounded-lg text-[1.35rem] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeGuideTab === 'worker'
                    ? 'bg-[#07266E] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Earn as Worker
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeGuideTab === 'employer'}
                onClick={() => setActiveGuideTab('employer')}
                className={`px-4 py-2 rounded-lg text-[1.35rem] font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  activeGuideTab === 'employer'
                    ? 'bg-[#F97316] text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Promote Business
              </button>
            </div>
          </div>

          {activeGuideTab === 'worker' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01. Create Your Free Account',
                  desc: 'Sign up in seconds with your email and phone number. Zero registration fees or deposits required to work.',
                  icon: Users,
                },
                {
                  step: '02. Pick & Complete Simple Tasks',
                  desc: 'Choose tasks like video watches, app installs, or social engagement, follow instructions, and submit proof.',
                  icon: CheckCircle2,
                },
                {
                  step: '03. Withdraw Directly in Taka (৳)',
                  desc: 'Once your submission is approved, cash out securely anytime via bKash, Nagad, or Mobile Recharge.',
                  icon: Wallet,
                },
              ].map((item, idx) => {
                const StepIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="bg-[#F8FAFC] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 space-y-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-800/50 text-[#0B3D9E] dark:text-blue-400 flex items-center justify-center">
                      <StepIcon className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-[1.75rem] text-slate-900 dark:text-white">
                      {item.step}
                    </h3>
                    <p className="text-[1.45rem] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  step: '01. Deposit Funds Easily',
                  desc: 'Add campaign balance safely using bKash or Nagad personal accounts with fast transaction verification.',
                  icon: Wallet,
                },
                {
                  step: '02. Launch Your Micro-Campaign',
                  desc: 'Set your exact instructions, required proof screenshots, worker slots, and Taka (৳) reward per completion.',
                  icon: Megaphone,
                },
                {
                  step: '03. Review Real Human Proof',
                  desc: 'Verify screenshots submitted by real Bangladeshi workers—pay only for genuine completed work.',
                  icon: ShieldCheck,
                },
              ].map((item, idx) => {
                const StepIcon = item.icon;
                return (
                  <div
                    key={idx}
                    className="bg-[#F8FAFC] dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 space-y-4"
                  >
                    <div className="w-12 h-12 rounded-xl bg-orange-50 dark:bg-orange-950/60 border border-orange-100 dark:border-orange-800/50 text-[#F97316] dark:text-orange-400 flex items-center justify-center">
                      <StepIcon className="w-6 h-6" />
                    </div>
                    <h3 className="font-display font-bold text-[1.75rem] text-slate-900 dark:text-white">
                      {item.step}
                    </h3>
                    <p className="text-[1.45rem] text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ===================================================================
          PLATFORM FEATURES & SUPPORTED PAYMENT GATEWAYS
         =================================================================== */}
      <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 space-y-14">
        {/* Trust & Feature Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: ShieldCheck,
              title: 'Secure & Verified',
              desc: 'Anti-fraud checks and manual proof moderation protect both workers and advertisers.',
              tone: 'text-[#0B3D9E] dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-800/50',
            },
            {
              icon: Zap,
              title: 'Fast Local Payouts',
              desc: 'Withdraw directly in Bangladeshi Taka (৳) with low minimum limits.',
              tone: 'text-[#F97316] dark:text-orange-400 bg-orange-50 dark:bg-orange-950/60 border-orange-100 dark:border-orange-800/50',
            },
            {
              icon: Globe,
              title: 'Real Human Traffic',
              desc: 'Every campaign task is completed by verified real members—no bots.',
              tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-100 dark:border-emerald-800/50',
            },
            {
              icon: Headphones,
              title: 'Dedicated Support',
              desc: 'Reach our support team directly via WhatsApp, Telegram, or Support Tickets.',
              tone: 'text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 border-sky-100 dark:border-sky-800/50',
            },
          ].map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 space-y-3"
              >
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${feat.tone}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-[1.65rem] text-slate-900 dark:text-white">
                  {feat.title}
                </h3>
                <p className="text-[1.4rem] text-slate-600 dark:text-slate-400 leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Supported Bangladeshi Payment Methods Bar */}
        <div className="bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="space-y-1.5 text-center lg:text-left">
            <h3 className="font-display font-bold text-[2rem] text-slate-900 dark:text-white">
              Trusted Bangladeshi Payment Gateways
            </h3>
            <p className="text-[1.45rem] text-slate-600 dark:text-slate-400">
              Instant deposits and hassle-free withdrawals supported across all major mobile wallets.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8">
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
              <BkashLogo size="md" showLabel />
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
              <NagadLogo size="md" showLabel />
            </div>
            <div className="px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-700/70">
              <RechargeLogo size="md" showLabel />
            </div>
          </div>
        </div>

        {/* Dual Value Banners (Workers & Employers) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-[#06256D] to-[#0B3D9E] rounded-3xl p-8 sm:p-10 text-white shadow-lg flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-[#FB923C]" />
              </div>
              <h3 className="font-display font-extrabold text-[2.6rem] leading-tight">
                Need Real People to Grow Your Brand?
              </h3>
              <p className="text-[1.5rem] text-blue-100/90 leading-relaxed">
                Post micro-tasks and receive genuine reviews, video engagement, app installs, and
                website visits from verified Bangladeshi users.
              </p>
            </div>
            <div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-[1.45rem] transition-colors"
              >
                <span>Launch a Campaign</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 rounded-3xl p-8 sm:p-10 text-white shadow-lg flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-[#FB923C]" />
              </div>
              <h3 className="font-display font-extrabold text-[2.6rem] leading-tight">
                Earning Daily Income Made Simple
              </h3>
              <p className="text-[1.5rem] text-slate-300 leading-relaxed">
                Complete quick online tasks from your phone or computer and cash out straight to
                your bKash, Nagad, or mobile balance.
              </p>
            </div>
            <div>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-[1.45rem] transition-colors"
              >
                <span>Start Working Free</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          FAQ ACCORDION & DIRECT CONTACT SECTION
         =================================================================== */}
      <section
        id="faq"
        className="bg-white dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800 py-16 sm:py-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* FAQ Column */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display font-extrabold text-[2.6rem] sm:text-[3rem] text-slate-900 dark:text-white tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-[1.45rem] text-slate-600 dark:text-slate-400">
                Clear answers about tasks, verification, and local Taka (৳) payouts.
              </p>
            </div>

            <div className="space-y-3">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openFaqIndex === idx;
                return (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200/90 dark:border-slate-700/80 bg-[#F8FAFC] dark:bg-slate-800/80 overflow-hidden"
                  >
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left font-display font-bold text-[1.55rem] text-slate-900 dark:text-white hover:bg-slate-100/70 dark:hover:bg-slate-700/40 transition-colors cursor-pointer"
                    >
                      <span>{item.q}</span>
                      <ChevronDown
                        className={`w-5 h-5 shrink-0 text-slate-500 transition-transform duration-200 ${
                          isOpen ? 'rotate-180 text-[#F97316]' : ''
                        }`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-4 pt-1 text-[1.4rem] text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-200/60 dark:border-slate-700/60">
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Direct Support & Contact Column */}
          <div id="contact" className="lg:col-span-5 space-y-6">
            <div className="space-y-2">
              <h2 className="font-display font-extrabold text-[2.6rem] sm:text-[3rem] text-slate-900 dark:text-white tracking-tight">
                Contact &amp; Support
              </h2>
              <p className="text-[1.45rem] text-slate-600 dark:text-slate-400">
                Have questions or need help? Reach the official AH Task Pay team directly.
              </p>
            </div>

            <div className="bg-[#F8FAFC] dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 rounded-2xl p-6 space-y-3.5">
              <a
                href="https://wa.me/8801870866189"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 hover:border-emerald-400 transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[1.45rem] text-slate-900 dark:text-white">
                      WhatsApp Support
                    </p>
                    <p className="text-[1.25rem] text-slate-500 dark:text-slate-400">
                      Direct chat assistance
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors" />
              </a>

              <a
                href="https://t.me/ahtaskpay_owner"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 hover:border-sky-400 transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[1.45rem] text-slate-900 dark:text-white">
                      Telegram Help Desk
                    </p>
                    <p className="text-[1.25rem] text-slate-500 dark:text-slate-400">
                      @ahtaskpay_owner
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-sky-500 transition-colors" />
              </a>

              <a
                href="https://t.me/ahtaskpay"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 hover:border-blue-400 transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#0B3D9E] dark:text-blue-400 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[1.45rem] text-slate-900 dark:text-white">
                      Official Telegram Channel
                    </p>
                    <p className="text-[1.25rem] text-slate-500 dark:text-slate-400">
                      Live updates &amp; task alerts
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
              </a>

              <a
                href="mailto:ahtaskpay@gmail.com"
                className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 hover:border-orange-400 transition-colors group"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-[#F97316] dark:text-orange-400 flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-[1.45rem] text-slate-900 dark:text-white">
                      Email Support
                    </p>
                    <p className="text-[1.25rem] text-slate-500 dark:text-slate-400">
                      ahtaskpay@gmail.com
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-orange-500 transition-colors" />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================
          FINAL CTA STRIP & BRANDED FOOTER
         =================================================================== */}
      <section className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white py-14 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div className="space-y-1.5">
            <h2 className="font-display font-extrabold text-[2.6rem] sm:text-[3rem] tracking-tight">
              Ready to Start Earning Today?
            </h2>
            <p className="text-[1.5rem] text-blue-100/90">
              Join AH Task Pay for free and complete your first paid micro-task in minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3.5 shrink-0">
            <Link
              to="/register"
              className="px-7 py-3.5 rounded-full bg-[#F97316] hover:bg-[#EA580C] text-white font-bold text-[1.45rem] shadow-lg transition-all whitespace-nowrap"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="px-6 py-3.5 rounded-full border border-white/35 bg-white/10 hover:bg-white/20 text-white font-semibold text-[1.45rem] transition-all whitespace-nowrap"
            >
              User Login
            </Link>
          </div>
        </div>
      </section>

      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-10 px-4 sm:px-6 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <BrandLogo size="md" />
          <div className="text-center space-y-1.5">
            <p className="text-slate-500 dark:text-slate-400 text-[1.35rem] font-medium">
              © 2026 AH Task Pay. All rights reserved.
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-[1.3rem]">
              <a href="mailto:ahtaskpay@gmail.com" className="hover:text-[#0B3D9E] dark:hover:text-orange-400 transition-colors">
                Support Email : ahtaskpay@gmail.com
              </a>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[1.3rem] font-semibold text-slate-600 dark:text-slate-400">
              <Link
                to="/terms-privacy#terms"
                className="hover:text-[#0B3D9E] dark:hover:text-orange-400 underline underline-offset-4 transition-colors"
              >
                Terms &amp; Conditions
              </Link>
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">•</span>
              <Link
                to="/terms-privacy#privacy"
                className="hover:text-[#0B3D9E] dark:hover:text-orange-400 underline underline-offset-4 transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 text-[1.35rem] font-semibold text-slate-600 dark:text-slate-400">
            <button
              type="button"
              onClick={() => scrollToSection('popular-tasks')}
              className="hover:text-[#0B3D9E] dark:hover:text-orange-400 transition-colors cursor-pointer"
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works')}
              className="hover:text-[#0B3D9E] dark:hover:text-orange-400 transition-colors cursor-pointer"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="hover:text-[#0B3D9E] dark:hover:text-orange-400 transition-colors cursor-pointer"
            >
              FAQ
            </button>
            <Link
              to="/login"
              className="hover:text-[#0B3D9E] dark:hover:text-orange-400 transition-colors"
            >
              Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
