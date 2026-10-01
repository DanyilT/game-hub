import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchIncomingCount } from '../lib/friends';
import { supabase } from '../lib/supabase';
import { showToast } from '../lib/toast';
import { useAuth } from './AuthContext';

// ==========================================
// Library context
// ==========================================
// The signed-in player's own favorites, bookmarks and ratings (supabase/migrations/*_ratings.sql),
// loaded once when they sign in, so every game card and game page shows them without asking again.
// Changes show straight away, and are undone if the database refuses them. Components read it
// through useLibrary(); useGameStats() gives a game's public totals.
// Favorites are public (they're on the player's profile); bookmarks and ratings are private.
// Also how many friend requests are waiting for the player's answer (the badge on Profile), checked
// at sign-in and whenever the window comes back into focus.

const LibraryContext = createContext(null);

// Favorites are public: the first time a player adds one on this device, a message says so
const FAVORITES_NOTICE_KEY = 'gamehub:favorites-public-seen';
const noticeSeen = () => {
  try {
    return localStorage.getItem(FAVORITES_NOTICE_KEY) === 'true';
  } catch {
    return false;
  }
};
const rememberNoticeSeen = () => {
  try {
    localStorage.setItem(FAVORITES_NOTICE_KEY, 'true');
  } catch {
    // storage unavailable: the message may show again another time
  }
};

const emptyLibrary = (userId = null) => ({
  userId,
  favorites: new Map(), // game id → when it was added to the favorites
  bookmarks: new Map(), // game id → when it was bookmarked
  ratings: new Map(), // game id → { score, updated_at }
  loaded: false,
  error: null,
});

const byGame = (rows, value) => new Map((rows ?? []).map((row) => [row.game_id, value(row)]));

const REQUESTS_RECHECK = 30_000; // ms: focusing the window checks the friend requests at most this often

export const LibraryProvider = ({ children }) => {
  const { isAvailable, user, openSignIn } = useAuth();
  const userId = user?.id ?? null;
  // Tagged with the player it belongs to, so one player's library never shows for another
  const [library, setLibrary] = useState(emptyLibrary);
  const [attempt, setAttempt] = useState(0);
  // Goes up after each change, so pages showing totals (useGameStats) fetch them again
  const [version, setVersion] = useState(0);
  // Friend requests waiting for an answer, tagged with the player
  const [requests, setRequests] = useState({ userId: null, count: 0 });
  const requestsCheckedRef = useRef(0);

  useEffect(() => {
    if (!isAvailable || !userId) return undefined;
    let active = true;
    Promise.all([
      supabase.from('favorites').select('game_id, created_at').eq('user_id', userId),
      supabase.from('bookmarks').select('game_id, created_at'),
      supabase.from('ratings').select('game_id, score, updated_at'),
    ]).then(([favorites, bookmarks, ratings]) => {
      if (!active) return;
      setLibrary({
        userId,
        favorites: byGame(favorites.data, (row) => row.created_at),
        bookmarks: byGame(bookmarks.data, (row) => row.created_at),
        ratings: byGame(ratings.data, ({ score, updated_at: updatedAt }) => ({ score, updated_at: updatedAt })),
        loaded: true,
        error: favorites.error ?? bookmarks.error ?? ratings.error ?? null,
      });
    });
    return () => {
      active = false;
    };
  }, [isAvailable, userId, attempt]);

  const refreshRequests = useCallback(() => {
    if (!isAvailable || !userId) return;
    requestsCheckedRef.current = Date.now();
    fetchIncomingCount(userId).then(
      (count) => setRequests({ userId, count }),
      () => {}, // the badge just stays as it was
    );
  }, [isAvailable, userId]);

  useEffect(() => {
    refreshRequests();
    const onFocus = () => {
      if (Date.now() - requestsCheckedRef.current > REQUESTS_RECHECK) refreshRequests();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshRequests]);

  const current = useMemo(() => (library.userId === userId ? library : emptyLibrary(userId)), [library, userId]);

  // Changes one of the lists at once (optimistically), for the signed-in player only
  const change = useCallback((list, update) => {
    setLibrary((previous) => {
      if (previous.userId !== userId) return previous;
      const next = new Map(previous[list]);
      update(next);
      return { ...previous, [list]: next };
    });
  }, [userId]);

  /**
   * Adds a game to the favorites (the heart button), or takes it out. Signed out, it opens the
   * sign-in window instead.
   * @return {Promise<boolean|null>} - whether the game is a favorite now (null when nothing changed)
   */
  const toggleFavorite = useCallback(async (gameId) => {
    if (!userId) {
      openSignIn();
      return null;
    }
    const favorite = current.favorites.has(gameId);
    const firstFavorite = !favorite && current.favorites.size === 0;
    change('favorites', (map) => (favorite ? map.delete(gameId) : map.set(gameId, new Date().toISOString())));
    const { error } = favorite
      ? await supabase.from('favorites').delete().eq('user_id', userId).eq('game_id', gameId)
      : await supabase.from('favorites').insert({ game_id: gameId });
    // Already a favorite (another tab, a double click) counts as done
    if (error && error.code !== '23505') {
      change('favorites', (map) => (favorite ? map.set(gameId, new Date().toISOString()) : map.delete(gameId)));
      showToast("Couldn't save that. Check your connection and try again.", { tone: 'error' });
      return null;
    }
    setVersion((n) => n + 1);
    if (firstFavorite && !noticeSeen()) {
      showToast('Favorites are public: they show on your profile, for anyone to see. Bookmarks stay private.',
        { duration: 0, action: { label: 'Got it', onClick: rememberNoticeSeen } });
    }
    return !favorite;
  }, [userId, current, change, openSignIn]);

  /**
   * Bookmarks a game to play later, or removes the bookmark. Signed out, it opens the sign-in window.
   * @return {Promise<boolean|null>} - whether the game is bookmarked now (null when nothing changed)
   */
  const toggleBookmark = useCallback(async (gameId) => {
    if (!userId) {
      openSignIn();
      return null;
    }
    const saved = current.bookmarks.has(gameId);
    change('bookmarks', (map) => (saved ? map.delete(gameId) : map.set(gameId, new Date().toISOString())));
    const { error } = saved
      ? await supabase.from('bookmarks').delete().eq('game_id', gameId)
      : await supabase.from('bookmarks').insert({ game_id: gameId });
    if (error && error.code !== '23505') {
      change('bookmarks', (map) => (saved ? map.set(gameId, new Date().toISOString()) : map.delete(gameId)));
      showToast("Couldn't save that. Check your connection and try again.", { tone: 'error' });
      return null;
    }
    setVersion((n) => n + 1);
    return !saved;
  }, [userId, current, change, openSignIn]);

  /**
   * Rates a game from 1 to 5, or removes the rating (null). Throws when it can't be saved.
   * @param {string} gameId
   * @param {number|null} score
   */
  const rateGame = useCallback(async (gameId, score) => {
    const { error } = await supabase.rpc('rate_game', { p_game: gameId, p_score: score });
    if (error) throw error;
    change('ratings', (map) => (score === null
      ? map.delete(gameId)
      : map.set(gameId, { score, updated_at: new Date().toISOString() })));
    setVersion((n) => n + 1);
  }, [change]);

  /**
   * Sends feedback, which only the developer reads (the `feedback` table). Throws when it can't be sent.
   * @param {object} feedback - { gameId?, kind: 'rating'|'bug'|'other', score?, message, withBrowser? }
   */
  const sendFeedback = useCallback(async ({ gameId = null, kind, score = null, message, withBrowser = false }) => {
    const { error } = await supabase.from('feedback').insert({
      game_id: gameId,
      kind,
      score,
      message: message.trim(),
      browser: withBrowser ? navigator.userAgent.slice(0, 400) : null,
    });
    if (error) throw error;
  }, []);

  const requestCount = requests.userId === userId ? requests.count : 0;

  const value = useMemo(() => ({
    ...current,
    version,
    requestCount,
    refreshRequests,
    retry: () => setAttempt((n) => n + 1),
    toggleFavorite,
    toggleBookmark,
    rateGame,
    sendFeedback,
  }), [current, version, requestCount, refreshRequests, toggleFavorite, toggleBookmark, rateGame, sendFeedback]);

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
};

/**
 * A game's public totals: { rating_count, rating_average, score_counts, favorite_count,
 * bookmark_count }, fetched again after the player changes their own. null until they've loaded,
 * and on a site without Supabase.
 * @param {string} gameId
 * @return {object|null}
 */
export const useGameStats = (gameId) => {
  const { version } = useLibrary();
  // Tagged with the game, so another game's totals never show; kept while a newer fetch is on its way
  const [result, setResult] = useState({ gameId: null, stats: null });

  useEffect(() => {
    if (!supabase) return undefined;
    let active = true;
    supabase.rpc('game_stats', { p_game: gameId }).then(({ data, error }) => {
      if (active && !error) setResult({ gameId, stats: data?.[0] ?? null });
    });
    return () => {
      active = false;
    };
  }, [gameId, version]);

  return result.gameId === gameId ? result.stats : null;
};

export default LibraryProvider;
