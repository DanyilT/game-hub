// The made-up world Storybook's fake Supabase serves (mocks/supabase.js): players, friends, favorites,
// ratings, play time, records. Fixed, so every story looks the same each time. Times are relative to
// when the story opens ("5 min ago" stays 5 minutes ago).

const now = Date.now();
export const ago = (minutes) => new Date(now - minutes * 60_000).toISOString();
const MIN = 1;
const HOUR = 60;
const DAY = 24 * HOUR;

// A picture for a player, drawn here: a coloured square with their initial (no image site needed)
const picture = (letter, from, to) => `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">`
  + `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>`
  + `<rect width="96" height="96" fill="url(#g)"/><text x="48" y="64" font-family="sans-serif" font-size="48" `
  + `font-weight="700" fill="#fff" text-anchor="middle">${letter}</text></svg>`,
)}`;

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** The signed-in player in the stories */
export const ME = {
  id: id(1),
  username: 'dany',
  display_name: 'Dany',
  avatar_url: picture('D', '#662c91', '#ff5cb3'),
  created_at: '2026-09-28T10:00:00Z',
};

// [username, display name, picture?, joined (days ago)]
const PEOPLE = [
  ['cosmic_narwhal42', 'Nora', ['N', '#2e86de', '#5ef38c'], 5],
  ['zippy_fox55', 'Foxy', ['F', '#e67e22', '#f1c40f'], 6],
  ['jolly_robot12', 'Robo', null, 4],
  ['mystic_yeti88', 'Yeti', ['Y', '#16a085', '#2ecc71'], 3],
  ['mega_muffin31', 'Muffin', null, 2],
  ['sneaky_ninja2', 'Ninja', ['S', '#232020', '#662c91'], 2],
  ['sleepy_panda7', null, null, 7],
  ['turbo_taco19', 'Taco Tim', ['T', '#c0392b', '#f39c12'], 7],
  ['wobbly_waffle3', null, null, 1],
  ['grumpy_dragon42', null, null, 1],
  ['spicy_noodle61', 'Noodle', null, 6],
  ['legendary_llama9', 'Lama', ['L', '#8e44ad', '#3498db'], 5],
  ['funky_koala24', null, null, 4],
  ['epic_penguin77', 'Pingu', null, 3],
  ['quirky_cactus5', null, null, 3],
  ['happy_hamster64', 'Hammy', ['H', '#d35400', '#e74c3c'], 2],
  ['crazy_pretzel17', 'Pretzel', null, 2],
  ['lazy_sloth90', 'Sloth', null, 6],
  ['mighty_phoenix8', 'Phoenix', ['P', '#e74c3c', '#f1c40f'], 5],
  ['silly_goblin46', null, null, 4],
  ['ultra_raccoon33', 'Rocky', null, 1],
  ['bouncy_burrito71', null, null, 1],
  ['dizzy_unicorn14', 'Uni', ['U', '#ff5cb3', '#c054f2'], 3],
  ['speedy_pirate29', 'Captain', null, 2],
];

export const PLAYERS = [
  ME,
  ...PEOPLE.map(([username, displayName, pic, days], i) => ({
    id: id(i + 2),
    username,
    display_name: displayName,
    avatar_url: pic ? picture(...pic) : null,
    created_at: ago(days * DAY + i * 37),
  })),
];

/** A player by username */
export const player = (username) => PLAYERS.find((p) => p.username === username);

// The names the signed-in player picked or kept (an empty history: a new player, who's asked to pick one)
export const USERNAME_HISTORY = [{ id: 1, username: 'dany', set_at: ago(5 * DAY) }];

// Friendships: one row a pair, smaller id first (as the database keeps them)
const pair = (a, b, requestedBy, status, minutes) => {
  const [userA, userB] = [player(a).id, player(b).id].sort();
  return {
    user_a: userA,
    user_b: userB,
    requested_by: player(requestedBy).id,
    status,
    created_at: ago(minutes + 60),
    accepted_at: status === 'accepted' ? ago(minutes) : null,
  };
};

export const FRIENDSHIPS = [
  pair('dany', 'cosmic_narwhal42', 'dany', 'accepted', 4 * DAY),
  pair('dany', 'zippy_fox55', 'zippy_fox55', 'accepted', 3 * DAY),
  pair('dany', 'jolly_robot12', 'dany', 'accepted', 2 * DAY),
  pair('mega_muffin31', 'dany', 'mega_muffin31', 'pending', 3 * HOUR),
  pair('sneaky_ninja2', 'dany', 'sneaky_ninja2', 'pending', 1 * DAY),
  pair('dany', 'mystic_yeti88', 'dany', 'pending', 2 * HOUR),
  pair('cosmic_narwhal42', 'zippy_fox55', 'zippy_fox55', 'accepted', 2 * DAY),
  pair('cosmic_narwhal42', 'legendary_llama9', 'cosmic_narwhal42', 'accepted', 1 * DAY),
];

const favorite = (username, gameId, minutes) => ({ user_id: player(username).id, game_id: gameId, created_at: ago(minutes) });
export const FAVORITES = [
  favorite('dany', 'snake', 3 * DAY),
  favorite('dany', 'sudoku', 1 * DAY),
  favorite('cosmic_narwhal42', 'tetris', 2 * DAY),
  favorite('cosmic_narwhal42', 'minesweeper', 2 * DAY),
  favorite('zippy_fox55', 'snake', 5 * HOUR),
  favorite('mystic_yeti88', 'sudoku', 9 * HOUR),
];

export const BOOKMARKS = [
  { user_id: ME.id, game_id: 'tetris', created_at: ago(2 * DAY) },
  { user_id: ME.id, game_id: 'chillzone', created_at: ago(6 * HOUR) },
];

export const RATINGS = [
  { user_id: ME.id, game_id: 'snake', score: 5, updated_at: ago(2 * DAY) },
  { user_id: ME.id, game_id: 'tetris', score: 4, updated_at: ago(1 * DAY) },
];

/** Each game's public totals (game_stats) */
export const GAME_STATS = {
  snake: { rating_count: 18, rating_average: 4.4, score_counts: [0, 1, 2, 4, 11], favorite_count: 12, bookmark_count: 5 },
  tetris: { rating_count: 9, rating_average: 4.1, score_counts: [0, 1, 1, 3, 4], favorite_count: 7, bookmark_count: 9 },
  minesweeper: { rating_count: 6, rating_average: 3.7, score_counts: [1, 0, 1, 2, 2], favorite_count: 4, bookmark_count: 2 },
  sudoku: { rating_count: 4, rating_average: 4.8, score_counts: [0, 0, 0, 1, 3], favorite_count: 6, bookmark_count: 3 },
  chillzone: { rating_count: 2, rating_average: 4.5, score_counts: [0, 0, 0, 1, 1], favorite_count: 1, bookmark_count: 1 },
  'flashback-arcade': { rating_count: 0, rating_average: null, score_counts: [0, 0, 0, 0, 0], favorite_count: 0, bookmark_count: 1 },
};

/** player_played: the games each player has played for a minute or more */
export const PLAYED = {
  [ME.id]: [
    { game_id: 'snake', last_played: ago(1 * MIN), plays: 14, seconds: 3260 },
    { game_id: 'tetris', last_played: ago(5 * HOUR), plays: 6, seconds: 2410 },
    { game_id: 'sudoku', last_played: ago(2 * DAY), plays: 3, seconds: 1980 },
  ],
  [player('cosmic_narwhal42').id]: [
    { game_id: 'tetris', last_played: ago(2 * MIN), plays: 22, seconds: 8100 },
    { game_id: 'minesweeper', last_played: ago(1 * DAY), plays: 9, seconds: 2200 },
  ],
  [player('zippy_fox55').id]: [{ game_id: 'snake', last_played: ago(1 * MIN), plays: 4, seconds: 900 }],
};

/** playing_now: who's in a game right now */
export const PLAYING_NOW = {
  [player('cosmic_narwhal42').id]: { game_id: 'tetris', since: ago(12 * MIN) },
  [player('zippy_fox55').id]: { game_id: 'snake', since: ago(3 * MIN) },
  [player('mighty_phoenix8').id]: { game_id: 'minesweeper', since: ago(8 * MIN) },
};

/** recent_activity: the games page's strip */
export const RECENT_ACTIVITY = [
  ['zippy_fox55', 'snake', 1 * MIN, 900],
  ['cosmic_narwhal42', 'tetris', 2 * MIN, 1460],
  ['mighty_phoenix8', 'minesweeper', 20 * MIN, 380],
  ['dany', 'snake', 35 * MIN, 610],
  ['legendary_llama9', 'sudoku', 2 * HOUR, 1240],
  ['dizzy_unicorn14', 'snake', 3 * HOUR, 95],
  ['turbo_taco19', 'tetris', 5 * HOUR, 700],
  ['happy_hamster64', 'minesweeper', 1 * DAY, 140],
  ['mystic_yeti88', 'sudoku', 2 * DAY, 2100],
].map(([username, gameId, minutes, seconds]) => {
  const { id: userId, display_name: displayName, avatar_url: avatarUrl } = player(username);
  return { user_id: userId, username, display_name: displayName, avatar_url: avatarUrl, game_id: gameId, played_at: ago(minutes), seconds };
});

export const PRIVACY = { show_played: 'everyone', show_playing: 'friends', show_activity: 'everyone', record_played: true };

export const BLOCKS = [{ blocker: ME.id, blocked: player('silly_goblin46').id, created_at: ago(2 * DAY) }];

// Roles: Dany is a developer and an admin (as on the real site), and Nora a developer too
export const USER_ROLES = [
  { user_id: ME.id, role: 'developer', granted_at: ago(5 * DAY) },
  { user_id: ME.id, role: 'admin', granted_at: ago(5 * DAY) },
  { user_id: player('cosmic_narwhal42').id, role: 'developer', granted_at: ago(1 * DAY) },
];

// Developers' bios and links (Settings → Developer)
export const DEVELOPER_PROFILES = [
  {
    user_id: ME.id,
    bio: 'I make small retro games for the browser: Snake, Tetris, Minesweeper and Sudoku, and GameHub to play them in.',
    links: ['https://github.com/DanyilT', 'https://danyilt.itch.io', 'https://danyt.dev'],
  },
  { user_id: player('cosmic_narwhal42').id, bio: '', links: ['https://www.youtube.com/@nora'] },
];

// Reports players sent (admins read them on /admin)
const report = (id, from, about, reason, gameId, message, minutes, resolved = false) => ({
  id,
  reporter: player(from).id,
  reported: player(about).id,
  reason,
  game_id: gameId,
  message,
  created_at: ago(minutes),
  resolved,
  resolved_at: resolved ? ago(minutes / 2) : null,
  resolved_by: resolved ? ME.id : null,
});
export const REPORTS = [
  report(3, 'zippy_fox55', 'grumpy_dragon42', 'cheating', 'tetris', 'A score of 999,999 two minutes after joining.', 3 * HOUR),
  report(2, 'mystic_yeti88', 'grumpy_dragon42', 'other', null, 'Their display name is an insult.', 1 * DAY),
  report(1, 'cosmic_narwhal42', 'turbo_taco19', 'cheating', 'snake', '', 4 * DAY, true),
];

// ==========================================
// The game page: what the game in the frame says (mocks/gameBridge.js), and the player's runs and records
// ==========================================

const score = (value) => [{ label: 'Score', value, format: null }];
const level = (name, seconds) => [{ label: 'Level', value: name, format: null }, { label: 'Time', value: seconds, format: 'time' }];

/** What each game shows in the panel under it (GameHub.status) */
export const GAME_STATUS = {
  snake: {
    main: [{ label: 'Score', value: 12, format: null }, { label: 'Best', value: 12, format: null }],
    more: [{ title: 'Snake', items: [{ label: 'Games played', value: 42, format: null }, { label: 'Food eaten', value: 318, format: null }] }],
    ongoing: false,
  },
  tetris: {
    main: [
      { label: 'Score', value: 2400, format: null }, { label: 'Lines', value: 18, format: null },
      { label: 'Level', value: 3, format: null }, { label: 'Best', value: 8800, format: null },
    ],
    more: [{ title: 'Your games', items: [{ label: 'Games played', value: 27, format: null }, { label: 'Most lines', value: 61, format: null }] }],
    ongoing: true,
  },
  minesweeper: {
    main: [{ label: 'Level', value: 'Expert', format: null }, { label: 'Time', value: 125, format: 'time' }, { label: 'Best', value: 98, format: 'time' }],
    more: [
      { title: 'Beginner', items: [{ label: 'Wins', value: 12, format: null }, { label: 'Best time', value: 9, format: 'time' }] },
      { title: 'Intermediate', items: [{ label: 'Wins', value: 5, format: null }, { label: 'Best time', value: 41, format: 'time' }] },
      { title: 'Expert', items: [{ label: 'Wins', value: 1, format: null }, { label: 'Best time', value: 98, format: 'time' }] },
    ],
    ongoing: true,
  },
  sudoku: {
    main: [{ label: 'Level', value: 'Medium', format: null }, { label: 'Time', value: 412, format: 'time' }, { label: 'Mistakes', value: 1, format: null }],
    more: [{ title: 'Solved', items: [{ label: 'Easy', value: 8, format: null }, { label: 'Medium', value: 3, format: null }, { label: 'Hard', value: null, format: null }] }],
    ongoing: true,
  },
};

// A run as a game records it (src/lib/runs.js): the made-up inputs are never played here
const run = (n, gameId, result, { outcome = 'over', mode = null, tick = 100, length = 300, best = false } = {}) => ({
  v: 1,
  id: `${gameId}-run-${n}`,
  ticket: `${gameId}-ticket-${n}`,
  seed: 1234 + n,
  mode,
  tick,
  length,
  inputs: [0, 'U', 5, 'L'],
  outcome,
  result,
  best,
});
const checked = (result, outcome = 'over') => ({ state: 'checked', outcome, result, best: false });

/**
 * Each game's runs, newest first, as the panel lists them (useRuns). The `check` is how GameHub's server took it; a
 * guest's have none (mocks/runs.js drops them).
 */
export const RUNS = {
  snake: [
    [1, score(12), { length: 320, best: true }, checked(score(12))],
    [2, score(1), { length: 50 }, checked(score(1))],
    [3, score(1), { length: 30 }, checked(score(1))],
    [40, score(7), { length: 180 }, { state: 'waiting' }],
    [DAY, score(4), { length: 120, best: true }, { state: 'refused', reason: 'claim' }],
    [2 * DAY, score(3), { length: 90 }, { state: 'unchecked' }],
  ],
  tetris: [
    [8, [{ label: 'Score', value: 8800, format: null }, { label: 'Lines', value: 61, format: null }], { tick: 50, length: 9400, best: true },
      checked([{ label: 'Score', value: 8800, format: null }, { label: 'Lines', value: 61, format: null }])],
    [HOUR, [{ label: 'Score', value: 2100, format: null }, { label: 'Lines', value: 14, format: null }], { tick: 50, length: 3100 },
      checked([{ label: 'Score', value: 2100, format: null }, { label: 'Lines', value: 14, format: null }])],
  ],
  minesweeper: [
    [15, level('Expert', 98), { outcome: 'won', mode: 'expert', tick: null, length: 98_000, best: true }, checked(level('Expert', 98), 'won')],
    [30, level('Expert', 40), { outcome: 'lost', mode: 'expert', tick: null, length: 40_000 }, checked(level('Expert', 40), 'lost')],
    [3 * HOUR, level('Beginner', 9), { outcome: 'won', mode: 'beginner', tick: null, length: 9000, best: true }, checked(level('Beginner', 9), 'won')],
  ],
  sudoku: [
    [DAY, level('Easy', 340), { outcome: 'won', mode: 'easy', tick: null, length: 340_000, best: true }, checked(level('Easy', 340), 'won')],
  ],
};

/** The rows the panel gets for a game: [{ key, endedAt, run, check }] */
export const runRows = (gameId) => (RUNS[gameId] ?? []).map(([minutes, result, options, check], i) => ({
  key: 100 - i,
  endedAt: now - minutes * 60_000,
  run: run(minutes, gameId, result, options),
  check,
}));

/**
 * my_runs: the signed-in player's runs kept on GameHub's server, as it lists them: the checked and refused ones above
 * (their moves kept 30 days after, or while it's a record), and for Snake one more, played in another browser (it
 * isn't in this one's runs, so the panel gets it from the server)
 */
export const serverRuns = (gameId) => {
  const records = new Set((RECORDS[gameId] ?? []).map((record) => record.ticket_id));
  const rows = (RUNS[gameId] ?? [])
    .filter(([, , , check]) => check.state === 'checked' || check.state === 'refused')
    .map(([minutes, result, options, check]) => ({ minutes, check, claimed: result, run: run(minutes, gameId, result, options) }));
  if (gameId === 'snake') {
    rows.push({
      minutes: 3 * DAY,
      check: checked(score(9)),
      claimed: score(9),
      run: { ...run(3 * DAY, gameId, score(9), { length: 240 }), id: 'snake-run-elsewhere', ticket: 'snake-ticket-elsewhere' },
    });
  }
  return rows.map(({ minutes, check, claimed, run: kept }) => {
    const record = records.has(kept.ticket);
    return {
      run_id: kept.id,
      ticket_id: kept.ticket,
      seed: kept.seed,
      mode: kept.mode,
      status: check.state,
      reason: check.reason ?? null,
      outcome: check.state === 'checked' ? check.outcome : null,
      result: check.result ?? [],
      claimed,
      tick: kept.tick,
      length: kept.length,
      checked_at: ago(minutes),
      record,
      keep_until: record ? null : ago(minutes - 30 * DAY),
    };
  });
};

/** my_records: the signed-in player's best checked run in each game (and level), naming its run's ticket */
export const RECORDS = {
  snake: [{ mode: null, score: 12, time_ms: null, result: score(12), checked_at: ago(1), ticket_id: 'snake-ticket-1' }],
  tetris: [{
    mode: null, score: 8800, time_ms: null, result: [{ label: 'Score', value: 8800 }, { label: 'Lines', value: 61 }],
    checked_at: ago(8), ticket_id: 'tetris-ticket-8',
  }],
  minesweeper: [
    { mode: 'beginner', score: null, time_ms: 9000, result: level('Beginner', 9), checked_at: ago(3 * HOUR), ticket_id: `minesweeper-ticket-${3 * HOUR}` },
    { mode: 'expert', score: null, time_ms: 98_000, result: level('Expert', 98), checked_at: ago(15), ticket_id: 'minesweeper-ticket-15' },
  ],
  sudoku: [{ mode: 'easy', score: null, time_ms: 340_000, result: level('Easy', 340), checked_at: ago(DAY), ticket_id: `sudoku-ticket-${DAY}` }],
};
