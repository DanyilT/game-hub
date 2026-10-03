import { refuse, seededRandom, timeline } from './random.js';

// Snake (DanyilT/dt-games, branch snake: js/snake.js), played again from a run: the same rules, step
// by step, with the same random numbers in the same order. Change it whenever the game changes.
// - The board is 20 × 20 tiles (a 400 px canvas, 20 px tiles). The snake starts in the middle,
//   one tile long, and grows to 5; each food it eats adds a tile and a point.
// - Inputs: 'U', 'D', 'L' or 'R', a turn (never straight back), recorded only when it changes the
//   direction. A step moves the snake one tile; running into a wall or itself ends the game.
// - The food goes on a random free tile: x, then y, again until it's free.

const TICK = 100; // ms per step (the game's gameSpeed)
const CANVAS = 400; // px
const TILES = 20; // tileCount: other boards (setGameParameters) don't count
const TILE = CANVAS / TILES;
const START_LENGTH = 5;
const TURNS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

/**
 * Plays a run of Snake again
 * @param {object} run - { seed, mode, tick, length (steps), inputs }
 * @return {object} - { ok: true, outcome, score, result } or { ok: false, reason }
 */
export const simulate = ({ seed, mode, tick, length, inputs }) => {
  if (mode !== null) return refuse('mode');
  if (tick !== TICK) return refuse('tick');
  const random = seededRandom(seed);

  // The snake, head first, and which tiles it covers (the game looks along the whole snake)
  const snake = [];
  const covered = new Uint16Array(TILES * TILES);
  const cover = (x, y, by) => { covered[y * TILES + x] += by; };
  const onSnake = (x, y) => covered[y * TILES + x] > 0;

  let velocityX = 0;
  let velocityY = 0;
  let movedX = 0;
  let movedY = 0;
  let snakeLength = START_LENGTH;
  let score = 0;
  let foodX;
  let foodY;
  let over = false;

  const placeFood = () => {
    if (snake.length >= TILES * TILES) return;
    do {
      foodX = Math.floor(random() * CANVAS / TILE);
      foodY = Math.floor(random() * CANVAS / TILE);
    } while (onSnake(foodX, foodY));
  };

  // The game's resetGame()
  snake.push({ x: CANVAS / 2 / TILE, y: CANVAS / 2 / TILE });
  cover(snake[0].x, snake[0].y, 1);
  placeFood();

  // The game's turn()
  const turn = (direction) => {
    const [x, y] = TURNS[direction];
    if ((x !== 0 && movedX === -x) || (y !== 0 && movedY === -y)) return false;
    if (velocityX === x && velocityY === y) return false;
    velocityX = x;
    velocityY = y;
    return true;
  };

  // The game's gameLoop()
  const step = () => {
    const headX = snake[0].x + velocityX;
    const headY = snake[0].y + velocityY;
    if (headX < 0 || headY < 0 || headX >= CANVAS / TILE || headY >= CANVAS / TILE || onSnake(headX, headY)) {
      over = true;
      return;
    }
    movedX = velocityX;
    movedY = velocityY;
    snake.unshift({ x: headX, y: headY });
    cover(headX, headY, 1);
    if (headX === foodX && headY === foodY) {
      placeFood();
      snakeLength++;
      score++;
    }
    if (snake.length > snakeLength) {
      const tail = snake.pop();
      cover(tail.x, tail.y, -1);
    }
  };

  // The inputs at their steps: each after the steps before it, and none once the game has ended
  const events = timeline(inputs);
  let next = 0;
  const playInputs = (done) => {
    for (; next < events.length && events[next].at === done; next += 1) {
      const { code } = events[next];
      if (over) return 'after-end';
      if (!TURNS[code]) return 'input';
      if (!turn(code)) return 'no-change'; // the game records only turns that change the direction
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
  if (next < events.length) return refuse('after-end');
  if (!over) return refuse('not-over');
  return { ok: true, outcome: 'over', score, timeMs: null, result: [{ label: 'Score', value: score, format: null }] };
};
