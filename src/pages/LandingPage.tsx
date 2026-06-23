import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { LogIn, Zap, CheckCircle, Shield, UserPlus, Phone, User, Mail, Lock, CreditCard, Users, Megaphone, TrendingUp, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

import { BrandLogo } from '../components/BrandLogo';

import fpPromise from '@fingerprintjs/fingerprintjs';

export function LandingPage({ defaultIsLogin = true }: { defaultIsLogin?: boolean }) {
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
  
  const [vpnWarning, setVpnWarning] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      localStorage.setItem('referralCode', ref);
      setRefCode(ref);
      setIsLogin(false); // Switch to registration tab
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVpnWarning(false);

    try {
      let actualEmail = email.trim();
      const formEl = e.target as HTMLFormElement;
      const formData = new FormData(formEl);
      const referredBy = formData.get('referred_by') as string || '';
      
      // 1. IP & VPN Security Check
      let ipAddress = '';
      try {
        const ipCheckRes = await fetch('/api/security/ip-check');
        const ipCheckData = await ipCheckRes.json();
        if (ipCheckData && ipCheckData.vpn) {
          setVpnWarning(true);
          return;
        }
        ipAddress = ipCheckData.ip || '';
      } catch (e) {
        console.warn("Could not check VPN status", e);
      }

      // 2. Device Fingerprint Capture
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
        
        if (signInError) {
           if (signInError.message.includes('Invalid login credentials')) {
               throw new Error('invalid email/password');
           } else if (signInError.message.includes('Email not confirmed')) {
               throw new Error('Please check your inbox and confirm your email address before logging in.');
           } else {
              throw signInError;
           }
        }
        
        // Update footprint on successful login
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
           const { data: profile } = await supabase.from('profiles').select('account_status').eq('id', user.id).single();
           if (profile && profile.account_status === 'deleted') {
              await supabase.auth.signOut();
              throw new Error('This account has been permanently deleted.');
           }
           await supabase.from('profiles').update({
             last_ip_address: ipAddress || null,
             device_fingerprint: visitorId || null
           }).eq('id', user.id);
        }

      } else {
        // Prevent Duplicate Fingerprints
        if (visitorId) {
          const { data: existingAccounts, error: checkError } = await supabase
            .from('profiles')
            .select('id')
            .eq('device_fingerprint', visitorId)
            .limit(1);
          
          if (existingAccounts && existingAccounts.length > 0) {
             throw new Error("Registration failed: Multiple accounts are strictly prohibited from the same device or IP.");
          }
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: actualEmail,
          password,
          options: {
            data: {
              name,
              username,
              phone,
              referred_by: referredBy
            }
          }
        });
        if (signUpError) throw signUpError;
        
        if (data.user) {
          const generatedCode = `AH${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: actualEmail,
            displayName: name,
            username: username,
            phone: phone,
            role: 'user',
            earningBalance: 0,
            depositBalance: 0,
            heldBalance: 0,
            referral_code: generatedCode,
            referred_by: referredBy,
            last_ip_address: ipAddress || null,
            device_fingerprint: visitorId || null,
            createdAt: new Date().toISOString()
          }, { onConflict: 'id' });
          
          if (profileError) {
            console.error(profileError);
          }
          
          if (referredBy) {
            try {
              await fetch('/api/referral/register', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ referrerCode: referredBy, newUserId: data.user.id })
              });
            } catch(e) {
               console.error("Referral reg error", e);
            }
          }
          
          if (!data.session && data.user.identities && data.user.identities.length > 0) {
            throw new Error("Registration successful! Please check your email to verify your account.");
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center transition-colors">
      {/* Top Section with Auth and Branding */}
      <section className="w-full bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 py-12 px-6 transition-colors">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <motion.div 
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="flex items-center justify-center lg:justify-start"
            >
              <BrandLogo size="lg" />
            </motion.div>
            
            <div className="space-y-4">
              <h2 className="text-5xl lg:text-6xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                {systemConfig?.loginTitle ? (
                  <span dangerouslySetInnerHTML={{ __html: systemConfig.loginTitle.replace(/\n/g, '<br/>') }} />
                ) : (
                  <>Marketplace for <br/><span className="text-primary-600 dark:text-primary-400">Micro Jobs</span></>
                )}
              </h2>
              <p className="text-lg text-gray-500 dark:text-slate-400 font-medium max-w-lg mx-auto lg:mx-0">
                The most trusted platform in Bangladesh. Join thousands of workers earning daily or promote your business with real people.
              </p>
            </div>
            
            {systemConfig?.loginBannerUrl && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 rounded-3xl overflow-hidden shadow-xl"
              >
                <img 
                  src={systemConfig.loginBannerUrl} 
                  alt="Promo Banner" 
                  referrerPolicy="no-referrer"
                  className="w-full object-cover max-h-64"
                />
              </motion.div>
            )}
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-800 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-700 shadow-2xl space-y-6 max-w-md mx-auto w-full relative z-10 transition-colors"
          >
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
              {vpnWarning && (
                 <div className="p-4 bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 text-sm rounded-2xl border border-orange-100 dark:border-orange-900/50 font-bold">
                    Security Alert: VPN/Proxy usage is strictly prohibited on this platform. Please disable it to continue.
                 </div>
              )}
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
          </motion.div>
        </div>
      </section>

      {/* Demo Sections / Ads */}
      <section className="w-full max-w-6xl py-20 px-6 space-y-20">
        <div className="text-center space-y-4">
          <h2 className="text-4xl font-black text-gray-900 dark:text-slate-100 tracking-tight uppercase">Platform Features</h2>
          <p className="text-gray-500 dark:text-slate-400 font-medium">Why AH Task Pay is the leading platform in Bangladesh.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
           <FeatureCard 
             icon={<CreditCard className="w-10 h-10 text-primary-600 dark:text-primary-400" />}
             title="Bkash & Nagad"
             description="Instant withdrawal to bKash and Nagad with minimum 20 BDT limit."
           />
           <FeatureCard 
             icon={<Users className="w-10 h-10 text-blue-600 dark:text-blue-400" />}
             title="Real Workers"
             description="Every job is completed by real verified users, no bots or fake traffic."
           />
           <FeatureCard 
             icon={<Megaphone className="w-10 h-10 text-orange-600 dark:text-orange-400" />}
             title="Boost Business"
             description="Promote your YouTube, Facebook, or Website with real human interaction."
           />
           <FeatureCard 
             icon={<TrendingUp className="w-10 h-10 text-green-600 dark:text-green-400" />}
             title="Expert Support"
             description="Direct WhatsApp support from the AH Task Pay team for all your queries."
           />
        </div>

        {/* Beautiful Demos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-primary-600 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-primary-200"
            >
              <div className="relative z-10 space-y-6">
                <div className="bg-white/20 w-fit p-4 rounded-2xl">
                  <Megaphone className="w-10 h-10" />
                </div>
                <h3 className="text-4xl font-black leading-tight">Need Real People <br/> to Grow your Brand?</h3>
                <p className="text-primary-100 font-medium text-lg">Post tasks and get real reviews, subscriptions, and follows from verified Bangladeshi users.</p>
                <div className="flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">100% Secure</div>
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Real Humans</div>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            </motion.div>

            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="bg-gray-900 rounded-[3rem] p-12 text-white overflow-hidden relative shadow-2xl shadow-gray-200"
            >
              <div className="relative z-10 space-y-6">
                <div className="bg-white/10 w-fit p-4 rounded-2xl">
                  <CreditCard className="w-10 h-10" />
                </div>
                <h3 className="text-4xl font-black leading-tight">Earning Money <br/> is Now Easier.</h3>
                <p className="text-gray-400 font-medium text-lg">Complete simple tasks like visiting websites or watching videos and get paid instantly to your wallet.</p>
                <div className="flex gap-4">
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Low Fee</div>
                   <div className="bg-white/10 px-4 py-2 rounded-full text-sm font-bold">Fast Approved</div>
                </div>
              </div>
              <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary-600/30 rounded-full blur-3xl" />
            </motion.div>
        </div>
      </section>

      <footer className="w-full bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 py-12 px-6 transition-colors">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
           <BrandLogo size="md" />
           <p className="text-gray-400 dark:text-slate-500 text-sm font-medium">© 2026 AH Task Pay. All rights reserved.</p>
           <div className="flex gap-6 text-sm font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest">
              <Link to="/terms-privacy" className="hover:text-primary-600 dark:hover:text-primary-400 cursor-pointer transition-colors">Terms & Privacy</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-slate-800 p-8 rounded-[2rem] border border-gray-100 dark:border-slate-700 shadow-sm text-left hover:border-primary-200 dark:hover:border-primary-900 transition-colors"
    >
      <div className="bg-gray-50 dark:bg-slate-700 w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-black text-gray-900 dark:text-slate-100 mb-2 uppercase tracking-tight">{title}</h3>
      <p className="text-gray-500 dark:text-slate-400 font-medium text-sm leading-relaxed">{description}</p>
    </motion.div>
  );
}
