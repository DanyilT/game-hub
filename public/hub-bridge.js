/**
 * GameHub's bridge, running inside a game's page
 *
 * A game's js/gamehub.js (DanyilT/dt-games) adds this script when the game is in a frame on GameHub,
 * from GameHub's own address (e.g. https://game-hub.danyt.workers.dev/hub-bridge.js). It talks to the
 * GameHub page around the game with postMessage, and attaches to the game's window.GameHub, so the
 * game's saves reach the player's account. The game never sees the player's sign-in.
 *
 * The messages (the hub page's side is src/lib/gameBridge.js):
 * - game → hub: { type: 'gamehub:hello', version: 1 }
 *   hub → game: { type: 'gamehub:welcome', version: 1, signedIn }
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
  const gameVersion = window.GameHub.version === 2 ? 2 : 1;

  // The game's id, from its gamehub.js tag: that file keeps the save in this browser under <id>GameData,
  // and (version 2) where it stands against the account under <id>GameSync
  const game = document.querySelector('script[data-game]')?.dataset.game;

  let welcomed = false;
  let gamePort = null; // version 2: how to tell the game a save reached the account
  let resetting = false; // Once progress is reset, nothing is saved until GameHub reloads the game
  let lastLoadId = 0;
  const loads = new Map(); // id → { resolve, reject, timer }

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

  function save(data, seq) {
    if (!resetting) send({ type: 'gamehub:save', data, seq });
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
  const offlineSupported = gameVersion === 2 && 'serviceWorker' in navigator && 'caches' in window;

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
    if (!offlineSupported) return { supported: false, downloaded: false, error: gameVersion === 2 ? null : 'unavailable' };
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
      if (gameVersion === 2) {
        const port = window.GameHub.attach({ version: 2, signedIn, load: loadSave, save });
        gamePort = typeof port === 'object' && port !== null ? port : null;
      } else {
        // Version 1 games take the save alone
        window.GameHub.attach({
          version: 1, signedIn, load: () => loadSave().then((saved) => saved?.data ?? null), save: (data) => save(data),
        });
      }
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
    }
  });

  send({ type: 'gamehub:hello', version: VERSION });
})();
