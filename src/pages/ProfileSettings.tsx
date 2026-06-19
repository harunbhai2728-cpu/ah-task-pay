import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Lock, ShieldCheck, Key, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function ProfileSettings() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  
  const [name, setName] = useState(profile?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await supabase.from('profiles').update({ displayName: name }).eq('id', user.id);
      setSuccess('Profile name updated successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to update name');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess('');
    
    try {
      // With Supabase, changing password while logged in just requires calling updateUser
      // Supabase's auth.updateUser doesn't strictly verify old password client-side, 
      // but it requires a valid session.
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) throw error;
      
      setSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please re-login if issues persist.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="bg-white dark:bg-slate-800 p-3 rounded-2xl text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 shadow-sm border border-gray-100 dark:border-slate-700 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-slate-100 tracking-tight uppercase">Profile Settings</h1>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Manage your personal information and security.</p>
        </div>
      </div>

      {(error || success) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border font-bold text-sm ${
            error ? 'bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400' : 'bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900/50 text-green-600 dark:text-green-400'
          }`}
        >
          {error || success}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Name Update */}
        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          <div className="flex items-center gap-3">
             <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                <User className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-black text-gray-900 dark:text-slate-100 uppercase">Change Name</h2>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-4">
             <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative">
                   <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                   <input 
                      type="text"
                      required
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-gray-50 dark:bg-slate-700 border border-transparent dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium dark:text-white"
                   />
                </div>
             </div>
             <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-gray-200 dark:shadow-none hover:bg-gray-800 dark:hover:bg-slate-200 disabled:opacity-50 transition-colors"
             >
                {loading ? 'Updating...' : 'Save Name'}
             </motion.button>
          </form>
        </section>

        {/* Password Update */}
        <section className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-sm space-y-6 transition-colors">
          <div className="flex items-center gap-3">
             <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded-xl text-orange-600 dark:text-orange-400">
                <Lock className="w-6 h-6" />
             </div>
             <h2 className="text-xl font-black text-gray-900 dark:text-slate-100 uppercase">Security</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
             <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                <input 
                   type="password"
                   required
                   value={newPassword}
                   onChange={e => setNewPassword(e.target.value)}
                   className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-700 border border-transparent dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium dark:text-white"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input 
                   type="password"
                   required
                   value={confirmPassword}
                   onChange={e => setConfirmPassword(e.target.value)}
                   className="w-full px-4 py-4 bg-gray-50 dark:bg-slate-700 border border-transparent dark:border-slate-600 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all font-medium dark:text-white"
                />
             </div>
             <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={loading}
                className="w-full py-4 bg-primary-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary-200 dark:shadow-none hover:bg-primary-700 disabled:opacity-50 transition-colors"
             >
                {loading ? 'Processing...' : 'Update Password'}
             </motion.button>
          </form>
        </section>
      </div>

      <div className="bg-primary-600 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row items-center justify-between gap-6">
         <div className="flex items-center gap-4">
            <div className="bg-white/20 p-4 rounded-2xl">
               <ShieldCheck className="w-10 h-10" />
            </div>
            <div>
               <h3 className="text-2xl font-black uppercase tracking-tight">Account Safety</h3>
               <p className="text-primary-100 font-medium">Your data is encrypted and saved securely with AH Task Pay.</p>
            </div>
         </div>
         <div className="bg-white/10 px-6 py-3 rounded-full font-bold text-sm">Verified User</div>
      </div>
    </div>
  );
}
