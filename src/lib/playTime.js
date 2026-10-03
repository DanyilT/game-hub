import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { fetchPlayed } from './activity';
import { rpcWithKeepalive, supabase } from './supabase';

// ==========================================
// Play time
// ==========================================
// How long a player plays each game. A signed-in player's goes to their account, for the activity on profiles and the
// games page (supabase/migrations/*_play_activity.sql; who sees it is their choice, Settings → Privacy). A guest's is
// kept in this browser only (GUEST_KEY), and never goes anywhere. Both show in the panel under the game. The hub
// measures it, and the game isn't involved:
// - a second counts while the game's page is on screen and the player pressed a key or tapped in the game in the last
//   2 minutes (the bridge says when: useGameBridge's activity), and never while a replay plays. A signed-in player's
//   counts only online, since it goes to their account.
// - signed in, a play session starts at the first second that counts (start_play), and its time goes up about once a
//   minute (report_play), once more when the page is hidden, and a last time when it's left. The server adds no more
//   than the time that has really passed, and a session counts as a play once it reaches a minute.

const IDLE_AFTER = 2 * 60_000; // ms without a key or tap in the game before the time stops
const REPORT_EVERY = 60; // seconds counted between reports
const RETRY_AFTER = 60_000; // ms before trying again to start a session that didn't start
const GUEST_KEY = 'gamehub:play-time'; // a guest's time in each game, in this browser: { [gameId]: seconds }
const GUEST_WRITE_EVERY = 15; // seconds counted between writes of a guest's time

// A guest's time in each game, in this browser. Storage can be unavailable (private mode, blocked site data): then it
// isn't kept.
const readGuestTimes = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(GUEST_KEY));
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
};
const guestTime = (gameId) => {
  const seconds = readGuestTimes()[gameId];
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : 0;
};
const addGuestTime = (gameId, seconds) => {
  if (seconds <= 0) return;
  try {
    localStorage.setItem(GUEST_KEY, JSON.stringify({ ...readGuestTimes(), [gameId]: guestTime(gameId) + seconds }));
  } catch {
    // storage unavailable: the time just isn't kept
  }
};

// What the panel shows, as a small store it subscribes to (it changes every second while the player plays, and only
// the panel needs to hear it): { seconds, plays, lastPlayed, where } (where: 'account' or 'browser'), or null while
// unknown
const createPlayedStore = () => {
  let played = null;
  const listeners = new Set();
  return {
    get: () => played,
    set: (next) => {
      played = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
};

/**
 * Counts the play time on a game's page: a signed-in player's goes to their account, a guest's stays in this browser.
 * @param {string} gameId
 * @param {object|null} session - the signed-in player's (AuthContext), or null for a guest
 * @param {object} activity - useGameBridge's: when the player last pressed a key or tapped in the game
 * @param {boolean} paused - a replay is playing: watching isn't playing
 * @return {object} - the time played, for usePlayed
 */
export const usePlayTime = ({ gameId, session, activity, paused = false }) => {
  const sessionRef = useRef(session);
  const pausedRef = useRef(paused);
  useLayoutEffect(() => {
    sessionRef.current = session; // the token, refreshed now and then
    pausedRef.current = paused;
  });
  const userId = session?.user?.id ?? null;
  const [played] = useState(createPlayedStore);

  useEffect(() => {
    let base = null; // the time played before this page: { seconds, plays, lastPlayed, where }
    let counted = 0; // seconds counted on this page since
    const show = () => played.set(base && { ...base, seconds: base.seconds + counted });
    played.set(null);

    const isPlaying = () => document.visibilityState === 'visible' && !pausedRef.current
      && activity.current > 0 && Date.now() - activity.current < IDLE_AFTER;

    // A guest: counted, and kept in this browser
    if (!userId) {
      base = { seconds: guestTime(gameId), plays: null, lastPlayed: null, where: 'browser' };
      show();
      let unwritten = 0;
      const write = () => {
        addGuestTime(gameId, unwritten);
        unwritten = 0;
      };
      const timer = setInterval(() => {
        if (!isPlaying()) return;
        counted += 1;
        unwritten += 1;
        if (unwritten >= GUEST_WRITE_EVERY) write();
        show();
      }, 1000);
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') write();
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', write);
      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', write);
        write();
      };
    }

    if (!supabase) return undefined;
    let active = true;
    // The time already in their account (none yet, if it's under a minute)
    fetchPlayed(userId).then(
      (rows) => {
        if (!active) return;
        const row = rows.find((r) => r.game_id === gameId);
        base = { seconds: row?.seconds ?? 0, plays: row?.plays ?? 0, lastPlayed: row?.last_played ?? null, where: 'account' };
        show();
      },
      () => {}, // offline: the panel shows no time
    );

    let playId = null; // the session, once started
    let starting = false;
    let startAgainAt = 0; // after a failed start
    let pending = 0; // seconds counted, not reported yet
    let reporting = false;

    const start = async () => {
      starting = true;
      const { data, error } = await supabase.rpc('start_play', { p_game: gameId });
      starting = false;
      if (error) {
        // Too many sessions this hour: not again on this page; otherwise (offline, a blip) in a minute
        startAgainAt = error.hint === 'play_limit' ? Infinity : Date.now() + RETRY_AFTER;
        pending = 0;
        return;
      }
      playId = data;
    };

    // Sends the seconds counted; `end` closes the session. With `keepalive` it still goes out as the
    // page closes, and isn't waited for.
    const report = async ({ end = false, keepalive = false } = {}) => {
      if (!playId || (pending === 0 && !end)) return;
      const body = { p_session: playId, p_seconds: pending, p_end: end };
      pending = 0;
      if (end) playId = null;
      if (keepalive) {
        const token = sessionRef.current?.access_token;
        if (token) rpcWithKeepalive('report_play', JSON.stringify(body), token).catch(() => {});
        return;
      }
      reporting = true;
      const { error } = await supabase.rpc('report_play', body);
      reporting = false;
      if (error && !end) pending += body.p_seconds; // tried again with the next report
    };

    const tick = () => {
      if (!navigator.onLine || !isPlaying()) return;
      pending = Math.min(pending + 1, 10 * REPORT_EVERY);
      counted += 1;
      show();
      if (!playId) {
        if (!starting && Date.now() >= startAgainAt) start();
      } else if (pending >= REPORT_EVERY && !reporting) {
        report();
      }
    };
    const timer = setInterval(tick, 1000);
    // Hidden, the page may be closed without a word (phones): what's counted goes now
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report({ keepalive: true });
    };
    const onPageHide = () => report({ end: true, keepalive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      report({ end: true }); // another page of the hub, or another player
    };
  }, [gameId, userId, activity, played]);

  return played;
};

/**
 * The time played, kept up to date: { seconds, plays, lastPlayed, where } (plays and lastPlayed are the account's,
 * null for a guest; where is 'account' or 'browser'), or null while it isn't known
 * @param {object} played - from usePlayTime
 */
export const usePlayed = (played) => useSyncExternalStore(played.subscribe, played.get);
