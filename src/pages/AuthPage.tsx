import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, UserPlus, Phone, User, Mail, Lock, Users, Eye, EyeOff, ArrowLeft, Sun, Moon, Book, Shield, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from '../components/BrandLogo';
import fpPromise from '@fingerprintjs/fingerprintjs';

export function AuthPage({ defaultIsLogin = true }: { defaultIsLogin?: boolean }) {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading, systemConfig } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refCode, setRefCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

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
      setIsLogin(defaultIsLogin);
      const storedRef = localStorage.getItem('referralCode');
      if (storedRef) setRefCode(storedRef);
    }
  }, [defaultIsLogin]);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#0B3D9E] dark:border-[#F97316] mb-4"></div>
        <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-sm animate-pulse">Initializing Environment...</p>
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

        if (!acceptedTerms) {
           throw new Error('অ্যাকাউন্ট খুলতে অবশ্যই Terms & Conditions এবং Privacy Policy-তে টিক মার্ক দিয়ে সম্মতি দিতে হবে।');
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

          import('../lib/telegram').then(({ notifyTelegramEvent }) => {
            notifyTelegramEvent('registration', {
              userId: data.user!.id,
              user: cleanName,
              username: cleanUsername,
              referredBy: referredBy || undefined,
            });
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] transition-colors flex flex-col">
      {/* Top Royal Blue Header matching Landing Page */}
      <header className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] text-white border-b border-white/10 shadow-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-blue-100 hover:text-white transition-colors font-bold text-xs uppercase tracking-wider bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl border border-white/15">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to Home</span>
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

      <div className="flex-1 flex items-center justify-center p-5 sm:p-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="bg-white dark:bg-[#1E293B] p-7 sm:p-9 rounded-[2.25rem] border border-slate-200 dark:border-slate-700/80 shadow-2xl space-y-6 transition-colors">
            <div className="text-center space-y-2">
              <div className="flex justify-center mb-3">
                <BrandLogo size="lg" />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white font-display tracking-tight">
                {isLogin ? 'Welcome Back' : 'Create Your Account'}
              </h1>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isLogin ? 'Sign in to access tasks & instant payouts' : 'Join AH Task Pay and start earning in Taka (৳)'}
              </p>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800/90 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700 transition-colors">
              <button 
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${isLogin ? 'bg-[#07266E] text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Login
              </button>
              <button 
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-widest text-xs transition-all ${!isLogin ? 'bg-[#07266E] text-white shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                Register
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-sm rounded-2xl border border-red-200 dark:border-red-900/50 font-bold">
                  {error}
                </div>
              )}

              {!isLogin && (
                <>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Full Name"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="tel"
                      placeholder="Mobile Number"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                    />
                  </div>
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Username"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                    />
                  </div>
                </>
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

              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="Password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-12 pr-12 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {isLogin && (
                  <div className="text-right px-2">
                    <Link to="/forgot-password" className="text-xs text-[#0B3D9E] dark:text-[#FB923C] font-bold hover:underline">Forgot Password?</Link>
                  </div>
                )}
              </div>

              {!isLogin && (
                <>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input 
                      type="text"
                      placeholder="Referred By (Optional)"
                      name="referred_by"
                      value={refCode}
                      onChange={(e) => setRefCode(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-4 focus:ring-blue-500/15 focus:border-[#0B3D9E] dark:focus:border-blue-400 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-white outline-none transition-all font-semibold placeholder:text-slate-400"
                    />
                  </div>

                  <div className={`p-3.5 rounded-2xl border transition-colors ${
                    acceptedTerms
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-[#0B3D9E]/40 dark:border-blue-700/60'
                      : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700'
                  }`}>
                    <label htmlFor="accept-terms" className="flex items-start gap-3 cursor-pointer select-none">
                      <input
                        id="accept-terms"
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        required
                        className="mt-0.5 w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-[#0B3D9E] focus:ring-[#0B3D9E] accent-[#0B3D9E] dark:accent-[#F97316] shrink-0 cursor-pointer"
                      />
                      <span className="text-xs sm:text-[13px] font-semibold text-slate-600 dark:text-slate-300 leading-relaxed">
                        আমি{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalModal('terms');
                          }}
                          className="text-[#0B3D9E] dark:text-[#FB923C] font-black underline underline-offset-2 hover:opacity-80 cursor-pointer"
                        >
                          Terms &amp; Conditions
                        </button>{' '}
                        এবং{' '}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setLegalModal('privacy');
                          }}
                          className="text-[#0B3D9E] dark:text-[#FB923C] font-black underline underline-offset-2 hover:opacity-80 cursor-pointer"
                        >
                          Privacy Policy
                        </button>{' '}
                        পড়েছি ও সম্মতি দিচ্ছি।
                      </span>
                    </label>
                  </div>
                </>
              )}

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className="w-full py-4 bg-[#F97316] hover:bg-[#EA580C] text-white rounded-2xl font-black text-base shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 uppercase tracking-widest cursor-pointer"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* Inline Terms & Conditions / Privacy Policy Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 rounded-[2rem] w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-[#041645] via-[#07266E] to-[#0B3D9E] px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                {legalModal === 'terms' ? <Book className="w-5 h-5 text-[#FB923C]" /> : <Shield className="w-5 h-5 text-emerald-400" />}
                <h2 className="font-display font-extrabold text-lg">
                  {legalModal === 'terms' ? 'Terms & Conditions' : 'Privacy Policy'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-6 gap-4 shrink-0">
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  legalModal === 'terms'
                    ? 'border-[#0B3D9E] dark:border-[#F97316] text-[#0B3D9E] dark:text-[#FB923C]'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                Terms &amp; Conditions
              </button>
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className={`py-3 text-xs font-black uppercase tracking-wider border-b-2 transition-colors cursor-pointer ${
                  legalModal === 'privacy'
                    ? 'border-[#0B3D9E] dark:border-[#F97316] text-[#0B3D9E] dark:text-[#FB923C]'
                    : 'border-transparent text-slate-500 dark:text-slate-400'
                }`}
              >
                Privacy Policy
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {legalModal === 'terms' ? (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-[#07266E] dark:text-[#FB923C] mb-1">অ্যাকাউন্ট তৈরি</h3>
                    <p>প্রতিটি ইউজারের জন্য কেবল একটি অ্যাকাউন্ট খোলার অনুমতি রয়েছে। একাধিক অ্যাকাউন্ট তৈরি করা, ভিপিএন (VPN) ব্যবহার করা বা ফেক তথ্য দিলে অ্যাকাউন্ট স্থায়ীভাবে ব্লক করা হবে।</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-[#07266E] dark:text-[#FB923C] mb-1">কাজের সততা (Worker Rules)</h3>
                    <p>ওয়ার্কারদের অবশ্যই বায়ারের দেওয়া নিয়ম অনুযায়ী সঠিক কাজ সম্পন্ন করতে হবে। কোনো প্রকার ভুয়ো বা এডিট করা স্ক্রিনশট (Fake Proof) জমা দিলে কোনো নোটিশ ছাড়াই আপনার অ্যাকাউন্টটি বাতিল এবং অর্জিত ব্যালেন্স বাজেয়াপ্ত করা হবে।</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-[#07266E] dark:text-[#FB923C] mb-1">জব পোস্ট করার নিয়ম (Buyer Rules)</h3>
                    <p>বায়াররা কোনো অবৈধ, জুয়া, পর্নোগ্রাফি বা প্রতারণামূলক কাজ পোস্ট করতে পারবেন না। পদের সংখ্যা (Slots) পূর্ণ হওয়া বা রিজেক্ট হওয়ার বিষয়টি সিস্টেমের নির্দিষ্ট নিয়ম অনুযায়ী স্বয়ংক্রিয়ভাবে পরিচালিত হবে।</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-[#07266E] dark:text-[#FB923C] mb-1">তহবিল ও পেমেন্ট</h3>
                    <p>সাইটের নিয়ম ভঙ্গ করলে বা কোনো জালিয়াতি প্রমাণিত হলে অ্যাডমিন যেকোনো অ্যাকাউন্টের পেমেন্ট আটকে রাখার বা অ্যাকাউন্ট বাতিল করার পূর্ণ অধিকার রাখে।</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">তথ্য সংগ্রহ</h3>
                    <p>আমাদের ওয়েবসাইটে রেজিস্ট্রেশন এবং কাজ করার সুবিধার্থে আমরা আপনার নাম, ইমেল এড্রেস, মোবাইল ব্যাংকিং নম্বর (বিকাশ/নগদ) এবং কাজের প্রমাণ হিসেবে জমা দেওয়া স্ক্রিনশট বা তথ্য সংগ্রহ করে থাকি।</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">তথ্যের ব্যবহার</h3>
                    <p>সংগৃহীত তথ্যগুলো শুধুমাত্র আপনার উইথড্র বা ডিপোজিট প্রসেস করতে, কাজের সত্যতা যাচাই করতে এবং আপনার অ্যাকাউন্টের নিরাপত্তা নিশ্চিত করার উদ্দেশ্যে ব্যবহার করা হয়।</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
                    <h3 className="font-bold text-emerald-700 dark:text-emerald-400 mb-1">তথ্য সুরক্ষা</h3>
                    <p>আমরা আপনার কোনো ব্যক্তিগত তথ্য বা পেমেন্ট ডিটেইলস কোনো তৃতীয় পক্ষের কাছে বিক্রি, লিক বা শেয়ার করি না। আপনার সমস্ত ডাটা আমাদের সার্ভারে সম্পূর্ণ সুরক্ষিত ও গোপনীয় রাখা হয়।</p>
                  </div>
                </>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setAcceptedTerms(true);
                  setLegalModal(null);
                }}
                className="px-5 py-2.5 bg-[#07266E] hover:bg-[#0B3D9E] text-white rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4 text-[#FB923C]" />
                Agree &amp; Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
