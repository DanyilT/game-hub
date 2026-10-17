import * as bounce from './bounce.js';
import * as flappyBird from './flappy-bird.js';
import { CHECKED_GAMES } from './list.js';
import * as minesweeper from './minesweeper.js';
import * as snake from './snake.js';
import * as solitaire from './solitaire.js';
import * as sudoku from './sudoku.js';
import * as tetris from './tetris.js';
import * as ticTacToe from './tic-tac-toe.js';

// The games GameHub can check: each plays a run again from its seed and inputs with the game's own
// rules (the files here are copies of each game's js/rules.js, from DanyilT/dt-games: `npm run
// games:pull`), and gives the result it gets. The game's own claim is never taken: it's only compared,
// to flag a run whose claim doesn't match for a look (a changed result, or a game that changed
// without its rules here being pulled again).
// bounce.js holds Nokia's levels, masks and numbers (Bounce 1.24): its header says so, and they're not
// under GameHub's MIT license (README → License).

const GAMES = { bounce, 'flappy-bird': flappyBird, minesweeper, snake, solitaire, sudoku, tetris, 'tic-tac-toe': ticTacToe }; // the same as CHECKED_GAMES

/** Whether GameHub can check runs of this game */
export const canCheck = (gameId) => CHECKED_GAMES.includes(gameId) && Object.hasOwn(GAMES, gameId);

/**
 * Plays a run again
 * @param {string} gameId
 * @param {object} run - { seed, mode, tick, length, inputs }
 * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
 */
export const replayRun = (gameId, run) => {
  if (!canCheck(gameId)) return { ok: false, reason: 'game' };
  try {
    return GAMES[gameId].simulate(run);
  } catch {
    return { ok: false, reason: 'replay' }; // a run that breaks the rules' code: never a record
  }
};

/**
 * Whether the game's claimed result says what the replay found. A time can be off by 2 s: a game's
 * own clock (Minesweeper's timer) doesn't run quite like the run's.
 * @param {object[]} claimed - the run's result: [{ label, value }]
 * @param {object[]} found - the replay's
 */
export const claimMatches = (claimed, found) => found.every((item) => {
  const claim = Array.isArray(claimed) ? claimed.find((other) => other?.label === item.label) : null;
  if (!claim) return false;
  if (item.format === 'time') return Number.isFinite(claim.value) && Math.abs(claim.value - item.value) <= 2;
  return claim.value === item.value;
});
