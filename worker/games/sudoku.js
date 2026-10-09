// sudoku's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch sudoku), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: f064c2a0cc5b7d044cc6ee06654a70856f5ae046ee6c50e3e8e75f3ae0315e30

/**
 * Sudoku: the rules
 *
 * Everything a game of Sudoku needs to play out, and nothing else. js/sudoku.js plays the game through these functions,
 * and GameHub's server plays a run again with GameRules.simulate(), so a game plays out the same in both.
 * - The puzzle: a full grid, filled in cell by cell (row by row, trying the digits in a shuffled order, backtracking),
 *   then a shuffled list of every cell, the first 20 to 70 of them emptied (by level: a run's mode). The shuffles take
 *   the run's random numbers, in that order.
 * - Inputs: one number a change, cell × 10 + the digit (0 empties the cell), the cells numbered row by row. The clues
 *   can't change.
 * - The puzzle is solved when every cell is filled and no row, column or 3 × 3 box has a digit twice (it needn't be the
 *   grid it was made from). The time is the run's clock at the solving change (the time on screen, across visits).
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const LEVELS = Object.freeze({
        beginner: Object.freeze({ remove: 20, name: 'For a Bread' }), // 61 of the 81 cells given
        easy: Object.freeze({ remove: 40, name: 'Easy' }),
        medium: Object.freeze({ remove: 50, name: 'Medium' }),
        hard: Object.freeze({ remove: 60, name: 'Hard' }),
        expert: Object.freeze({ remove: 70, name: 'Expert' }), // 11 given
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

    // Whether a digit can go in a cell: it isn't in the cell's row, column or 3 × 3 box already
    function isValidPlacement(board, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (board[row][x] === num) return false;
        }
        for (let y = 0; y < 9; y++) {
            if (board[y][col] === num) return false;
        }
        const subgridRow = Math.floor(row / 3) * 3;
        const subgridCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[subgridRow + i][subgridCol + j] === num) return false;
            }
        }
        return true;
    }

    /**
     * A puzzle: its full grid (solution) and its clues (initial, 0 where a cell is empty)
     * @param {function} random - the run's numbers
     * @param {string} level - 'beginner', 'easy', 'medium', 'hard' or 'expert'
     * @return {object} - { solution, initial }, 9 × 9 arrays of 0-9
     */
    function makePuzzle(random, level) {
        // Shuffle an array in place (Fisher-Yates)
        function shuffle(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }

        // The first empty cell, row by row: [row, col], or null
        function findEmptyCell(grid) {
            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    if (grid[row][col] === 0) return [row, col];
                }
            }
            return null;
        }

        // Fill the grid by backtracking, trying the digits in a shuffled order: true once it's full
        function solve(grid) {
            const emptyCell = findEmptyCell(grid);
            if (!emptyCell) return true;
            const [row, col] = emptyCell;
            const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
            shuffle(digits);
            for (const num of digits) {
                if (isValidPlacement(grid, row, col, num)) {
                    grid[row][col] = num;
                    if (solve(grid)) return true;
                    grid[row][col] = 0; // Backtrack
                }
            }
            return false;
        }

        const solution = Array.from({ length: 9 }, () => Array(9).fill(0));
        solve(solution);

        // The clues: the full grid with a shuffled list's first cells emptied
        const initial = solution.map((row) => row.slice());
        const positions = [];
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) positions.push([row, col]);
        }
        shuffle(positions);
        for (let i = 0; i < LEVELS[level].remove; i++) {
            const [row, col] = positions[i];
            initial[row][col] = 0;
        }
        return { solution, initial };
    }

    // Whether the board is solved: every cell filled, and no row, column or box with a digit twice
    function isSolved(board) {
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
    }

    // Put a digit in a cell (0 empties it): 'clue' (a clue can't change, so nothing changed), 'solved' or 'entered'
    function enter(board, initial, row, col, digit) {
        if (initial[row][col] > 0) return 'clue';
        board[row][col] = digit;
        return digit > 0 && isSolved(board) ? 'solved' : 'entered';
    }

    /**
     * Plays a run of Sudoku again
     * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, inputs }) {
        const level = LEVELS[mode];
        if (!level) return refuse('mode');
        if (tick !== null) return refuse('tick');
        const { initial } = makePuzzle(seededRandom(seed), mode);
        const board = initial.map((row) => row.slice());

        const events = timeline(inputs);
        let wonAt = null;
        for (const { at, code } of events) {
            if (wonAt !== null) return refuse('after-end');
            if (!Number.isSafeInteger(code) || code < 0 || code >= 810) return refuse('input');
            const cell = Math.floor(code / 10);
            const entered = enter(board, initial, Math.floor(cell / 9), cell % 9, code % 10);
            if (entered === 'clue') return refuse('clue');
            if (entered === 'solved') wonAt = at;
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
    }

    return Object.freeze({ LEVELS, seededRandom, makePuzzle, isValidPlacement, isSolved, enter, simulate });
})();

export const { simulate } = GameRules;
