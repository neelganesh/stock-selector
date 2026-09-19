import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { UserProfile } from '../lib/supabase';

/** Convert a username to a virtual email for Supabase auth.
 *  Users type just a username; we map it to a stable virtual email
 *  so Supabase auth works without email confirmation.
 */
function usernameToEmail(username: string): string {
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
  return `${clean}@stock-selector.local`;
}

/** Extract a display username from a user object (email or metadata). */
function getUsername(user: any): string | null {
  if (!user) return null;
  if (user.user_metadata?.username) return user.user_metadata.username;
  if (user.email) return user.email.split('@')[0];
  return null;
}


interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: any }>;
  signUp: (username: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  /** Returns the current Supabase access token, refreshing if needed. */
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (!error && data) {
      setProfile(data);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      // Timeout fallback: ensure loading never stays true forever
      const timeoutId = setTimeout(() => {
        console.warn('[Auth] Loading timeout - forcing loading=false');
        setLoading(false);
      }, 5000);

      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        clearTimeout(timeoutId);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        }
        setLoading(false);
      }).catch((err) => {
        clearTimeout(timeoutId);
        console.error('[Auth] getSession error:', err);
        setLoading(false);
      });

      // Listen for auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        console.log('[Auth] onAuthStateChange:', { event: _event, hasSession: !!session, user: session?.user?.email });
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      });

      return () => {
        clearTimeout(timeoutId);
        subscription.unsubscribe();
      };
    }, [fetchProfile]);

  const signIn = async (username: string, password: string) => {
    console.log('[Auth] signIn called with:', username);
    if (!supabase) {
      console.error('[Auth] Supabase not configured');
      return { error: new Error('Supabase not configured') };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
      console.log('[Auth] signInWithPassword result:', { data, error });
      return { error };
    } catch (err) {
      console.error('[Auth] signIn exception:', err);
      return { error: err };
    }
  };

  const signUp = async (username: string, password: string, fullName?: string) => {
    console.log('[Auth] signUp called with:', username);
    if (!supabase) {
      console.error('[Auth] Supabase not configured');
      return { error: new Error('Supabase not configured') };
    }
    const virtualEmail = usernameToEmail(username);
    const { data, error } = await supabase.auth.signUp({
      email: virtualEmail,
      password,
      options: {
        data: {
          full_name: fullName ?? null,
          username,
        },
        email: virtualEmail,
        confirm_email: false,
      },
    });
    if (error) return { error };

    // Create a user_profiles row for the new user. RLS lets a user insert
    // their own profile (auth.uid() = user_id). The schema's UNIQUE(user_id)
    // constraint means a duplicate insert is rejected — we treat that as
    // non-fatal in case a database trigger already created the row.
    if (data.user) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert(
          {
            user_id: data.user.id,
            email,
            full_name: fullName ?? null,
          },
          { onConflict: 'user_id', ignoreDuplicates: true }
        );
      // Ignore "duplicate key" errors — the row already exists, that's fine.
      if (profileError && profileError.code !== '23505') {
        return { error: profileError };
      }
    }
    return { error: null };
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    // getSession() can return a session with an expired token — refresh
    // proactively so serverless /api/* calls never see a stale JWT.
    if (data.session.expires_at && data.session.expires_at * 1000 < Date.now() + 30_000) {
      const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
      if (refreshErr || !refreshed.session) return null;
      return refreshed.session.access_token;
    }
    return data.session.access_token;
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, refreshProfile, getAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}