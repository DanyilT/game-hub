// minesweeper's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch minesweeper), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: 2951730164378e8634d615e1c7589d1266e40562a2d4250f94da62bbe2e6b13d

/**
 * Minesweeper: the rules
 *
 * Everything a game of Minesweeper needs to play out, and nothing else. js/minesweeper.js plays the game through these
 * functions, and GameHub's server plays a run again with GameRules.simulate(), so a game plays out the same in both.
 * - Three levels (a run's mode): Beginner (9 × 9, 10 mines), Intermediate (16 × 16, 40) and Expert (30 × 16, 99).
 * - The mines go in at the first open, never under it: a random row and column, again until there are enough. The numbers
 *   come from the run's seed, in that order.
 * - Inputs: one number a click, cell × 2 (+ 1 for a flag), the cells numbered row by row. Opening a flagged cell takes
 *   the flag off. Opening or flagging an open number whose flags are all there opens the cells around it (a chord). An
 *   empty cell opens the cells around it too.
 * - Opening a mine loses; opening every other cell wins. The time is from the first open to the last input, by the run's
 *   clock (which leaves out the time the page was hidden).
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const LEVELS = Object.freeze({
        beginner: Object.freeze({ rows: 9, cols: 9, mines: 10, name: 'Beginner' }),
        intermediate: Object.freeze({ rows: 16, cols: 16, mines: 40, name: 'Intermediate' }),
        expert: Object.freeze({ rows: 16, cols: 30, mines: 99, name: 'Expert' }),
    });

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

    // A run's inputs, [wait, code, wait, code, …] (each wait in ms since the input before), as [{ at, code }]
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

    // A new board at a level ('beginner', 'intermediate' or 'expert'), its mines still to come. random gives the run's
    // numbers.
    function newGame(random, level) {
        const { rows, cols, mines } = LEVELS[level];
        return {
            random,
            level,
            rows,
            cols,
            mines,
            board: Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighbors: 0, // The mines around it
            }))),
            firstClick: true, // No cell opened yet (the mines go in then)
            firstClickAt: 0, // The time of the first open (ms, the run's clock)
            revealedCount: 0,
            over: false,
            won: false,
            hit: null, // The mine that went off: { row, col }
        };
    }

    // Call visit(r, c) for each cell around a cell, until it returns false
    function around(game, row, col, visit) {
        for (let r = Math.max(0, row - 1); r <= Math.min(game.rows - 1, row + 1); r++) {
            for (let c = Math.max(0, col - 1); c <= Math.min(game.cols - 1, col + 1); c++) {
                if (r !== row || c !== col) {
                    if (visit(r, c) === false) return;
                }
            }
        }
    }

    // How many cells around a cell pass a test
    function countAround(game, row, col, test) {
        let count = 0;
        around(game, row, col, (r, c) => {
            if (test(game.board[r][c])) count++;
        });
        return count;
    }

    // Put the mines in, never under the first cell opened, and count each cell's neighbours
    function plantMines(game, firstRow, firstCol) {
        let planted = 0;
        while (planted < game.mines) {
            const r = Math.floor(game.random() * game.rows);
            const c = Math.floor(game.random() * game.cols);
            if ((r !== firstRow || c !== firstCol) && !game.board[r][c].isMine) {
                game.board[r][c].isMine = true;
                planted++;
            }
        }
        countNeighbors(game);
    }

    // Each cell's mines around it (the mines are in)
    function countNeighbors(game) {
        for (let r = 0; r < game.rows; r++) {
            for (let c = 0; c < game.cols; c++) {
                if (!game.board[r][c].isMine) game.board[r][c].neighbors = countAround(game, r, c, (cell) => cell.isMine);
            }
        }
    }

    // A board under way as plain data, to save with it (all but its random numbers, which its run keeps): each cell as
    // one number, 1 for a mine, + 2 if it's open, + 4 if it's flagged
    function saveState(game) {
        return {
            level: game.level,
            cells: game.board.map((row) => row.map((cell) => (cell.isMine ? 1 : 0) + (cell.isRevealed ? 2 : 0) + (cell.isFlagged ? 4 : 0))),
            firstClick: game.firstClick,
            firstClickAt: game.firstClickAt,
        };
    }

    // The board saveState() gave, carrying on with random (the run's numbers, from where they were); null if it isn't one
    // still being played
    function loadState(data, random) {
        if (data === null || typeof data !== 'object' || !Object.hasOwn(LEVELS, data.level)) return null;
        if (typeof data.firstClick !== 'boolean' || !Number.isInteger(data.firstClickAt) || data.firstClickAt < 0) return null;
        const game = newGame(random, data.level);
        const isCell = (value) => Number.isInteger(value) && value >= 0 && value <= 7;
        if (!Array.isArray(data.cells) || data.cells.length !== game.rows) return null;
        if (!data.cells.every((row) => Array.isArray(row) && row.length === game.cols && row.every(isCell))) return null;

        let mines = 0;
        for (let r = 0; r < game.rows; r++) {
            for (let c = 0; c < game.cols; c++) {
                const value = data.cells[r][c];
                const cell = game.board[r][c];
                cell.isMine = (value & 1) !== 0;
                cell.isRevealed = (value & 2) !== 0;
                cell.isFlagged = (value & 4) !== 0;
                if (cell.isMine) mines++;
                if (cell.isRevealed) game.revealedCount++;
                if (cell.isRevealed && (cell.isMine || cell.isFlagged)) return null; // An open mine, or a flag on an open cell
            }
        }
        // No mines before the first open, all of them after it, and not won yet
        if (mines !== (data.firstClick ? 0 : game.mines)) return null;
        if (data.firstClick ? game.revealedCount > 0 : game.revealedCount >= game.rows * game.cols - game.mines) return null;
        countNeighbors(game);
        game.firstClick = data.firstClick;
        game.firstClickAt = data.firstClickAt;
        return game;
    }

    // Open a cell, and the cells around it if it has no mines around (not a flagged one, or one already open)
    function revealCell(game, row, col) {
        if (row < 0 || row >= game.rows || col < 0 || col >= game.cols || game.board[row][col].isRevealed || game.board[row][col].isFlagged) return;
        game.board[row][col].isRevealed = true;
        game.revealedCount++;
        if (game.board[row][col].neighbors === 0) around(game, row, col, (r, c) => revealCell(game, r, c));
    }

    // A mine went off: the game is lost
    function lose(game, row, col) {
        game.over = true;
        game.won = false;
        game.hit = { row, col };
    }

    // Open the closed, unflagged cells around a cell (a mine among them loses)
    function revealUnflaggedNeighbors(game, row, col) {
        around(game, row, col, (r, c) => {
            if (game.board[r][c].isRevealed || game.board[r][c].isFlagged) return true;
            if (game.board[r][c].isMine) {
                lose(game, r, c);
                return false;
            }
            revealCell(game, r, c);
            return true;
        });
    }

    // Every cell but the mines open: the game is won
    function checkWinCondition(game) {
        if (game.over) return;
        if (game.revealedCount === game.rows * game.cols - game.mines) {
            game.over = true;
            game.won = true;
        }
    }

    // Opening or flagging an open number whose flags are all there opens the cells around it
    function chord(game, row, col) {
        const cell = game.board[row][col];
        if (cell.neighbors > 0 && countAround(game, row, col, (other) => other.isFlagged) === cell.neighbors) {
            revealUnflaggedNeighbors(game, row, col);
            checkWinCondition(game);
        }
    }

    // Flag or unflag a cell (an open number: a chord)
    function flagCell(game, row, col) {
        if (game.over) return;
        if (game.board[row][col].isRevealed) {
            chord(game, row, col);
            return;
        }
        game.board[row][col].isFlagged = !game.board[row][col].isFlagged;
    }

    // Open a cell, at a time (ms, the run's clock): a flagged one loses its flag, the first one puts the mines in, an
    // open number is a chord, and a mine loses
    function openCell(game, row, col, at) {
        if (game.over) return;
        if (game.board[row][col].isFlagged) {
            flagCell(game, row, col);
            return;
        }
        if (game.firstClick) {
            game.firstClick = false;
            game.firstClickAt = at;
            plantMines(game, row, col);
        }
        if (game.board[row][col].isRevealed && game.board[row][col].neighbors > 0) {
            chord(game, row, col);
            return;
        }
        if (game.board[row][col].isMine) {
            lose(game, row, col);
            return;
        }
        revealCell(game, row, col);
        checkWinCondition(game);
    }

    /**
     * Plays a run of Minesweeper again
     * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, inputs }) {
        const level = LEVELS[mode];
        if (!level) return refuse('mode');
        if (tick !== null) return refuse('tick');
        const game = newGame(seededRandom(seed), mode);

        const events = timeline(inputs);
        for (const { at, code } of events) {
            if (game.over) return refuse('after-end');
            if (!Number.isSafeInteger(code) || code < 0 || code >= game.rows * game.cols * 2) return refuse('input');
            const cell = Math.floor(code / 2);
            const row = Math.floor(cell / game.cols);
            const col = cell % game.cols;
            if (code % 2) flagCell(game, row, col);
            else openCell(game, row, col, at);
        }
        if (!game.over) return refuse('not-over');
        const last = events[events.length - 1].at;
        return {
            ok: true,
            outcome: game.won ? 'won' : 'lost',
            score: null,
            timeMs: game.won ? last - game.firstClickAt : null,
            result: [
                { label: 'Level', value: level.name, format: null },
                { label: 'Time', value: Math.floor((last - game.firstClickAt) / 1000), format: 'time' },
            ],
        };
    }

    return Object.freeze({ LEVELS, seededRandom, newGame, saveState, loadState, openCell, flagCell, simulate });
})();

export const { simulate } = GameRules;
