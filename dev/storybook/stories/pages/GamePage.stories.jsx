import { AppRoutes } from '../../../../src/App';

const GAMES = ['snake', 'tetris', 'minesweeper', 'sudoku', 'chillzone', 'flashback-arcade'];

/**
 * A game's page, in the site's layout: the game in its frame (the real one, from its own site), the panel under it with
 * the game's numbers and replays, and the info cards. The toolbar sets who's signed in, online or not, and the server;
 * the controls set what the game in the frame reports (mocks/gameBridge.js).
 */
export default {
  title: 'Pages/Game page',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: {
    route: (args) => `/g/${args.game}`,
    scenario: (args) => ({
      game: {
        connected: args.connected,
        version: args.version,
        status: args.numbers,
        ongoing: args.ongoing,
        save: args.save,
        download: args.download,
        runs: args.runs,
        replay: args.replay,
        replayAt: args.replayAt,
      },
      tickets: args.ticketsLeft === null ? {} : { [args.game]: args.ticketsLeft },
      downloads: args.downloaded ? [args.game] : [],
      playTime: { [args.game]: 1260 }, // a guest's, in this browser
      toast: args.toast ? { text: args.toast, tone: args.toastTone } : null,
      device: args.android ? 'android' : null,
    }),
  },
  argTypes: {
    game: { control: 'select', options: GAMES, description: 'Which game (ChillZone is on Google Play, Flashback Arcade a collection)' },
    connected: { description: 'The game has connected to the hub (the panel and save line show)' },
    version: { control: 'inline-radio', options: [1, 2, 3], description: "Its gamehub.js: 3 has the panel's numbers, replays and tickets" },
    numbers: { description: 'It sends its numbers for the panel (GameHub.status)' },
    ongoing: { description: 'A game is under way (watching a replay asks first)' },
    save: { control: 'inline-radio', options: ['saved', 'saving', 'failed', 'none'], description: "Signed in: the account's save" },
    download: { control: 'select', options: ['unknown', 'unsupported', 'available', 'downloaded', 'updated'], description: 'What the game says about downloading it' },
    downloaded: { description: 'The hub remembers it as downloaded (offline, it plays)' },
    runs: { description: 'The player has replays of it' },
    replay: { control: 'inline-radio', options: ['playing', 'paused', 'ended', 'error'], description: "A replay's state, once one is watched" },
    replayAt: { control: { type: 'range', min: 0, max: 1, step: 0.05 }, description: 'How far the replay has got' },
    ticketsLeft: { control: { type: 'number', min: 0, max: 10 }, description: 'Offline: tickets left for this game' },
    toast: { control: 'text', description: 'A message at the bottom of the screen' },
    toastTone: { control: 'inline-radio', options: ['info', 'error'] },
    android: { description: 'An Android device: an app on Google Play gets Play on its picture, which tries the app' },
  },
  args: {
    game: 'snake',
    connected: true,
    version: 3,
    numbers: true,
    ongoing: false,
    save: 'saved',
    download: 'available',
    downloaded: false,
    runs: true,
    replay: 'playing',
    replayAt: 0.4,
    ticketsLeft: 7,
    toast: '',
    toastTone: 'info',
    android: false,
  },
};

/** Playing Snake, signed in: the panel's numbers, replays with how each was checked, and the save line */
export const Playing = {};

export const Guest = { globals: { account: 'guest' } };

export const Tetris = { args: { game: 'tetris', ongoing: true } };
export const Minesweeper = { args: { game: 'minesweeper' } };
export const Sudoku = { args: { game: 'sudoku' } };

/** Offline with the game downloaded: tickets left, so the games played now still count once back online */
export const Offline = { globals: { network: 'offline' }, args: { downloaded: true, download: 'downloaded', ticketsLeft: 3 } };

/** Offline, out of tickets: the games played now stay on the device */
export const OfflineOutOfTickets = { globals: { network: 'offline' }, args: { downloaded: true, download: 'downloaded', ticketsLeft: 0 } };

/** Downloaded, and the game's worker has just got a new version: a reload plays it */
export const NewVersionDownloaded = {
  args: { downloaded: true, download: 'updated' },
  play: async ({ canvas }) => {
    await canvas.findByText(/A new version of Snake is downloaded/);
  },
};

/** Offline, and the game isn't downloaded: it can't play */
export const OfflineNotDownloaded = { globals: { network: 'offline' } };

/**
 * Downloaded, but it doesn't load offline (its copy is gone, or the network is down without saying so): after 8 s the
 * cover says so, with Reload and Show it anyway, in place of the spinner
 */
export const OfflineNotLoading = {
  globals: { network: 'offline' },
  args: { downloaded: true, download: 'downloaded', connected: false },
  play: async ({ canvas }) => {
    await canvas.findByText(/isn’t loading offline/, {}, { timeout: 10000 });
  },
};

/** Watching a replay: the bar with pause, speeds and progress (opened with the newest run's play button) */
export const WatchingAReplay = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Watch again', description: /Score 12/ }));
  },
};

/** Watching a run played in another browser: its moves come from GameHub's server first */
export const ReplayFromTheServer = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Show all/ }));
    await userEvent.click(await canvas.findByRole('button', { name: 'Watch again', description: /Score 9/ }));
  },
};

/** A game under way asks before a replay replaces it */
export const ReplayAsksFirst = {
  args: { ongoing: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Watch again', description: /Score 12/ }));
  },
};

/** Tags picked in the Tags card: a button finds the games that have them all */
export const TagsPicked = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Difficulty: easy' }));
    await userEvent.click(canvas.getByRole('button', { name: 'retro' }));
  },
};

/** The help window (the ? button) */
export const Help = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Help' }));
  },
};

/** The game hasn't connected (yet, or it's an older game): no panel, no save line */
export const NotConnected = { args: { connected: false } };

/** An older game (gamehub.js version 2): saves, but no numbers or replays */
export const OlderGame = { args: { version: 2, runs: false } };

export const SaveFailed = { args: { save: 'failed' } };

/** An app on Google Play: a picture with the store badge instead of the frame */
export const AppOnGooglePlay = { args: { game: 'chillzone' } };

/** The app, on an Android device: its picture glassed over, with Play in the middle, which tries the app */
export const AppOnAndroid = {
  args: { game: 'chillzone', android: true },
  play: async ({ canvas }) => {
    await canvas.findByRole('link', { name: 'Play' });
  },
};

/** A collection on a site of its own */
export const Collection = { args: { game: 'flashback-arcade' } };

export const LastTicketMessage = {
  globals: { network: 'offline' },
  args: {
    downloaded: true,
    download: 'downloaded',
    ticketsLeft: 0,
    toast: 'That was your last offline ticket for Snake: your next games won’t be saved to your account. Connect to the internet to get more.',
  },
};

export const NotFound = { parameters: { route: '/g/no-such-game' } };
