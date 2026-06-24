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
  Book,
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

  React.useEffect(() => {
    // Check for our dedicated tracking cookie
    const hasImpersonationCookie = document.cookie.includes('sb-admin-impersonating=');
    setIsImpersonating(hasImpersonationCookie);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
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

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar Desktop */}
      <aside className="hidden md:flex flex-col w-72 bg-white dark:bg-slate-800 border-r border-gray-100 dark:border-slate-700 fixed h-full shadow-2xl shadow-gray-100 dark:shadow-none z-50 transition-colors duration-300">
        <div className="p-8 flex items-center justify-between">
          <Link to="/dashboard">
            <BrandLogo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            <button
               onClick={toggleTheme}
               className="p-2 transition-all hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl text-gray-500 dark:text-slate-400 group focus:outline-none"
               title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
               {theme === 'light' ? (
                 <Moon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
               ) : (
                 <Sun className="w-5 h-5 group-hover:rotate-45 transition-transform" />
               )}
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="px-6 mb-8">
           <div className="bg-gray-50 dark:bg-slate-700/50 p-4 rounded-3xl border border-gray-100 dark:border-slate-700 flex items-center gap-4 transition-colors">
              <div className="bg-white dark:bg-slate-800 w-12 h-12 rounded-2xl flex items-center justify-center text-primary-600 shadow-sm font-black border border-gray-100 dark:border-slate-700 transition-colors">
                 #{profile?.serialNumber}
              </div>
              <div className="overflow-hidden">
                 <p className="text-xs font-black text-gray-900 dark:text-slate-100 uppercase truncate tracking-tight">{profile?.displayName}</p>
                 <p className="text-[10px] text-gray-400 dark:text-slate-400 font-bold tracking-widest uppercase">Verified Hub</p>
              </div>
           </div>
        </div>
        
        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 px-5 py-4 rounded-2xl text-[10px] uppercase font-black tracking-[0.1em] transition-all group",
                location.pathname === item.path 
                  ? "bg-gray-900 dark:bg-white text-white dark:text-slate-900 shadow-xl shadow-gray-200 dark:shadow-none" 
                  : "text-gray-400 dark:text-slate-500 hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-100"
              )}
            >
              <item.icon className={cn("w-5 h-5", location.pathname === item.path ? (theme === 'dark' ? "text-primary-600" : "text-primary-400") : "text-gray-300 dark:text-slate-600 group-hover:text-gray-900 dark:group-hover:text-slate-100")} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-100 dark:border-slate-700 space-y-4">
          <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/50 transition-colors">
            <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-widest mb-1">Earning Balance</p>
            <p className="text-xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(profile?.earningBalance || 0)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-2xl border border-blue-100 dark:border-blue-900/50 transition-colors">
            <p className="text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-widest mb-1">Deposit Balance</p>
            <p className="text-xl font-black text-gray-900 dark:text-slate-100">{formatCurrency(profile?.depositBalance || 0)}</p>
          </div>
          
          {deferredPrompt && (
            <button 
              type="button"
              onClick={handleInstallClick}
              className="flex items-center gap-3 w-full px-4 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-xl transition-all shadow-md text-left"
            >
              <Download className="w-5 h-5 animate-bounce" />
              <div className="flex flex-col">
                <span className="text-xs font-black uppercase tracking-wide">Install App</span>
                <span className="text-[9px] text-indigo-100 font-bold">অ্যাপ ইন্সটল করুন</span>
              </div>
            </button>
          )}

          <Link 
            to="/terms-privacy" 
            className="flex items-center gap-3 w-full px-4 py-3 text-gray-500 dark:text-slate-400 font-medium hover:bg-gray-50 dark:hover:bg-slate-700 hover:text-gray-900 dark:hover:text-slate-100 rounded-xl transition-all"
          >
            <Book className="w-5 h-5 opacity-70" />
            Terms & Privacy
          </Link>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"
          >
            <LogOut className="w-5 h-5" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 md:ml-72 relative pb-24 md:pb-0 transition-colors duration-300">
        {(isImpersonating && !location.pathname.startsWith('/admin')) && (
          <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex flex-col sm:flex-row items-center justify-between shadow-md">
             <div className="flex items-center gap-2 font-bold mb-2 sm:mb-0">
               <LifeBuoy className="w-5 h-5" />
               <span className="text-sm">Impersonating User: <span className="uppercase">{profile?.displayName || 'Unknown'}</span></span>
             </div>
             <button 
               onClick={handleExitSupportMode}
               className="bg-amber-950 text-amber-500 hover:bg-amber-900 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-colors shadow-sm"
             >
               Exit Support Mode
             </button>
          </div>
        )}

        {/* Mobile Header */}
        <header className={cn("md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700 transition-colors", !isImpersonating && "sticky top-0 z-40")}>
          <Link to="/dashboard">
            <BrandLogo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <button
               onClick={toggleTheme}
               className="p-2 bg-gray-50 dark:bg-slate-700 rounded-xl text-gray-400 dark:text-slate-300"
            >
               {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <NotificationBell />
            <Link to="/profile-settings" className="p-2 bg-gray-50 dark:bg-slate-700 rounded-xl text-gray-400 dark:text-slate-300">
               <CircleUser className="w-6 h-6" />
            </Link>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 bg-gray-50 dark:bg-slate-700 rounded-xl text-gray-400 dark:text-slate-300">
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </header>

        <div className="max-w-5xl mx-auto p-4 md:p-8">
          <Outlet />
        </div>

        {/* Footer info/Support */}
        <footer className="mt-auto border-t border-gray-100 dark:border-slate-700 p-8 text-center space-y-4 transition-colors">
          <div className="flex items-center justify-center gap-2 text-gray-400 dark:text-slate-500">
            <span>© 2026 AH Task Pay</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a 
              href="https://wa.me/8801870866189" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full font-bold shadow-lg hover:bg-green-600 transition-transform hover:scale-105"
            >
              <MessageCircle className="w-5 h-5" />
              WhatsApp Support
            </a>
            <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full font-bold shadow-lg hover:bg-blue-600 transition-transform hover:scale-105"
            >
              <MessageCircle className="w-5 h-5" />
              Join Telegram Channel
            </a>
          </div>
        </footer>
      </main>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="absolute right-0 top-0 bottom-0 w-64 bg-white dark:bg-slate-800 p-6 transition-colors shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h2 className="font-bold text-lg dark:text-slate-100">Menu</h2>
                <button onClick={() => setIsMobileMenuOpen(false)} className="dark:text-slate-400">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="bg-primary-50 dark:bg-slate-700/50 p-4 rounded-2xl mb-6 flex items-center gap-3 border border-primary-100 dark:border-slate-600">
                 <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center text-white">
                    <User className="w-6 h-6" />
                 </div>
                 <div className="overflow-hidden">
                    <p className="text-sm font-black text-gray-900 dark:text-slate-100 truncate uppercase">{profile?.displayName}</p>
                    <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase">UID: {profile?.serialNumber}</p>
                 </div>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 font-bold transition-all px-4 py-3 rounded-xl text-sm",
                      location.pathname === item.path 
                        ? "bg-primary-50 dark:bg-slate-700 text-indigo-600 dark:text-primary-400" 
                        : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                ))}
                {deferredPrompt && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      handleInstallClick();
                    }}
                    className="flex items-center gap-3 w-full px-4 py-3 bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-xl transition-all shadow-md text-left"
                  >
                    <Download className="w-5 h-5 animate-bounce" />
                    <div className="flex flex-col">
                      <span className="text-xs font-black uppercase tracking-wide">Install App</span>
                      <span className="text-[9px] text-indigo-100 font-bold">অ্যাপ ইন্সটল করুন</span>
                    </div>
                  </button>
                )}

                <Link
                  to="/terms-privacy"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 font-bold transition-all px-4 py-3 rounded-xl text-sm",
                    location.pathname === "/terms-privacy" ? "bg-primary-50 dark:bg-slate-700 text-indigo-600 dark:text-primary-400" : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                  )}
                >
                  <Book className="w-5 h-5" />
                  Terms & Privacy
                </Link>
              </nav>

              <div className="absolute bottom-6 left-6 right-6 pt-6 border-t dark:border-slate-700">
                <button onClick={handleLogout} className="flex items-center gap-3 text-red-600 dark:text-red-400 font-medium px-4 py-3 w-full hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all text-sm">
                  <LogOut className="w-5 h-5" />
                  Logout
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
