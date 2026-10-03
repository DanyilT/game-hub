// The game checkers against real runs (`npm run test:worker`). fixtures.json holds runs recorded from
// the games themselves (DanyilT/dt-games, gamehub.js version 3, played by a test bot through their
// own key and click handlers), with what each game said at the end. Record new ones when a game's
// rules change, and change its checker to match.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { claimMatches, replayRun } from './index.js';
import { simulate as tetris } from './tetris.js';

const fixtures = JSON.parse(readFileSync(new URL('./fixtures.json', import.meta.url), 'utf8'));
const games = { snake: 'snake', tetris: 'tetris', minesweeperWon: 'minesweeper', minesweeperLost: 'minesweeper', sudoku: 'sudoku' };
// A copy of a run with some inputs changed: [index, wait, code] for each
const edited = (run, changes) => {
  const inputs = run.inputs.slice();
  changes.forEach(([i, wait, code]) => {
    inputs[i * 2] = wait;
    inputs[i * 2 + 1] = code;
  });
  return { ...run, inputs };
};

for (const [name, gameId] of Object.entries(games)) {
  test(`${name}: the game's own run plays out to what the game said`, () => {
    const run = fixtures[name];
    const found = replayRun(gameId, run);
    assert.equal(found.ok, true, found.reason);
    assert.equal(found.outcome, run.outcome);
    assert.equal(claimMatches(run.result, found.result), true);
  });
}

test('tetris: the level too', () => {
  assert.equal(tetris(fixtures.tetris).level, fixtures.tetris.level);
});

test('a claim that says more than the run did is caught', () => {
  const run = fixtures.snake;
  const found = replayRun('snake', run);
  assert.equal(claimMatches([{ label: 'Score', value: 99 }], found.result), false);
  assert.equal(claimMatches([], found.result), false);
  const tetrisFound = replayRun('tetris', fixtures.tetris);
  assert.equal(claimMatches([{ label: 'Score', value: 2627 }, { label: 'Lines', value: 16 }], tetrisFound.result), false);
  // a game's clock can be off by 2 s, no more
  const won = replayRun('minesweeper', fixtures.minesweeperWon);
  assert.equal(claimMatches([{ label: 'Level', value: 'Beginner' }, { label: 'Time', value: 2, format: 'time' }], won.result), true);
  assert.equal(claimMatches([{ label: 'Level', value: 'Beginner' }, { label: 'Time', value: 3, format: 'time' }], won.result), false);
  assert.equal(claimMatches([{ label: 'Level', value: 'Expert' }, { label: 'Time', value: 0, format: 'time' }], won.result), false);
});

test('another seed, mode or tick gives another game, or none', () => {
  const snake = replayRun('snake', { ...fixtures.snake, seed: fixtures.snake.seed + 1 });
  assert.ok(!snake.ok || snake.score !== 12);
  assert.equal(replayRun('snake', { ...fixtures.snake, mode: '30' }).reason, 'mode');
  assert.equal(replayRun('snake', { ...fixtures.snake, tick: 50 }).reason, 'tick');
  assert.equal(replayRun('tetris', { ...fixtures.tetris, tick: 100 }).reason, 'tick');
  assert.equal(replayRun('minesweeper', { ...fixtures.minesweeperWon, mode: 'impossible' }).reason, 'mode');
  assert.equal(replayRun('sudoku', { ...fixtures.sudoku, tick: 100 }).reason, 'tick');
  const sudoku = replayRun('sudoku', { ...fixtures.sudoku, seed: fixtures.sudoku.seed + 1 });
  assert.equal(sudoku.ok, false); // the same entries don't solve another puzzle (and some land on its clues)
  assert.equal(replayRun('chess', fixtures.snake).reason, 'game');
});

test('runs a game could never have made are refused', () => {
  // Snake: a turn that changes nothing (the game never records one), an unknown input, inputs after
  // the end, a run cut short, a run that goes on after the end
  assert.equal(replayRun('snake', edited(fixtures.snake, [[1, 0, 'L']])).reason, 'no-change');
  assert.equal(replayRun('snake', edited(fixtures.snake, [[2, 7, 'X']])).reason, 'input');
  assert.equal(replayRun('snake', { ...fixtures.snake, inputs: [...fixtures.snake.inputs, 5, 'L'] }).reason, 'after-end');
  assert.equal(replayRun('snake', { ...fixtures.snake, length: 100 }).reason, 'after-end'); // inputs at later steps
  assert.equal(replayRun('snake', { ...fixtures.snake, length: 146 }).reason, 'not-over');
  assert.equal(replayRun('snake', { ...fixtures.snake, length: 300 }).reason, 'ended-early');
  // Tetris: an unknown move, a run that ends sooner than it says
  assert.equal(replayRun('tetris', edited(fixtures.tetris, [[0, 2, 'Z']])).reason, 'input');
  assert.equal(replayRun('tetris', { ...fixtures.tetris, length: 9000 }).reason, 'ended-early');
  // Minesweeper: a cell off the board, a click after the end, a game that isn't over
  const won = fixtures.minesweeperWon;
  assert.equal(replayRun('minesweeper', edited(won, [[3, 0, 999]])).reason, 'input');
  assert.equal(replayRun('minesweeper', { ...won, inputs: [...won.inputs, 0, 2] }).reason, 'after-end');
  assert.equal(replayRun('minesweeper', { ...won, inputs: won.inputs.slice(0, -2) }).reason, 'not-over');
  // Sudoku: a clue changed, a puzzle not solved
  const sudoku = fixtures.sudoku;
  assert.equal(replayRun('sudoku', { ...sudoku, inputs: [0, 21, ...sudoku.inputs] }).reason, 'clue'); // cell 2 is a clue
  assert.equal(replayRun('sudoku', { ...sudoku, inputs: sudoku.inputs.slice(0, -2) }).reason, 'not-over');
});

test('a run that breaks the rules\' code is refused, not thrown', () => {
  assert.equal(replayRun('tetris', { ...fixtures.tetris, inputs: null }).reason, 'replay');
});

test('times come from the run: Minesweeper from the first open, Sudoku from the start', () => {
  const won = fixtures.minesweeperWon;
  const timed = { ...won, inputs: won.inputs.map((value, i) => (i % 2 === 0 ? (i === 0 ? 400 : 1000) : value)) };
  const found = replayRun('minesweeper', timed);
  // a flag at 400 ms, an open that takes it off 1 s later, the first real open 1 s after that, then
  // an input a second
  assert.equal(found.timeMs, (won.inputs.length / 2 - 3) * 1000);
  const sudoku = { ...fixtures.sudoku, inputs: fixtures.sudoku.inputs.map((value, i) => (i % 2 === 0 ? 1500 : value)) };
  assert.equal(replayRun('sudoku', sudoku).timeMs, 1500 * (fixtures.sudoku.inputs.length / 2));
});
