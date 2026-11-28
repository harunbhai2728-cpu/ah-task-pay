/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { AuthPage } from './pages/AuthPage';
import { Dashboard } from './pages/Dashboard';
import { PostJob } from './pages/PostJob';
import { PostAd } from './pages/PostAd';
import { ManageAds } from './pages/ManageAds';
import { ManageJobs } from './pages/ManageJobs';
import { BrowseJobs } from './pages/BrowseJobs';
import { JobDetails } from './pages/JobDetails';
import { Deposit } from './pages/Deposit';
import { Withdraw } from './pages/Withdraw';
import { AdminPanel } from './pages/AdminPanel';
import { SubmittedJobs } from './pages/SubmittedJobs';
import { SupportTickets } from './pages/SupportTickets';
import { ReferralDashboard } from './pages/ReferralDashboard';
import { UserRole } from './types';
import { LogOut } from 'lucide-react';
import { supabase } from './lib/supabase';
import ForgotPassword from './pages/ForgotPassword';
import ProfileSettings from './pages/ProfileSettings';
import { TermsPrivacy } from './pages/TermsPrivacy';

function PrivateRoute({ children, requiredAdmin }: { children: React.ReactNode, requiredAdmin?: boolean }) {
  const { user, profile, loading, isAdmin, error } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#EFF4FC] dark:bg-[#040C24] transition-colors">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0B3D9E] dark:border-[#F97316]"></div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFF4FC] dark:bg-[#040C24] p-6 transition-colors">
        <div className="bg-white dark:bg-[#0A1638] p-10 rounded-[2.5rem] shadow-2xl text-center space-y-6 max-w-md border border-red-200 dark:border-red-900/40">
          <div className="bg-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-red-500/20">
             <LogOut className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-black text-red-600 dark:text-red-400 uppercase tracking-tight">System Error</h2>
            <p className="text-slate-700 dark:text-slate-300 font-semibold text-base">{error}</p>
          </div>
          <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
             className="w-full py-4 bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#F97316] dark:hover:bg-[#EA580C] text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg"
           >
             Log Out & Try Again Later
          </button>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/" />;

  if (profile?.account_status === 'deleted') {
    const isByAdmin = profile.deleted_by === 'admin' || (profile.deletion_reason && profile.deletion_reason.toLowerCase().includes('administrator'));
    const heading = isByAdmin ? 'Your account has been deleted by Admin' : 'Your account has been deleted by You';
    
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFF4FC] dark:bg-[#040C24] p-6 transition-colors">
        <div className="bg-white dark:bg-[#0A1638] p-10 rounded-[2.5rem] shadow-2xl text-center space-y-5 max-w-md border border-red-200 dark:border-red-900/40">
           <div className="bg-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-red-500/20">
              <LogOut className="w-10 h-10" />
           </div>
           <div className="space-y-3">
             <h2 className="text-2xl font-black text-red-600 dark:text-red-400 uppercase tracking-tight">{heading}</h2>
             {profile.deletion_reason && (
               <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-xl border border-red-100 dark:border-red-900/40 text-left">
                 <p className="text-red-800 dark:text-red-300 font-bold text-sm leading-relaxed whitespace-pre-wrap">
                   Reason: {profile.deletion_reason}
                 </p>
               </div>
             )}
             <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
               If you have any questions, please contact our support team.
             </p>
           </div>
           <a
               href="https://wa.me/8801870866189"
               target="_blank"
               rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg"
            >
              Contact WhatsApp Support
            </a>
           <a
               href="https://t.me/ahtaskpay_owner"
               target="_blank"
               rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-[#0B3D9E] hover:bg-[#07266E] text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Telegram Support
            </a>
           <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Telegram Channel
            </a>
           <a 
              href="mailto:ahtaskpay@gmail.com" 
              className="w-full inline-block py-3.5 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Email Support
            </a>
           <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
             className="w-full py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm mt-3 shadow-lg"
           >
             Log Out
           </button>
        </div>
      </div>
    );
  }
  
  if (profile?.isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#EFF4FC] dark:bg-[#040C24] p-6 transition-colors">
        <div className="bg-white dark:bg-[#0A1638] p-10 rounded-[2.5rem] shadow-2xl text-center space-y-5 max-w-md border border-red-200 dark:border-red-900/40">
           <div className="bg-red-500 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-red-500/20">
              <LogOut className="w-10 h-10" />
           </div>
           <div className="space-y-3">
             <h2 className="text-3xl font-black text-red-600 dark:text-red-400 uppercase tracking-tight">Account Blocked</h2>
             <p className="text-slate-700 dark:text-slate-300 font-bold tracking-tight text-base">Your account has been blocked by the administration.</p>
             {profile.warning && (
               <div className="bg-orange-50 dark:bg-orange-950/30 p-4 rounded-xl border border-orange-200 dark:border-orange-900/40">
                 <p className="text-orange-800 dark:text-orange-300 font-bold text-sm leading-relaxed">
                   Reason: {profile.warning}
                 </p>
               </div>
             )}
             <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
               If you think this is a mistake, please contact our support team.
             </p>
           </div>
           <a 
              href="https://wa.me/8801870866189" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg"
            >
              Contact WhatsApp Support
            </a>
           <a 
              href="https://t.me/ahtaskpay_owner" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-[#0B3D9E] hover:bg-[#07266E] text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Telegram Support
            </a>
           <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Telegram Channel
            </a>
           <a 
              href="mailto:ahtaskpay@gmail.com" 
              className="w-full inline-block py-3.5 bg-slate-700 hover:bg-slate-800 text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm shadow-lg mt-2"
            >
              Email Support
            </a>
           <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
             className="w-full py-3.5 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black transition-all uppercase tracking-widest text-sm mt-3 shadow-lg"
           >
             Log Out
           </button>
        </div>
      </div>
    );
  }

  if (requiredAdmin && !isAdmin) {
    return <Navigate to="/dashboard" />;
  }
  
  return <>{children}</>;
}

function KeepAlive() {
  React.useEffect(() => {
    // Ping the backend every 5 minutes (300000 ms) to keep the Render server from sleeping
    const interval = setInterval(() => {
      fetch('/api/ping').catch(() => {
        // Silently fail if ping doesn't work
      });
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);
  
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <Toaster 
        position="top-left" 
        toastOptions={{
          style: {
            padding: '16px 24px',
            fontSize: '16.5px',
            fontWeight: '600',
            borderRadius: '16px',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          }
        }}
      />
      <KeepAlive />
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<AuthPage defaultIsLogin={true} />} />
            <Route path="/register" element={<AuthPage defaultIsLogin={false} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms-privacy" element={<TermsPrivacy />} />
            <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/post-job" element={<PostJob />} />
              <Route path="/post-ad" element={<PostAd />} />
              <Route path="/manage-ads" element={<ManageAds />} />
              <Route path="/manage-jobs" element={<ManageJobs />} />
              <Route path="/browse-jobs" element={<BrowseJobs />} />
              <Route path="/submitted-jobs" element={<SubmittedJobs />} />
              <Route path="/profile-settings" element={<ProfileSettings />} />
              <Route path="/job/:id" element={<JobDetails />} />
              <Route path="/deposit" element={<Deposit />} />
              <Route path="/withdraw" element={<Withdraw />} />
              <Route path="/referral" element={<ReferralDashboard />} />
              <Route path="/support" element={<SupportTickets />} />
              <Route path="/admin" element={<PrivateRoute requiredAdmin><AdminPanel /></PrivateRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

