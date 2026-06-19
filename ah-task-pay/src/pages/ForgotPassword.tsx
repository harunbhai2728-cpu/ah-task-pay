import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function ForgotPassword() {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white p-10 rounded-[3rem] shadow-2xl border border-gray-100 space-y-8"
      >
        <div className="flex justify-between items-center">
            <Link to="/" className="p-3 bg-gray-50 rounded-2xl hover:bg-gray-100 transition-all">
                <ArrowLeft className="w-5 h-5 text-gray-400" />
            </Link>
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-tight">Forgot Password</h2>
            <div className="w-10"></div>
        </div>

        {success ? (
          <div className="text-center space-y-6 py-4">
             <div className="w-20 h-20 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-green-100">
                <CheckCircle2 className="w-10 h-10" />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 uppercase">Check your Email</h3>
                <p className="text-gray-500 font-medium">We've sent a password reset link to <br/> <span className="text-gray-900 font-bold">{email}</span></p>
             </div>
             <Link 
               to="/"
               className="block w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm"
             >
               Back to Login
             </Link>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-gray-500 font-medium text-center">Enter your email and we'll send you a link to reset your password instantly.</p>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 text-sm rounded-2xl border border-red-100 font-bold">
                  {error}
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input 
                  type="email"
                  placeholder="Email Address"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-transparent rounded-2xl focus:ring-2 focus:ring-primary-500 focus:bg-white outline-none transition-all font-medium"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-primary-200 hover:bg-primary-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest"
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
  );
}
