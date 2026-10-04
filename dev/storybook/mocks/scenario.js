// What the story asks for, in one place: the toolbar's choices (globals) and the story's own controls
// (args), which the fakes read (mocks/*.js). The decorator (.storybook/withApp.jsx) sets it before
// the story draws, and draws the app afresh whenever it changes.

/** The toolbar's choices, and their first values */
export const GLOBAL_DEFAULTS = {
  account: 'signedIn', // 'signedIn', 'newPlayer' (hasn't picked a username), 'guest', or 'off' (a site without accounts)
  network: 'online', // 'online' or 'offline' (navigator.onLine)
  server: 'fast', // how the fake Supabase answers: 'fast', 'slow' (2 s), 'down' (errors) or 'never' (loads forever)
  nav: 'sidebar', // Settings → Preferences: 'sidebar', 'floating-right' or 'floating-left'
};

/** The game in the frame, as the fake bridge reports it (mocks/gameBridge.js) */
export const GAME_DEFAULTS = {
  connected: true, // the game has said hello (the panel under it shows)
  version: 3, // its gamehub.js: 3 has the panel's numbers, replays and tickets
  status: true, // it sends its numbers (GameHub.status)
  ongoing: null, // a game under way that reloading loses (null: the game's own default)
  save: 'saved', // signed in: 'saved', 'saving', 'failed' or 'none'
  download: 'available', // 'unknown' (not answered yet), 'unsupported', 'available' or 'downloaded'
  playing: true, // the player is pressing keys in it (play time counts)
  replay: 'playing', // a replay's state once one is watched: 'playing', 'paused', 'ended' or 'error'
  replayAt: 0.4, // how far it has got (0 to 1)
  runs: true, // the player has runs of it to watch again
};

export const scenario = {
  ...GLOBAL_DEFAULTS,
  game: { ...GAME_DEFAULTS },
  emailSignIn: false, // the sign-in window offers the email link (only with the local Supabase on the real site)
  privacy: {}, // the signed-in player's choices, over data.js's PRIVACY (e.g. { record_played: false })
  install: { canPrompt: false, platform: null, installed: false, stepsOpen: false, bannerDue: false },
};

const listeners = new Set();
/** For the fakes that hold state of their own (the install state) */
export const onScenarioChange = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/**
 * Sets what the next drawing of the story shows
 * @param {object} changes - any of the scenario's keys; `game` and `install` are merged
 */
export const setScenario = (changes) => {
  const { game, install, ...rest } = changes;
  Object.assign(scenario, rest);
  if (game) scenario.game = { ...GAME_DEFAULTS, ...game };
  if (install) scenario.install = { ...scenario.install, ...install };
  listeners.forEach((listener) => listener());
};

/** Whether the story has a signed-in player */
export const signedIn = () => ['signedIn', 'newPlayer'].includes(scenario.account);
