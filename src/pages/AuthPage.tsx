import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Phone, User, Mail, Lock, Users, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { BrandLogo } from '../components/BrandLogo';
import fpPromise from '@fingerprintjs/fingerprintjs';

export function AuthPage({ defaultIsLogin = true }: { defaultIsLogin?: boolean }) {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, systemConfig } = useAuth();
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refCode, setRefCode] = useState('');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referralCode', ref);
      setRefCode(ref);
      setIsLogin(false);
    } else {
      const storedRef = localStorage.getItem('referralCode');
      if (storedRef) setRefCode(storedRef);
    }
  }, []);

  React.useEffect(() => {
    if (user && !authLoading) {
      if (isAdmin) {
        navigate('/admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, isAdmin, authLoading, navigate]);

  if (authLoading || (systemConfig === null)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-primary-600 dark:border-primary-500 mb-4"></div>
        <p className="text-gray-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">Initializing Environment...</p>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let actualEmail = email.trim();
      const formEl = e.target as HTMLFormElement;
      const formData = new FormData(formEl);
      const referredBy = formData.get('referred_by') as string || '';
      
      let ipAddress = '';
      try {
        const ipCheckRes = await fetch('/api/security/ip-check');
        const ipCheckData = await ipCheckRes.json();
        ipAddress = ipCheckData.ip || '';
      } catch (e) {
        console.warn("Could not check IP status", e);
      }

      let visitorId = '';
      try {
        const fp = await fpPromise.load();
        const result = await fp.get();
        visitorId = result.visitorId;
      } catch (e) {
        console.warn("Could not capture device fingerprint", e);
      }
      
      if (isLogin) {
        if (!actualEmail.includes('@')) {
           throw new Error('Please enter a valid email address.');
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: actualEmail,
          password
        });
        
        if (signInError) throw signInError;
      } else {
        if (actualEmail.length < 5 || !actualEmail.includes('@') || !actualEmail.includes('.')) {
          throw new Error('Please enter a valid email address');
        }
        
        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }

        if (!name.trim() || !phone.trim() || !username.trim()) {
           throw new Error('All fields are required');
        }

        const cleanName = name.trim();
        const cleanPhone = phone.trim();
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: actualEmail,
          password,
          options: {
            data: {
              full_name: cleanName,
              phone: cleanPhone,
              username: cleanUsername,
              avatar_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
              ip_address: ipAddress,
              device_fingerprint: visitorId
            }
          }
        });
        
        if (signUpError) {
          if (signUpError.message.includes('already registered') || signUpError.status === 422) {
             throw new Error('This email is already registered. Please login instead.');
          }
          throw signUpError;
        }

        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            displayName: cleanName,
            username: cleanUsername,
            phone: cleanPhone,
            email: actualEmail,
            photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
            account_status: 'active',
            earningBalance: 0,
            depositBalance: 0,
            pendingEarningBalance: 0,
            pendingDepositBalance: 0,
            role: 'worker',
            createdAt: new Date().toISOString()
          }, { onConflict: 'id' });

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }

          if (referredBy) {
            try {
              await fetch('/api/referral/register', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ referrerCode: referredBy, newUserId: data.user.id })
              });
            } catch (e) {
               console.error("Referral reg error", e);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors flex flex-col items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Link to="/" className="inline-flex items-center gap-2 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white mb-8 transition-colors font-bold uppercase tracking-widest text-xs">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        
        <div className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-2xl space-y-6 transition-colors">
          <div className="flex justify-center mb-6">
             <BrandLogo size="md" />
          </div>

          <div className="flex bg-gray-100/50 dark:bg-slate-700 p-1.5 rounded-2xl transition-colors">
            <button 
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${isLogin ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}
            >
              Login
            </button>
            <button 
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${!isLogin ? 'bg-white dark:bg-slate-600 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}
            >
              Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-100 dark:border-red-900/50 font-bold">
                {error}
              </div>
            )}

            {!isLogin && (
              <>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Full Name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <input 
                    type="tel"
                    placeholder="Mobile Number"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400"
                  />
                </div>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                  <input 
                    type="text"
                    placeholder="Username"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400"
                  />
                </div>
              </>
            )}

            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input 
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400"
              />
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
                <input 
                  type={showPassword ? "text" : "password"}
                  placeholder="Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-gray-50/50 dark:bg-slate-700 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400"
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {isLogin && (
                <div className="text-right px-2">
                  <Link to="/forgot-password" size="sm" className="text-xs text-primary-600 dark:text-primary-400 font-bold hover:underline">Forgot Password?</Link>
                </div>
              )}
            </div>

            {!isLogin && (
              <div className="relative opacity-70">
                <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400/80 dark:text-slate-500/80" />
                <input 
                  type="text"
                  placeholder="Referred By (Optional)"
                  name="referred_by"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-gray-50/50 dark:bg-slate-700/50 border border-gray-100 dark:border-slate-600 rounded-2xl focus:ring-4 focus:ring-primary-50 dark:focus:ring-primary-900/20 focus:bg-white dark:focus:bg-slate-800 dark:text-white outline-none transition-all font-bold placeholder:text-gray-400 text-gray-500 dark:text-slate-300"
                />
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading}
              className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-lg shadow-xl shadow-gray-200 dark:shadow-none hover:bg-gray-800 dark:hover:bg-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/30 dark:border-slate-900/30 border-t-white dark:border-t-slate-900 rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                  {isLogin ? 'Login Now' : 'Create Account'}
                </>
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
