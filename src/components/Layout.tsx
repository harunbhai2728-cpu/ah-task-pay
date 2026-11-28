import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, 
  PlusSquare, 
  List, 
  Search, 
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut, 
  Menu, 
  X, 
  User,
  MessageCircle,
  ShieldCheck,
  Lock,
  Settings,
  CircleUser,
  Zap,
  LifeBuoy,
  Gift,
  Sun,
  Moon,
  Download
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { cn, formatCurrency } from '../lib/utils';

import { BrandLogo } from './BrandLogo';
import { NotificationBell } from './NotificationBell';

export function Layout() {
  const { profile, isAdmin, isSuperAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isImpersonating, setIsImpersonating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  React.useEffect(() => {
    // Check for our dedicated tracking cookie
    const hasImpersonationCookie = document.cookie.includes('sb-admin-impersonating=');
    setIsImpersonating(hasImpersonationCookie);

    const handleBeforeInstallPrompt = (e: Event) => {
      // Intentionally NOT preventing default to keep browser's native options fully functional
      // e.preventDefault(); 
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if running standalone
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    if (isStandalone) {
      setDeferredPrompt(null);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  React.useEffect(() => {
    if (deferredPrompt && location.pathname === '/dashboard' && !sessionStorage.getItem('installPromptShown')) {
      setShowInstallPrompt(true);
      sessionStorage.setItem('installPromptShown', 'true');
    }
  }, [deferredPrompt, location.pathname]);

  const handleInstallClick = async () => {
    setShowInstallPrompt(false);
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleCloseInstallPrompt = () => {
    setShowInstallPrompt(false);
  };

  const handleExitSupportMode = async () => {
    if (isImpersonating) {
      try {
        const sessionRes = await supabase.auth.getSession();
        const targetJwt = sessionRes.data?.session?.access_token;

        const res = await fetch('/api/admin/exit-impersonation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                targetJwt: targetJwt,
                redirectTo: window.location.origin + '/admin'
            })
        });
        const data = await res.json();
        
        // Ensure standard local storage backups are also cleared
        localStorage.removeItem('admin_session_backup');
        
        if (res.ok && data.restoreUrl) {
             await supabase.auth.signOut(); 
             window.location.href = data.restoreUrl;
        } else {
             await supabase.auth.signOut();
             window.location.href = '/login';
        }
      } catch(e) {
        console.error('Failed to restore admin session:', e);
        localStorage.removeItem('admin_session_backup');
        await supabase.auth.signOut();
        window.location.href = '/login';
      }
    }
  };

  const handleLogout = async () => {
    if (isImpersonating || localStorage.getItem('admin_session_backup')) {
      alert("You are currently impersonating a user. Please use the 'EXIT SUPPORT MODE' button to safely end the session.");
      return;
    }
    sessionStorage.removeItem('installPromptShown');
    await supabase.auth.signOut();
    navigate('/');
  };

  let navItems = [
    { label: 'Dashboard', icon: Home, path: '/dashboard' },
    { label: 'Find Job', icon: Search, path: '/browse-jobs' },
    { label: 'Post Job', icon: PlusSquare, path: '/post-job' },
    { label: 'Post Ad', icon: Zap, path: '/post-ad' },
    { label: 'Posted Ads', icon: Zap, path: '/manage-ads' },
    { label: 'My Job', icon: List, path: '/manage-jobs' },
    { label: 'Submitted Job', icon: ShieldCheck, path: '/submitted-jobs' },
    { label: 'Refer & Earn', icon: Gift, path: '/referral' },
    { label: 'Deposit', icon: ArrowDownCircle, path: '/deposit' },
    { label: 'Withdraw', icon: ArrowUpCircle, path: '/withdraw' },
    { label: 'Support', icon: LifeBuoy, path: '/support' },
    { label: 'Profile', icon: Settings, path: '/profile-settings' },
  ];

  if (isAdmin) {
    navItems.push({ label: 'Admin Panel', icon: Lock, path: '/admin' });
  }
  
  if (isSuperAdmin) {
    navItems = [
      { label: 'Admin Panel', icon: Lock, path: '/admin' },
      { label: 'Profile', icon: Settings, path: '/profile-settings' }
    ];
  }

  const currentNavLabel =
    navItems.find((item) => item.path === location.pathname)?.label ||
    (location.pathname.startsWith('/job/') ? 'Job Details' : 'Workspace');

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#EFF4FC] dark:bg-[#040C24] flex flex-col md:flex-row transition-colors duration-300 relative">
      {/* Subtle Ambient Navy Glow on Canvas */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-32 right-0 w-[34rem] h-[34rem] rounded-full bg-[#0B3D9E]/[0.06] dark:bg-[#1D4ED8]/[0.10] blur-3xl" />
        <div className="absolute bottom-0 md:left-72 lg:left-80 w-[28rem] h-[28rem] rounded-full bg-[#041645]/[0.04] dark:bg-[#0B3D9E]/[0.08] blur-3xl" />
      </div>

      {/* Signature Deep Navy Sidebar (Desktop) */}
      <aside className="hidden md:flex flex-col w-72 lg:w-80 bg-gradient-to-b from-[#041645] via-[#061D57] to-[#041133] text-white border-r border-[#173582]/70 fixed h-full shadow-2xl shadow-blue-950/25 z-50 transition-colors duration-300">
        {/* Royal Navy Brand Header */}
        <div className="bg-[#031136]/80 px-6 py-5 flex items-center justify-between border-b border-white/10">
          <Link to="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5">
            <button
               onClick={toggleTheme}
               className="p-2 transition-all bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 group focus:outline-none cursor-pointer"
               title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
               {theme === 'light' ? (
                 <Moon className="w-4 h-4 text-blue-100 group-hover:rotate-12 transition-transform" />
               ) : (
                 <Sun className="w-4 h-4 text-[#FB923C] group-hover:rotate-45 transition-transform" />
               )}
            </button>
            <NotificationBell onDark />
          </div>
        </div>

        <div className="px-5 pt-5 mb-4">
           <div className="bg-[#0A2568]/85 p-3.5 rounded-2xl border border-blue-400/20 flex items-center gap-3.5 shadow-inner">
              <div className="bg-gradient-to-br from-[#F97316] to-[#EA580C] w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md shadow-orange-950/30 font-black text-xs border border-white/20 shrink-0 tabular-nums">
                 #{profile?.serialNumber}
              </div>
              <div className="overflow-hidden">
                 <p className="text-xs font-black text-white uppercase truncate tracking-tight">{profile?.displayName}</p>
                 <p className="text-[10px] text-[#FB923C] font-bold tracking-widest uppercase">Verified Hub</p>
              </div>
           </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center justify-between gap-3 px-4 py-3 rounded-2xl text-[11px] uppercase font-extrabold tracking-[0.08em] transition-all group",
                  isActive
                    ? "bg-gradient-to-r from-[#0E43AE] to-[#1759DB] text-white border border-blue-300/30 shadow-lg shadow-black/25" 
                    : "text-blue-100/75 hover:bg-white/10 hover:text-white border border-transparent"
                )}
              >
                <span className="flex items-center gap-3.5 min-w-0">
                  <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-[#FB923C]" : "text-blue-200/70 group-hover:text-[#FB923C]")} />
                  <span className="truncate">{item.label}</span>
                </span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FB923C] shrink-0" />}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 bg-[#030F30]/60 space-y-3">
          <div className="grid grid-cols-1 gap-2.5">
            <div className="bg-gradient-to-br from-[#F97316]/20 via-[#EA580C]/10 to-transparent p-3.5 rounded-2xl border border-[#FB923C]/35 transition-colors">
              <p className="text-[10px] text-[#FB923C] font-extrabold uppercase tracking-widest mb-0.5">Earning Balance</p>
              <p className="text-lg font-black text-white tabular-nums">{formatCurrency(Number(profile?.earningBalance) || 0)}</p>
            </div>
            <div className="bg-[#092363]/80 p-3.5 rounded-2xl border border-blue-400/25 transition-colors">
              <p className="text-[10px] text-blue-200 font-extrabold uppercase tracking-widest mb-0.5">Deposit Balance</p>
              <p className="text-lg font-black text-white tabular-nums">{formatCurrency(Number(profile?.depositBalance) || 0)}</p>
            </div>
          </div>

          <div className="pt-1">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-rose-200 font-bold bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/25 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 lg:ml-80 relative z-10 flex flex-col min-h-screen min-w-0 transition-colors duration-300">
        {(isImpersonating && !location.pathname.startsWith('/admin')) && (
          <div className="sticky top-0 z-50 bg-[#F97316] text-white px-4 py-2 flex flex-col sm:flex-row items-center justify-between shadow-md">
             <div className="flex items-center gap-2 font-bold mb-2 sm:mb-0">
               <LifeBuoy className="w-5 h-5" />
               <span className="text-sm">Impersonating User: <span className="uppercase">{profile?.displayName || 'Unknown'}</span></span>
             </div>
             <button 
               onClick={handleExitSupportMode}
               className="bg-[#041645] text-white hover:bg-[#07266E] px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
             >
               Exit Support Mode
             </button>
          </div>
        )}

        {/* Slim Desktop Workspace Header */}
        <header className="hidden md:flex items-center justify-between px-8 py-3.5 bg-white/85 dark:bg-[#071336]/90 backdrop-blur-md border-b border-[#D6E3F8] dark:border-[#1B357A]/55 sticky top-0 z-30 transition-colors">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-[#041645] dark:bg-[#0E3A96] text-white text-[10px] font-black uppercase tracking-widest">
              AH Task Pay
            </span>
            <span className="text-[#CBD8F0] dark:text-blue-800">/</span>
            <span className="text-sm font-black font-display text-[#071845] dark:text-white tracking-tight uppercase">
              {currentNavLabel}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/deposit"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-[#EFF4FC] dark:bg-[#0C1D4D] border border-[#D2E0F8] dark:border-[#214296]/60 hover:border-[#0B3D9E] transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-[#0B3D9E] dark:text-blue-300">Deposit</span>
              <span className="text-xs font-black text-[#041645] dark:text-white tabular-nums">
                {formatCurrency(Number(profile?.depositBalance) || 0)}
              </span>
            </Link>
            <Link
              to="/withdraw"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-orange-50/90 dark:bg-orange-950/35 border border-orange-200/80 dark:border-orange-500/30 hover:border-[#F97316] transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] dark:text-[#FB923C]">Earning</span>
              <span className="text-xs font-black text-[#041645] dark:text-white tabular-nums">
                {formatCurrency(Number(profile?.earningBalance) || 0)}
              </span>
            </Link>
            {!isSuperAdmin && (
              <Link
                to="/browse-jobs"
                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#041645] to-[#0B3D9E] hover:from-[#07266E] hover:to-[#134EC2] text-white text-xs font-black uppercase tracking-wider shadow-sm whitespace-nowrap shrink-0 transition-all"
              >
                Find Jobs
              </Link>
            )}
          </div>
        </header>

        {/* Mobile Header (Deep Royal Navy) */}
        <header className={cn("md:hidden flex items-center justify-between gap-2 px-3.5 py-2.5 bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white border-b border-white/10 shadow-md transition-colors", !isImpersonating && "sticky top-0 z-40")}>
          <Link to="/dashboard" className="shrink-0">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
               onClick={toggleTheme}
               className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors"
               aria-label="Toggle theme"
            >
               {theme === 'light' ? <Moon className="w-4 h-4 text-blue-100" /> : <Sun className="w-4 h-4 text-[#FB923C]" />}
            </button>
            <NotificationBell onDark />
            <Link to="/profile-settings" aria-label="Profile Settings" className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors">
               <CircleUser className="w-4 h-4" />
            </Link>
            <button onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu" className="p-2 bg-[#F97316] hover:bg-[#EA580C] rounded-xl text-white shadow-sm transition-colors">
              <Menu className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className={cn(
          "flex-1 w-full mx-auto px-3.5 py-4 sm:p-6 lg:p-8",
          isAdminRoute ? "max-w-[138rem]" : "max-w-[116rem]"
        )}>
          <Outlet />
        </div>

        {/* Footer info/Support */}
        <footer className="mt-auto border-t border-[#D6E3F8] dark:border-[#1B357A]/55 bg-white/75 dark:bg-[#06102B]/90 px-4 py-7 md:p-8 text-center space-y-4 transition-colors">
          <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-blue-200/75 text-sm font-semibold">
            <span>© 2026 AH Task Pay</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <a 
              href="https://wa.me/8801870866189" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-emerald-600 text-white rounded-full font-bold shadow-md hover:bg-emerald-700 transition-all hover:scale-105 text-xs sm:text-sm"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              WhatsApp Support
            </a>
            <a 
              href="https://t.me/ahtaskpay_owner" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#07266E] text-white rounded-full font-bold shadow-md hover:bg-[#0B3D9E] transition-all hover:scale-105 text-xs sm:text-sm"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              Telegram Support
            </a>
            <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-[#F97316] text-white rounded-full font-bold shadow-md hover:bg-[#EA580C] transition-all hover:scale-105 text-xs sm:text-sm"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              Join Telegram Channel
            </a>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-blue-200/70 text-xs sm:text-sm">
            <a href="mailto:ahtaskpay@gmail.com" className="hover:text-[#0B3D9E] dark:hover:text-[#FB923C] transition-colors">
              Support Email : ahtaskpay@gmail.com
            </a>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs sm:text-sm font-bold pt-1">
              <Link
                to="/terms-privacy#terms"
                className="hover:text-[#0B3D9E] dark:hover:text-[#FB923C] underline underline-offset-4 transition-colors"
              >
                Terms &amp; Conditions
              </Link>
              <span className="text-slate-300 dark:text-blue-800" aria-hidden="true">•</span>
              <Link
                to="/terms-privacy#privacy"
                className="hover:text-[#0B3D9E] dark:hover:text-[#FB923C] underline underline-offset-4 transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Menu & Install Prompt Overlays */}
      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#02081B]/75 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#0A1638] border border-[#D7E3F7] dark:border-[#1E3B8A]/60 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E]"></div>
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-4 pt-4">
                <div className="w-20 h-20 bg-white dark:bg-[#071336] rounded-2xl flex items-center justify-center text-[#F97316] shadow-lg border border-[#D7E3F7] dark:border-[#1E3B8A]/60 mb-2">
                  <Download className="w-10 h-10 animate-bounce" />
                </div>
                
                <h3 className="text-2xl font-black text-[#071845] dark:text-white tracking-tight font-display">
                  Install AH Task Pay
                </h3>
                <p className="text-sm text-slate-600 dark:text-blue-100/80 font-medium pb-2">
                  Add our app to your home screen for faster access, notifications, and a better experience!
                </p>

                <div className="flex flex-col w-full gap-3 pt-2">
                  <button
                    onClick={handleInstallClick}
                    className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest text-sm transition-all shadow-lg shadow-orange-500/25"
                  >
                    Install App
                  </button>
                  <button
                    onClick={handleCloseInstallPrompt}
                    className="w-full py-3.5 bg-[#EFF4FC] dark:bg-[#11245A] hover:bg-[#E1ECFA] dark:hover:bg-[#173178] text-[#07266E] dark:text-blue-100 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors"
                  >
                    Not Now
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-[#02081B]/75 backdrop-blur-xs z-50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-gradient-to-b from-[#041645] via-[#061D57] to-[#041133] text-white flex flex-col transition-colors shadow-2xl border-l border-[#1C3B8B]/70"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-[#031136]/85 p-5 flex justify-between items-center border-b border-white/10">
                <BrandLogo size="sm" />
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 flex flex-col overflow-hidden">
                <div className="bg-[#0A2568]/85 p-3.5 rounded-2xl mb-3 flex items-center gap-3 border border-blue-400/20 shrink-0">
                   <div className="w-10 h-10 bg-gradient-to-br from-[#F97316] to-[#EA580C] rounded-xl flex items-center justify-center text-white shrink-0">
                      <User className="w-5 h-5" />
                   </div>
                   <div className="overflow-hidden">
                      <p className="text-sm font-black text-white truncate uppercase">{profile?.displayName}</p>
                      <p className="text-[10px] text-[#FB923C] font-bold uppercase tracking-wider tabular-nums">UID: {profile?.serialNumber}</p>
                   </div>
                </div>

                {/* Compact Mobile Drawer Wallet Balances */}
                <div className="grid grid-cols-2 gap-2 mb-3 shrink-0">
                  <Link
                    to="/withdraw"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="bg-gradient-to-br from-[#F97316]/25 to-[#EA580C]/10 p-2.5 rounded-xl border border-[#FB923C]/35"
                  >
                    <p className="text-[9px] text-[#FB923C] font-extrabold uppercase tracking-wider">Earning</p>
                    <p className="text-xs font-black text-white tabular-nums truncate">
                      {formatCurrency(Number(profile?.earningBalance) || 0)}
                    </p>
                  </Link>
                  <Link
                    to="/deposit"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="bg-[#092363]/90 p-2.5 rounded-xl border border-blue-400/25"
                  >
                    <p className="text-[9px] text-blue-200 font-extrabold uppercase tracking-wider">Deposit</p>
                    <p className="text-xs font-black text-white tabular-nums truncate">
                      {formatCurrency(Number(profile?.depositBalance) || 0)}
                    </p>
                  </Link>
                </div>

                <nav className="flex-1 space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-3 font-bold transition-all px-4 py-3 rounded-xl text-sm",
                          isActive
                            ? "bg-gradient-to-r from-[#0E43AE] to-[#1759DB] text-white border border-blue-300/30 shadow-md" 
                            : "text-blue-100/80 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        <span className="flex items-center gap-3">
                          <item.icon className={cn("w-5 h-5", isActive ? "text-[#FB923C]" : "text-blue-200/75")} />
                          {item.label}
                        </span>
                        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#FB923C]" />}
                      </Link>
                    );
                  })}
                </nav>

                <div className="pt-4 mt-4 border-t border-white/10 shrink-0">
                  <button onClick={handleLogout} className="flex items-center justify-center gap-3 text-rose-200 font-bold px-4 py-3 w-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-400/25 rounded-xl transition-all text-sm">
                    <LogOut className="w-5 h-5" />
                    Logout
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
