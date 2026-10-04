import { fn } from 'storybook/test';
import GameProgress from '../../../../src/components/layout/game/GameProgress/GameProgress';
import { mergeRuns, useServerRuns } from '../../../../src/lib/checks';
import { GAME_STATUS, ME, RECORDS, runRows } from '../../mocks/data';

// The time played, as usePlayTime hands it over (a store the panel reads)
const playedStore = (seconds, where) => {
  const value = seconds === null ? null : { seconds, plays: where === 'account' ? 14 : null, lastPlayed: null, where };
  return { subscribe: () => () => {}, get: () => value };
};

/**
 * The panel under a game, on its own: the game's numbers (More opens the rest, the checked records and the play time),
 * and the replays, each with how GameHub's server took it (✓ counts, a clock while it waits, ✗ didn't count, a
 * crossed-out cloud when it stays on the device), ★ on the record, and for a run kept on the server, how many days
 * more (⧗). Pointing at a badge slides its label out. Only a run's ▶ button plays it. Signed in, the runs kept on
 * the server join this browser's (one of Snake's was played in another browser).
 */
export default {
  title: 'Game/Panel under the game',
  component: GameProgress,
  parameters: { layout: 'padded' },
  render: ({ game, numbers, seconds, guest, runs, fromServer, records, watching, replayState, replayAt, ...args }) => {
    const local = runs ? runRows(game).map((row) => (guest ? { ...row, check: null } : row)) : [];
    // The fake Supabase's my_runs (mocks/data.js), read as the game page reads it
    const server = useServerRuns(guest || !fromServer ? null : ME.id, game, null);
    const rows = mergeRuns(local, server);
    const length = 32_000;
    return (
      <div style={{ maxWidth: 760 }}>
        <GameProgress
          {...args}
          status={numbers ? GAME_STATUS[game] : null}
          played={playedStore(seconds, guest ? 'browser' : 'account')}
          runs={rows}
          records={guest || !records ? null : RECORDS[game]}
          signedIn={!guest}
          replay={watching && rows[0] ? { row: rows[0], speed: 1, key: 1 } : null}
          replayState={watching ? { state: replayState, position: replayState === 'ended' ? length : length * replayAt, length } : null}
        />
      </div>
    );
  },
  argTypes: {
    game: { control: 'select', options: ['snake', 'tetris', 'minesweeper', 'sudoku'] },
    numbers: { description: 'The game sends its numbers (GameHub.status)' },
    seconds: { control: { type: 'number', min: 0 }, description: 'Time played (null: not known yet)' },
    guest: { description: "A guest's panel: no checks, the game's own Best" },
    runs: { description: 'Runs to watch again' },
    fromServer: { description: 'Signed in: the runs kept on GameHub’s server too (from any browser)' },
    records: { description: "The player's checked records (More)" },
    watching: { description: 'A replay is playing (the bar at the top)' },
    replayState: { control: 'inline-radio', options: ['playing', 'paused', 'ended', 'error'] },
    replayAt: { control: { type: 'range', min: 0, max: 1, step: 0.05 } },
  },
  args: {
    game: 'snake',
    numbers: true,
    seconds: 3260,
    guest: false,
    runs: true,
    fromServer: true,
    records: true,
    watching: false,
    replayState: 'playing',
    replayAt: 0.4,
    canReplay: true,
    onWatch: fn(),
    onControlReplay: fn(),
    onReplayAgain: fn(),
    onStopReplay: fn(),
  },
};

export const SignedIn = {};
export const Guest = { args: { guest: true, seconds: 1260 } };

export const MoreOpen = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /More/ }));
  },
};

export const AllReplays = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Show all/ }));
  },
};

export const WatchingAReplay = { args: { watching: true } };

/** Only this browser's runs (none from the server: no countdowns) */
export const ThisBrowserOnly = { args: { fromServer: false } };

/** The play button has the keyboard's focus: the row's badges show their labels */
export const KeyboardFocus = {
  play: async ({ canvas, userEvent }) => {
    await canvas.findAllByRole('button', { name: 'Watch again' });
    await userEvent.tab();
  },
};
export const ReplayPaused = { args: { watching: true, replayState: 'paused' } };
export const ReplayFinished = { args: { watching: true, replayState: 'ended' } };
export const ReplayCantPlay = { args: { watching: true, replayState: 'error' } };

/** Minesweeper: times, levels, won and lost */
export const Minesweeper = { args: { game: 'minesweeper' } };
export const Tetris = { args: { game: 'tetris' } };

/** No runs yet: how to get some */
export const NoReplaysYet = { args: { runs: false } };

/** An older game: no numbers or replays, only the time */
export const OnlyTheTime = { args: { numbers: false, runs: false, canReplay: false } };
