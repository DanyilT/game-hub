import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// Play activity (supabase/migrations/*_play_activity.sql; the time is counted by playTime.js): the
// games a player has played, what they're playing now, and the games page's recent activity. The
// server shows each only as far as the player lets the viewer see it (Settings → Privacy), so these
// just ask.

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

/** Who can see each kind of activity: the values the database takes, with their labels */
export const AUDIENCES = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'friends', label: 'Friends' },
  { value: 'nobody', label: 'Only me' },
];

/** The games a player has played: [{ game_id, last_played, plays, seconds }], most recent first */
export const fetchPlayed = (playerId) => call('player_played', { p_user: playerId });

/**
 * What these players are playing now (the ones the viewer may see)
 * @param {string[]} playerIds
 * @return {Promise<Map<string, {game_id: string, since: string}>>} - player id → what they're playing
 */
export const fetchPlayingNow = async (playerIds) => {
  if (!supabase || playerIds.length === 0) return new Map();
  const rows = await call('playing_now', { p_users: playerIds });
  return new Map(rows.map((row) => [row.user_id, row]));
};

/** The latest plays across the site: [{ user_id, username, display_name, avatar_url, game_id, played_at, seconds }] */
export const fetchRecentActivity = (limit = 12) => call('recent_activity', { p_limit: limit });

/** The signed-in player's choices: { show_played, show_playing, show_activity } */
export const fetchMyPrivacy = async () => (await call('my_privacy'))?.[0] ?? null;

/** Changes some of the signed-in player's choices, e.g. { show_playing: 'nobody' } */
export const setPrivacy = (changes) => call('set_privacy', {
  p_show_played: changes.show_played ?? null,
  p_show_playing: changes.show_playing ?? null,
  p_show_activity: changes.show_activity ?? null,
});

/**
 * What these players are playing now, kept up to date while the page is open (every minute, like
 * the reports it comes from)
 * @param {string[]} playerIds
 * @return {Map<string, {game_id: string}>}
 */
export const usePlayingNow = (playerIds) => {
  const [playing, setPlaying] = useState(() => new Map());
  const key = playerIds.join(',');
  useEffect(() => {
    if (!supabase || !key) return undefined;
    let active = true;
    const load = () => {
      if (document.visibilityState !== 'visible') return;
      fetchPlayingNow(key.split(',')).then((map) => active && setPlaying(map), () => {});
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [key]);
  return playing;
};

/**
 * Play time, short: "45 s", "12 min", "1 h 20 min"
 * @param {number} seconds
 * @return {string}
 */
export const playTime = (seconds) => {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
};

/**
 * How long ago, short: "just now", "5 min ago", "3 h ago", "2 days ago", then the date
 * @param {string|number|Date} date
 * @return {string}
 */
export const timeAgo = (date) => {
  const minutes = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return days === 1 ? 'yesterday' : `${days} days ago`;
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
};
