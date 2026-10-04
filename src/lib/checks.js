import { useEffect, useState, useSyncExternalStore } from 'react';
import { CHECKED_GAMES } from '../../worker/games/list.js';
import { cleanItems } from './gameStatus';
import { keepRun, setRunCheck, waitingRuns } from './runs';
import { supabase } from './supabase';

// ==========================================
// Checked runs: tickets, and sending runs to be checked
// ==========================================
// Saves are the player's own and can say anything, so records come only from runs GameHub's server has
// played again itself (worker/verify-run.js; supabase/migrations/*_checked_runs.sql):
// - Tickets: a signed-in player's game takes one for each run, a seed the server chose. Each player's
//   tickets for each game are kept here in the browser (localStorage), 10 a game, so a game played
//   offline has them too. They're topped up whenever there's a connection: on the game's page, and
//   for the downloaded games on coming back online (MainLayout). The server hears that a ticket was
//   taken as the run starts (start_ticket: online, which also starts its clock), or once back online
//   (take_tickets), so it doesn't hand it out again.
// - Checking: a run that ends on a ticket goes to the server at once, or waits until back online
//   (src/lib/runs.js keeps it, with how its check went). A run without a ticket (offline, once they've
//   run out) stays on this device.
// - Records: the player's best checked runs in a game (my_records()).
// - In any browser: a checked run's moves are kept on the server too (30 days, or while it's a record), so the
//   player can watch it again anywhere (my_runs(), my_run_inputs()).

const TICKETS_KEY = 'gamehub:tickets'; // { [userId]: { [gameId]: [{ id, seed, expiresAt }] } }
const TAKEN_KEY = 'gamehub:tickets-taken'; // { [userId]: [ids] }: tickets taken offline, to tell the server

/** Whether GameHub checks runs of this game */
export const canCheck = (gameId) => CHECKED_GAMES.includes(gameId);

const read = (key) => {
  try {
    const stored = JSON.parse(localStorage.getItem(key));
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: no tickets kept, so runs go unchecked offline
  }
};

// Tickets changing, for the pages that show how many are left
const listeners = new Set();
const ticketsChanged = () => listeners.forEach((listener) => listener());
const subscribe = (listener) => {
  const onStorage = (e) => {
    if (e.key === TICKETS_KEY) listener(); // another tab took or got some
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

/**
 * A player's tickets for a game that are still in date: [{ id, seed, expiresAt }]
 * @param {string} userId
 * @param {string} gameId
 */
export const ticketsFor = (userId, gameId) => {
  const list = read(TICKETS_KEY)[userId]?.[gameId];
  return Array.isArray(list) ? list.filter((ticket) => Date.parse(ticket.expiresAt) > Date.now()) : [];
};

const setTickets = (userId, gameId, list) => {
  const all = read(TICKETS_KEY);
  all[userId] = { ...all[userId], [gameId]: list };
  write(TICKETS_KEY, all);
  ticketsChanged();
};

const takenFor = (userId) => (Array.isArray(read(TAKEN_KEY)[userId]) ? read(TAKEN_KEY)[userId] : []);
const setTaken = (userId, ids) => write(TAKEN_KEY, { ...read(TAKEN_KEY), [userId]: ids });

/** Tells the server which tickets were taken offline, so it doesn't hand them out again */
const sendTaken = async (userId) => {
  const ids = takenFor(userId);
  if (ids.length === 0) return;
  const { error } = await supabase.rpc('take_tickets', { p_tickets: ids });
  if (error) throw error;
  setTaken(userId, takenFor(userId).filter((id) => !ids.includes(id)));
};

/**
 * Tops up a player's tickets for a game from the server (the ones taken offline told first). Resolves to the tickets;
 * rejects when the server can't be reached.
 */
export const refillTickets = async (userId, gameId) => {
  if (!supabase || !canCheck(gameId)) return [];
  await sendTaken(userId);
  const { data, error } = await supabase.rpc('issue_tickets', { p_game: gameId });
  if (error) throw error;
  const list = data.map((ticket) => ({ id: ticket.id, seed: Number(ticket.seed), expiresAt: ticket.expires_at }));
  setTickets(userId, gameId, list);
  return list;
};

/**
 * A game started a run on one of the player's tickets: it's no longer theirs to hand out. Online, the server hears of
 * it now, and starts the run's clock; offline, it hears once back online.
 * @return {Promise<number>} - how many are left (once the server knows, when online)
 */
export const spendTicket = async (userId, gameId, ticketId) => {
  const left = ticketsFor(userId, gameId).filter((ticket) => ticket.id !== ticketId);
  setTickets(userId, gameId, left);
  let told = false;
  if (navigator.onLine && supabase) {
    try {
      told = !(await supabase.rpc('start_ticket', { p_ticket: ticketId })).error;
    } catch {
      // unreachable after all: told once back online
    }
  }
  if (!told) setTaken(userId, [...takenFor(userId), ticketId]);
  return left.length;
};

/**
 * How many tickets a player has left for a game, kept up to date (null when there's no player, or the game isn't
 * checked)
 */
export const useTicketsLeft = (userId, gameId) => useSyncExternalStore(
  subscribe,
  () => (userId && canCheck(gameId) ? ticketsFor(userId, gameId).length : null),
);

// ==========================================
// Checking
// ==========================================

// What the server said, as a run's check (null: try again later)
const checkFrom = async (response) => {
  if (response.status === 200) {
    const answer = await response.json();
    return answer.status === 'checked'
      ? { state: 'checked', outcome: answer.outcome, result: answer.result, best: answer.best === true }
      : { state: 'refused', reason: answer.reason };
  }
  if (response.status === 409) return { state: 'refused', reason: 'ticket' };
  if (response.status === 400 || response.status === 413) return { state: 'refused', reason: 'not-a-run' };
  return null; // signed out, the server or Supabase unreachable, or not set up
};

/**
 * Sends a run to the server to be checked
 * @param {object} session - the signed-in player's
 * @return {Promise<object|null>} - its check, or null when it has to wait (offline, the server unreachable)
 */
export const sendRun = async (session, gameId, run) => {
  try {
    const response = await fetch('/api/verify-run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ game: gameId, run }),
    });
    return await checkFrom(response);
  } catch {
    return null;
  }
};

/**
 * Keeps a run that just ended, and checks it when it can: a signed-in player's run on a ticket goes to the server now
 * if there's a connection, or waits for one
 * @param {object|null} session - the signed-in player's, or null for a guest
 */
export const keepAndCheck = async (session, gameId, run) => {
  const userId = session?.user?.id ?? null;
  if (!userId) {
    await keepRun('guest', gameId, run);
    return;
  }
  const checked = run.ticket && canCheck(gameId);
  const key = await keepRun(userId, gameId, run, { state: checked ? 'waiting' : 'unchecked' });
  if (!checked || !navigator.onLine) return;
  const check = await sendRun(session, gameId, run);
  if (check) await setRunCheck(key, check);
};

let checking = null;
/**
 * Sends every run of the player's that waits to be checked (played offline, or while the server was unreachable)
 * @return {Promise<{checked: number, refused: number, waiting: number}>}
 */
export const checkWaiting = (session) => {
  checking ??= (async () => {
    const counts = { checked: 0, refused: 0, waiting: 0 };
    for (const { key, gameId, run } of await waitingRuns(session.user.id)) {
      const check = await sendRun(session, gameId, run);
      if (!check) {
        counts.waiting += 1;
        continue;
      }
      counts[check.state] += 1;
      await setRunCheck(key, check);
    }
    return counts;
  })().finally(() => {
    checking = null;
  });
  return checking;
};

/**
 * Back online (or the site opened online): runs started offline told, tickets topped up for these games, and the runs
 * waiting checked
 * @param {object} session - the signed-in player's
 * @param {string[]} gameIds - the games to top up (the downloaded ones)
 * @return {Promise<{tickets: boolean, checked: number, refused: number, waiting: number}>} - tickets: all topped up
 */
export const catchUp = async (session, gameIds) => {
  const userId = session.user.id;
  let tickets = true;
  for (const gameId of gameIds.filter(canCheck)) {
    try {
      await refillTickets(userId, gameId);
    } catch {
      tickets = false;
    }
  }
  return { tickets, ...(await checkWaiting(session)) };
};

// ==========================================
// Records
// ==========================================

/**
 * The signed-in player's checked records in a game, kept up to date as runs are checked: [{ mode, score, time_ms,
 * result, checked_at }], or null (none to show: signed out, or not loaded)
 * @param {string|null} userId
 * @param {string} gameId
 * @param {*} changed - anything that changes when they may have (the runs list)
 */
export const useRecords = (userId, gameId, changed) => {
  const [records, setRecords] = useState({ key: null, list: null });
  const key = userId && canCheck(gameId) ? `${userId}:${gameId}` : null;
  useEffect(() => {
    if (!key || !supabase) return undefined;
    let active = true;
    supabase.rpc('my_records', { p_game: gameId }).then(({ data, error }) => {
      if (active && !error) setRecords({ key, list: data });
    });
    return () => {
      active = false;
    };
  }, [key, gameId, changed]);
  return records.key === key ? records.list : null;
};

// ==========================================
// Runs kept on the server
// ==========================================
// The runs a signed-in player played on a ticket are kept on GameHub's server too: their moves for 30 days after
// they're checked, or as long as the run is the player's record (supabase/migrations/*_checked_runs.sql). So the panel
// under the game lists them in any browser (*_runs_on_any_browser.sql), with the ones this browser keeps, and a run's
// moves come from the server when it's watched.

// A run from my_runs(), as runs.js keeps them, but its moves (fetchRunInputs), with `serverId`, and `keepUntil`: when
// its moves go from the server (ms), or null for a record (kept while it's one)
const serverRow = (row) => ({
  key: `server:${row.run_id}`,
  endedAt: Date.parse(row.checked_at),
  run: {
    v: 1,
    id: row.run_id,
    ticket: row.ticket_id,
    seed: Number(row.seed),
    mode: row.mode,
    tick: row.tick,
    length: Number(row.length),
    inputs: null,
    outcome: row.outcome ?? 'over',
    result: cleanItems(row.claimed, 3),
    best: false,
  },
  check: row.status === 'checked'
    ? { state: 'checked', outcome: row.outcome, result: cleanItems(row.result, 3), best: row.record }
    : { state: 'refused', reason: row.reason },
  serverId: row.run_id,
  keepUntil: row.keep_until ? Date.parse(row.keep_until) : null,
});

/**
 * The signed-in player's runs of a game kept on the server, newest first, as runs.js keeps them (see serverRow), read
 * again when `changed` changes; or null (none to show: signed out, the game's runs aren't checked, or not loaded)
 * @param {string|null} userId
 * @param {string} gameId
 * @param {*} changed - anything that changes when they may have (this browser's runs)
 */
export const useServerRuns = (userId, gameId, changed) => {
  const [runs, setRuns] = useState({ key: null, list: null });
  const key = userId && canCheck(gameId) ? `${userId}:${gameId}` : null;
  useEffect(() => {
    if (!key || !supabase) return undefined;
    let active = true;
    supabase.rpc('my_runs', { p_game: gameId }).then(({ data, error }) => {
      if (active && !error) setRuns({ key, list: data.map(serverRow) });
    });
    return () => {
      active = false;
    };
  }, [key, gameId, changed]);
  return runs.key === key ? runs.list : null;
};

/**
 * This browser's runs of a game with the ones kept on the server (useServerRuns), newest first: one row for each run
 * (by its ticket), this browser's if it has it, with the server's word on its check and when its moves go
 * @param {object[]|null} local - useRuns'
 * @param {object[]|null} server - useServerRuns'
 */
export const mergeRuns = (local, server) => {
  if (!server) return local;
  const byTicket = new Map(server.map((row) => [row.run.ticket, row]));
  const merged = (local ?? []).map((row) => {
    const kept = row.run.ticket ? byTicket.get(row.run.ticket) : null;
    if (!kept) return row;
    byTicket.delete(row.run.ticket);
    return { ...row, check: kept.check, serverId: kept.serverId, keepUntil: kept.keepUntil };
  });
  return [...merged, ...byTicket.values()].sort((a, b) => b.endedAt - a.endedAt);
};

/**
 * A run's moves, from the server (for a run this browser doesn't keep)
 * @param {string} serverId - the run's, from useServerRuns
 * @return {Promise<Array|null>} - null once they're no longer kept
 */
export const fetchRunInputs = async (serverId) => {
  const { data, error } = await supabase.rpc('my_run_inputs', { p_run: serverId });
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data : null;
};
