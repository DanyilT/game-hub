import { supabase } from './supabase';

// Reporting a player to the developer (supabase/migrations/*_blocks_and_reports.sql), from the ⋯ on their profile.
// Reports can't be read back: the developer reads them in Supabase's table editor, and for cheating, looks at the
// player's checked games. At most one report a day about the same player, and 10 a day in all.

export const REPORT_MAX = 2000; // characters, like the table's check

export const REPORT_REASONS = [
  {
    value: 'cheating',
    label: 'Cheating',
    text: 'Records or results they couldn’t have got fairly: a changed save, a bot, a bug they use.',
  },
  {
    value: 'other',
    label: 'Something else',
    text: 'An offensive name or picture, pestering, or anything else against the Terms.',
  },
];

/**
 * Reports a player
 * @param {object} report
 * @param {string} report.playerId
 * @param {'cheating'|'other'} report.reason
 * @param {string|null} [report.gameId] - for cheating: the game, if known
 * @param {string} [report.message] - what happened (needed for 'other')
 */
export const reportPlayer = async ({ playerId, reason, gameId = null, message = '' }) => {
  const { error } = await supabase.rpc('report_player', {
    p_user: playerId,
    p_reason: reason,
    p_game: gameId,
    p_message: message,
  });
  if (error) throw error;
};

/**
 * A sentence for a report's error
 * @param {object} error - a PostgrestError, or a network error
 * @return {string}
 */
export const describeReportError = (error) => {
  if (['self', 'no_player', 'report_message', 'already_reported', 'report_limit'].includes(error?.hint)) return error.message;
  if (error?.code === '42501' || error?.code === 'PGRST301') return 'Your session has expired. Sign in again.';
  return "Couldn't send it. Check your connection and try again.";
};
