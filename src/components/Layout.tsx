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

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-[#131C31] border-r border-slate-200/80 dark:border-slate-800 fixed h-full shadow-xl shadow-slate-200/40 dark:shadow-none z-50 transition-colors duration-300">
        {/* Royal Blue Brand Header */}
        <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] px-6 py-5 flex items-center justify-between border-b border-white/10">
          <Link to="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-1.5">
            <button
               onClick={toggleTheme}
               className="p-2 transition-all bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 group focus:outline-none"
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
           <div className="bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-700/70 flex items-center gap-3.5 transition-colors">
              <div className="bg-[#07266E] dark:bg-[#0B3D9E] w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-sm font-black text-xs border border-white/10 shrink-0 tabular-nums">
                 #{profile?.serialNumber}
              </div>
              <div className="overflow-hidden">
                 <p className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase truncate tracking-tight">{profile?.displayName}</p>
                 <p className="text-[10px] text-[#F97316] font-bold tracking-widest uppercase">Verified Hub</p>
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
                  "flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-[11px] uppercase font-extrabold tracking-[0.08em] transition-all group",
                  isActive
                    ? "bg-gradient-to-r from-[#07266E] to-[#0B3D9E] text-white shadow-lg shadow-blue-900/20" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:text-[#07266E] dark:hover:text-white"
                )}
              >
                <item.icon className={cn("w-5 h-5 shrink-0 transition-colors", isActive ? "text-[#FB923C]" : "text-slate-400 dark:text-slate-500 group-hover:text-[#0B3D9E] dark:group-hover:text-blue-400")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
          <div className="grid grid-cols-1 gap-2.5">
            <div className="bg-orange-50/90 dark:bg-orange-950/30 p-3.5 rounded-2xl border border-orange-200/70 dark:border-orange-900/50 transition-colors">
              <p className="text-[10px] text-[#EA580C] dark:text-orange-400 font-extrabold uppercase tracking-widest mb-0.5">Earning Balance</p>
              <p className="text-lg font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(Number(profile?.earningBalance) || 0)}</p>
            </div>
            <div className="bg-blue-50/90 dark:bg-blue-950/30 p-3.5 rounded-2xl border border-blue-200/70 dark:border-blue-900/50 transition-colors">
              <p className="text-[10px] text-[#0B3D9E] dark:text-blue-400 font-extrabold uppercase tracking-widest mb-0.5">Deposit Balance</p>
              <p className="text-lg font-black text-slate-900 dark:text-slate-100 tabular-nums">{formatCurrency(Number(profile?.depositBalance) || 0)}</p>
            </div>
          </div>

          <div className="pt-1">
            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs text-red-600 dark:text-red-400 font-bold bg-red-50/80 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 relative flex flex-col min-h-screen transition-colors duration-300">
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

        {/* Mobile Header (Deep Royal Blue matching Landing Page) */}
        <header className={cn("md:hidden flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white border-b border-white/10 shadow-md transition-colors", !isImpersonating && "sticky top-0 z-40")}>
          <Link to="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <button
               onClick={toggleTheme}
               className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors"
               aria-label="Toggle theme"
            >
               {theme === 'light' ? <Moon className="w-5 h-5 text-blue-100" /> : <Sun className="w-5 h-5 text-[#FB923C]" />}
            </button>
            <NotificationBell onDark />
            <Link to="/profile-settings" className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors">
               <CircleUser className="w-5 h-5" />
            </Link>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-[#F97316] hover:bg-[#EA580C] rounded-xl text-white shadow-sm transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 w-full max-w-5xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>

        {/* Footer info/Support */}
        <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-[#0B1120] p-8 text-center space-y-4 transition-colors">
          <div className="flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm font-medium">
            <span>© 2026 AH Task Pay</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a 
              href="https://wa.me/8801870866189" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-full font-bold shadow-md hover:bg-emerald-700 transition-all hover:scale-105 text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp Support
            </a>
            <a 
              href="https://t.me/ahtaskpay_owner" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0B3D9E] text-white rounded-full font-bold shadow-md hover:bg-[#07266E] transition-all hover:scale-105 text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Telegram Support
            </a>
            <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#F97316] text-white rounded-full font-bold shadow-md hover:bg-[#EA580C] transition-all hover:scale-105 text-sm"
            >
              <MessageCircle className="w-4 h-4" />
              Join Telegram Channel
            </a>
          </div>
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
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
              <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">•</span>
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
            className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-3xl p-8 max-w-sm w-full shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-28 bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E]"></div>
              
              <div className="relative z-10 flex flex-col items-center text-center space-y-4 pt-4">
                <div className="w-20 h-20 bg-white dark:bg-[#131C31] rounded-2xl flex items-center justify-center text-[#F97316] shadow-lg border border-slate-100 dark:border-slate-700 mb-2">
                  <Download className="w-10 h-10 animate-bounce" />
                </div>
                
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-display">
                  Install AH Task Pay
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium pb-2">
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
                    className="w-full py-3.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-2xl font-bold uppercase tracking-widest text-xs transition-colors"
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
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-[#131C31] flex flex-col transition-colors shadow-2xl border-l border-slate-200 dark:border-slate-800"
              onClick={e => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] p-5 flex justify-between items-center border-b border-white/10">
                <BrandLogo size="sm" />
                <button onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex-1 flex flex-col overflow-hidden">
                <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 rounded-2xl mb-4 flex items-center gap-3 border border-slate-200 dark:border-slate-700 shrink-0">
                   <div className="w-10 h-10 bg-[#07266E] rounded-xl flex items-center justify-center text-white shrink-0">
                      <User className="w-5 h-5" />
                   </div>
                   <div className="overflow-hidden">
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100 truncate uppercase">{profile?.displayName}</p>
                      <p className="text-[10px] text-[#F97316] font-bold uppercase tracking-wider">UID: {profile?.serialNumber}</p>
                   </div>
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
                          "flex items-center gap-3 font-bold transition-all px-4 py-3 rounded-xl text-sm",
                          isActive
                            ? "bg-gradient-to-r from-[#07266E] to-[#0B3D9E] text-white shadow-md" 
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                      >
                        <item.icon className={cn("w-5 h-5", isActive ? "text-[#FB923C]" : "")} />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>

                <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
                  <button onClick={handleLogout} className="flex items-center gap-3 text-red-600 dark:text-red-400 font-bold px-4 py-3 w-full bg-red-50/70 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-xl transition-all text-sm">
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
