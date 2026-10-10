// tetris's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch tetris), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: c29bc1f37ed671c1c5f45de45d15e08599ec1ef6f8cd456738b3769c3ce85987

/**
 * Tetris: the rules
 *
 * Everything a game of Tetris needs to play out, and nothing else. js/tetris.js plays the game through these functions,
 * and GameHub's server plays a run again with GameRules.simulate(), so a game plays out the same in both.
 * - A 10 × 20 board. The pieces are the seven tetrominoes, each drawn from the run's seed. A new piece starts at the top,
 *   in the middle.
 * - The game moves in steps of 50 ms. The piece falls a row every gameSpeed / 50 steps: 1000 ms at level 1, 100 ms less
 *   each level, down to 100 ms, counting again from each level-up. A piece that can't fall any further locks, and full
 *   rows clear.
 * - Inputs: 'L' and 'R' (move), 'U' (rotate a quarter turn clockwise, moving a column away from a wall or block when it
 *   doesn't fit), 'D' (down a row, or lock) and 'H' (hard drop: down as far as it goes, a point a row, and lock). Each
 *   comes after the steps before it.
 * - Score: 100, 300, 500 or 800 × the level for 1 to 4 rows cleared at once, and a level every 10 rows. The game ends
 *   when a new piece doesn't fit.
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const TICK = 50; // ms per step
    const COLS = 10;
    const ROWS = 20;
    const GAME_SPEED = 1000; // ms between falls at level 1
    const SHAPES = [
        // I piece
        [
            [0, 0, 0, 0],
            [1, 1, 1, 1],
            [0, 0, 0, 0],
            [0, 0, 0, 0]
        ],
        // J piece
        [
            [1, 0, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // L piece
        [
            [0, 0, 1],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // O piece
        [
            [1, 1],
            [1, 1]
        ],
        // S piece
        [
            [0, 1, 1],
            [1, 1, 0],
            [0, 0, 0]
        ],
        // T piece
        [
            [0, 1, 0],
            [1, 1, 1],
            [0, 0, 0]
        ],
        // Z piece
        [
            [1, 1, 0],
            [0, 1, 1],
            [0, 0, 0]
        ]
    ];
    const LINE_SCORES = [0, 100, 300, 500, 800]; // For 0 to 4 rows cleared at once, × the level
    const MOVES = ['L', 'R', 'U', 'D', 'H'];

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

    // A shape turned a quarter clockwise
    function rotate(matrix) {
        const N = matrix.length;
        const result = Array.from({ length: N }, () => Array(N).fill(0));
        for (let y = 0; y < N; y++) {
            for (let x = 0; x < N; x++) {
                result[x][N - 1 - y] = matrix[y][x];
            }
        }
        return result;
    }

    // A piece of a type (0 to 6, an index in SHAPES), at the top of the board, in the middle
    function newPiece(type) {
        const shape = SHAPES[type];
        return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
    }

    // The next piece, drawn from the run's numbers
    function randomPiece(game) {
        return newPiece(Math.floor(game.random() * SHAPES.length));
    }

    // Whether a shape at x, y would be off the board (sides or bottom) or on a block. Above the top is fine.
    function collision(game, x, y, shape) {
        for (let r = 0; r < shape.length; r++) {
            for (let c = 0; c < shape[r].length; c++) {
                if (!shape[r][c]) {
                    continue;
                }
                const newX = x + c;
                const newY = y + r;
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                if (newY < 0) {
                    continue;
                }
                if (game.board[newY][newX] !== 0) {
                    return true;
                }
            }
        }
        return false;
    }

    // The row the piece would land on, dropped straight down now: where a hard drop puts it (js/tetris.js draws a ghost piece there)
    function dropRow(game) {
        const piece = game.current;
        let y = piece.y;
        while (!collision(game, piece.x, y + 1, piece.shape)) y++;
        return y;
    }

    // The fall speed for the level; the next fall counts from now
    function updateGameSpeed(game) {
        game.gameSpeed = Math.max(100, GAME_SPEED - (game.level - 1) * 100);
        game.stepsSinceFall = 0;
    }

    // A new game: an empty board, the first piece and the next, from the run's numbers (random)
    function newGame(random) {
        const game = {
            random,
            board: Array.from({ length: ROWS }, () => Array(COLS).fill(0)), // 0, or a locked block's type + 1
            score: 0,
            level: 1,
            lines: 0,
            gameSpeed: GAME_SPEED,
            stepsSinceFall: 0, // Steps since the piece last fell by itself
            current: null,
            next: null,
            over: false,
        };
        game.current = randomPiece(game);
        game.next = randomPiece(game);
        updateGameSpeed(game);
        return game;
    }

    // A game under way as plain data, to save with it (all but its random numbers, which its run keeps)
    function saveState(game) {
        const piece = ({ type, shape, x, y }) => ({ type, shape: shape.map((row) => row.slice()), x, y });
        return {
            board: game.board.map((row) => row.slice()),
            current: piece(game.current),
            next: piece(game.next),
            score: game.score,
            level: game.level,
            lines: game.lines,
            stepsSinceFall: game.stepsSinceFall,
        };
    }

    // The game saveState() gave, carrying on with random (the run's numbers, from where they were); null if it isn't one
    function loadState(data, random) {
        const sameShape = (a, b) => a.length === b.length
            && a.every((row, y) => Array.isArray(row) && row.length === b[y].length && row.every((cell, x) => cell === b[y][x]));
        // A piece: one of the seven, turned one of its four ways, near the board
        const isPiece = (piece) => {
            if (piece === null || typeof piece !== 'object') return false;
            if (!Number.isInteger(piece.type) || piece.type < 0 || piece.type >= SHAPES.length || !Array.isArray(piece.shape)) return false;
            if (!Number.isInteger(piece.x) || !Number.isInteger(piece.y) || Math.abs(piece.x) > COLS || Math.abs(piece.y) > ROWS) return false;
            let shape = SHAPES[piece.type];
            for (let turn = 0; turn < 4; turn++, shape = rotate(shape)) {
                if (sameShape(shape, piece.shape)) return true;
            }
            return false;
        };
        const isCell = (cell) => Number.isInteger(cell) && cell >= 0 && cell <= SHAPES.length; // 0, or a type + 1
        if (data === null || typeof data !== 'object' || !Array.isArray(data.board) || data.board.length !== ROWS) return null;
        if (!data.board.every((row) => Array.isArray(row) && row.length === COLS && row.every(isCell))) return null;
        if (!isPiece(data.current) || !isPiece(data.next)) return null;
        if (!Number.isInteger(data.score) || !Number.isInteger(data.lines) || data.lines < 0) return null;
        if (data.level !== Math.floor(data.lines / 10) + 1) return null; // A level every 10 rows
        if (!Number.isInteger(data.stepsSinceFall) || data.stepsSinceFall < 0) return null;

        const piece = ({ type, shape, x, y }) => ({ type, shape: shape.map((row) => row.slice()), x, y });
        const game = {
            random,
            board: data.board.map((row) => row.slice()),
            score: data.score,
            level: data.level,
            lines: data.lines,
            gameSpeed: GAME_SPEED,
            stepsSinceFall: 0,
            current: piece(data.current),
            next: piece(data.next),
            over: false,
        };
        updateGameSpeed(game); // The level's fall speed
        game.stepsSinceFall = Math.min(data.stepsSinceFall, game.gameSpeed / TICK - 1);
        return game;
    }

    // Lock the piece where it is: full rows clear and score, and the next piece comes. 'over' if it doesn't fit.
    function lockPiece(game) {
        const piece = game.current;
        for (let y = 0; y < piece.shape.length; y++) {
            for (let x = 0; x < piece.shape[y].length; x++) {
                if (piece.shape[y][x] && piece.y + y >= 0) {
                    game.board[piece.y + y][piece.x + x] = piece.type + 1;
                }
            }
        }

        let linesCleared = 0;
        for (let y = ROWS - 1; y >= 0; y--) {
            if (game.board[y].every((cell) => cell !== 0)) {
                game.board.splice(y, 1);
                game.board.unshift(Array(COLS).fill(0));
                linesCleared++;
                y++; // The same row again, now that the rows above came down
            }
        }
        if (linesCleared > 0) {
            game.score += LINE_SCORES[linesCleared] * game.level;
            game.lines += linesCleared;
            const newLevel = Math.floor(game.lines / 10) + 1; // A level every 10 rows
            if (newLevel > game.level) {
                game.level = newLevel;
                updateGameSpeed(game);
            }
        }

        game.current = game.next;
        game.next = randomPiece(game);
        if (collision(game, game.current.x, game.current.y, game.current.shape)) {
            game.over = true; // The new piece doesn't fit
            return 'over';
        }
        return 'locked';
    }

    // The piece goes down a row, or locks if it can't: 'moved', 'locked' or 'over'
    function moveDown(game) {
        const piece = game.current;
        if (!collision(game, piece.x, piece.y + 1, piece.shape)) {
            piece.y++;
            return 'moved';
        }
        return lockPiece(game);
    }

    // An input ('L', 'R', 'U', 'D' or 'H'): 'moved' (or nothing changed), 'locked' or 'over'
    function move(game, code) {
        const piece = game.current;
        if (code === 'L') {
            if (!collision(game, piece.x - 1, piece.y, piece.shape)) piece.x--;
        } else if (code === 'R') {
            if (!collision(game, piece.x + 1, piece.y, piece.shape)) piece.x++;
        } else if (code === 'U') {
            const turned = rotate(piece.shape);
            let kick = 0;
            if (collision(game, piece.x, piece.y, turned)) {
                kick = piece.x > COLS / 2 ? -1 : 1; // Away from the nearer wall
            }
            if (!collision(game, piece.x + kick, piece.y, turned)) {
                piece.x += kick;
                piece.shape = turned;
            }
        } else if (code === 'D') {
            return moveDown(game);
        } else if (code === 'H') {
            const landing = dropRow(game);
            game.score += landing - piece.y; // A point a row
            piece.y = landing;
            return lockPiece(game);
        }
        return 'moved';
    }

    // One step: 'waiting' (not time to fall yet), or the fall: 'moved', 'locked' or 'over'
    function step(game) {
        game.stepsSinceFall++;
        if (game.stepsSinceFall < game.gameSpeed / TICK) {
            return 'waiting';
        }
        game.stepsSinceFall = 0;
        return moveDown(game);
    }

    /**
     * Plays a run of Tetris again
     * @param {object} run - { seed, mode, tick, length (steps), inputs }
     * @return {object} - { ok: true, outcome, score, timeMs, result, lines, level } or { ok: false, reason }
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
                if (!MOVES.includes(code)) return 'input';
                move(game, code);
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
        return {
            ok: true,
            outcome: 'over',
            score: game.score,
            timeMs: null,
            result: [{ label: 'Score', value: game.score, format: null }, { label: 'Lines', value: game.lines, format: null }],
            lines: game.lines,
            level: game.level,
        };
    }

    return Object.freeze({
        TICK, COLS, ROWS, MOVES, seededRandom, newGame, saveState, loadState, collision, dropRow, move, step, simulate,
    });
})();

export const { simulate } = GameRules;
