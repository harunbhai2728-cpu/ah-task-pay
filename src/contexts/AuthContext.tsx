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
      const { data } = await supabase.from('system_config').select('*').eq('id', 'config').single();
      if (data) setSystemConfig(data);
      else setSystemConfig({});
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
      const sessionData = await supabase.auth.getSession();
      const token = sessionData?.data?.session?.access_token;
      if (!token) {
        throw new Error("No active authentication session token found. Please try logging in again.");
      }

      let res;
      let retries = 3;
      while (retries > 0) {
        try {
          res = await fetch('/api/proxy', {
               method: 'POST',
               headers: {
                   'Content-Type': 'application/json',
                   'Authorization': 'Bearer ' + token
               },
               body: JSON.stringify({
                   table: 'profiles',
                   method: 'select',
                   args: ['*'],
                   eq: ['id', sessionUser.id],
                   single: true
               })
          });
          break; // successfully fetched
        } catch (fetchErr: any) {
          retries--;
          if (retries === 0) {
            throw fetchErr;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      if (!res || !res.ok) {
          const errMsg = res ? await res.text() : "Network error";
          throw new Error(`Profile load failed: ${res?.status || 'Unknown'} - ${errMsg}`);
      }

      const { data, error: profileErr } = await res.json();
      if (profileErr) {
          throw new Error(profileErr.message || profileErr);
      }

      if (data) {
        if (isMasterEmail && data.isBlocked) {
            try {
                await fetch('/api/proxy', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                   body: JSON.stringify({ table: 'profiles', method: 'update', args: [{ isBlocked: false }], eq: ['id', sessionUser.id] })
                });
            } catch (err) {
                console.error("Failed to unblock master user", err);
            }
        }

        if (!data.serialNumber) {
            const randomSerial = Math.floor(100000 + Math.random() * 900000);
            try {
                await fetch('/api/proxy', {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                   body: JSON.stringify({ table: 'profiles', method: 'update', args: [{ serialNumber: randomSerial }], eq: ['id', sessionUser.id] })
                });
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
