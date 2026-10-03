import { useEffect, useState, useSyncExternalStore } from 'react';
import { cleanItems } from './gameStatus';

// ==========================================
// Runs: games a player finished, to watch again
// ==========================================
// A game in the hub (gamehub.js version 3) records each game from its start to its end: the random seed it played
// with, and the inputs that changed it, each with its step (games that move by themselves) or its time. Never
// pictures, so a run is a few KB. When a game ends, the game sends its run (gameBridge.js), and it's kept here, in this
// browser (IndexedDB), with that player's other runs of the game: the latest ones, and their best ones however old.
// A guest's runs are the guest's. Watching one reloads the game in a mode where it plays the run itself (GamePage,
// GameProgress). A signed-in player's run played on a ticket also goes to GameHub's server to be checked
// (src/lib/checks.js): its `check` says how that went.

const DB_NAME = 'gamehub';
const DB_VERSION = 1;
const STORE = 'runs';
const KEEP_LATEST = 20; // runs per player and game
const KEEP_BEST = 5; // and the newest of their best ones, however old
const MAX_INPUTS = 20000; // like gamehub.js
const MAX_SIZE = 256 * 1024; // bytes of JSON
const OUTCOMES = ['won', 'lost', 'over'];

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCode = (code) => (Number.isSafeInteger(code) && code >= 0) || (typeof code === 'string' && code.length > 0 && code.length <= 16);

/**
 * A run from a game, checked: { v, id, ticket, seed, mode, tick, length, inputs, outcome, result, best }, or null
 * - ticket: the id of the ticket it was played on (a seed GameHub's server chose), or null
 * - seed: the 32-bit seed of its random numbers; mode: its level, or null
 * - tick: ms per step for games that move by themselves, or null for games that wait for the player
 * - length: how long it lasted: steps, or ms (games without a tick)
 * - inputs: [wait, code, wait, code, …]: each input, after a wait in steps or ms since the one before
 * - outcome: 'won', 'lost' or 'over'; result: up to 3 numbers for the list (cleanItems); best: it beat the player's best
 */
export const cleanRun = (run) => {
  if (!isPlainObject(run) || run.v !== 1) return null;
  const { id, seed, mode, tick, length, inputs, outcome, result, best } = run;
  const ticket = run.ticket ?? null;
  const valid = typeof id === 'string' && id.length > 0 && id.length <= 40
    && (ticket === null || (typeof ticket === 'string' && ticket.length > 0 && ticket.length <= 40))
    && Number.isSafeInteger(seed) && seed >= 0 && seed < 2 ** 32
    && (mode === null || (typeof mode === 'string' && mode.length <= 32))
    && (tick === null || (Number.isSafeInteger(tick) && tick >= 1 && tick <= 10000))
    && Number.isSafeInteger(length) && length >= 0
    && Array.isArray(inputs) && inputs.length > 0 && inputs.length % 2 === 0 && inputs.length <= MAX_INPUTS * 2
    && inputs.every((value, i) => (i % 2 === 0 ? Number.isSafeInteger(value) && value >= 0 : isCode(value)))
    && OUTCOMES.includes(outcome);
  if (!valid) return null;
  const clean = { v: 1, id, ticket, seed, mode, tick, length, inputs, outcome, result: cleanItems(result, 3), best: best === true };
  return JSON.stringify(clean).length <= MAX_SIZE ? clean : null;
};

/** How long a run lasted, in seconds of the game's time */
export const runSeconds = (run) => (run.tick ? run.length * run.tick : run.length) / 1000;

// ==========================================
// Kept in this browser
// ==========================================
// The store holds { key, owner, endedAt, run, check }: owner is "<player>:<game id>" (player: their account id, or
// 'guest'), and check is null (a guest's run) or { state, … } (src/lib/checks.js):
// - 'waiting': played on a ticket, to send to the server (it waits while offline)
// - 'checked': the server played it again: { outcome, result, best (the player's record then) }
// - 'refused': it didn't play out the same there, or its ticket couldn't be used: { reason }
// - 'unchecked': played without a ticket (offline, after they ran out): it stays here

// Runs kept, or their checks changing, anywhere on the page (or in another tab): the lists read again
const listeners = new Set();
let version = 0;
const runsChanged = () => {
  version += 1;
  listeners.forEach((listener) => listener());
};
const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

let opening = null;
const openDb = () => {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('No IndexedDB'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: 'key', autoIncrement: true });
      store.createIndex('owner', 'owner');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
  opening.catch(() => {
    opening = null; // tried again next time
  });
  return opening;
};

// Runs a request in a transaction; resolves to its result once the transaction is done
const inStore = async (mode, work) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Aborted'));
  });
};

const ownerOf = (player, gameId) => `${player}:${gameId}`;

// Whether a run is one of the player's best: the server's word once it's checked, else the game's
const isBest = ({ run, check }) => (check?.state === 'checked' ? check.best === true : run.best && !check);

/**
 * A player's runs of a game, newest first: [{ key, endedAt, run, check }]
 * @param {string} player - their account id, or 'guest'
 * @param {string} gameId
 */
export const listRuns = async (player, gameId) => {
  const rows = await inStore('readonly', (store) => store.index('owner').getAll(ownerOf(player, gameId)));
  return (rows ?? []).sort((a, b) => b.endedAt - a.endedAt || b.key - a.key)
    .map(({ key, endedAt, run, check }) => ({ key, endedAt, run, check: check ?? null }));
};

/**
 * Keeps a run that just ended (from cleanRun), then lets go of the ones too old to keep (never one waiting to be
 * checked). Resolves to its key.
 * @param {object|null} check - see the top of this part
 */
export const keepRun = async (player, gameId, run, check = null) => {
  const owner = ownerOf(player, gameId);
  const key = await inStore('readwrite', (store) => store.add({ owner, endedAt: Date.now(), run, check }));
  const rows = await listRuns(player, gameId);
  const bests = rows.filter(isBest).slice(0, KEEP_BEST).map((row) => row.key);
  const kept = new Set([...rows.slice(0, KEEP_LATEST).map((row) => row.key), ...bests]);
  const old = rows.filter((row) => !kept.has(row.key) && row.check?.state !== 'waiting');
  if (old.length > 0) await inStore('readwrite', (store) => old.forEach((row) => store.delete(row.key)));
  runsChanged();
  return key;
};

/** A kept run's check changed (src/lib/checks.js) */
export const setRunCheck = async (key, check) => {
  await inStore('readwrite', (store) => {
    const request = store.get(key);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, check });
    };
    return request;
  });
  runsChanged();
};

/** A player's runs in every game that wait to be checked: [{ key, gameId, run }] */
export const waitingRuns = async (player) => {
  const rows = await inStore('readonly', (store) => store.getAll());
  return (rows ?? []).filter((row) => row.owner.startsWith(`${player}:`) && row.check?.state === 'waiting')
    .sort((a, b) => a.endedAt - b.endedAt)
    .map(({ key, owner, run }) => ({ key, gameId: owner.slice(player.length + 1), run }));
};

/** Deletes a player's runs of a game (resetting its progress) */
export const clearRuns = async (player, gameId) => {
  const rows = await listRuns(player, gameId);
  if (rows.length > 0) await inStore('readwrite', (store) => rows.forEach((row) => store.delete(row.key)));
  runsChanged();
};

/**
 * A player's runs of a game, newest first, read again whenever runs change (kept, checked, cleared)
 * @return {{ key: number, endedAt: number, run: object, check: object|null }[] | null} - null until read (or when this
 *   browser can't keep them)
 */
export const useRuns = (player, gameId) => {
  const [runs, setRuns] = useState({ owner: null, list: null });
  const changed = useSyncExternalStore(subscribe, () => version);
  const owner = player ? ownerOf(player, gameId) : null;
  useEffect(() => {
    if (!player) return undefined;
    let active = true;
    listRuns(player, gameId).then(
      (list) => active && setRuns({ owner: ownerOf(player, gameId), list }),
      () => active && setRuns({ owner: ownerOf(player, gameId), list: null }),
    );
    return () => {
      active = false;
    };
  }, [player, gameId, changed]);
  return runs.owner === owner ? runs.list : null;
};
