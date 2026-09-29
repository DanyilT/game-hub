// Installing the site as an app: a PWA, described by public/manifest.json.
// - Chrome, Edge and Samsung Internet fire `beforeinstallprompt` once the site can be installed
//   (over HTTPS only) and the player has used it for a bit (a tap, and about 30 s). The site keeps
//   that event, and opens the browser's install dialog with it when the player asks: the sidebar's
//   "Install app", or the banner on the games page (phones).
// - Until then, and in browsers without the event (Firefox, Safari), phones and tablets get the
//   steps instead: the browser menu's "Add to Home screen" on Android, Share → Add to Home Screen
//   on iPhone and iPad. Computers get nothing until the event comes.
// The state lives outside React (components read it with useInstall()), because the event can
// fire before the app has rendered.

const DAY = 24 * 60 * 60 * 1000;
const GAMES_KEY = 'gamehub:games-opened';
const LATER_KEY = 'gamehub:install-later';
const INSTALLED_KEY = 'gamehub:installed';
// The banner waits until the player has opened this many games, and a "Not now" holds for a month
const GAMES_BEFORE_BANNER = 2;
const LATER_DAYS = 30;

// Storage can be unavailable (private mode, blocked site data): then nothing is remembered
const readNumber = (key) => {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // not remembered
  }
};

/**
 * Where installing works through steps in the browser's own menu: 'ios' (iPhone, iPad; iPadOS
 * says it's a Mac, but Macs have no touch screen), 'android', or null (a computer).
 * @param {string} userAgent
 * @param {number} maxTouchPoints
 * @return {'ios'|'android'|null}
 */
export const installPlatform = (userAgent, maxTouchPoints) => {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(userAgent)) return 'android';
  return null;
};

// Opened as the app. Remember that: on Android the app shares the browser's storage, so the browser
// stops offering it even after an install from its menu, which Firefox never reports (`appinstalled`
// is Chromium's). On iPhone and iPad the app's storage is its own, so Safari can't know.
const runningAsApp = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
if (runningAsApp) write(INSTALLED_KEY, Date.now());

let installPrompt = null; // the browser's install dialog, kept until the player asks for it
let state = {
  canPrompt: false, // the browser's install dialog is ready (Chromium, over HTTPS)
  platform: installPlatform(navigator.userAgent, navigator.maxTouchPoints), // steps work here
  // Running as the app, or installed from this browser before (remembered)
  installed: runningAsApp || readNumber(INSTALLED_KEY) > 0,
  stepsOpen: false, // the steps are showing
};
const listeners = new Set();

const update = (changes) => {
  state = { ...state, ...changes };
  listeners.forEach((listener) => listener());
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // no mini-infobar on Android: the site offers it at a better moment
  installPrompt = e;
  update({ canPrompt: true });
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  write(INSTALLED_KEY, Date.now());
  update({ canPrompt: false, installed: true });
});

export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** { canPrompt, platform, installed, stepsOpen }: the same object until something changes */
export const getInstallState = () => state;

/**
 * Whether to offer installing: the browser's dialog is ready (it's never ready once installed, so
 * that also covers someone who uninstalled), or a phone or tablet can follow the steps
 */
export const canInstall = ({ canPrompt, platform, installed }) => canPrompt || (!installed && platform !== null);

export const openInstallSteps = () => update({ stepsOpen: true });
export const closeInstallSteps = () => update({ stepsOpen: false });

/** "Not now": no banner for a month */
export const installLater = () => write(LATER_KEY, Date.now());

/** Counts the game pages opened: the banner waits for a game or two */
export const noteGameOpened = () => write(GAMES_KEY, readNumber(GAMES_KEY) + 1);

/** Whether the banner is due: a game or two opened, and no "Not now" in the last month */
export const bannerDue = () =>
  readNumber(GAMES_KEY) >= GAMES_BEFORE_BANNER && Date.now() - readNumber(LATER_KEY) > LATER_DAYS * DAY;

/** Opens the browser's install dialog if it's ready, or else the steps */
export const install = async () => {
  if (!installPrompt) {
    if (state.platform) openInstallSteps();
    return;
  }
  const event = installPrompt;
  installPrompt = null; // each event opens the dialog only once (the browser may offer it again later)
  update({ canPrompt: false });
  await event.prompt();
  const { outcome } = await event.userChoice; // 'accepted' (then `appinstalled` fires) or 'dismissed'
  if (outcome === 'dismissed') installLater();
};
