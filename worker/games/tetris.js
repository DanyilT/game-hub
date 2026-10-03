import { refuse, seededRandom, timeline } from './random.js';

// Tetris (DanyilT/dt-games, branch tetris: js/tetris.js), played again from a run: the same rules,
// step by step, with the same random numbers in the same order. Change it whenever the game changes.
// - A 10 × 20 board. The game moves in steps of 50 ms; the piece falls a row every gameSpeed / 50
//   steps (1000 ms at level 1, 100 ms less each level, down to 100 ms), counting again from each
//   level-up. A piece that can't fall any further locks; full rows clear.
// - Inputs: 'L', 'R' (move), 'U' (rotate, with a one-column kick), 'D' (down a row, or lock) and 'H'
//   (hard drop: a point a row), each after the steps before it.
// - Score: 100, 300, 500 or 800 × the level for 1 to 4 rows; a level every 10 rows. The game ends when
//   a new piece doesn't fit.

const TICK = 50; // ms per step (the game's TICK)
const COLS = 10;
const ROWS = 20;
const SHAPES = [
  [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I
  [[1, 0, 0], [1, 1, 1], [0, 0, 0]], // J
  [[0, 0, 1], [1, 1, 1], [0, 0, 0]], // L
  [[1, 1], [1, 1]], // O
  [[0, 1, 1], [1, 1, 0], [0, 0, 0]], // S
  [[0, 1, 0], [1, 1, 1], [0, 0, 0]], // T
  [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
];
const LINE_SCORES = [0, 100, 300, 500, 800];
const MOVES = ['L', 'R', 'U', 'D', 'H'];

// The game's rotate(): a quarter turn clockwise
const rotate = (matrix) => {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      result[x][n - 1 - y] = matrix[y][x];
    }
  }
  return result;
};

/**
 * Plays a run of Tetris again
 * @param {object} run - { seed, mode, tick, length (steps), inputs }
 * @return {object} - { ok: true, outcome, score, lines, level, result } or { ok: false, reason }
 */
export const simulate = ({ seed, mode, tick, length, inputs }) => {
  if (mode !== null) return refuse('mode');
  if (tick !== TICK) return refuse('tick');
  const random = seededRandom(seed);

  const board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
  let score = 0;
  let level = 1;
  let lines = 0;
  let gameSpeed = 1000;
  let stepsSinceFall = 0;
  let over = false;

  const newPiece = (shape) => ({ shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 });
  const randomPiece = () => newPiece(SHAPES[Math.floor(random() * SHAPES.length)]);

  const collision = (x, y, shape) => {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (!shape[r][c]) continue;
        const newX = x + c;
        const newY = y + r;
        if (newX < 0 || newX >= COLS || newY >= ROWS) return true;
        if (newY < 0) continue;
        if (board[newY][newX] !== 0) return true;
      }
    }
    return false;
  };

  const updateGameSpeed = () => {
    gameSpeed = Math.max(100, 1000 - (level - 1) * 100);
    stepsSinceFall = 0;
  };

  // The game's resetGame()
  let current = randomPiece();
  let next = randomPiece();
  updateGameSpeed();

  const lockPiece = () => {
    current.shape.forEach((row, y) => row.forEach((cell, x) => {
      if (cell && current.y + y >= 0) board[current.y + y][current.x + x] = 1;
    }));
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (board[y].every((cell) => cell !== 0)) {
        board.splice(y, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++;
        y++;
      }
    }
    if (cleared > 0) {
      score += LINE_SCORES[cleared] * level;
      lines += cleared;
      const newLevel = Math.floor(lines / 10) + 1;
      if (newLevel > level) {
        level = newLevel;
        updateGameSpeed();
      }
    }
    current = next;
    next = randomPiece();
    if (collision(current.x, current.y, current.shape)) over = true;
  };

  const moveDown = () => {
    if (!collision(current.x, current.y + 1, current.shape)) {
      current.y++;
      return;
    }
    lockPiece();
  };

  const move = (code) => {
    if (code === 'L' && !collision(current.x - 1, current.y, current.shape)) current.x--;
    else if (code === 'R' && !collision(current.x + 1, current.y, current.shape)) current.x++;
    else if (code === 'U') {
      const turned = rotate(current.shape);
      let kick = 0;
      if (collision(current.x, current.y, turned)) kick = current.x > COLS / 2 ? -1 : 1;
      if (!collision(current.x + kick, current.y, turned)) {
        current.x += kick;
        current.shape = turned;
      }
    } else if (code === 'D') moveDown();
    else if (code === 'H') {
      let dropped = 0;
      while (!collision(current.x, current.y + 1, current.shape)) {
        current.y++;
        dropped++;
      }
      score += dropped;
      lockPiece();
    }
  };

  // The game's gameLoop(): one step
  const step = () => {
    stepsSinceFall++;
    if (stepsSinceFall < gameSpeed / TICK) return;
    stepsSinceFall = 0;
    moveDown();
  };

  const events = timeline(inputs);
  let nextInput = 0;
  const playInputs = (done) => {
    for (; nextInput < events.length && events[nextInput].at === done; nextInput += 1) {
      const { code } = events[nextInput];
      if (over) return 'after-end';
      if (!MOVES.includes(code)) return 'input';
      move(code);
    }
    return null;
  };

  let problem = playInputs(0);
  for (let done = 0; !problem && done < length;) {
    if (over) return refuse('ended-early');
    step();
    done += 1;
    problem = playInputs(done);
  }
  if (problem) return refuse(problem);
  if (nextInput < events.length) return refuse('after-end');
  if (!over) return refuse('not-over');
  return {
    ok: true,
    outcome: 'over',
    score,
    timeMs: null,
    result: [{ label: 'Score', value: score, format: null }, { label: 'Lines', value: lines, format: null }],
    lines,
    level,
  };
};
