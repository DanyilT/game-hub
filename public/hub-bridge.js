/**
 * GameHub's bridge, running inside a game's page
 *
 * A game's js/gamehub.js (DanyilT/dt-games) adds this script when the game is in a frame on GameHub,
 * from GameHub's own address (https://gamehub.foo/hub-bridge.js). It talks to the
 * GameHub page around the game with postMessage, and attaches to the game's window.GameHub, so the
 * game's saves reach the player's account. The game never sees the player's sign-in.
 *
 * The messages (the hub page's side is src/lib/gameBridge.js):
 * - game → hub: { type: 'gamehub:hello', version: 1, game, playable } (game: its gamehub.js version, 1 to 3, a newer
 *   one counting as 3; playable: whether it sends gamehub:playable, below)
 *   hub → game: { type: 'gamehub:welcome', version: 1, signedIn, player } (player: a name for the
 *   signed-in account that means nothing outside this game, or null for a guest; see "Whose copy")
 * - game → hub: { type: 'gamehub:load', id }
 *   hub → game: { type: 'gamehub:loaded', id, data, updatedAt } (both null when the account has none),
 *               or { type: 'gamehub:loaded', id, error: true }
 * - game → hub: { type: 'gamehub:save', data, seq } (seq numbers the game's saves; older games send none)
 *   hub → game: { type: 'gamehub:synced', seq, updatedAt } once save `seq` is in the account
 * - hub → game: { type: 'gamehub:reset' } (the game's help menu → Reset progress)
 *   game → hub: { type: 'gamehub:reset-done', ok }
 * - hub → game: { type: 'gamehub:offline', action: 'status' | 'download' | 'remove' } (Download on the
 *   game's page in GameHub)
 *   game → hub: { type: 'gamehub:offline-state', supported, downloaded, error } (error: 'unavailable'
 *   when the game can't be downloaded yet, 'failed' when it didn't work)
 * - game → hub: { type: 'gamehub:active' } when the player presses a key or taps in the game (at most
 *   every 10 seconds): GameHub counts play time only while they do (src/lib/playTime.js). Not in a
 *   replay: watching isn't playing.
 * The panel under the game (gamehub.js version 3; GameHub's side is src/components/layout/game/GameProgress):
 * - game → hub: { type: 'gamehub:status', status } (the game's numbers: GameHub.status())
 * - game → hub: { type: 'gamehub:run', run } when a game ends (GameHub keeps it, to watch again, and
 *   checks it on its server when it was played on a ticket)
 * - hub → game: { type: 'gamehub:tickets', tickets } for a signed-in player: [{ id, seed }], seeds the
 *   server chose (src/lib/checks.js), one per run (an empty list when there are none)
 *   game → hub: { type: 'gamehub:run-start', ticket } as a run starts (ticket: its id, or null)
 * - hub → game: { type: 'gamehub:replay', action: 'play', run, speed } | { …, action: 'pause' | 'resume' }
 *   | { …, action: 'speed', speed }, in a game GameHub opened with #gamehub-replay (GameHub.replaying)
 *   game → hub: { type: 'gamehub:replay-state', state, position, length } ('playing', 'paused',
 *   'ended' or 'error'; how far it has got, in ms of the game's time)
 * These go between the GameHub page and the game's own gamehub.js, not through this file (GamePage.jsx); the frame has
 * `allowFullScreen`, for a game's own full-screen button (Minesweeper's □):
 * - hub → game: { type: 'gamehub:center' } after a load and when the frame changes size, for games with
 *   `dimensions.center`: the game scrolls its play area (data-play-area) to the middle of the frame
 * - hub → game: { type: 'gamehub:view', view: 'frame' | 'full' } after each load and when the frame goes
 *   in or out of full screen: in the frame, the game shows only what's needed to play; full screen, its
 *   whole page (gamehub.js puts it in data-gamehub-view on the game's <html>)
 * - game → hub: { type: 'gamehub:playable' } once per load, when the game is on screen and ready (a replay: once it's
 *   hooked up). GameHub covers the frame with "Loading…" until then; for games whose hello doesn't say `playable`,
 *   until the frame's load, and never more than 6 s after it.
 * - game → hub: { type: 'gamehub:fullscreen', full } when the game's own full screen (GameHub.fullScreen) needs
 *   GameHub: full: false, to leave the full screen GameHub put the frame in (only GameHub can); full: true, when the
 *   browser refused the game's own request, so GameHub asks for the frame
 * - hub → game: { type: 'gamehub:pause' } when the player can't see or reach the game: the frame scrolled mostly out
 *   of view, a GameHub window or sheet over it, or before the frame is replaced (a replay, a reload). Games that move
 *   by themselves pause (and save); the others ignore it. Safe to send any time.
 * And one from this file that the game page reads itself (GamePage.jsx, not gameBridge.js):
 * - game → hub: { type: 'gamehub:fullscreen-key' } when F is pressed in the game (not while typing in a text field):
 *   GameHub's page has F for full screen on or off, but keys pressed in the game reach only the game. The browser
 *   counts the key press for GameHub's page too, so it can still go full screen (Chrome; Safari may refuse).
 * Messages go only to GameHub's address (where this file came from), and only messages from the
 * GameHub page itself are read.
 *
 * gamehub.js version 2 (GameHub.version) keeps progress made offline: its load() gets the account's
 * save with when it was saved, and it hears when each save reaches the account. Version 1 games get
 * the save alone, as before.
 *
 * Downloading: the game's own service worker (sw.js, next to its index.html: the same file in every
 * game) answers with the copy this script keeps in the game's storage when there's no network. Only
 * games with gamehub.js version 2 have it.
 *
 * Whose copy: gamehub.js keeps one save in this browser (<id>GameData, and <id>GameSync), whoever is
 * playing. So that one player's progress never shows for another, nor goes up to their account, this
 * script keeps a copy per player: before the game reads its save, it puts the copy there aside under
 * its owner's name (<key>@<owner>) and brings back the current player's own, if they have one. The
 * owner is the welcome's player, or 'guest' (<id>GameOwner says whose copy is out). A guest's progress
 * stays the guest's: it never goes up to an account. Copies from before this have no owner: one that
 * never came from an account is the guest's, and one that did is the signed-in player's only when it
 * carries on from their account's save (otherwise it's set aside as 'earlier').
 */
(function () {
  const VERSION = 1;
  const LOAD_TIMEOUT = 10000; // ms (gamehub.js gives up on load() sooner anyway)
  const OFFLINE_CACHE = 'gamehub-offline'; // the name sw.js reads
  const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com']; // kept with a game that uses Google Fonts

  const script = document.currentScript;
  const hub = window.parent;
  if (!script || hub === window || !window.GameHub) return;
  const hubOrigin = new URL(script.src).origin;
  // A newer gamehub.js than this bridge knows is treated as the newest it does (3), so games can move on first
  const gameVersion = window.GameHub.version >= 3 ? 3 : (window.GameHub.version === 2 ? 2 : 1);
  const replaying = window.GameHub.replaying === true; // GameHub opened the game to play a replay

  // The game's id, from its gamehub.js tag: that file keeps the save in this browser under <id>GameData,
  // and (version 2) where it stands against the account under <id>GameSync
  const game = document.querySelector('script[data-game]')?.dataset.game;

  let welcomed = false;
  let gamePort = null; // version 2 on: how to tell the game a save reached the account (and, 3, the replay's controls)
  let waitingReplay = []; // what GameHub asked of the replay before the game attached
  let waitingTickets = null; // tickets GameHub sent before the game attached
  let resetting = false; // Once progress is reset, nothing is saved until GameHub reloads the game
  let lastLoadId = 0;
  const loads = new Map(); // id → { resolve, reject, timer }
  let earlyLoad = null; // the account's save, read before the game asks (to sort the copies)

  function send(message) {
    hub.postMessage(message, hubOrigin);
  }

  // The account's save: { data, updatedAt }, or null when it has none; rejects when GameHub can't read it
  function loadSave() {
    return new Promise((resolve, reject) => {
      const id = ++lastLoadId;
      const timer = setTimeout(() => {
        loads.delete(id);
        reject(new Error('GameHub did not answer'));
      }, LOAD_TIMEOUT);
      loads.set(id, { resolve, reject, timer });
      send({ type: 'gamehub:load', id });
    });
  }

  // For the game: the account's save, the one already read for sorting the copies if there is one
  function loadForGame() {
    const pending = earlyLoad ?? loadSave();
    earlyLoad = null;
    return pending;
  }

  function save(data, seq) {
    if (!resetting) send({ type: 'gamehub:save', data, seq });
  }

  // Whose copy (see the top of this file)
  const dataKeys = game ? [`${game}GameData`, `${game}GameSync`] : [];
  const ownerKey = `${game}GameOwner`;

  // When the copy out was last in step with the account (gamehub.js version 2's GameSync), or null
  function copyBase(suffix = '') {
    try {
      const base = JSON.parse(localStorage.getItem(`${game}GameSync${suffix}`))?.base;
      return typeof base === 'string' ? base : null;
    } catch (error) {
      return null;
    }
  }

  // Puts the copy out aside under its owner's name (an empty one clears theirs)
  function putAside(owner) {
    for (const key of dataKeys) {
      const value = localStorage.getItem(key);
      if (value === null) localStorage.removeItem(`${key}@${owner}`);
      else localStorage.setItem(`${key}@${owner}`, value);
      localStorage.removeItem(key);
    }
  }

  // Brings back an owner's copy put aside, if there is one
  function bringBack(owner) {
    for (const key of dataKeys) {
      const value = localStorage.getItem(`${key}@${owner}`);
      if (value !== null) localStorage.setItem(key, value);
      localStorage.removeItem(`${key}@${owner}`);
    }
  }

  // Makes the copy out the current player's (me: their player name, or 'guest')
  async function sortCopies(me, signedIn) {
    let owner = localStorage.getItem(ownerKey);
    if (owner === null && localStorage.getItem(dataKeys[0]) !== null) owner = copyBase() ? 'earlier' : 'guest';
    if (owner !== null && owner !== me) {
      // An earlier copy from an account is this player's when it carries on from their account's save
      if (owner === 'earlier' && signedIn) {
        earlyLoad ??= loadSave();
        const account = await earlyLoad.catch(() => null);
        if (account?.updatedAt && account.updatedAt === copyBase()) owner = me;
      }
      if (owner !== me) {
        putAside(owner);
        bringBack(me);
      }
    }
    // Or one set aside earlier, when this player has none of their own here
    if (signedIn && localStorage.getItem(dataKeys[0]) === null && localStorage.getItem(`${dataKeys[0]}@earlier`) !== null) {
      earlyLoad ??= loadSave();
      const account = await earlyLoad.catch(() => null);
      if (account?.updatedAt && account.updatedAt === copyBase('@earlier')) bringBack('earlier');
    }
    localStorage.setItem(ownerKey, me);
  }

  // Clears this browser's save, and keeps it clear until GameHub reloads the game: a game may save
  // once more on its way out (Sudoku saves when its page is hidden). True if it's cleared.
  function reset() {
    resetting = true;
    if (!game) return false;
    const keys = [`${game}GameData`, `${game}GameSync`];
    try {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === window.localStorage && keys.includes(String(name))) return;
        setItem.call(this, name, value);
      };
      keys.forEach((key) => localStorage.removeItem(key));
      return keys.every((key) => localStorage.getItem(key) === null);
    } catch (error) {
      return false;
    }
  }

  // Downloading the game: its files go into OFFLINE_CACHE, and its sw.js answers from there offline
  const offlineSupported = gameVersion >= 2 && 'serviceWorker' in navigator && 'caches' in window;

  async function offlineState() {
    if (!offlineSupported) return { supported: false, downloaded: false };
    const [registration, saved] = await Promise.all([navigator.serviceWorker.getRegistration(), caches.has(OFFLINE_CACHE)]);
    return { supported: true, downloaded: Boolean(registration) && saved };
  }

  async function download() {
    const worker = new URL('sw.js', location.href);
    const check = await fetch(worker, { method: 'HEAD', cache: 'no-store' });
    if (!check.ok) throw Object.assign(new Error('This game has no sw.js'), { code: 'unavailable' });

    // Everything the page has loaded: it's all loaded by now, since the player is playing
    const files = new Set([location.href.split('#')[0]]);
    for (const { name } of performance.getEntriesByType('resource')) {
      const url = new URL(name);
      if (url.origin === location.origin || FONT_HOSTS.includes(url.hostname)) files.add(url.href.split('#')[0]);
    }
    const cache = await caches.open(OFFLINE_CACHE);
    await Promise.all([...files].map(async (file) => {
      const response = await fetch(file, { cache: 'no-cache' });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      await cache.put(file, response);
    }));
    await navigator.serviceWorker.register(worker);
  }

  async function removeDownload() {
    const registration = await navigator.serviceWorker.getRegistration();
    await Promise.all([registration?.unregister(), caches.delete(OFFLINE_CACHE)]);
  }

  async function offline(action) {
    if (!offlineSupported) return { supported: false, downloaded: false, error: gameVersion >= 2 ? null : 'unavailable' };
    try {
      if (action === 'download') await download();
      if (action === 'remove') await removeDownload();
      return { ...(await offlineState()), error: null };
    } catch (error) {
      if (action === 'download') await caches.delete(OFFLINE_CACHE).catch(() => {}); // no half copies
      return { ...(await offlineState().catch(() => ({ supported: true, downloaded: false }))), error: error.code ?? 'failed' };
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== hub || event.origin !== hubOrigin) return;
    const message = event.data;
    if (typeof message !== 'object' || message === null) return;

    if (message.type === 'gamehub:welcome' && message.version === VERSION && !welcomed) {
      welcomed = true;
      const signedIn = message.signedIn === true;
      const attach = () => {
        if (gameVersion >= 2) {
          const adapter = { version: gameVersion, signedIn, load: loadForGame, save };
          if (gameVersion === 3) {
            // GameHub's panel: the game's numbers, its finished runs, and how a replay is going
            adapter.status = (status) => send({ type: 'gamehub:status', status });
            adapter.run = (run) => send({ type: 'gamehub:run', run });
            adapter.runStart = (start) => send({ type: 'gamehub:run-start', ticket: start?.ticket ?? null });
            adapter.replayState = (state) => send({ type: 'gamehub:replay-state', ...state });
          }
          const port = window.GameHub.attach(adapter);
          gamePort = typeof port === 'object' && port !== null ? port : null;
          if (waitingTickets) gamePort?.tickets?.(waitingTickets);
          waitingTickets = null;
          waitingReplay.forEach((command) => gamePort?.replay?.(command));
          waitingReplay = null;
        } else {
          // Version 1 games take the save alone
          window.GameHub.attach({
            version: 1, signedIn, load: () => loadForGame().then((saved) => saved?.data ?? null), save: (data) => save(data),
          });
        }
      };
      // The copies are sorted first, since the game reads its save once attached (an older GameHub
      // page names no player: then they're left as they are). Storage that can't be used has nothing
      // to sort.
      const player = typeof message.player === 'string' && message.player ? message.player : null;
      const sorting = game && 'player' in message ? sortCopies(signedIn && player ? player : 'guest', signedIn && Boolean(player)) : null;
      Promise.resolve(sorting).catch(() => {}).then(attach);
    } else if (message.type === 'gamehub:loaded') {
      const pending = loads.get(message.id);
      if (!pending) return;
      loads.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error('GameHub could not read the save'));
      } else {
        pending.resolve(message.data == null ? null : { data: message.data, updatedAt: message.updatedAt ?? null });
      }
    } else if (message.type === 'gamehub:synced') {
      gamePort?.synced?.(message.seq, message.updatedAt);
    } else if (message.type === 'gamehub:reset') {
      send({ type: 'gamehub:reset-done', ok: reset() });
    } else if (message.type === 'gamehub:offline' && ['status', 'download', 'remove'].includes(message.action)) {
      offline(message.action).then((state) => send({ type: 'gamehub:offline-state', ...state }));
    } else if (message.type === 'gamehub:tickets' && Array.isArray(message.tickets)) {
      if (waitingReplay) waitingTickets = message.tickets; // the game isn't attached yet: the newest list waits
      else gamePort?.tickets?.(message.tickets);
    } else if (message.type === 'gamehub:replay' && replaying) {
      const command = { action: message.action, run: message.run, speed: message.speed };
      if (waitingReplay) waitingReplay.push(command); // the game isn't attached yet
      else gamePort?.replay?.(command);
    }
  });

  // The player pressing a key or tapping in the game (or moving the pointer over it): said at most
  // every 10 seconds, and never in a replay
  let lastActive = 0;
  const onInput = () => {
    const now = Date.now();
    if (replaying || now - lastActive < 10000) return;
    lastActive = now;
    send({ type: 'gamehub:active' });
  };
  for (const type of ['keydown', 'pointerdown', 'pointermove', 'touchstart', 'wheel']) {
    window.addEventListener(type, onInput, { capture: true, passive: true });
  }

  // F: GameHub's full screen, on or off (the game's own keys go first: one it used stays its own). Not while typing in
  // a text field; a number field (Sudoku's cells) never types an F, so it goes up from there.
  const typing = (target) => target instanceof Element && (
    target.closest('textarea, select, [contenteditable]:not([contenteditable="false"])')
    || (target.matches('input') && !['number', 'checkbox', 'radio', 'range', 'button', 'submit', 'reset'].includes(target.type))
  );
  window.addEventListener('keydown', (event) => {
    if (event.key?.toLowerCase() !== 'f' || event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (event.defaultPrevented || typing(event.target)) return;
    send({ type: 'gamehub:fullscreen-key' });
  });

  // `playable`: the game says when it's on screen and ready (gamehub:playable), so GameHub covers the frame until then
  send({ type: 'gamehub:hello', version: VERSION, game: gameVersion, playable: typeof window.GameHub.playable === 'function' });
})();
