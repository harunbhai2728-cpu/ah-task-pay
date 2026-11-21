import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, CheckCircle2, Sun, Moon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from '../components/BrandLogo';

export default function ForgotPassword() {
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      let resetInput = email.trim();
      let actualEmail = resetInput;
      if (!resetInput) throw new Error("Please enter a valid email address.");

      if (!actualEmail.includes('@')) {
         throw new Error("Please enter a valid email address.");
      }

      const { error } = await supabase.auth.resetPasswordForEmail(actualEmail, {
        redirectTo: window.location.origin + '/profile-settings',
      });
      if (error) throw error;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] transition-colors flex flex-col">
      <header className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white border-b border-white/10 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/login" className="inline-flex items-center gap-2 text-blue-100 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl border border-white/15">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Login</span>
          </Link>
          <Link to="/">
            <BrandLogo size="sm" />
          </Link>
          <button
            onClick={toggleTheme}
            className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white border border-white/15 transition-colors"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon className="w-4 h-4 text-blue-100" /> : <Sun className="w-4 h-4 text-[#FB923C]" />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white dark:bg-[#1E293B] p-8 sm:p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-slate-700/80 space-y-6 transition-colors"
        >
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">Reset Password</h1>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Recover access to your AH Task Pay account</p>
          </div>

          {success ? (
            <div className="text-center space-y-6 py-4">
               <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="w-10 h-10" />
               </div>
               <div className="space-y-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase">Check your Email</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">We've sent a password reset link to <br/> <span className="text-slate-900 dark:text-white font-bold">{email}</span></p>
               </div>
               <Link 
                 to="/login"
                 className="block w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black uppercase tracking-widest text-sm shadow-lg shadow-orange-500/25 transition-all"
               >
                 Back to Login
               </Link>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-slate-600 dark:text-slate-300 font-medium text-center text-sm">Enter your email and we'll send you a link to reset your password instantly.</p>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-200 dark:border-red-900/50 font-bold">
                    {error}
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type="email"
                    placeholder="Email Address"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  disabled={loading}
                  className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-base shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Send Reset Link'
                  )}
                </motion.button>
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
