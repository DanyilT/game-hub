import { refuse, seededRandom, timeline } from './random.js';

// Sudoku (DanyilT/dt-games, branch sudoku: js/sudoku.js), played again from a run: the same puzzle
// from the same random numbers, then each change to a cell. Change it whenever the game changes.
// - The puzzle: a full grid filled in cell by cell (row by row, trying the digits in a shuffled
//   order, backtracking), then a shuffled list of every cell, the first 20 to 70 of them emptied
//   (by level, the run's mode).
// - Inputs: one number a change, cell × 10 + the digit (0 empties it), cells numbered row by row.
//   The clues can't change. The puzzle is solved when every cell is filled and no row, column or box
//   has a digit twice (it needn't be the grid it was made from).
// - The time is the run's clock (time on screen, across visits) at the solving change.

const LEVELS = {
  beginner: { remove: 20, name: 'For a Bread' },
  easy: { remove: 40, name: 'Easy' },
  medium: { remove: 50, name: 'Medium' },
  hard: { remove: 60, name: 'Hard' },
  expert: { remove: 70, name: 'Expert' },
};

const isValidPlacement = (grid, row, col, num) => {
  for (let x = 0; x < 9; x++) {
    if (grid[row][x] === num) return false;
  }
  for (let y = 0; y < 9; y++) {
    if (grid[y][col] === num) return false;
  }
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      if (grid[boxRow + i][boxCol + j] === num) return false;
    }
  }
  return true;
};

/**
 * The puzzle a run plays: its full grid (solution) and its clues (initial), from its random numbers
 * @param {function} random
 * @param {string} mode - the level
 */
export const makePuzzle = (random, mode) => {
  const shuffle = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  };
  const findEmpty = (grid) => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] === 0) return [row, col];
      }
    }
    return null;
  };
  const solve = (grid) => {
    const empty = findEmpty(grid);
    if (!empty) return true;
    const [row, col] = empty;
    const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    shuffle(digits);
    for (const num of digits) {
      if (isValidPlacement(grid, row, col, num)) {
        grid[row][col] = num;
        if (solve(grid)) return true;
        grid[row][col] = 0;
      }
    }
    return false;
  };

  const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
  solve(solution);
  const initial = solution.map((row) => row.slice());
  const positions = [];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) positions.push([row, col]);
  }
  shuffle(positions);
  for (let i = 0; i < LEVELS[mode].remove; i++) {
    const [row, col] = positions[i];
    initial[row][col] = 0;
  }
  return { solution, initial };
};

/**
 * Plays a run of Sudoku again
 * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
 * @return {object} - { ok: true, outcome, timeMs, result } or { ok: false, reason }
 */
export const simulate = ({ seed, mode, tick, inputs }) => {
  const level = LEVELS[mode];
  if (!level) return refuse('mode');
  if (tick !== null) return refuse('tick');
  const { initial } = makePuzzle(seededRandom(seed), mode);
  const board = initial.map((row) => row.slice());

  const solved = () => {
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (board[row][col] === 0) return false;
      }
    }
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const value = board[row][col];
        board[row][col] = 0;
        const valid = isValidPlacement(board, row, col, value);
        board[row][col] = value;
        if (!valid) return false;
      }
    }
    return true;
  };

  const events = timeline(inputs);
  let wonAt = null;
  for (const { at, code } of events) {
    if (wonAt !== null) return refuse('after-end');
    if (!Number.isSafeInteger(code) || code < 0 || code >= 810) return refuse('input');
    const cell = Math.floor(code / 10);
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    if (initial[row][col] > 0) return refuse('clue');
    board[row][col] = code % 10;
    if (code % 10 > 0 && solved()) wonAt = at;
  }
  if (wonAt === null) return refuse('not-over');
  return {
    ok: true,
    outcome: 'won',
    score: null,
    timeMs: wonAt,
    result: [
      { label: 'Level', value: level.name, format: null },
      { label: 'Time', value: Math.round(wonAt / 1000), format: 'time' },
    ],
  };
};
