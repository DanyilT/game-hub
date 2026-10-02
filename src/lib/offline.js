import { useSyncExternalStore } from 'react';

// ==========================================
// Offline play
// ==========================================
// - The site's own service worker (src/service-worker.js, built into /sw.js) keeps the app on the
//   device, so GameHub opens without a network. Production builds only: the dev server never has it.
// - A game is downloaded from its page in GameHub: the game's own service worker (sw.js in
//   DanyilT/dt-games) keeps its files, since a page's worker can't answer for a frame from another
//   site. GameHub's bridge does the downloading inside the game's page (public/hub-bridge.js).
// - Which games are downloaded is remembered here too (localStorage), for the games list: the hub
//   can't look into another site's storage. The game's page corrects it whenever it's opened.

/** Registers the site's service worker (production builds only) */
export const registerAppWorker = () => {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
    // No offline copy of the site this time; it works online as always
  });
};

// Online or not, kept up to date (the browser's own idea: "online" can still be a bad connection)
const subscribeOnline = (listener) => {
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
};

/** Whether the browser thinks it's online */
export const useOnline = () => useSyncExternalStore(subscribeOnline, () => navigator.onLine);

// The downloaded games: { [gameId]: true }
const DOWNLOADS_KEY = 'gamehub:downloads';
const readDownloads = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DOWNLOADS_KEY));
    return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
};

let downloads = readDownloads();
const listeners = new Set();

const subscribeDownloads = (listener) => {
  const onStorage = (e) => {
    if (e.key !== DOWNLOADS_KEY) return;
    downloads = readDownloads();
    listener();
  };
  listeners.add(listener);
  window.addEventListener('storage', onStorage); // downloaded or removed in another tab
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
};

/** The downloaded games, kept up to date: { [gameId]: true } */
export const useDownloads = () => useSyncExternalStore(subscribeDownloads, () => downloads);

/**
 * Records whether a game is downloaded (as its page reports it)
 * @param {string} gameId
 * @param {boolean} downloaded
 */
export const setDownloaded = (gameId, downloaded) => {
  if (Boolean(downloads[gameId]) === downloaded) return;
  const next = { ...downloads };
  if (downloaded) next[gameId] = true;
  else delete next[gameId];
  downloads = next;
  try {
    localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: the games list just won't know until the game's page is opened
  }
  listeners.forEach((listener) => listener());
};

/**
 * Asks the browser to keep the site's offline copy even when space runs low (best-effort: some
 * browsers ask the player, some decide by themselves)
 */
export const keepOfflineCopy = () => {
  navigator.storage?.persist?.().catch(() => {});
};
