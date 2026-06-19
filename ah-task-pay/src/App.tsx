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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
    </div>
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-6 max-w-md border border-red-100">
          <div className="bg-red-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-red-200">
             <LogOut className="w-12 h-12" />
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-red-600 uppercase tracking-tight">System Error</h2>
            <p className="text-gray-700 font-bold tracking-tight text-lg">{error}</p>
          </div>
          <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
             className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all uppercase tracking-widest text-sm"
           >
             Log Out & Try Again Later
          </button>
        </div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/" />;
  
  if (profile?.isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 p-6">
        <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center space-y-6 max-w-md border border-red-100">
           <div className="bg-red-500 w-24 h-24 rounded-full flex items-center justify-center mx-auto text-white shadow-lg shadow-red-200">
              <LogOut className="w-12 h-12" />
           </div>
           <div className="space-y-4">
             <h2 className="text-3xl font-black text-red-600 uppercase tracking-tight">Account Blocked</h2>
             <p className="text-gray-700 font-bold tracking-tight text-lg">Your account has been blocked by the administration.</p>
             {profile.warning && (
               <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                 <p className="text-orange-800 font-bold text-sm leading-relaxed">
                   Reason: {profile.warning}
                 </p>
               </div>
             )}
             <p className="text-gray-500 font-medium text-sm">
               If you think this is a mistake, please contact our support team.
             </p>
           </div>
           <a 
              href="https://wa.me/8801870866189" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-4 bg-green-500 text-white rounded-2xl font-black hover:bg-green-600 transition-all uppercase tracking-widest text-sm shadow-lg shadow-green-200"
            >
              Contact WhatsApp Support
            </a>
           <a 
              href="https://t.me/ahtaskpay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full inline-block py-4 bg-blue-500 text-white rounded-2xl font-black hover:bg-blue-600 transition-all uppercase tracking-widest text-sm shadow-lg shadow-blue-200 mt-2"
            >
              Join Telegram Channel
            </a>
           <button 
             onClick={() => supabase.auth.signOut().then(() => window.location.href = '/')}
             className="w-full py-4 bg-gray-900 text-white rounded-2xl font-black hover:bg-gray-800 transition-all uppercase tracking-widest text-sm"
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
            <Route path="/register" element={<LandingPage defaultIsLogin={false} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms-privacy" element={<TermsPrivacy />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/post-job" element={<PrivateRoute><PostJob /></PrivateRoute>} />
              <Route path="/post-ad" element={<PrivateRoute><PostAd /></PrivateRoute>} />
              <Route path="/manage-ads" element={<PrivateRoute><ManageAds /></PrivateRoute>} />
              <Route path="/manage-jobs" element={<PrivateRoute><ManageJobs /></PrivateRoute>} />
              <Route path="/browse-jobs" element={<PrivateRoute><BrowseJobs /></PrivateRoute>} />
              <Route path="/submitted-jobs" element={<PrivateRoute><SubmittedJobs /></PrivateRoute>} />
              <Route path="/profile-settings" element={<PrivateRoute><ProfileSettings /></PrivateRoute>} />
              <Route path="/job/:id" element={<PrivateRoute><JobDetails /></PrivateRoute>} />
              <Route path="/deposit" element={<PrivateRoute><Deposit /></PrivateRoute>} />
              <Route path="/withdraw" element={<PrivateRoute><Withdraw /></PrivateRoute>} />
              <Route path="/referral" element={<PrivateRoute><ReferralDashboard /></PrivateRoute>} />
              <Route path="/support" element={<PrivateRoute><SupportTickets /></PrivateRoute>} />
              <Route path="/admin" element={<PrivateRoute requiredAdmin><AdminPanel /></PrivateRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

