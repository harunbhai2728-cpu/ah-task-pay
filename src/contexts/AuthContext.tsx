import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  systemConfig: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  refreshConfig: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  systemConfig: null,
  loading: true,
  isAdmin: false,
  isSuperAdmin: false,
  error: null,
  refreshProfile: async () => {},
  refreshConfig: async () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [systemConfig, setSystemConfig] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const { data } = await supabase.from('system_configuration').select('*').eq('id', 1).maybeSingle();
      if (data) {
        setSystemConfig({
            id: "config",
            notice: data.global_notice || "",
            minDeposit: data.min_deposit || 100,
            minWithdraw: data.min_withdraw || 20,
            withdrawalFee: data.withdrawal_fee || 10,
            jobPostingFee: data.job_service_charge || 10,
            bkashNumber: data.official_bkash || "",
            bkashMethod: data.bkash_method || "Personal",
            nagadNumber: data.official_nagad || "",
            nagadMethod: data.nagad_method || "Personal",
            depositBkashEnabled: data.deposit_bkash_enabled !== false,
            depositNagadEnabled: data.deposit_nagad_enabled !== false,
            withdrawBkashEnabled: data.withdraw_bkash_enabled !== false,
            withdrawNagadEnabled: data.withdraw_nagad_enabled !== false,
            transferEarningToDepositFee: data.transfer_earning_deposit_fee || 0,
            transferDepositToEarningFee: data.transfer_deposit_earning_fee || 10,
            loginTitle: data.login_title || "Welcome to TaskPay",
            loginBannerUrl: data.login_banner_url || "",
            referralBonusAmount: data.referral_bonus_amount ?? 5,
            referralValidationCriteria: data.referral_validation_criteria ?? 1,
            referralValidityDays: data.referral_validity_days ?? 30,
            campaignEndDate: data.campaign_end_date || null
        });
      } else {
        setSystemConfig({});
      }
    } catch (err) {
      console.warn("Failed to fetch system config", err);
      setSystemConfig({});
    }
  };

  const fetchProfile = async (sessionUser: any) => {
    if (!sessionUser) {
      setLoading(false);
      return;
    }
    const isMasterEmail = ['harunurrashid93427@gmail.com', 'harunbhai2728@gmail.com', 'superadmin@taskpay.systems'].includes(sessionUser.email?.toLowerCase() || '');
    const isSuper = sessionUser.email?.toLowerCase() === 'superadmin@taskpay.systems';

    try {
      let data = null;
      let retries = 3;
      while (retries > 0) {
        try {
          const { data: dbData, error: profileErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();
            
          if (profileErr && profileErr.code !== 'PGRST116') { // PGRST116 is 'not found'
            throw profileErr;
          }
          data = dbData;
          break; // successfully fetched
        } catch (fetchErr: any) {
          retries--;
          if (retries === 0) {
            throw fetchErr;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (data) {
        if (isMasterEmail && data.isBlocked) {
            try {
                const sessionData = await supabase.auth.getSession();
                const token = sessionData?.data?.session?.access_token;
                if (token) {
                  await fetch('/api/proxy', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                     body: JSON.stringify({ table: 'profiles', method: 'update', args: [{ isBlocked: false }], eq: ['id', sessionUser.id] })
                  });
                }
            } catch (err) {
                console.error("Failed to unblock master user", err);
            }
        }

        if (!data.serialNumber) {
            const randomSerial = Math.floor(100000 + Math.random() * 900000);
            try {
                const sessionData = await supabase.auth.getSession();
                const token = sessionData?.data?.session?.access_token;
                if (token) {
                  await fetch('/api/proxy', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                     body: JSON.stringify({ table: 'profiles', method: 'update', args: [{ serialNumber: randomSerial }], eq: ['id', sessionUser.id] })
                  });
                }
            } catch (err) {
                console.error("Failed to generate and assign serial number", err);
            }
        }

        // Mapping to match your frontend types
        setProfile({ uid: data.id, ...data });
        setIsAdmin(data.role === 'admin' || isMasterEmail);
        setIsSuperAdmin(isSuper);
      } else {
        setProfile(null);
        setIsAdmin(isMasterEmail);
        setIsSuperAdmin(isSuper);
      }
    } catch (e: any) {
      console.error("Error fetching user profile", e);
      setError(e.message || "Failed to load user profile");
      if (e.message && e.message.toLowerCase().includes('refresh token')) {
          supabase.auth.signOut().catch(() => {});
          setUser(null);
          setProfile(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const refreshConfig = async () => {
    await fetchConfig();
  };

  useEffect(() => {
    fetchConfig();

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.warn("Session retrieval warning:", error.message);
      }
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
        fetchConfig();
      } else {
        setLoading(false);
      }
    }).catch((err) => {
      console.warn("Session error ignored:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
        fetchConfig();
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // Subscribe to realtime updates for system config
    const configChannel = supabase.channel('public:system_configuration')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'system_configuration' },
        (payload) => {
          fetchConfig(); // Re-fetch through API to ensure consistent data mapping
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(configChannel);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Subscribe to realtime updates for this user's profile
    const channel = supabase.channel(`public:profiles:id=eq.${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          // Update profile state directly or re-fetch
          setProfile(prev => {
            if (!prev) return null;
            return { ...prev, ...payload.new };
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, profile, systemConfig, loading, isAdmin, isSuperAdmin, error, refreshProfile, refreshConfig }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
