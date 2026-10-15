import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { canCheck, keepAndCheck, refillTickets, spendTicket, ticketsFor } from './checks';
import { cleanStatus } from './gameStatus';
import { keepOfflineCopy, setDownloaded } from './offline';
import { cleanRun, clearRuns } from './runs';
import { rpcWithKeepalive, supabase } from './supabase';

// ==========================================
// The game bridge, the hub page's side
// ==========================================
// A game in the hub runs public/hub-bridge.js inside its own page (its js/gamehub.js loads it), and
// that talks to this with postMessage. The list of messages is at the top of that file. This:
// - answers the game's hello with whether a player is signed in, and a name for them that means
//   nothing outside this game (the bridge keeps each player's copy of the save apart by it). The game
//   is reloaded when that changes, so it only needs to know at the start.
// - reads the player's save for the game (with when it was saved), and writes the game's saves to
//   their account: at most one every 10 seconds, and whatever's left when the page is hidden or left.
//   It tells the game when each save landed, so a game can tell progress made offline from the
//   account's (gamehub.js version 2).
// - resets the game's progress (its help menu): the browser's copy through the bridge, then the
//   account's
// - downloads the game to play offline, or removes the download (src/lib/offline.js)
// - notes when the player last pressed a key or tapped in the game (play time, src/lib/playTime.js)
// - for the panel under the game (gamehub.js version 3): takes the game's numbers, keeps each run it
//   finishes (src/lib/runs.js), and plays a run again in a game opened for that (GameHub.replaying)
// - hands a signed-in player's game their tickets (seeds the server chose, src/lib/checks.js), one for
//   each run, and sends each run played on one to be checked
// It only listens to the game's own frame, from the game's own address, and never gives the game
// the player's sign-in.

const VERSION = 1;
export const SAVE_LIMIT = 64 * 1024; // bytes of JSON, like js/gamehub.js (bigger saves stay in the browser)
const SAVE_INTERVAL = 10_000; // ms: at most one save per game this often
const MAX_RETRY_WAIT = 60_000; // ms: failed saves are tried again, less and less often, up to this
const RESET_TIMEOUT = 3000; // ms for the game's page to clear its copy
const DOWNLOAD_TIMEOUT = 60_000; // ms for the game's page to download (or remove) its copy

// Saves still waiting to go out, written before signing out (AuthContext) so none are lost
const flushers = new Set();
/** Sends every game's waiting save now */
export const flushSaves = () => Promise.allSettled([...flushers].map((flush) => flush()));

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The name the game's page knows a signed-in player by: a 53-bit hash (cyrb53) of their account and the
 * game, as 14 hex characters. The same every time, but it doesn't say who they are, nor ties them
 * across games. It only keeps players' copies apart, so it needn't be cryptographic (crypto.subtle
 * isn't there on plain-http pages, like the dev server on the local network).
 * @return {string}
 */
const playerName = (userId, gameId) => {
  const text = `${userId}:${gameId}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
};

/**
 * A save as JSON text, if it's something a game could have saved (an object JSON can hold) and not
 * over SAVE_LIMIT; otherwise null
 */
const saveJson = (data) => {
  if (!isPlainObject(data)) return null;
  try {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json).length <= SAVE_LIMIT ? json : null;
  } catch {
    return null;
  }
};

/** The player's own save for a game: { data, updated_at }, or null when there's none */
const readSave = async (gameId) => {
  const { data, error } = await supabase.from('game_saves').select('data, updated_at').eq('game_id', gameId).maybeSingle();
  if (error) throw error;
  return data;
};

/**
 * One game's saves on their way to the player's account: only the newest waiting save is kept,
 * writes go one at a time and at most every SAVE_INTERVAL, and a failed one is tried again later.
 */
class SaveQueue {
  /**
   * @param {string} gameId
   * @param {function} getToken - the signed-in player's access token, or null
   * @param {function} onChange - gets { saving, savedAt?, saveFailed? } as writes start and end
   * @param {function} onWritten - gets the save (as added) and when the account saved it, after each write
   */
  constructor(gameId, getToken, onChange, onWritten) {
    Object.assign(this, { gameId, getToken, onChange, onWritten });
    this.pending = null; // { json, seq, frame }
    this.timer = null;
    this.lastWrite = 0;
    this.failures = 0;
    this.chain = Promise.resolve();
    this.paused = false; // while a reset is under way, until the game reloads
  }

  /**
   * @param {string} json - the save
   * @param {number|null} seq - the game's number for it (gamehub.js version 2), to acknowledge
   * @param {object} frame - the <iframe> it came from: the acknowledgement goes only to that page
   */
  add(json, seq, frame) {
    if (this.paused) return;
    this.pending = { json, seq, frame };
    this.schedule();
  }

  // At the next free moment: SAVE_INTERVAL after the last write, longer after failures
  schedule() {
    if (this.timer) return;
    const interval = Math.min(MAX_RETRY_WAIT, SAVE_INTERVAL * 2 ** this.failures);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, Math.max(0, this.lastWrite + interval - Date.now()));
  }

  /** Writes the waiting save now, after any write already on its way. `keepalive` when the page may be closing. */
  flush({ keepalive = false } = {}) {
    clearTimeout(this.timer);
    this.timer = null;
    this.chain = this.chain.then(() => this.write(keepalive));
    return this.chain;
  }

  async write(keepalive) {
    const save = this.pending;
    const token = this.getToken();
    if (save === null || !token || this.paused) return;
    this.pending = null;
    this.lastWrite = Date.now();
    this.onChange({ saving: true });
    try {
      let savedAt;
      if (keepalive) {
        savedAt = await rpcWithKeepalive('save_game', `{"p_game":${JSON.stringify(this.gameId)},"p_data":${save.json}}`, token);
      } else {
        const { data, error } = await supabase.rpc('save_game', { p_game: this.gameId, p_data: JSON.parse(save.json) });
        if (error) throw error;
        savedAt = data;
      }
      this.failures = 0;
      this.onChange({ saving: false, savedAt: new Date(savedAt), saveFailed: false });
      this.onWritten(save, savedAt);
    } catch {
      // Tried again later, unless a newer save came in meanwhile (that one goes instead)
      if (this.pending === null && !this.paused) this.pending = save;
      this.failures += 1;
      this.onChange({ saving: false, saveFailed: true });
      if (this.pending !== null) this.schedule();
    }
  }

  /** Drops the waiting save and takes no more, once any write on its way has landed */
  async pause() {
    this.paused = true;
    this.pending = null;
    clearTimeout(this.timer);
    this.timer = null;
    await this.chain;
  }

  resume() {
    this.paused = false;
  }
}

// What the game's page says about downloading it: supported is null until it has answered
const OFFLINE_UNKNOWN = { supported: null, downloaded: false, busy: false, error: null, version: null, update: null };
// How the game's worker's check of its copy is going (hub-bridge.js): 'updated' is a newer copy than the page in the frame
const UPDATE_STATES = ['checking', 'current', 'updating', 'updated', 'failed', 'offline'];

const REPLAY_STATES = ['playing', 'paused', 'ended', 'error'];
const isTime = (value) => Number.isFinite(value) && value >= 0;

/**
 * Connects the hub page to the game in its frame.
 * @param {object} frameRef - the game's <iframe>
 * @param {string} gameId - the game the hub put in that frame (never what a message says). The page
 *   is keyed by game, so this doesn't change.
 * @param {string} origin - the game's own origin (its embed URL's): only its messages count
 * @param {object|null} session - the signed-in player's session (AuthContext), null for guests
 * @param {object|null} replay - { run, speed, key } while the frame holds a game opened to play that
 *   run (a new key for each time it's played); null for a game to play
 * @return {{ frameKey: number, connected: boolean, gameVersion: number, playable: boolean, saving: boolean,
 *   savedAt: Date|null, saveFailed: boolean, offline: object, setDownload: function,
 *   reloadGame: function, resetProgress: function, activity: object, gameStatus: object|null,
 *   replayState: object|null, controlReplay: function }} - frameKey changes when
 *   the game has to start again (a key for its <iframe>); gameVersion is its gamehub.js version (1 to
 *   3, once connected); playable, whether it says when it's on screen and ready (gamehub:playable, read by
 *   GamePage.jsx); offline is { supported, downloaded, busy, error, version, update } (see OFFLINE_UNKNOWN);
 *   activity.current is when the player last pressed a key or tapped in the game (Date.now(), 0
 *   before they have); gameStatus is what the game says its panel shows (src/lib/gameStatus.js);
 *   replayState is { state, position, length } of a replay under way
 */
export const useGameBridge = ({ frameRef, gameId, origin, session, replay = null }) => {
  const signedIn = Boolean(session);
  const userId = session?.user?.id ?? null;
  const activity = useRef(0);
  const [frameKey, setFrameKey] = useState(0);
  const [status, setStatus] = useState({
    connected: false, gameVersion: 1, playable: false, saving: false, savedAt: null, saveFailed: false,
  });
  const [offline, setOffline] = useState(OFFLINE_UNKNOWN);
  const [gameStatus, setGameStatus] = useState(null);
  const [replayState, setReplayState] = useState(null);
  const replayRef = useRef(replay);
  const playerRef = useRef(userId ?? 'guest'); // whose runs the game's runs are
  const sessionRef = useRef(session);
  const connectedRef = useRef(false);
  const resetReplyRef = useRef(null); // resolves a reset waiting for the game's page
  const downloadTimerRef = useRef(null);
  const [queue] = useState(() => new SaveQueue(
    gameId,
    () => sessionRef.current?.access_token ?? null,
    (changes) => setStatus((previous) => ({ ...previous, ...changes })),
    // The game hears that its save landed, if it numbered it and its page is still the one in the frame
    ({ seq, frame }, updatedAt) => {
      if (seq !== null && frame === frameRef.current && connectedRef.current) {
        frame.contentWindow?.postMessage({ type: 'gamehub:synced', seq, updatedAt }, origin);
      }
    },
  ));

  useLayoutEffect(() => {
    sessionRef.current = session;
    replayRef.current = replay;
    playerRef.current = userId ?? 'guest';
  });

  // Hands the game in the frame the player's tickets for it: the ones kept in this browser at once, then a fresh list
  // once topped up from the server, when online (only that, when none are kept: a game that starts a run as it loads
  // waits for the first list)
  const handTickets = useCallback(async (reply) => {
    const player = sessionRef.current?.user?.id;
    if (!player) return;
    const send = (list) => reply({ type: 'gamehub:tickets', tickets: list.map(({ id, seed }) => ({ id, seed })) });
    const kept = canCheck(gameId) ? ticketsFor(player, gameId) : [];
    const online = navigator.onLine && canCheck(gameId);
    if (kept.length > 0 || !online) send(kept);
    if (!online) return;
    try {
      send(await refillTickets(player, gameId));
    } catch {
      if (kept.length === 0) send(kept); // the server can't be reached: none, then
    }
  }, [gameId]);

  // The game's messages
  useEffect(() => {
    const onMessage = (event) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow || event.origin !== origin) return;
      const message = event.data;
      if (!isPlainObject(message)) return;
      const reply = (answer) => frame.contentWindow?.postMessage(answer, origin);

      switch (message.type) {
        case 'gamehub:hello': {
          if (message.version !== VERSION) return;
          connectedRef.current = true;
          queue.resume(); // a fresh page (a reset reloads the game)
          const gameVersion = message.game >= 3 ? 3 : (message.game === 2 ? 2 : 1);
          // Whether the game says when it's playable (gamehub:playable, to GamePage.jsx)
          setStatus((previous) => ({ ...previous, connected: true, gameVersion, playable: message.playable === true }));
          reply({ type: 'gamehub:welcome', version: VERSION, signedIn, player: userId ? playerName(userId, gameId) : null });
          reply({ type: 'gamehub:offline', action: 'status' }); // is it downloaded?
          // A game opened for a replay plays it (the bridge holds it until the game is ready); a game to play gets the
          // player's tickets
          const wanted = replayRef.current;
          if (wanted) reply({ type: 'gamehub:replay', action: 'play', run: wanted.run, speed: wanted.speed });
          else if (gameVersion === 3 && signedIn) handTickets(reply);
          return;
        }
        case 'gamehub:load':
          if (!signedIn || !Number.isSafeInteger(message.id)) return;
          readSave(gameId).then(
            (row) => {
              if (row) setStatus((previous) => ({ ...previous, savedAt: new Date(row.updated_at) }));
              reply({ type: 'gamehub:loaded', id: message.id, data: row?.data ?? null, updatedAt: row?.updated_at ?? null });
            },
            () => reply({ type: 'gamehub:loaded', id: message.id, error: true }),
          );
          return;
        case 'gamehub:save': {
          if (!signedIn) return;
          const json = saveJson(message.data);
          if (json !== null) queue.add(json, Number.isSafeInteger(message.seq) ? message.seq : null, frame);
          return;
        }
        case 'gamehub:reset-done':
          resetReplyRef.current?.(message.ok === true);
          return;
        case 'gamehub:active':
          activity.current = Date.now();
          return;
        case 'gamehub:status':
          setGameStatus(cleanStatus(message.status));
          return;
        case 'gamehub:run-start': {
          // A run took one of the player's tickets: it's spent, and the game gets more when online
          const player = sessionRef.current?.user?.id;
          if (!player || replayRef.current || typeof message.ticket !== 'string') return;
          spendTicket(player, gameId, message.ticket).then(() => {
            if (navigator.onLine) handTickets(reply);
          });
          return;
        }
        case 'gamehub:run': {
          // A game it played, kept with this player's runs, and checked when it was played on a ticket (none come from
          // a replay)
          const run = cleanRun(message.run);
          if (!run || replayRef.current) return;
          keepAndCheck(signedIn ? sessionRef.current : null, gameId, run).catch(() => {});
          return;
        }
        case 'gamehub:replay-state':
          if (!replayRef.current || !REPLAY_STATES.includes(message.state) || !isTime(message.position) || !isTime(message.length)) return;
          setReplayState({ state: message.state, position: Math.min(message.position, message.length), length: message.length });
          return;
        case 'gamehub:offline-state': {
          const supported = message.supported === true;
          const downloaded = supported && message.downloaded === true;
          const copy = {
            version: downloaded && typeof message.version === 'string' ? message.version : null,
            update: downloaded && UPDATE_STATES.includes(message.update) ? message.update : null,
          };
          if (message.worker === true) {
            // The game's worker checking its copy, as it goes: not the answer to anything asked
            setOffline((previous) => ({ ...previous, supported, downloaded, ...copy }));
          } else {
            clearTimeout(downloadTimerRef.current);
            setOffline({ supported, downloaded, busy: false, error: typeof message.error === 'string' ? message.error : null, ...copy });
          }
          setDownloaded(gameId, downloaded); // for the games list
          return;
        }
        default:
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frameRef, origin, gameId, signedIn, userId, queue, handTickets]);

  // A new frame (after signing in or out, or a reset, or for a replay or back from one) starts out
  // unconnected. The game's numbers stay until the new page sends its own, so the panel doesn't
  // blink.
  const replayKey = replay?.key ?? null;
  useEffect(() => {
    connectedRef.current = false;
    setStatus((previous) => ({ ...previous, connected: false, playable: false }));
    setOffline(OFFLINE_UNKNOWN);
    setReplayState(null);
  }, [frameKey, signedIn, replayKey]);

  // Nothing waiting is lost: it goes out when the page is hidden or closed (it may not come back),
  // before signing out, and when leaving the game for another page of the hub
  useEffect(() => {
    const flush = () => queue.flush();
    const onHide = () => {
      if (document.visibilityState === 'hidden') queue.flush({ keepalive: true });
    };
    const onPageHide = () => queue.flush({ keepalive: true });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    flushers.add(flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      flushers.delete(flush);
      queue.flush();
    };
  }, [queue]);

  useEffect(() => () => clearTimeout(downloadTimerRef.current), []);

  /**
   * Downloads the game to play offline, or removes the download. The game's page does it, and
   * answers with its new state (offline).
   * @param {boolean} download
   */
  const setDownload = useCallback((download) => {
    const target = frameRef.current?.contentWindow;
    if (!target || !connectedRef.current) return;
    if (download) keepOfflineCopy();
    setOffline((previous) => ({ ...previous, busy: true, error: null }));
    clearTimeout(downloadTimerRef.current);
    downloadTimerRef.current = setTimeout(() => {
      setOffline((previous) => ({ ...previous, busy: false, error: 'failed' }));
    }, DOWNLOAD_TIMEOUT);
    target.postMessage({ type: 'gamehub:offline', action: download ? 'download' : 'remove' }, origin);
  }, [frameRef, origin]);

  /** Starts the game again (e.g. back online: it reconnects, and its progress goes up) */
  const reloadGame = useCallback(() => setFrameKey((key) => key + 1), []);

  /**
   * Pauses or resumes the replay under way, or changes its speed
   * @param {object} command - { action: 'pause' } | { action: 'resume' } | { action: 'speed', speed: 1 | 2 | 4 }
   */
  const controlReplay = useCallback((command) => {
    const target = frameRef.current?.contentWindow;
    if (target && connectedRef.current && replayRef.current) target.postMessage({ type: 'gamehub:replay', ...command }, origin);
  }, [frameRef, origin]);

  // Asks the game's page to clear its copy; resolves to whether it did
  const clearGameCopy = useCallback(() => new Promise((resolve) => {
    const target = frameRef.current?.contentWindow;
    if (!target || !connectedRef.current) {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => {
      resetReplyRef.current = null;
      resolve(false);
    }, RESET_TIMEOUT);
    resetReplyRef.current = (ok) => {
      clearTimeout(timer);
      resetReplyRef.current = null;
      resolve(ok);
    };
    target.postMessage({ type: 'gamehub:reset' }, origin);
  }), [frameRef, origin]);

  /**
   * Resets the game's progress: this browser's copy (through the game's page), then the account's,
   * then reloads the game so it starts afresh. The browser's copy goes first: signed in, a copy left
   * behind would go straight back up to the account. The player's runs of the game go too.
   * Throws an error with code 'game' when the game's page couldn't clear its copy, or Supabase's
   * error when the account's copy couldn't be deleted. Either way nothing is reset: in the second
   * case the reloaded game gets the account's copy back.
   */
  const resetProgress = useCallback(async () => {
    await queue.pause(); // a save already on its way lands before the delete, not after it
    let cleared = false;
    try {
      cleared = await clearGameCopy();
      if (!cleared) throw Object.assign(new Error("The game couldn't clear its progress"), { code: 'game' });
      if (signedIn) {
        const { error } = await supabase.rpc('delete_game_save', { p_game: gameId });
        if (error) throw error;
        setStatus((previous) => ({ ...previous, savedAt: null, saveFailed: false }));
      }
      await clearRuns(playerRef.current, gameId).catch(() => {}); // a browser that can't keep runs has none
    } finally {
      // The cleared page keeps nothing from now on, so the game starts again either way
      if (cleared) setFrameKey((key) => key + 1);
      else queue.resume();
    }
  }, [queue, clearGameCopy, gameId, signedIn]);

  return { frameKey, ...status, offline, setDownload, reloadGame, resetProgress, activity, gameStatus, replayState, controlReplay };
};
