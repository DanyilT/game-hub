// tic-tac-toe's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch tic-tac-toe), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: 7bc41a3ca0a4413a1187661edc686fa9ab803c8769a1c4beb0aabff3ef06c211

/**
 * Tic-Tac-Toe: the rules
 *
 * Everything a match of Tic-Tac-Toe against the bot needs to play out, and nothing else. js/tic-tac-toe.js plays the
 * game through these functions, and GameHub's server plays a run again with GameRules.simulate(), so a match plays out
 * the same in both.
 * - A match is 5 rounds on a 3 × 3 board. X always moves first: the player is X in rounds 1, 3 and 5, and O in rounds 2
 *   and 4 (then the bot opens). Three in a row wins the round; a full board without one is a draw.
 * - A round won is 2 points, a draw 1. The match is won by whoever has more points after 5 rounds (or drawn).
 * - The bot plays by minimax: it knows the best moves (a quicker win is better, a later loss less bad). At each move it
 *   draws two numbers from the run's seed: the first says whether it slips (picks any free cell instead: often on
 *   Easy, sometimes on Medium, never on Hard), the second which of its choices it takes. So Hard can't be beaten.
 * - Inputs: the player's moves only, the cell 0 to 8 (row by row). The bot's answers aren't inputs: they come from these
 *   rules, so a replay (or GameHub's server) works them out again, and nobody can change them.
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const LEVELS = Object.freeze({
        easy: Object.freeze({ name: 'Easy', slips: 0.6 }),
        medium: Object.freeze({ name: 'Medium', slips: 0.2 }),
        hard: Object.freeze({ name: 'Hard', slips: 0 }),
    });
    const ROUNDS = 5;
    const POINTS = Object.freeze({ won: 2, drawn: 1, lost: 0 });
    const X = 1;
    const O = 2;
    const LINES = Object.freeze([[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]]);

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

    // The other mark
    function other(mark) {
        return mark === X ? O : X;
    }

    // The line of three a mark has on the board ([a, b, c]), or null
    function winningLine(board) {
        return LINES.find(([a, b, c]) => board[a] !== 0 && board[a] === board[b] && board[a] === board[c]) ?? null;
    }

    // The free cells
    function freeCells(board) {
        return board.flatMap((mark, cell) => (mark === 0 ? [cell] : []));
    }

    // How good the board is for the mark to move (minimax, both sides playing their best): a win is 1 + the free cells
    // left then (so sooner is better), a loss the same below 0, a draw 0. Each board is worked out once.
    const values = new Map();
    function value(board, mark) {
        const key = board.join('') + mark;
        if (values.has(key)) return values.get(key);
        const free = freeCells(board);
        let best;
        if (winningLine(board)) {
            best = -(1 + free.length); // The other mark just won
        } else if (free.length === 0) {
            best = 0;
        } else {
            best = -Infinity;
            for (const cell of free) {
                board[cell] = mark;
                best = Math.max(best, -value(board, other(mark)));
                board[cell] = 0;
            }
        }
        values.set(key, best);
        return best;
    }

    // The best cells for the mark to move on the board: all those as good as the best
    function bestMoves(board, mark) {
        const scored = freeCells(board).map((cell) => {
            board[cell] = mark;
            const score = -value(board, other(mark));
            board[cell] = 0;
            return { cell, score };
        });
        const top = Math.max(...scored.map(({ score }) => score));
        return scored.filter(({ score }) => score === top).map(({ cell }) => cell);
    }

    // A new match at a level ('easy', 'medium' or 'hard'): the player is X, and moves first. random gives the run's
    // numbers.
    function newMatch(random, level) {
        return {
            random,
            level,
            round: 1,
            board: Array(9).fill(0),
            player: X, // The player's mark this round
            turn: X, // Whose mark goes next
            results: [], // Each round's, for the player: 'won', 'drawn' or 'lost'
            points: 0,
            botPoints: 0,
            over: false,
        };
    }

    // The bot's move: two numbers from the run, the first for a slip (any free cell), the second for which one
    function botCell(game) {
        const slip = game.random() < LEVELS[game.level].slips;
        const pick = game.random();
        const choices = slip ? freeCells(game.board) : bestMoves(game.board, game.turn);
        return choices[Math.floor(pick * choices.length)];
    }

    // A mark on a cell, for whoever's turn it is
    function place(game, cell, who, events) {
        game.board[cell] = game.turn;
        events.push({ type: 'mark', who, cell, mark: game.turn });
        game.turn = other(game.turn);
    }

    // The round's end, if it has ended: the points, then the next round (the bot opening when it's X), or the match's end.
    // True if it ended.
    function endOfRound(game, events) {
        const line = winningLine(game.board);
        if (!line && freeCells(game.board).length > 0) return false;
        const result = !line ? 'drawn' : game.board[line[0]] === game.player ? 'won' : 'lost';
        game.results.push(result);
        game.points += POINTS[result];
        game.botPoints += POINTS[result === 'won' ? 'lost' : result === 'lost' ? 'won' : 'drawn'];
        events.push({ type: 'round', result, line });

        if (game.round === ROUNDS) {
            game.over = true;
            events.push({ type: 'match', outcome: outcome(game) });
            return true;
        }
        game.round++;
        game.board = Array(9).fill(0);
        game.player = game.round % 2 === 1 ? X : O;
        game.turn = X;
        events.push({ type: 'round-start', round: game.round, player: game.player });
        if (game.player === O) place(game, botCell(game), 'bot', events);
        return true;
    }

    /**
     * The player's move on a cell (0 to 8), and what follows: the bot's answer, the end of the round, the next round
     * @return {object[]|null} - what happened, in order ({ type: 'mark', who, cell, mark }, { type: 'round', result, line },
     *   { type: 'round-start', round, player }, { type: 'match', outcome }), or null if the move isn't allowed
     */
    function play(game, cell) {
        if (game.over || game.turn !== game.player || !Number.isInteger(cell) || cell < 0 || cell > 8 || game.board[cell] !== 0) {
            return null;
        }
        const events = [];
        place(game, cell, 'player', events);
        if (!endOfRound(game, events)) {
            place(game, botCell(game), 'bot', events);
            endOfRound(game, events);
        }
        return events;
    }

    // How the match came out, for the player: 'won', 'lost', or 'over' (drawn)
    function outcome(game) {
        if (game.points > game.botPoints) return 'won';
        return game.points < game.botPoints ? 'lost' : 'over';
    }

    // The rounds as wins, draws and losses: '2-1-2'
    function record(game) {
        const count = (result) => game.results.filter((each) => each === result).length;
        return `${count('won')}-${count('drawn')}-${count('lost')}`;
    }

    // The match's result, for GameHub's list of runs
    function result(game) {
        return [
            { label: 'Level', value: LEVELS[game.level].name, format: null },
            { label: 'Points', value: game.points, format: null },
            { label: 'Won-drawn-lost', value: record(game), format: null },
        ];
    }

    // A match under way as plain data, to save with it (all but its random numbers, which its run keeps)
    function saveState(game) {
        const { level, round, board, player, turn, results, points, botPoints } = game;
        return { level, round, board: board.slice(), player, turn, results: results.slice(), points, botPoints };
    }

    // The match saveState() gave, carrying on with random (the run's numbers, from where they were); null if it isn't
    // one still being played
    function loadState(data, random) {
        if (data === null || typeof data !== 'object' || !Object.hasOwn(LEVELS, data.level)) return null;
        const { round, board, player, turn, results, points, botPoints } = data;
        if (!Number.isInteger(round) || round < 1 || round > ROUNDS || !Array.isArray(board) || board.length !== 9
            || !board.every((mark) => mark === 0 || mark === X || mark === O) || player !== (round % 2 === 1 ? X : O)
            || turn !== player || !Array.isArray(results) || results.length !== round - 1
            || !results.every((each) => Object.hasOwn(POINTS, each)) || winningLine(board)) {
            return null;
        }
        const game = newMatch(random, data.level);
        game.results = results.slice();
        game.points = results.reduce((sum, each) => sum + POINTS[each], 0);
        game.botPoints = results.reduce((sum, each) => sum + POINTS[each === 'won' ? 'lost' : each === 'lost' ? 'won' : 'drawn'], 0);
        if (game.points !== points || game.botPoints !== botPoints) return null;
        Object.assign(game, { round, board: board.slice(), player, turn });
        return game;
    }

    /**
     * Plays a run of Tic-Tac-Toe again: the player's moves, and the bot's answers worked out again
     * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, inputs }) {
        if (!Object.hasOwn(LEVELS, mode)) return refuse('mode');
        if (tick !== null) return refuse('tick');
        const game = newMatch(seededRandom(seed), mode);
        for (const { code } of timeline(inputs)) {
            if (game.over) return refuse('after-end');
            if (play(game, code) === null) return refuse('input');
        }
        if (!game.over) return refuse('not-over');
        return { ok: true, outcome: outcome(game), score: game.points, timeMs: null, result: result(game) };
    }

    return Object.freeze({
        LEVELS, ROUNDS, X, O, seededRandom, winningLine, freeCells, bestMoves, newMatch, play, outcome, result, saveState, loadState,
        simulate,
    });
})();

export const { simulate } = GameRules;
