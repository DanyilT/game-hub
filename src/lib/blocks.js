import { supabase } from './supabase';

// Blocks (supabase/migrations/*_blocks_and_reports.sql): a player blocks another from the ⋯ on their profile. The two
// stop being friends, can't send each other friend requests, and see none of each other's activity. Only the player
// who blocked sees the block (RLS); every change goes through a database function.

const call = async (fn, args) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data;
};

/** Blocks a player: you stop being friends, and a request either way is dropped */
export const blockPlayer = (playerId) => call('block_player', { p_user: playerId });
/** Unblocks a player (friends again only through a new request) */
export const unblockPlayer = (playerId) => call('unblock_player', { p_user: playerId });

/**
 * Whether the signed-in player has blocked this one
 * @return {Promise<boolean>}
 */
export const fetchIsBlocked = async (playerId) => {
  const { data, error } = await supabase.from('blocks').select('blocked').eq('blocked', playerId).maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

/** The players the signed-in player has blocked, newest first: [{ id, username, display_name, avatar_url, blocked_at }] */
export const fetchMyBlocks = async () => {
  const { data, error } = await supabase
    .from('blocks')
    .select('created_at, player:profiles!blocks_blocked_fkey (id, username, display_name, avatar_url)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.filter((row) => row.player).map((row) => ({ ...row.player, blocked_at: row.created_at }));
};
