import { refuse, seededRandom, timeline } from './random.js';

// Minesweeper (DanyilT/dt-games, branch minesweeper: js/minesweeper.js), played again from a run:
// the same rules, click by click, with the same random numbers in the same order. Change it whenever
// the game changes.
// - Three levels (the run's mode). The mines go in at the first open, never under it: random rows and
//   columns, again until there are enough.
// - Inputs: one number a click, cell × 2 (+ 1 for a flag), cells numbered row by row. Opening a
//   flagged cell takes the flag off; opening or flagging an open number whose flags are all there
//   opens the cells around it. An empty cell opens the cells around it too.
// - Opening a mine loses; opening every other cell wins. The time is from the first open to the
//   last input (the run's clock, which leaves out time the page was hidden).

const LEVELS = {
  beginner: { rows: 9, cols: 9, mines: 10, name: 'Beginner' },
  intermediate: { rows: 16, cols: 16, mines: 40, name: 'Intermediate' },
  expert: { rows: 16, cols: 30, mines: 99, name: 'Expert' },
};

/**
 * Plays a run of Minesweeper again
 * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
 * @return {object} - { ok: true, outcome, timeMs, result } or { ok: false, reason }
 */
export const simulate = ({ seed, mode, tick, inputs }) => {
  const level = LEVELS[mode];
  if (!level) return refuse('mode');
  if (tick !== null) return refuse('tick');
  const random = seededRandom(seed);
  const { rows, cols, mines } = level;

  const board = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
    isMine: false, isRevealed: false, isFlagged: false, neighbors: 0,
  })));
  let firstClick = true;
  let gameOver = false;
  let won = false;
  let revealedCount = 0;

  const around = (row, col, visit) => {
    for (let r = Math.max(0, row - 1); r <= Math.min(rows - 1, row + 1); r++) {
      for (let c = Math.max(0, col - 1); c <= Math.min(cols - 1, col + 1); c++) {
        if (r !== row || c !== col) {
          if (visit(r, c) === false) return;
        }
      }
    }
  };
  const countAround = (row, col, test) => {
    let count = 0;
    around(row, col, (r, c) => {
      if (test(board[r][c])) count++;
    });
    return count;
  };

  const plantMines = (firstRow, firstCol) => {
    let planted = 0;
    while (planted < mines) {
      const r = Math.floor(random() * rows);
      const c = Math.floor(random() * cols);
      if ((r !== firstRow || c !== firstCol) && !board[r][c].isMine) {
        board[r][c].isMine = true;
        planted++;
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!board[r][c].isMine) board[r][c].neighbors = countAround(r, c, (cell) => cell.isMine);
      }
    }
  };

  const revealCell = (row, col) => {
    if (row < 0 || row >= rows || col < 0 || col >= cols || board[row][col].isRevealed || board[row][col].isFlagged) return;
    board[row][col].isRevealed = true;
    revealedCount++;
    if (board[row][col].neighbors === 0) around(row, col, (r, c) => revealCell(r, c));
  };

  const revealUnflaggedNeighbors = (row, col) => {
    around(row, col, (r, c) => {
      if (board[r][c].isRevealed || board[r][c].isFlagged) return true;
      if (board[r][c].isMine) {
        gameOver = true;
        return false;
      }
      revealCell(r, c);
      return true;
    });
  };

  const checkWinCondition = () => {
    if (gameOver) return;
    if (revealedCount === rows * cols - mines) {
      gameOver = true;
      won = true;
    }
  };

  // Opening or flagging a number whose flags are all there opens the cells around it
  const chord = (row, col) => {
    const cell = board[row][col];
    if (cell.neighbors > 0 && countAround(row, col, (other) => other.isFlagged) === cell.neighbors) {
      revealUnflaggedNeighbors(row, col);
      checkWinCondition();
    }
  };

  // The game's flagCell() and openCell()
  const flagCell = (row, col) => {
    if (gameOver) return;
    if (board[row][col].isRevealed) {
      chord(row, col);
      return;
    }
    board[row][col].isFlagged = !board[row][col].isFlagged;
  };
  let firstClickAt = 0;
  const openCell = (row, col, at) => {
    if (gameOver) return;
    if (board[row][col].isFlagged) {
      flagCell(row, col);
      return;
    }
    if (firstClick) {
      firstClick = false;
      firstClickAt = at;
      plantMines(row, col);
    }
    if (board[row][col].isRevealed && board[row][col].neighbors > 0) {
      chord(row, col);
      return;
    }
    if (board[row][col].isMine) {
      gameOver = true;
      return;
    }
    revealCell(row, col);
    checkWinCondition();
  };

  const events = timeline(inputs);
  for (const { at, code } of events) {
    if (gameOver) return refuse('after-end');
    if (!Number.isSafeInteger(code) || code < 0 || code >= rows * cols * 2) return refuse('input');
    const cell = Math.floor(code / 2);
    const row = Math.floor(cell / cols);
    const col = cell % cols;
    if (code % 2) flagCell(row, col);
    else openCell(row, col, at);
  }
  if (!gameOver) return refuse('not-over');
  const timeMs = won ? events[events.length - 1].at - firstClickAt : null;
  return {
    ok: true,
    outcome: won ? 'won' : 'lost',
    score: null,
    timeMs,
    result: [
      { label: 'Level', value: level.name, format: null },
      { label: 'Time', value: Math.floor((events[events.length - 1].at - firstClickAt) / 1000), format: 'time' },
    ],
  };
};
