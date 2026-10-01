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
 *   hub → game: { type: 'gamehub:loaded', id, data } (data is null when the account has none),
 *               or { type: 'gamehub:loaded', id, error: true }
 * - game → hub: { type: 'gamehub:save', data }
 * - hub → game: { type: 'gamehub:reset' } (the game's help menu → Reset progress)
 *   game → hub: { type: 'gamehub:reset-done', ok }
 * Messages go only to GameHub's address (where this file came from), and only messages from the
 * GameHub page itself are read.
 */
(function () {
  const VERSION = 1;
  const LOAD_TIMEOUT = 10000; // ms (gamehub.js gives up on load() sooner anyway)

  const script = document.currentScript;
  const hub = window.parent;
  if (!script || hub === window || !window.GameHub) return;
  const hubOrigin = new URL(script.src).origin;

  // The game's id, from its gamehub.js tag: that file keeps the save in this browser under <id>GameData
  const game = document.querySelector('script[data-game]')?.dataset.game;

  let welcomed = false;
  let resetting = false; // Once progress is reset, nothing is saved until GameHub reloads the game
  let lastLoadId = 0;
  const loads = new Map(); // id → { resolve, reject, timer }

  function send(message) {
    hub.postMessage(message, hubOrigin);
  }

  // The account's save (null when it has none); rejects when GameHub can't read it
  function load() {
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

  function save(data) {
    if (!resetting) send({ type: 'gamehub:save', data });
  }

  // Clears this browser's save, and keeps it clear until GameHub reloads the game: a game may save
  // once more on its way out (Sudoku saves when its page is hidden). True if it's cleared.
  function reset() {
    resetting = true;
    if (!game) return false;
    const key = `${game}GameData`;
    try {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (name, value) {
        if (this === window.localStorage && String(name) === key) return;
        setItem.call(this, name, value);
      };
      localStorage.removeItem(key);
      return localStorage.getItem(key) === null;
    } catch (error) {
      return false;
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== hub || event.origin !== hubOrigin) return;
    const message = event.data;
    if (typeof message !== 'object' || message === null) return;

    if (message.type === 'gamehub:welcome' && message.version === VERSION && !welcomed) {
      welcomed = true;
      window.GameHub.attach({ version: VERSION, signedIn: message.signedIn === true, load, save });
    } else if (message.type === 'gamehub:loaded') {
      const pending = loads.get(message.id);
      if (!pending) return;
      loads.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) {
        pending.reject(new Error('GameHub could not read the save'));
      } else {
        pending.resolve(message.data ?? null);
      }
    } else if (message.type === 'gamehub:reset') {
      send({ type: 'gamehub:reset-done', ok: reset() });
    }
  });

  send({ type: 'gamehub:hello', version: VERSION });
})();
