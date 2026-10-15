// solitaire's rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch solitaire), made by `npm run games:pull`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: be73e78b1cf36597cb3979e295c66f57fc4cc2295598b3261a7b99dbf8bc0fa8

/**
 * Solitaire: the rules
 *
 * Everything a game of Solitaire (Klondike, as Windows 7 played it) needs to play out, and nothing else. js/solitaire.js
 * plays the game through these functions, and GameHub's server plays a run again with GameRules.simulate(), so a game
 * plays out the same in both.
 * - The deck is shuffled with the run's numbers (52 of them, Fisher–Yates) and dealt into 7 columns: 1 card in the
 *   first, up to 7 in the last, the top one of each face up. The other 24 are the stock.
 * - Eight levels (a run's mode): Draw One or Draw Three, each with Standard scoring (timed, or untimed), Vegas scoring
 *   or no scoring ('standard-1', 'standard-3-untimed', 'vegas-3', 'none-1', …).
 * - A card is a number, 0 to 51: its suit (0 clubs, 1 diamonds, 2 hearts, 3 spades) × 13, + its rank − 1 (ace 0 … king
 *   12). Diamonds and hearts are red.
 * - Inputs, as short texts:
 *   - 'D': deal from the stock onto the waste (1 card, or 3); with the stock empty, turn the waste over into the stock
 *     again (a new pass: Vegas allows 1 pass with Draw One, 3 with Draw Three).
 *   - A move: where from, where to, and how many cards when more than one. W is the waste, a to d the four foundations,
 *     0 to 6 the columns: 'W3' (the waste's card onto column 3), '2b' (column 2's top card onto foundation b), '354'
 *     (column 3's top 4 cards onto column 5), 'a6' (foundation a's card back onto column 6).
 *   - 'A': every card that can go onto a foundation goes, again and again (the waste's, then the columns' left to
 *     right; an ace onto the first empty foundation).
 *   - 'U': undo the last input (one, as in Windows).
 *   - 'X': give up (the last input of a game that wasn't won). The page gives up by itself when there's no useful move
 *     left (isStuck()): the game is lost.
 * - A column takes a card one lower and of the other colour, or a king when it's empty. A foundation takes the ace,
 *   then the cards of its suit in order. A face-down card left on top of a column turns over by itself. Moving all 52
 *   onto the foundations wins.
 * - The time runs from the first input, by the run's clock (which leaves out the time the page was hidden).
 * - Standard scoring: +10 a card onto a foundation; +5 a card from the waste onto a column, or a card turned over; −15
 *   a card from a foundation back onto a column; −100 each new pass with Draw One, −20 each new pass after the third
 *   with Draw Three. The points never go below 0. Timed, −2 every 10 seconds (the score never below 0), and a win
 *   taking more than 30 seconds gets a bonus of 700,000 ÷ its seconds; untimed, neither.
 * - Vegas scoring: −$52 for the deal, +$5 a card onto a foundation, −$5 a card taken back off one.
 *
 * GameHub uses this file as it is, and adds `export const { simulate } = GameRules;` after it to make it a module. So it
 * declares nothing but GameRules, and uses nothing but the language: no page, timers, storage, Math.random or Date.
 */
const GameRules = (() => {
    const SUITS = Object.freeze(['clubs', 'diamonds', 'hearts', 'spades']);
    const RANKS = Object.freeze(['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king']);
    const COLUMNS = 7;
    const FOUNDATIONS = 'abcd';
    // The levels: each draw with Standard scoring (timed, or untimed), Vegas or none
    const MODES = Object.freeze(Object.fromEntries([1, 3].flatMap((draw) => {
        const drawName = `Draw ${draw === 1 ? 'One' : 'Three'}`;
        return [
            [`standard-${draw}`, { scoring: 'standard', draw, timed: true, name: `${drawName}, Standard` }],
            [`standard-${draw}-untimed`, { scoring: 'standard', draw, timed: false, name: `${drawName}, Standard, untimed` }],
            [`vegas-${draw}`, { scoring: 'vegas', draw, timed: true, name: `${drawName}, Vegas` }],
            [`none-${draw}`, { scoring: 'none', draw, timed: true, name: `${drawName}, No scoring` }],
        ].map(([mode, settings]) => [mode, Object.freeze(settings)]);
    })));
    const VEGAS_PASSES = Object.freeze({ 1: 1, 3: 3 }); // passes through the stock Vegas allows
    const VEGAS_ANTE = -52;
    const BONUS = 700000; // ÷ a win's seconds, when it took more than BONUS_AFTER
    const BONUS_AFTER = 30;
    const SEARCH_LIMIT = 1000; // positions isStuck() looks through at most (a few dozen ms)

    const suitOf = (card) => Math.floor(card / 13);
    const rankOf = (card) => card % 13 + 1; // 1 ace … 13 king
    const isRed = (card) => suitOf(card) === 1 || suitOf(card) === 2;
    const cardName = (card) => `${RANKS[rankOf(card) - 1]} of ${SUITS[suitOf(card)]}`;

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

    /**
     * A new game at a level (a mode), dealt from the run's numbers
     * @param {function} random - the run's numbers (52 are taken)
     * @param {string} mode - 'standard-1', 'vegas-3', …
     */
    function newGame(random, mode) {
        const deck = Array.from({ length: 52 }, (_, card) => card);
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
        const tableau = Array.from({ length: COLUMNS }, () => ({ cards: [], down: 0 }));
        for (let row = 0; row < COLUMNS; row++) {
            for (let col = row; col < COLUMNS; col++) tableau[col].cards.push(deck.pop());
        }
        tableau.forEach((column) => {
            column.down = column.cards.length - 1; // the top card face up
        });
        return {
            mode,
            stock: deck, // the top card last
            waste: [],
            fan: 0, // how many of the waste's top cards are spread out (Draw Three: the last deal's)
            foundations: [[], [], [], []],
            tableau,
            passes: 1, // the pass through the stock under way
            points: MODES[mode].scoring === 'vegas' ? VEGAS_ANTE : 0, // Standard: before the time; Vegas: the dollars
            startedAt: null, // ms by the run's clock: the first input
            endedAt: null, // the last one: the win, or giving up
            over: false,
            won: false,
            undo: null, // the game before the last input (undo())
        };
    }

    // The parts of a game an undo goes back to (all but the time, and the undo itself)
    function snapshot(game) {
        return {
            stock: game.stock.slice(),
            waste: game.waste.slice(),
            fan: game.fan,
            foundations: game.foundations.map((pile) => pile.slice()),
            tableau: game.tableau.map(({ cards, down }) => ({ cards: cards.slice(), down })),
            passes: game.passes,
            points: game.points,
        };
    }

    // Standard scoring's points never go below 0; Vegas' dollars can
    function addPoints(game, points) {
        const { scoring } = MODES[game.mode];
        if (scoring === 'standard') game.points = Math.max(0, game.points + points);
        if (scoring === 'vegas') game.points += points;
    }

    // What an input means: { type: 'deal' | 'move' | 'auto' | 'undo' | 'give-up', … }, or null if it's none
    function parse(code) {
        if (typeof code !== 'string') return null;
        const simple = { D: 'deal', A: 'auto', U: 'undo', X: 'give-up' }[code];
        if (simple) return { type: simple };
        const found = /^([Wa-d0-6])([a-d0-6])([2-9]|1[0-3])?$/.exec(code);
        if (!found || found[1] === found[2]) return null;
        return { type: 'move', from: found[1], to: found[2], count: found[3] ? Number(found[3]) : 1 };
    }

    // A pile's cards by its letter: W the waste, a to d the foundations, 0 to 6 the columns
    function pileOf(game, letter) {
        if (letter === 'W') return game.waste;
        if (FOUNDATIONS.includes(letter)) return game.foundations[FOUNDATIONS.indexOf(letter)];
        return game.tableau[Number(letter)].cards;
    }

    // Whether a card can go onto a foundation (its suit's next, or an ace onto an empty one)
    function fitsFoundation(pile, card) {
        if (pile.length === 0) return rankOf(card) === 1;
        const top = pile[pile.length - 1];
        return suitOf(top) === suitOf(card) && rankOf(card) === rankOf(top) + 1;
    }

    // Whether a card can go onto a column (one lower and of the other colour, or a king onto an empty one; never onto a
    // face-down card)
    function fitsColumn(column, card) {
        if (column.cards.length === 0) return rankOf(card) === 13;
        if (column.down >= column.cards.length) return false;
        const top = column.cards[column.cards.length - 1];
        return rankOf(card) === rankOf(top) - 1 && isRed(card) !== isRed(top);
    }

    // Whether a move can be made: the cards are there to take (face up), and they fit where they go
    function canMove(game, { from, to, count }) {
        const source = pileOf(game, from);
        if (count > source.length) return false;
        if (/[0-6]/.test(from)) {
            const column = game.tableau[Number(from)];
            if (count > column.cards.length - column.down) return false; // only face-up cards move
        } else if (count !== 1) {
            return false; // one card at a time off the waste or a foundation
        }
        const first = source[source.length - count];
        if (FOUNDATIONS.includes(to)) return count === 1 && !FOUNDATIONS.includes(from) && fitsFoundation(pileOf(game, to), first);
        return fitsColumn(game.tableau[Number(to)], first);
    }

    // A face-down card left on top of a column turns over by itself (Standard: +5)
    function turnOver(game, col) {
        const column = game.tableau[col];
        if (column.cards.length === 0 || column.down < column.cards.length) return;
        column.down--;
        if (MODES[game.mode].scoring === 'standard') addPoints(game, 5);
    }

    // Make a move (canMove() said it can be made), with its points
    function move(game, { from, to, count }) {
        const source = pileOf(game, from);
        const cards = source.splice(source.length - count, count);
        pileOf(game, to).push(...cards);
        if (from === 'W') game.fan = game.waste.length === 0 ? 0 : Math.max(1, game.fan - 1);
        if (/[0-6]/.test(from)) turnOver(game, Number(from));
        const toFoundation = FOUNDATIONS.includes(to);
        const { scoring } = MODES[game.mode];
        if (scoring === 'standard') {
            if (toFoundation) addPoints(game, 10);
            else if (from === 'W') addPoints(game, 5);
            else if (FOUNDATIONS.includes(from)) addPoints(game, -15);
        } else if (scoring === 'vegas') {
            if (toFoundation) addPoints(game, 5);
            else if (FOUNDATIONS.includes(from)) addPoints(game, -5);
        }
    }

    // Whether the stock can be dealt from, or turned over again (Vegas: only as many passes as it allows)
    function canDeal(game) {
        if (game.stock.length > 0) return true;
        if (game.waste.length === 0) return false;
        const { scoring, draw } = MODES[game.mode];
        return scoring !== 'vegas' || game.passes < VEGAS_PASSES[draw];
    }

    // Deal 1 or 3 cards onto the waste, or turn the waste over into the stock (a new pass: Standard takes points)
    function deal(game) {
        const { scoring, draw } = MODES[game.mode];
        if (game.stock.length > 0) {
            const count = Math.min(draw, game.stock.length);
            for (let i = 0; i < count; i++) game.waste.push(game.stock.pop());
            game.fan = count;
            return;
        }
        game.stock = game.waste.reverse(); // the first card dealt is on top again
        game.waste = [];
        game.fan = 0;
        game.passes++;
        if (scoring === 'standard' && draw === 1) addPoints(game, -100);
        if (scoring === 'standard' && draw === 3 && game.passes > 3) addPoints(game, -20);
    }

    // The foundation a card can go onto now ('a' to 'd'), or null: its suit's, or for an ace the first empty one
    function foundationFor(game, card) {
        for (let i = 0; i < 4; i++) {
            if (fitsFoundation(game.foundations[i], card)) return FOUNDATIONS[i];
        }
        return null;
    }

    // The next card that can go onto a foundation (the waste's, then the columns' left to right), as a move, or null
    function nextToFoundation(game) {
        for (const from of ['W', '0', '1', '2', '3', '4', '5', '6']) {
            const pile = pileOf(game, from);
            if (pile.length === 0) continue;
            if (from !== 'W' && game.tableau[Number(from)].down >= pile.length) continue;
            const to = foundationFor(game, pile[pile.length - 1]);
            if (to) return { type: 'move', from, to, count: 1 };
        }
        return null;
    }

    // The cards dealing can bring to the top of the waste, without any other move: the waste's top card now, and each one
    // a deal would show, round the whole stock (and only through the passes Vegas has left)
    function reachable(game) {
        const deck = { ...snapshot(game), mode: game.mode };
        const cards = new Set();
        if (deck.waste.length) cards.add(deck.waste[deck.waste.length - 1]);
        const passes = deck.passes;
        for (let i = 0; i < 120 && canDeal(deck) && deck.passes < passes + 2; i++) {
            deal(deck);
            if (deck.waste.length) cards.add(deck.waste[deck.waste.length - 1]);
        }
        return [...cards];
    }

    /**
     * Whether a game has no useful move left, so it's lost. A move is useful when it leads, now or after moves that only
     * rearrange the columns and the foundations, to progress: a face-down card turned over, a card more on the
     * foundations, or a place for a card the stock can bring (dealing round and round, or moving cards back and forth,
     * changes nothing). The search stops after SEARCH_LIMIT positions, and then the game isn't called lost.
     */
    function isStuck(game) {
        if (game.over) return false;
        const fromStock = reachable(game);
        const startDown = game.tableau.reduce((total, column) => total + column.down, 0);
        const startHome = cardsHome(game);
        const progress = (position) => position.tableau.reduce((total, column) => total + column.down, 0) < startDown
            || cardsHome(position) > startHome
            || fromStock.some((card) => position.foundations.some((pile) => fitsFoundation(pile, card))
                || position.tableau.some((column) => fitsColumn(column, card)));
        const copy = (position) => ({
            mode: position.mode, stock: [], waste: [], fan: 0, points: 0,
            tableau: position.tableau.map(({ cards, down }) => ({ cards: cards.slice(), down })),
            foundations: position.foundations.map((pile) => pile.slice()),
        });
        const key = (position) => `${position.tableau.map(({ cards, down }) => `${down}:${cards.join(',')}`).join('|')}/${position.foundations.map((pile) => pile.length).join(',')}`;
        // The moves within the columns and the foundations from a position
        const movesFrom = (position) => {
            const moves = [];
            position.tableau.forEach(({ cards, down }, col) => {
                for (let i = down; i < cards.length; i++) {
                    for (let to = 0; to < COLUMNS; to++) {
                        if (to !== col && fitsColumn(position.tableau[to], cards[i])) moves.push({ from: String(col), to: String(to), count: cards.length - i });
                    }
                }
                const top = cards[cards.length - 1];
                if (top === undefined) return;
                position.foundations.forEach((pile, f) => {
                    if (fitsFoundation(pile, top)) moves.push({ from: String(col), to: FOUNDATIONS[f], count: 1 });
                });
            });
            position.foundations.forEach((pile, f) => {
                const top = pile[pile.length - 1];
                if (top === undefined) return;
                for (let to = 0; to < COLUMNS; to++) {
                    if (fitsColumn(position.tableau[to], top)) moves.push({ from: FOUNDATIONS[f], to: String(to), count: 1 });
                }
            });
            return moves;
        };

        const first = copy(game);
        if (progress(first)) return false;
        const seen = new Set([key(first)]);
        const queue = [first];
        while (queue.length) {
            const position = queue.shift();
            for (const found of movesFrom(position)) {
                const next = copy(position);
                move(next, { type: 'move', ...found });
                if (progress(next)) return false;
                const nextKey = key(next);
                if (seen.has(nextKey)) continue;
                if (seen.size >= SEARCH_LIMIT) return false; // too many to look through: not called lost
                seen.add(nextKey);
                queue.push(next);
            }
        }
        return true;
    }

    // Whether an input can be played now (the game isn't over, and the input means something that can be done)
    function isLegal(game, code) {
        const input = parse(code);
        if (!input || game.over) return false;
        if (input.type === 'deal') return canDeal(game);
        if (input.type === 'move') return canMove(game, input);
        if (input.type === 'auto') return nextToFoundation(game) !== null;
        if (input.type === 'undo') return game.undo !== null;
        return true; // giving up
    }

    /**
     * Plays an input, at a time
     * @param {object} game
     * @param {string} code - 'D', 'W3', '354', 'A', 'U' or 'X' (see the top of this file)
     * @param {number} at - ms, by the run's clock
     * @return {boolean} - whether it could be played (if not, nothing changed)
     */
    function play(game, code, at) {
        if (!isLegal(game, code)) return false;
        const input = parse(code);
        if (game.startedAt === null) game.startedAt = at;
        if (input.type === 'give-up') {
            game.over = true;
            game.endedAt = at;
            return true;
        }
        if (input.type === 'undo') {
            Object.assign(game, game.undo);
            game.undo = null;
            return true;
        }
        const before = snapshot(game);
        if (input.type === 'deal') {
            deal(game);
        } else if (input.type === 'move') {
            move(game, input);
        } else {
            for (let next = nextToFoundation(game); next; next = nextToFoundation(game)) move(game, next);
        }
        game.undo = before;
        if (game.foundations.every((pile) => pile.length === 13)) {
            game.over = true;
            game.won = true;
            game.endedAt = at;
            game.undo = null;
        }
        return true;
    }

    // Whole seconds on the clock at a time (ms, the run's clock): from the first input, to the end once it's over
    function seconds(game, at) {
        if (game.startedAt === null) return 0;
        return Math.max(0, Math.floor(((game.over ? game.endedAt : at) - game.startedAt) / 1000));
    }

    // A timed win's bonus (Standard scoring): 700,000 ÷ its seconds, when it took more than 30
    function bonus(game) {
        const time = seconds(game, game.endedAt);
        return game.won && time > BONUS_AFTER ? Math.floor(BONUS / time) : 0;
    }

    // The score at a time: Standard, the points (timed: less 2 every 10 seconds, never below 0, and a win's bonus);
    // Vegas, the dollars; none without scoring
    function score(game, at) {
        const { scoring, timed } = MODES[game.mode];
        if (scoring === 'vegas') return game.points;
        if (scoring !== 'standard') return null;
        if (!timed) return game.points;
        return Math.max(0, game.points - 2 * Math.floor(seconds(game, at) / 10)) + bonus(game);
    }

    // Dollars as Windows showed them: $208, -$52
    function money(dollars) {
        return dollars < 0 ? `-$${-dollars}` : `$${dollars}`;
    }

    // How many cards are on the foundations
    function cardsHome(game) {
        return game.foundations.reduce((total, pile) => total + pile.length, 0);
    }

    // What a game that's over gave, for GameHub's list of runs: the level, the score (the dollars, or the cards on the
    // foundations without scoring) and the time
    function result(game) {
        const { scoring, name } = MODES[game.mode];
        const items = [{ label: 'Level', value: name, format: null }];
        if (scoring === 'standard') items.push({ label: 'Score', value: score(game, game.endedAt), format: null });
        else if (scoring === 'vegas') items.push({ label: 'Money', value: money(game.points), format: null });
        else items.push({ label: 'Cards', value: cardsHome(game), format: null });
        items.push({ label: 'Time', value: seconds(game, game.endedAt), format: 'time' });
        return items;
    }

    // A game as plain data, to save with it (all but its random numbers: the deal took them all)
    function saveState(game) {
        return { ...snapshot(game), mode: game.mode, startedAt: game.startedAt, undo: game.undo && snapshot(game.undo) };
    }

    // Whether saved parts (snapshot()'s) are a game this version can carry on: every card once, each pile as the rules
    // allow, and not won
    function isPlayable(data, mode) {
        const isCard = (card) => Number.isInteger(card) && card >= 0 && card < 52;
        const isCards = (cards) => Array.isArray(cards) && cards.every(isCard);
        if (data === null || typeof data !== 'object' || !isCards(data.stock) || !isCards(data.waste)) return false;
        if (!Array.isArray(data.foundations) || data.foundations.length !== 4 || !data.foundations.every(isCards)) return false;
        if (!Array.isArray(data.tableau) || data.tableau.length !== COLUMNS) return false;
        if (!data.tableau.every((column) => column !== null && typeof column === 'object' && isCards(column.cards)
            && Number.isInteger(column.down) && column.down >= 0
            && (column.down < column.cards.length || column.cards.length === 0))) return false; // the top card face up
        if (!Number.isInteger(data.fan) || data.fan < 0 || data.fan > Math.min(3, data.waste.length)) return false;
        if (!Number.isInteger(data.passes) || data.passes < 1 || !Number.isSafeInteger(data.points)) return false;
        const { scoring, draw } = MODES[mode];
        if (scoring === 'vegas' && data.passes > VEGAS_PASSES[draw]) return false;
        if (scoring === 'standard' && data.points < 0) return false;

        const all = [data.stock, data.waste, ...data.foundations, ...data.tableau.map((column) => column.cards)].flat();
        if (all.length !== 52 || new Set(all).size !== 52) return false;
        const foundationsRight = data.foundations.every((pile) => pile.every((card, i) => rankOf(card) === i + 1 && suitOf(card) === suitOf(pile[0])));
        const runsRight = data.tableau.every(({ cards, down }) => cards.slice(down).every((card, i, up) => i === 0
            || (rankOf(card) === rankOf(up[i - 1]) - 1 && isRed(card) !== isRed(up[i - 1]))));
        return foundationsRight && runsRight && !data.foundations.every((pile) => pile.length === 13);
    }

    // The game saveState() gave; null if it isn't one still being played
    function loadState(data) {
        if (data === null || typeof data !== 'object' || !Object.hasOwn(MODES, data.mode) || !isPlayable(data, data.mode)) return null;
        if (data.startedAt !== null && !(Number.isSafeInteger(data.startedAt) && data.startedAt >= 0)) return null;
        if (data.undo !== null && !isPlayable(data.undo, data.mode)) return null;
        const parts = snapshot(data);
        return {
            ...parts,
            mode: data.mode,
            startedAt: data.startedAt,
            endedAt: null,
            over: false,
            won: false,
            undo: data.undo === null ? null : snapshot(data.undo),
        };
    }

    /**
     * Plays a run of Solitaire again
     * @param {object} run - { seed, mode (the level), tick, length (ms), inputs (waits in ms) }
     * @return {object} - { ok: true, outcome, score, timeMs, result } or { ok: false, reason }
     */
    function simulate({ seed, mode, tick, inputs }) {
        if (typeof mode !== 'string' || !Object.hasOwn(MODES, mode)) return refuse('mode');
        if (tick !== null) return refuse('tick');
        const game = newGame(seededRandom(seed), mode);
        for (const { at, code } of timeline(inputs)) {
            if (game.over) return refuse('after-end');
            if (!play(game, code, at)) return refuse('input');
        }
        if (!game.over) return refuse('not-over');
        const { scoring } = MODES[mode];
        return {
            ok: true,
            outcome: game.won ? 'won' : 'lost',
            score: scoring === 'vegas' || (scoring === 'standard' && game.won) ? score(game, game.endedAt) : null,
            timeMs: game.won ? game.endedAt - game.startedAt : null,
            result: result(game),
        };
    }

    return Object.freeze({
        SUITS, RANKS, MODES, FOUNDATIONS, suitOf, rankOf, isRed, cardName, seededRandom, newGame, parse, isLegal, play,
        canDeal, canMove, foundationFor, nextToFoundation, fitsColumn, isStuck, seconds, score, money, cardsHome, result,
        saveState, loadState, simulate,
    });
})();

export const { simulate } = GameRules;
