import { useEffect } from 'react';
import { MemoryRouter } from 'react-router';
import ConfirmDialog from '../../../src/components/common/ConfirmDialog/ConfirmDialog';
import Toasts from '../../../src/components/common/Toasts/Toasts';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { LibraryProvider } from '../../../src/contexts/LibraryContext';
import { answerQuestion } from '../../../src/lib/confirm';
import { setDownloaded } from '../../../src/lib/offline';
import { setPreference } from '../../../src/lib/preferences';
import { dismissToast, getToasts, showToast } from '../../../src/lib/toast';
import { ME } from '../mocks/data';
import { GAME_DEFAULTS, scenario, setScenario } from '../mocks/scenario';
import { applyScenario } from '../mocks/supabase';

// The decorator every story is drawn in: it sets the scenario from the toolbar (globals) and the story
// (parameters.scenario, and its controls through it), then draws the story inside the site's router and
// its two contexts, as src/index.jsx does. A new scenario draws everything afresh.

// The browser's online state follows the toolbar's Network (the site reads navigator.onLine)
Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => scenario.network !== 'offline' });

// An Android device, when the story asks for one (scenario.device): store apps get Play, which tries the app
// (src/lib/nativeApps.js reads the platform from navigator.userAgentData, or the user agent)
const realAgent = { data: window.navigator.userAgentData, text: window.navigator.userAgent };
const ANDROID_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36';
Object.defineProperty(window.navigator, 'userAgentData', {
  configurable: true,
  get: () => (scenario.device === 'android' ? { platform: 'Android', mobile: true, brands: [] } : realAgent.data),
});
Object.defineProperty(window.navigator, 'userAgent', {
  configurable: true,
  get: () => (scenario.device === 'android' ? ANDROID_AGENT : realAgent.text),
});

// What the site keeps in this browser, cleared for every story (preferences are set from the toolbar)
const STORED_KEYS = [
  'gamehub:tickets', 'gamehub:tickets-taken', 'gamehub:downloads', 'gamehub:play-time', 'gamehub:sidebar-expanded',
  'gamehub:controls-expanded', 'gamehub:favorites-public-seen', 'gamehub:games-opened', 'gamehub:install-later',
];

/**
 * A story's scenario, from the toolbar and the story: parameters.scenario is an object, or a function of the
 * story's controls (args) and the toolbar (globals). Its extras, besides scenario.js's keys:
 * - tickets: { [gameId]: how many } kept in this browser for the signed-in player (offline play)
 * - downloads: game ids downloaded to play offline
 * - playTime: { [gameId]: seconds } a guest has played (kept in the browser)
 * - toast: { text, tone } a message at the bottom of the screen
 * - storage: { key: value } anything else to put in localStorage
 */
const scenarioFor = ({ globals, parameters, args }) => {
  const extra = typeof parameters.scenario === 'function' ? parameters.scenario(args, globals) : parameters.scenario ?? {};
  return {
    account: globals.account,
    network: globals.network,
    server: globals.server,
    nav: globals.nav,
    emailSignIn: false,
    privacy: {},
    install: { canPrompt: false, platform: null, installed: false, stepsOpen: false, bannerDue: false },
    device: null,
    ...extra,
    game: { ...GAME_DEFAULTS, ...extra.game },
  };
};

const writeStorage = (key, value) => {
  try {
    if (value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // storage unavailable: the story starts from nothing
  }
};

let drawn = null; // the scenario the app was last set up for
const setUp = (wanted, key) => {
  if (drawn === key) return;
  drawn = key;
  const { tickets = {}, downloads = [], playTime = {}, toast = null, storage = {}, ...rest } = wanted;
  setScenario(rest);
  applyScenario();

  // The browser: nothing left from the story before
  STORED_KEYS.forEach((name) => writeStorage(name, undefined));
  const expires = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString();
  writeStorage('gamehub:tickets', {
    [ME.id]: Object.fromEntries(Object.entries(tickets).map(([gameId, count]) => [
      gameId, Array.from({ length: count }, (_, i) => ({ id: `${gameId}-kept-ticket-${i}`, seed: 77 + i, expiresAt: expires })),
    ])),
  });
  writeStorage('gamehub:play-time', playTime);
  Object.entries(storage).forEach(([name, value]) => writeStorage(name, value));
  ['snake', 'tetris', 'minesweeper', 'sudoku'].forEach((gameId) => setDownloaded(gameId, downloads.includes(gameId)));
  const [navStyle, navCorner] = wanted.nav === 'sidebar' ? ['sidebar', 'right'] : ['floating', wanted.nav.replace('floating-', '')];
  setPreference('navStyle', navStyle);
  setPreference('navCorner', navCorner);

  // Nothing left on screen from the story before
  getToasts().forEach(({ id }) => dismissToast(id));
  answerQuestion(false);
  window.dispatchEvent(new Event(scenario.network === 'offline' ? 'offline' : 'online'));
  scenario.toast = toast;
};

// A story's message at the bottom of the screen (its Toast control), shown once the page is up
const StoryToast = ({ toast }) => {
  useEffect(() => {
    if (!toast?.text) return undefined;
    const id = showToast(toast.text, { tone: toast.tone ?? 'info', duration: 0 });
    return () => dismissToast(id);
  }, [toast?.text, toast?.tone]);
  return null;
};

export const withApp = (Story, context) => {
  const wanted = scenarioFor(context);
  const route = typeof context.parameters.route === 'function' ? context.parameters.route(context.args) : context.parameters.route;
  const key = JSON.stringify([context.id, route, wanted]);
  setUp(wanted, key);
  return (
    <MemoryRouter key={key} initialEntries={[route ?? '/']}>
      <AuthProvider>
        <LibraryProvider>
          <Story />
          <StoryToast toast={scenario.toast} />
          {/* A whole page has them in its layout (MainLayout); a part on its own gets them here */}
          {!route && (
            <>
              <Toasts />
              <ConfirmDialog />
            </>
          )}
        </LibraryProvider>
      </AuthProvider>
    </MemoryRouter>
  );
};
