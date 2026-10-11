// flappy-bird's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch flappy-bird), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: c77c421785a29d75fedb9ccca18f9108d808e0eba96d5b7fe63b942c01e7b258

/**
 * Flappy Bird: the rules
 *
 * Everything a game of Flappy Bird needs to play out, and nothing else. js/flappy-bird.js plays the game through these
 * functions, and GameHub's server plays a run again with GameRules.simulate(), so a game plays out the same in both.
 * - The world is 288 × 512 px, the ground's top at 400. The bird stays at x 70; pipes come from the right, 2 px a step,
 *   one every 176 px, each with a 100 px gap whose top is between 60 and 240 px, drawn from the run's seed.
 * - The game moves in steps of 16 ms. Each step the bird falls faster (gravity, down to a top speed), moves, and the
 *   pipes move. A flap ('F') sets the bird going up at once. Heights and speeds are in hundredths of a pixel, all whole
 *   numbers, so every browser (and GameHub's server) works them out exactly the same.
 * - A pipe passed (its middle behind the bird's) is a point. Touching a pipe (they reach up for ever, above the screen
 *   too) or the ground ends the game.
 * - Inputs: 'F', a flap, each after the steps before it. The game starts with the first one.
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const TICK = 16; // ms per step
    const WIDTH = 288; // px: the world
    const GROUND = 400; // px: the ground's top
    const BIRD_X = 70; // px: the bird's middle, across
    const BIRD_START = 24000; // 1/100 px: the bird's middle, down, as the game starts
    const BIRD_HALF_WIDTH = 13; // px: the bird's box, around its middle (a little inside its drawing: fair)
    const BIRD_HALF_HEIGHT = 10;
    const GRAVITY = 24; // 1/100 px a step, each step
    const FLAP = -450; // 1/100 px a step: a flap's speed, upwards
    const MAX_FALL = 800; // 1/100 px a step
    const PIPE_WIDTH = 52; // px
    const PIPE_SPEED = 2; // px a step
    const PIPE_SPACING = 176; // px from one pipe to the next
    const FIRST_PIPE = WIDTH + 120; // px: where the first pipe starts (its left edge)
    const GAP = 100; // px: the opening between a pipe's two halves
    const GAP_MARGIN = 60; // px: a gap's top is at least this far from the top, and its bottom from the ground
    const MEDALS = Object.freeze([[40, 'platinum'], [30, 'gold'], [20, 'silver'], [10, 'bronze']]);

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

    // A new pipe at x (px, its left edge), with the game's gap, its top drawn from the run's numbers
    function newPipe(game, x) {
        const range = GROUND - GAP_MARGIN - game.gap - GAP_MARGIN; // px: where the gap's top can be, above the lowest
        return { x, gapTop: GAP_MARGIN + Math.floor(game.random() * (range + 1)), gap: game.gap, passed: false };
    }

    // A new game: the bird in the air, not moving yet, and the first pipe on its way. random gives the run's numbers.
    function newGame(random) {
        const game = {
            random,
            y: BIRD_START, // 1/100 px: the bird's middle
            speed: 0, // 1/100 px a step: down is positive
            pipes: [],
            gap: GAP, // px: the gaps of the pipes to come (the Easter egg widens them)
            steps: 0,
            score: 0,
            over: false,
        };
        game.pipes.push(newPipe(game, FIRST_PIPE));
        return game;
    }

    // A flap: the bird goes up at once
    function flap(game) {
        if (game.over) return;
        game.speed = FLAP;
    }

    // Whether the bird touches a pipe: they reach up for ever, and down to the ground
    function hitsPipe(game) {
        const top = Math.floor(game.y / 100) - BIRD_HALF_HEIGHT;
        const bottom = Math.floor(game.y / 100) + BIRD_HALF_HEIGHT;
        return game.pipes.some((pipe) => BIRD_X + BIRD_HALF_WIDTH > pipe.x && BIRD_X - BIRD_HALF_WIDTH < pipe.x + PIPE_WIDTH
            && (top < pipe.gapTop || bottom > pipe.gapTop + pipe.gap));
    }

    // One step: 'over' (the bird hit a pipe or the ground), 'scored' (it passed a pipe) or 'moved'
    function step(game) {
        if (game.over) return 'over';
        game.steps++;
        game.speed = Math.min(game.speed + GRAVITY, MAX_FALL);
        game.y += game.speed;

        // The pipes come on; a new one when the last is far enough in, and the ones gone past go
        game.pipes.forEach((pipe) => {
            pipe.x -= PIPE_SPEED;
        });
        const last = game.pipes[game.pipes.length - 1];
        if (last.x <= WIDTH - PIPE_SPACING + PIPE_WIDTH) game.pipes.push(newPipe(game, last.x + PIPE_SPACING));
        if (game.pipes[0].x + PIPE_WIDTH < 0) game.pipes.shift();

        if (Math.floor(game.y / 100) + BIRD_HALF_HEIGHT >= GROUND || hitsPipe(game)) {
            game.over = true;
            return 'over';
        }
        let scored = false;
        game.pipes.forEach((pipe) => {
            if (!pipe.passed && pipe.x + PIPE_WIDTH / 2 < BIRD_X) {
                pipe.passed = true;
                game.score++;
                scored = true;
            }
        });
        return scored ? 'scored' : 'moved';
    }

    // The medal a score earns ('bronze' from 10, 'silver' 20, 'gold' 30, 'platinum' 40), or null
    function medal(score) {
        return MEDALS.find(([least]) => score >= least)?.[1] ?? null;
    }

    /**
     * Plays a run of Flappy Bird again
     * @param {object} run - { seed, mode, tick, length (steps), inputs }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, length, inputs }) {
        if (mode !== null) return refuse('mode');
        if (tick !== TICK) return refuse('tick');
        const events = timeline(inputs);
        if (events.length === 0 || events[0].at !== 0) return refuse('input'); // The game starts with a flap
        const game = newGame(seededRandom(seed));

        // The inputs after `done` steps (none once the game has ended): what's wrong with one, or null
        let next = 0;
        function playInputs(done) {
            for (; next < events.length && events[next].at === done; next += 1) {
                if (game.over) return 'after-end';
                if (events[next].code !== 'F') return 'input';
                flap(game);
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

    return Object.freeze({
        TICK, WIDTH, GROUND, BIRD_X, BIRD_START, PIPE_WIDTH, PIPE_SPEED, GAP, seededRandom, newGame, flap, step, medal, simulate,
    });
})();

export const { simulate } = GameRules;
