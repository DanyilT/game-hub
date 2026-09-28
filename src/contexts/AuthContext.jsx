import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { rememberReturnPath } from '../lib/account';

// ==========================================
// Auth context
// ==========================================
// The signed-in player (Supabase Auth) and their public profile (the `profiles` table,
// supabase/migrations/*_accounts.sql). Components read it through useAuth().
// Without Supabase settings (src/lib/supabase.js) everyone is a guest and `isAvailable` is false.

const AuthContext = createContext(null);

export const PROFILE_COLUMNS = 'id, username, display_name, avatar_url, created_at';

const requireSupabase = () => {
  if (!supabase) throw new Error('Accounts are not available on this site.');
};

/**
 * The signed-in player's own profile, plus `username_history`: the names they've picked or kept,
 * oldest first (lib/account.js reads it). Only they can see it; it's empty until they choose a name.
 * @return {Promise<{data: object|null, error: object|null}>}
 */
const fetchOwnProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select(`${PROFILE_COLUMNS}, username_history (id, username, set_at)`)
    .eq('id', userId)
    .single();
  data?.username_history.sort((a, b) => a.id - b.id);
  return { data, error };
};

// Where sign-in redirects and email links bring players back to (allowed in Supabase's redirect list)
const callbackUrl = () => new URL(`${import.meta.env.BASE_URL}auth/callback`, window.location.origin).href;

export const AuthProvider = ({ children }) => {
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(!supabase);
  // Tagged with the user id it belongs to, so one player's profile never shows for another
  const [profileState, setProfileState] = useState({ userId: null, data: null, error: null });
  const [profileRequest, setProfileRequest] = useState(0);
  const [signInOpen, setSignInOpen] = useState(false);

  const user = session?.user ?? null;
  const userId = user?.id ?? null;

  // The session: read from storage at start-up (after swapping a sign-in ?code= for one),
  // then updated on every sign-in, sign-out and token refresh
  useEffect(() => {
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionLoaded(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // The profile, whenever a different player signs in. (Not from inside onAuthStateChange:
  // calling Supabase in that callback can deadlock the auth client.)
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    fetchOwnProfile(userId).then(({ data, error }) => {
      if (active) setProfileState({ userId, data: data ?? null, error: error ?? null });
    });
    return () => {
      active = false;
    };
  }, [userId, profileRequest]);

  const profileLoaded = !userId || profileState.userId === userId;
  const profile = userId && profileState.userId === userId ? profileState.data : null;
  const profileError = userId && profileState.userId === userId ? profileState.error : null;

  const refreshProfile = useCallback(() => setProfileRequest((n) => n + 1), []);

  // The sign-in window (components/account/SignInModal, shown by MainLayout)
  const openSignIn = useCallback(() => setSignInOpen(true), []);
  const closeSignIn = useCallback(() => setSignInOpen(false), []);

  /**
   * Leaves the site for Google / Discord; they send the player back to /auth/callback.
   * @param {'google'|'discord'} provider
   * @param {string} returnTo - path to open once signed in
   */
  const signInWith = useCallback(async (provider, returnTo) => {
    requireSupabase();
    rememberReturnPath(returnTo);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(),
        // Google: always ask which account to use (handy on shared computers)
        queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
      },
    });
    if (error) throw error;
  }, []);

  /**
   * Emails a one-time sign-in link. Only offered with the local Supabase, for testing; the real
   * site shows "soon" until there's a domain of our own to send email from.
   * The link has to be opened in this browser: it finishes the sign-in started here.
   * @param {string} email
   * @param {string} returnTo - path to open once signed in
   */
  const sendSignInLink = useCallback(async (email, returnTo) => {
    requireSupabase();
    rememberReturnPath(returnTo);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl() } });
    if (error) throw error;
  }, []);

  /**
   * Signs out on this device, or everywhere (every browser and device the player used).
   * This device is always signed out, even when the server can't be reached.
   */
  const signOut = useCallback(async ({ everywhere = false } = {}) => {
    requireSupabase();
    const { error } = await supabase.auth.signOut({ scope: everywhere ? 'global' : 'local' });
    if (error && everywhere) throw error;
  }, []);

  /**
   * Saves profile changes. The database checks them (username rules, 30-day limit, lengths).
   * Sending the current username keeps it: that's how a new player confirms their starting name.
   * @param {object} changes - columns to update, e.g. { display_name: 'Dany' }
   * @return {Promise<object>} - the saved profile
   */
  const updateProfile = useCallback(async (changes) => {
    requireSupabase();
    const { error } = await supabase.from('profiles').update(changes).eq('id', userId);
    if (error) throw error;
    // Read back, not from the update's answer: a username goes into its history through a
    // trigger, and that answer can't see rows the same statement added
    const { data, error: readError } = await fetchOwnProfile(userId);
    if (readError) throw readError;
    setProfileState({ userId, data, error: null });
    return data;
  }, [userId]);

  /** Deletes the account and everything tied to it, then signs out this device */
  const deleteAccount = useCallback(async () => {
    requireSupabase();
    const { error } = await supabase.rpc('delete_my_account');
    if (error) throw error;
    await supabase.auth.signOut({ scope: 'local' });
  }, []);

  /** Live check while typing: is the username valid, not reserved and not taken? */
  const isUsernameAvailable = useCallback(async (username) => {
    requireSupabase();
    const { data, error } = await supabase.rpc('is_username_available', { p_username: username });
    if (error) throw error;
    return data === true;
  }, []);

  const value = useMemo(() => ({
    isAvailable: Boolean(supabase),
    // true until we know whether someone is signed in (and have their profile)
    loading: !sessionLoaded || !profileLoaded,
    isAuthenticated: Boolean(user),
    user,
    profile,
    profileError,
    refreshProfile,
    // Closes by itself once someone is signed in (e.g. from an email link opened in another tab)
    signInOpen: signInOpen && !user,
    openSignIn,
    closeSignIn,
    signInWith,
    sendSignInLink,
    signOut,
    updateProfile,
    deleteAccount,
    isUsernameAvailable,
  }), [sessionLoaded, profileLoaded, user, profile, profileError, refreshProfile, signInOpen, openSignIn,
    closeSignIn, signInWith, sendSignInLink, signOut, updateProfile, deleteAccount, isUsernameAvailable]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
