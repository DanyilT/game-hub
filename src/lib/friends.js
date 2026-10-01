import { supabase } from './supabase';

// Friends (supabase/migrations/*_friends.sql). Friendships are public; requests are only seen by
// the two players. Every change goes through a database function.

/**
 * Where two players stand: 'none', 'outgoing' (I asked), 'incoming' (they asked) or 'friends'
 * @param {string} me - the signed-in player's id
 * @param {string} them - the other player's id
 * @return {Promise<string>}
 */
export const fetchFriendState = async (me, them) => {
  const { data, error } = await supabase
    .from('friendships')
    .select('status, requested_by')
    .in('user_a', [me, them])
    .in('user_b', [me, them])
    .maybeSingle();
  if (error) throw error;
  if (!data) return 'none';
  if (data.status === 'accepted') return 'friends';
  return data.requested_by === me ? 'outgoing' : 'incoming';
};

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

/** Asks a player to be friends (or accepts, if they asked first). Resolves to 'pending' or 'accepted'. */
export const sendFriendRequest = (playerId) => call('send_friend_request', { p_user: playerId });
export const acceptFriendRequest = (playerId) => call('accept_friend_request', { p_user: playerId });
/** Unfriends, declines their request or cancels yours */
export const removeFriend = (playerId) => call('remove_friend', { p_user: playerId });

/** A player's friends, newest friendship first: [{ id, username, display_name, avatar_url, since }] */
export const fetchFriends = (playerId) => call('player_friends', { p_user: playerId });

/** The signed-in player's requests waiting for an answer: [{ id, username, …, direction, sent_at }] */
export const fetchMyRequests = () => call('my_friend_requests');

/** How many players are waiting for the signed-in player to answer their request */
export const fetchIncomingCount = async (me) => {
  const { count, error } = await supabase
    .from('friendships')
    .select('user_a', { count: 'exact', head: true })
    .eq('status', 'pending')
    .neq('requested_by', me);
  if (error) throw error;
  return count ?? 0;
};

/**
 * A sentence for a friends error
 * @param {object} error - a PostgrestError, or a network error
 * @return {string}
 */
export const describeFriendError = (error) => {
  if (error?.hint === 'request_limit' || error?.hint === 'self' || error?.hint === 'no_player') return error.message;
  if (error?.code === '42501' || error?.code === 'PGRST301') return 'Your session has expired. Sign in again.';
  return "Couldn't do that. Check your connection and try again.";
};
