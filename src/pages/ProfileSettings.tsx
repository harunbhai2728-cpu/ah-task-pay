import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  User,
  Lock,
  ShieldCheck,
  ArrowLeft,
  AlertTriangle,
  X,
  Mail,
  Phone,
  AtSign,
  BadgeCheck,
  ChevronDown,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type ChangeRequestType = 'email' | 'phone' | 'username';

interface AccountChangeRequest {
  id: string;
  userId: string;
  type: ChangeRequestType;
  newValue: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

export default function ProfileSettings() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(profile?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showVerifiedOptions, setShowVerifiedOptions] = useState(false);
  const [changeRequests, setChangeRequests] = useState<AccountChangeRequest[]>([]);
  const [activeChangeType, setActiveChangeType] = useState<ChangeRequestType | null>(null);
  const [changeNewValue, setChangeNewValue] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [changeModalError, setChangeModalError] = useState('');

  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionLoading, setDeletionLoading] = useState(false);

  const fetchChangeRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch('/api/account/change-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.requests)) {
          setChangeRequests(json.requests);
        }
      }
    } catch {
      // silent
    }
  }, [user]);

  useEffect(() => {
    fetchChangeRequests();
  }, [fetchChangeRequests]);

  useEffect(() => {
    if (profile?.displayName) {
      setName(profile.displayName);
    }
  }, [profile?.displayName]);

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

  const openChangeModal = (type: ChangeRequestType) => {
    setActiveChangeType(type);
    setChangeNewValue('');
    setChangeReason('');
    setChangeModalError('');
  };

  const handleSubmitChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChangeType) return;
    setChangeModalError('');
    setError('');
    setSuccess('');

    if (!changeNewValue.trim()) {
      setChangeModalError('Please enter the new value.');
      return;
    }
    if (!changeReason.trim()) {
      setChangeModalError('Please enter a reason for this change.');
      return;
    }

    setChangeSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Session expired. Please login again.');

      const res = await fetch('/api/account/change-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: activeChangeType,
          newValue: changeNewValue.trim(),
          reason: changeReason.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to submit request');
      }

      const labelMap: Record<ChangeRequestType, string> = {
        email: 'ইমেইল পরিবর্তনের আবেদন (Email change request)',
        phone: 'নাম্বার পরিবর্তনের আবেদন (Phone number change request)',
        username: 'ইউজারনেম পরিবর্তনের আবেদন (Username change request)',
      };
      setSuccess(`${labelMap[activeChangeType]} সফলভাবে জমা হয়েছে! এডমিন রিভিউয়ের পর এটি আপডেট হবে।`);
      setActiveChangeType(null);
      setChangeNewValue('');
      setChangeReason('');
      await fetchChangeRequests();
    } catch (err: any) {
      setChangeModalError(err.message || 'Failed to submit request');
    } finally {
      setChangeSubmitting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;
    if (!deletionReason.trim()) {
      setError('Please provide a reason for deletion');
      return;
    }
    setDeletionLoading(true);
    setError('');
    setSuccess('');

    try {
      await supabase
        .from('profiles')
        .update({
          account_status: 'pending_deletion',
          deletion_reason: deletionReason,
        })
        .eq('id', user.id);

      setSuccess('একাউন্ট ডিলিটের আবেদন জমা হয়েছে। এডমিন অনুমোদনের অপেক্ষায় রয়েছে। (Account deletion request submitted.)');
      setShowDeletionModal(false);
      setDeletionReason('');
    } catch (err: any) {
      setError(err.message || 'Failed to request deletion');
    } finally {
      setDeletionLoading(false);
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
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      import('../lib/telegram').then(({ notifyTelegramEvent }) => {
        notifyTelegramEvent('profile_update', {
          details: 'User changed account password',
        });
      });

      setSuccess('Password changed successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to change password. Please re-login if issues persist.');
    } finally {
      setLoading(false);
    }
  };

  const pendingChangeCount =
    changeRequests.filter((r) => r.status === 'pending').length +
    (profile?.account_status === 'pending_deletion' ? 1 : 0);

  const getPendingByType = (type: ChangeRequestType) =>
    changeRequests.find((r) => r.type === type && r.status === 'pending');

  const changeModalMeta = activeChangeType
    ? {
        email: {
          title: 'Request Email Change',
          bn: 'ইমেইল পরিবর্তনের আবেদন',
          currentLabel: 'Current Email',
          currentValue: profile?.email || user?.email || 'N/A',
          newLabel: 'New Email Address',
          placeholder: 'example@gmail.com',
          inputType: 'email',
          icon: <Mail className="w-6 h-6 text-[#0B3D9E] dark:text-blue-300" />,
        },
        phone: {
          title: 'Request Number Change',
          bn: 'নাম্বার পরিবর্তনের আবেদন',
          currentLabel: 'Current Phone Number',
          currentValue: profile?.phone || 'Not provided',
          newLabel: 'New Phone Number',
          placeholder: '01XXXXXXXXX',
          inputType: 'tel',
          icon: <Phone className="w-6 h-6 text-[#0B3D9E] dark:text-blue-300" />,
        },
        username: {
          title: 'Request Username Change',
          bn: 'ইউজারনেম পরিবর্তনের আবেদন',
          currentLabel: 'Current Username',
          currentValue: profile?.username ? `@${profile.username}` : 'Not set',
          newLabel: 'New Username',
          placeholder: 'new_username (no spaces)',
          inputType: 'text',
          icon: <AtSign className="w-6 h-6 text-[#0B3D9E] dark:text-blue-300" />,
        },
      }[activeChangeType]
    : null;

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] rounded-[2rem] p-6 sm:p-8 text-white border border-blue-400/20 shadow-xl shadow-blue-950/15 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl text-white border border-white/15 transition-all shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight uppercase">Profile Settings</h1>
          <p className="text-blue-100 font-medium text-sm mt-0.5">Manage your personal information and security.</p>
        </div>
      </div>

      {(error || success) && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl border font-bold text-sm ${
            error
              ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400'
          }`}
        >
          {error || success}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Details */}
        <section className="bg-white dark:bg-[#0A1638] p-6 sm:p-8 rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 transition-colors">
          <div className="flex items-center gap-3">
            <div className="bg-[#EFF4FC] dark:bg-[#102255] border border-[#DCE7FA] dark:border-[#1C3882]/60 p-2.5 rounded-xl text-[#0B3D9E] dark:text-blue-300">
              <User className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black font-display text-[#071845] dark:text-white uppercase">Personal Details</h2>
          </div>

          <form onSubmit={handleUpdateName} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#0B3D9E]/60 dark:text-blue-300/60" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] outline-none transition-all font-medium text-[#071845] dark:text-white"
                />
              </div>
            </div>

            {/* Registered Email (Read-only) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest">Email Address</label>
                <span className="text-[10px] font-bold text-slate-400 dark:text-blue-200/50 uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read Only
                </span>
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-blue-200/40" />
                <input
                  type="email"
                  readOnly
                  disabled
                  value={profile?.email || user?.email || 'N/A'}
                  className="w-full pl-12 pr-4 py-4 bg-[#F2F6FE] dark:bg-[#050F2B]/60 border border-[#DCE7FA] dark:border-[#1C3882]/45 rounded-2xl text-slate-500 dark:text-blue-200/60 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            {/* Phone Number (Read-only) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest">Phone Number</label>
                <span className="text-[10px] font-bold text-slate-400 dark:text-blue-200/50 uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read Only
                </span>
              </div>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-blue-200/40" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={profile?.phone || 'Not provided'}
                  className="w-full pl-12 pr-4 py-4 bg-[#F2F6FE] dark:bg-[#050F2B]/60 border border-[#DCE7FA] dark:border-[#1C3882]/45 rounded-2xl text-slate-500 dark:text-blue-200/60 font-medium cursor-not-allowed tabular-nums"
                />
              </div>
            </div>

            {/* Username (Read-only) */}
            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest">Username</label>
                <span className="text-[10px] font-bold text-slate-400 dark:text-blue-200/50 uppercase flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read Only
                </span>
              </div>
              <div className="relative">
                <AtSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-blue-200/40" />
                <input
                  type="text"
                  readOnly
                  disabled
                  value={profile?.username || 'Not set'}
                  className="w-full pl-12 pr-4 py-4 bg-[#F2F6FE] dark:bg-[#050F2B]/60 border border-[#DCE7FA] dark:border-[#1C3882]/45 rounded-2xl text-slate-500 dark:text-blue-200/60 font-medium cursor-not-allowed"
                />
              </div>
            </div>

            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-4 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-blue-900/15 dark:shadow-none disabled:opacity-50 transition-colors mt-2 cursor-pointer"
            >
              {loading ? 'Updating...' : 'Save Name'}
            </motion.button>
          </form>
        </section>

        {/* Password Update */}
        <section className="bg-white dark:bg-[#0A1638] p-6 sm:p-8 rounded-[2.5rem] border border-[#D7E3F7] dark:border-[#1C3882]/55 shadow-sm shadow-blue-950/[0.04] space-y-6 transition-colors">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 dark:bg-orange-950/40 border border-orange-200/60 dark:border-orange-900/40 p-2.5 rounded-xl text-[#F97316] dark:text-[#FB923C]">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-black font-display text-[#071845] dark:text-white uppercase">Security</h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] outline-none transition-all font-medium text-[#071845] dark:text-white"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">Confirm New Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#07153B] outline-none transition-all font-medium text-[#071845] dark:text-white"
              />
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-orange-500/20 dark:shadow-none disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Processing...' : 'Update Password'}
            </motion.button>
          </form>
        </section>
      </div>

      {/* Account Safety & Interactive Verified User Options */}
      <div className="mt-8 bg-gradient-to-br from-[#041645] via-[#07266E] to-[#0B3D9E] p-6 sm:p-8 rounded-[2.5rem] text-white border border-blue-400/20 shadow-xl shadow-blue-950/15">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-white/15 p-4 rounded-2xl border border-white/15 shrink-0">
              <ShieldCheck className="w-10 h-10 text-[#FB923C]" />
            </div>
            <div>
              <h3 className="text-2xl font-black font-display uppercase tracking-tight">Account Safety</h3>
              <p className="text-blue-100 font-medium text-sm sm:text-base">
                Your data is encrypted and saved securely with AH Task Pay.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowVerifiedOptions((prev) => !prev)}
            className="bg-white/15 hover:bg-white/25 border border-white/25 px-5 py-3 rounded-full font-bold text-sm flex items-center gap-2.5 transition-all cursor-pointer shadow-md shrink-0"
          >
            <BadgeCheck className="w-5 h-5 text-emerald-300" />
            <span>Verified User</span>
            {pendingChangeCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-black bg-[#F97316] text-white rounded-full">
                {pendingChangeCount}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${showVerifiedOptions ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <AnimatePresence>
          {showVerifiedOptions && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-6 pt-6 border-t border-white/15 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black uppercase tracking-widest text-blue-100">
                      Account Options • একাউন্ট সংক্রান্ত আবেদন
                    </h4>
                    <p className="text-xs text-blue-200/80 font-medium mt-0.5">
                      প্রয়োজনে এখান থেকে ইমেইল, নাম্বার, ইউজারনেম পরিবর্তন বা একাউন্ট ডিলিটের আবেদন করুন।
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Email Change Request */}
                  <button
                    type="button"
                    onClick={() => openChangeModal('email')}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/15 text-blue-200 group-hover:text-white shrink-0">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">ইমেইল পরিবর্তনের আবেদন</p>
                        <p className="text-xs text-blue-200/80 font-medium truncate">
                          Request Email Change
                        </p>
                      </div>
                    </div>
                    {getPendingByType('email') ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-black uppercase shrink-0">
                        Pending
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-200 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Apply →
                      </span>
                    )}
                  </button>

                  {/* Phone Number Change Request */}
                  <button
                    type="button"
                    onClick={() => openChangeModal('phone')}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/15 text-blue-200 group-hover:text-white shrink-0">
                        <Phone className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">নাম্বার পরিবর্তনের আবেদন</p>
                        <p className="text-xs text-blue-200/80 font-medium truncate">
                          Request Phone Number Change
                        </p>
                      </div>
                    </div>
                    {getPendingByType('phone') ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-black uppercase shrink-0">
                        Pending
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-200 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Apply →
                      </span>
                    )}
                  </button>

                  {/* Username Change Request */}
                  <button
                    type="button"
                    onClick={() => openChangeModal('username')}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-white/15 text-blue-200 group-hover:text-white shrink-0">
                        <AtSign className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">ইউজারনেম পরিবর্তনের আবেদন</p>
                        <p className="text-xs text-blue-200/80 font-medium truncate">
                          Request Username Change
                        </p>
                      </div>
                    </div>
                    {getPendingByType('username') ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-black uppercase shrink-0">
                        Pending
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-blue-200 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Apply →
                      </span>
                    )}
                  </button>

                  {/* Account Deletion Request */}
                  <button
                    type="button"
                    onClick={() => setShowDeletionModal(true)}
                    className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-300/30 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-rose-500/25 text-rose-200 shrink-0">
                        <AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm text-rose-100 truncate">একাউন্ট ডিলিট আবেদন</p>
                        <p className="text-xs text-rose-200/80 font-medium truncate">
                          Request Account Deletion
                        </p>
                      </div>
                    </div>
                    {profile?.account_status === 'pending_deletion' ? (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/30 text-amber-200 text-[10px] font-black uppercase shrink-0">
                        Pending
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-rose-200 group-hover:translate-x-0.5 transition-transform shrink-0">
                        Request →
                      </span>
                    )}
                  </button>
                </div>

                {/* User's Recent Change Requests */}
                {(changeRequests.length > 0 || profile?.account_status === 'pending_deletion') && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-widest text-blue-200/80">
                      Recent Request Status
                    </p>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {profile?.account_status === 'pending_deletion' && (
                        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-rose-500/15 border border-rose-300/25 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Clock className="w-4 h-4 text-amber-300 shrink-0" />
                            <span className="font-bold text-white truncate">
                              Account Deletion Request
                            </span>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-200 font-black uppercase text-[10px] shrink-0">
                            Pending
                          </span>
                        </div>
                      )}
                      {changeRequests.slice(0, 5).map((req) => (
                        <div
                          key={req.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white/10 border border-white/10 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {req.status === 'approved' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                            ) : req.status === 'rejected' ? (
                              <XCircle className="w-4 h-4 text-rose-300 shrink-0" />
                            ) : (
                              <Clock className="w-4 h-4 text-amber-300 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">
                                <span className="uppercase">{req.type}</span> → {req.newValue}
                              </p>
                              {req.adminNote && (
                                <p className="text-[11px] text-blue-200/80 truncate">
                                  Admin note: {req.adminNote}
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-md font-black uppercase text-[10px] self-start sm:self-auto shrink-0 ${
                              req.status === 'approved'
                                ? 'bg-emerald-400/20 text-emerald-200'
                                : req.status === 'rejected'
                                  ? 'bg-rose-400/20 text-rose-200'
                                  : 'bg-amber-400/20 text-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Account Info Change Request Modal */}
      {activeChangeType && changeModalMeta && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#02081B]/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#0A1638] rounded-[2rem] w-full max-w-md p-6 sm:p-8 shadow-2xl border border-[#D7E3F7] dark:border-[#1E3B8A]/60"
          >
            <div className="flex justify-between items-start mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-[#EFF4FC] dark:bg-[#102255] border border-[#DCE7FA] dark:border-[#1C3882]/60">
                  {changeModalMeta.icon}
                </div>
                <div>
                  <h3 className="text-lg font-black font-display text-[#071845] dark:text-white leading-tight">
                    {changeModalMeta.title}
                  </h3>
                  <p className="text-xs font-bold text-[#0B3D9E] dark:text-blue-300 mt-0.5">
                    {changeModalMeta.bn}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveChangeType(null)}
                className="text-slate-400 hover:text-[#071845] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {changeModalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-bold">
                {changeModalError}
              </div>
            )}

            <form onSubmit={handleSubmitChangeRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">
                  {changeModalMeta.currentLabel}
                </label>
                <div className="w-full px-4 py-3 bg-[#F2F6FE] dark:bg-[#050F2B]/70 border border-[#DCE7FA] dark:border-[#1C3882]/50 rounded-xl text-sm font-bold text-slate-600 dark:text-blue-200/70 break-all">
                  {changeModalMeta.currentValue}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">
                  {changeModalMeta.newLabel}
                </label>
                <input
                  type={changeModalMeta.inputType}
                  required
                  value={changeNewValue}
                  onChange={(e) => setChangeNewValue(e.target.value)}
                  placeholder={changeModalMeta.placeholder}
                  className="w-full px-4 py-3.5 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] font-medium text-sm text-[#071845] dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-200/40"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-500 dark:text-blue-200/70 uppercase tracking-widest ml-1">
                  Reason • পরিবর্তনের কারণ
                </label>
                <textarea
                  required
                  rows={3}
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="কেন পরিবর্তন করতে চান তা লিখুন..."
                  className="w-full p-4 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl outline-none focus:ring-2 focus:ring-[#0B3D9E]/20 focus:border-[#0B3D9E] dark:focus:border-[#3B82F6] font-medium text-sm text-[#071845] dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-200/40 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveChangeType(null)}
                  className="flex-1 py-3.5 text-sm font-bold text-[#071845] dark:text-blue-100 bg-[#EFF4FC] dark:bg-[#102255] rounded-xl hover:bg-[#DCE7FA] dark:hover:bg-[#162E6E] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changeSubmitting || !changeNewValue.trim() || !changeReason.trim()}
                  className="flex-1 py-3.5 text-sm font-bold text-white bg-[#07266E] hover:bg-[#0B3D9E] dark:bg-[#F97316] dark:hover:bg-[#EA580C] rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {changeSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Deletion Modal */}
      {showDeletionModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#02081B]/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-[#0A1638] rounded-[2rem] w-full max-w-md p-6 sm:p-8 shadow-2xl border border-[#D7E3F7] dark:border-[#1E3B8A]/60"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-black font-display text-[#071845] dark:text-white flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  Delete Account
                </h3>
                <p className="text-xs font-bold text-rose-500 mt-0.5 ml-8">একাউন্ট ডিলিট আবেদন</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDeletionModal(false)}
                className="text-slate-400 hover:text-[#071845] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-500 dark:text-blue-200/70 mb-5 font-medium">
              Please enter the reason for requesting account deletion. Once deleted, your account data and balances are permanently lost. An administrator will review your request.
            </p>

            <textarea
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              placeholder="Why are you leaving?"
              rows={4}
              className="w-full p-4 mb-6 bg-[#F4F7FE] dark:bg-[#050F2B] border border-[#CEDDF6] dark:border-[#1E3B8A]/65 rounded-2xl outline-none focus:ring-2 focus:ring-red-500 font-medium text-sm text-[#071845] dark:text-white placeholder:text-slate-400 dark:placeholder:text-blue-200/40 resize-none"
            ></textarea>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setShowDeletionModal(false)}
                className="flex-1 py-3 text-sm font-bold text-[#071845] dark:text-blue-100 bg-[#EFF4FC] dark:bg-[#102255] rounded-xl hover:bg-[#DCE7FA] dark:hover:bg-[#162E6E] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestDeletion}
                disabled={deletionLoading || !deletionReason.trim()}
                className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {deletionLoading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

