// snake's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch snake), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: 0a46427875efd2a929884cacaba75949132eb174fb566b9f8d5d26d9ea778041

/**
 * Snake: the rules
 *
 * Everything a game of Snake needs to play out, and nothing else. js/snake.js plays the game through these functions,
 * and GameHub's server plays a run again with GameRules.simulate(), so a game plays out the same in both.
 * - The board is 20 × 20 tiles: a 400 px canvas of 20 px tiles. The snake starts in the middle, one tile long, and grows
 *   to 5. Each food it eats adds a tile and a point.
 * - Inputs: 'U', 'D', 'L' or 'R', a turn. It's never straight back (against the way the snake last moved), and a run
 *   records a turn only when it changes the direction.
 * - A step (every 100 ms) moves the snake one tile. Running into a wall or into itself ends the game.
 * - The food goes on a random tile: x, then y, again until it's a tile the snake isn't on. The numbers come from the
 *   run's seed, in that order.
 * Other boards (setGameParameters() in js/snake.js, a cheat) play by the same rules, but simulate() refuses them.
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const TICK = 100; // ms per step
    const CANVAS = 400; // px: the canvas's width and height
    const TILES = 20; // tiles a side
    const START_LENGTH = 5; // tiles: the snake grows to this before it eats
    const TURNS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

    // The run's random numbers: mulberry32 from a 32-bit seed, the same as run.random() in js/gamehub.js
    function seededRandom(seed) {
        let state = seed | 0;
        return function () {
            state = (state + 0x6D2B79F5) | 0;
            let t = Math.imul(state ^ (state >>> 15), 1 | state);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    // A run's inputs, [wait, code, wait, code, …] (each wait in steps since the input before), as [{ at, code }]
    function timeline(inputs) {
        const events = [];
        let at = 0;
        for (let i = 0; i < inputs.length; i += 2) {
            at += inputs[i];
            events.push({ at, code: inputs[i + 1] });
        }
        return events;
    }

    // A run that doesn't play out: why
    function refuse(reason) {
        return { ok: false, reason };
    }

    // The tile at x, y as a key of the tiles the snake covers
    function tileKey(x, y) {
        return `${x},${y}`;
    }

    // Whether the snake is on the tile at x, y (anywhere along it, its tail included)
    function onSnake(game, x, y) {
        return game.covered.has(tileKey(x, y));
    }

    // The snake comes onto a tile (by 1) or leaves it (by -1)
    function cover(game, x, y, by) {
        const key = tileKey(x, y);
        const count = (game.covered.get(key) ?? 0) + by;
        if (count > 0) game.covered.set(key, count);
        else game.covered.delete(key);
    }

    // Put the food on a random tile the snake isn't on (none when the snake fills the board)
    function placeFood(game) {
        if (game.snake.length >= game.tiles * game.tiles) return;
        do {
            game.foodX = Math.floor(game.random() * CANVAS / game.tile);
            game.foodY = Math.floor(game.random() * CANVAS / game.tile);
        } while (onSnake(game, game.foodX, game.foodY));
    }

    // A game's state, before its snake is on the board: random gives the run's numbers, tiles is the board's size
    function emptyGame(random, tiles) {
        const tile = CANVAS / tiles; // px a side
        return {
            random,
            tiles,
            tile,
            snake: [], // Head first
            covered: new Map(), // How many parts of the snake are on each tile
            snakeLength: START_LENGTH,
            velocityX: 0,
            velocityY: 0,
            movedX: 0, // The way the snake last moved (a turn can't reverse it)
            movedY: 0,
            foodX: 0,
            foodY: 0,
            score: 0,
            over: false,
        };
    }

    // A new game: the snake in the middle, not moving yet, and the food. random gives the run's numbers; tiles is the
    // board's size (20 a side, unless setGameParameters() changed it).
    function newGame(random, tiles = TILES) {
        const game = emptyGame(random, tiles);
        game.snake.push({ x: CANVAS / 2 / game.tile, y: CANVAS / 2 / game.tile });
        cover(game, game.snake[0].x, game.snake[0].y, 1);
        placeFood(game);
        return game;
    }

    // A game under way as plain data, to save with it (all but its random numbers, which its run keeps)
    function saveState(game) {
        return {
            tiles: game.tiles,
            snake: game.snake.map(({ x, y }) => ({ x, y })),
            snakeLength: game.snakeLength,
            velocityX: game.velocityX,
            velocityY: game.velocityY,
            movedX: game.movedX,
            movedY: game.movedY,
            foodX: game.foodX,
            foodY: game.foodY,
            score: game.score,
        };
    }

    // The game saveState() gave, carrying on with random (the run's numbers, from where they were); null if it isn't one
    function loadState(data, random) {
        const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);
        const isDirection = (value) => value === -1 || value === 0 || value === 1;
        if (data === null || typeof data !== 'object' || !Number.isInteger(data.tiles) || data.tiles < 2 || data.tiles > 100
            || !Array.isArray(data.snake) || data.snake.length === 0 || !data.snake.every((part) => isNumber(part?.x) && isNumber(part?.y))
            || !Number.isInteger(data.snakeLength) || data.snakeLength < 1 || !Number.isInteger(data.score)
            || ![data.velocityX, data.velocityY, data.movedX, data.movedY].every(isDirection)
            || !isNumber(data.foodX) || !isNumber(data.foodY)) {
            return null;
        }
        const game = emptyGame(random, data.tiles);
        for (const { x, y } of data.snake) {
            game.snake.push({ x, y });
            cover(game, x, y, 1);
        }
        for (const key of ['snakeLength', 'velocityX', 'velocityY', 'movedX', 'movedY', 'foodX', 'foodY', 'score']) {
            game[key] = data[key];
        }
        return game;
    }

    // Turn the snake ('U', 'D', 'L' or 'R'): true if that changed its direction
    function turn(game, direction) {
        const [x, y] = TURNS[direction];
        if ((x !== 0 && game.movedX === -x) || (y !== 0 && game.movedY === -y)) return false;
        if (game.velocityX === x && game.velocityY === y) return false;
        game.velocityX = x;
        game.velocityY = y;
        return true;
    }

    // One step: 'over' (the snake ran into a wall or into itself), 'ate' (it ate the food) or 'moved'
    function step(game) {
        const headX = game.snake[0].x + game.velocityX;
        const headY = game.snake[0].y + game.velocityY;
        if (headX < 0 || headY < 0 || headX >= CANVAS / game.tile || headY >= CANVAS / game.tile || onSnake(game, headX, headY)) {
            game.over = true;
            return 'over';
        }
        game.movedX = game.velocityX;
        game.movedY = game.velocityY;
        game.snake.unshift({ x: headX, y: headY });
        cover(game, headX, headY, 1);

        let ate = false;
        if (headX === game.foodX && headY === game.foodY) {
            placeFood(game);
            game.snakeLength++;
            game.score++;
            ate = true;
        }
        if (game.snake.length > game.snakeLength) {
            const tail = game.snake.pop();
            cover(game, tail.x, tail.y, -1);
        }
        return ate ? 'ate' : 'moved';
    }

    /**
     * Plays a run of Snake again
     * @param {object} run - { seed, mode, tick, length (steps), inputs }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, length, inputs }) {
        if (mode !== null) return refuse('mode');
        if (tick !== TICK) return refuse('tick');
        const game = newGame(seededRandom(seed));

        // The inputs after `done` steps (none once the game has ended): what's wrong with one, or null
        const events = timeline(inputs);
        let next = 0;
        function playInputs(done) {
            for (; next < events.length && events[next].at === done; next += 1) {
                const { code } = events[next];
                if (game.over) return 'after-end';
                if (!TURNS[code]) return 'input';
                if (!turn(game, code)) return 'no-change'; // The game records only turns that change the direction
            }
            return null;
        }

        let problem = playInputs(0);
        for (let done = 0; !problem && done < length;) {
            if (game.over) return refuse('ended-early');
            step(game);
            done += 1;
            problem = playInputs(done);
        }
        if (problem) return refuse(problem);
        if (next < events.length) return refuse('after-end');
        if (!game.over) return refuse('not-over');
        return { ok: true, outcome: 'over', score: game.score, timeMs: null, result: [{ label: 'Score', value: game.score, format: null }] };
    }

    return Object.freeze({ TICK, TILES, seededRandom, newGame, saveState, loadState, turn, step, simulate });
})();

export const { simulate } = GameRules;
