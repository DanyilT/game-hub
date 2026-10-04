// Storybook's stand-in for src/lib/supabase.js (.storybook/main.js swaps it in): a pretend Supabase that
// answers from the made-up world in data.js, in memory. It knows just what the site asks for: its tables
// (each player sees what the real row level security lets them), its database functions, and sign-in.
// The toolbar picks who's signed in and how the server answers (scenario.js); what a story changes (a
// favorite, a block) lasts until the story is drawn again.

import {
  BLOCKS, BOOKMARKS, FAVORITES, FRIENDSHIPS, GAME_STATS, ME, PLAYED, PLAYERS, PLAYING_NOW, PRIVACY, RATINGS,
  RECENT_ACTIVITY, RECORDS, USERNAME_HISTORY, serverRuns,
} from './data';
import { scenario, signedIn } from './scenario';

// ==========================================
// The tables
// ==========================================

let db;
/** A fresh copy of the made-up world (each time a story is drawn) */
export const resetDatabase = () => {
  const copy = (rows) => rows.map((row) => ({ ...row }));
  db = {
    profiles: copy(PLAYERS),
    // A new player hasn't picked or kept a username yet (the welcome window asks)
    username_history: scenario.account === 'newPlayer' ? [] : USERNAME_HISTORY.map((row) => ({ ...row, user_id: ME.id })),
    favorites: copy(FAVORITES),
    bookmarks: copy(BOOKMARKS),
    ratings: copy(RATINGS),
    friendships: copy(FRIENDSHIPS),
    blocks: copy(BLOCKS),
    feedback: [],
    player_reports: [],
    game_saves: [],
    privacy: { ...PRIVACY, ...scenario.privacy },
    // Play history: the games each player has played (player_played), and the recent activity
    played: Object.fromEntries(Object.entries(PLAYED).map(([userId, rows]) => [userId, copy(rows)])),
    recent: copy(RECENT_ACTIVITY),
  };
};
resetDatabase();

const me = () => (signedIn() ? ME.id : null);
// Dany's history, while it's off (Settings → Privacy), is only Dany's, and what Dany is playing now shows to no one
const hiddenHistory = (userId) => userId === ME.id && me() !== ME.id && !db.privacy.record_played;
const hiddenPlaying = (userId) => userId === ME.id && !db.privacy.record_played;
const profile = (id) => db.profiles.find((row) => row.id === id);
const blockedBetween = (a, b) => db.blocks.some((row) => (row.blocker === a && row.blocked === b) || (row.blocker === b && row.blocked === a));

// What each player may read of each table (supabase/migrations: the row level security)
const READABLE = {
  profiles: () => true,
  favorites: () => true,
  bookmarks: (row) => row.user_id === me(),
  ratings: (row) => row.user_id === me(),
  username_history: (row) => row.user_id === me(),
  friendships: (row) => row.status === 'accepted' || [row.user_a, row.user_b].includes(me()),
  blocks: (row) => row.blocker === me(),
  feedback: () => false,
  game_saves: (row) => row.user_id === me(),
};

const fail = (code, message, hint = null) => Object.assign(new Error(message), { code, hint, details: null });
const NOT_SIGNED_IN = () => fail('42501', 'permission denied');

// ==========================================
// How the server answers (the toolbar's Server)
// ==========================================

const DELAYS = { fast: 120, slow: 2000, down: 400 };
const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * Answers like supabase-js does, { data, error, count }, after the server's delay. 'down' answers every request
 * with a network error, 'never' never answers (loading states).
 */
const respond = (make) => new Promise((resolve) => {
  if (scenario.server === 'never') return;
  setTimeout(() => {
    if (scenario.server === 'down') {
      resolve({ data: null, error: { code: '', message: 'TypeError: Failed to fetch', details: null, hint: null }, count: null });
      return;
    }
    try {
      resolve({ count: null, ...make(), error: null });
    } catch (error) {
      resolve({ data: null, count: null, error: { code: error.code ?? '', message: error.message, details: error.details ?? null, hint: error.hint ?? null } });
    }
  }, DELAYS[scenario.server] ?? DELAYS.fast);
});

// ==========================================
// supabase.from(table)
// ==========================================

class Query {
  constructor(table) {
    Object.assign(this, { table, action: 'select', columns: '*', options: {}, filters: [], orders: [], bounds: null, one: null });
  }

  select(columns = '*', options = {}) {
    if (this.action === 'select') Object.assign(this, { columns, options });
    return this;
  }

  insert(values) {
    return Object.assign(this, { action: 'insert', values });
  }

  update(values) {
    return Object.assign(this, { action: 'update', values });
  }

  delete() {
    return Object.assign(this, { action: 'delete' });
  }

  eq(column, value) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  neq(column, value) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }

  in(column, values) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  // Only what the players page sends: "username.ilike.*text*,display_name.ilike.*text*"
  or(expression) {
    const terms = expression.split(',').map((part) => {
      const [column, , pattern] = part.split('.');
      return [column, pattern.replaceAll('*', '').replaceAll('\\_', '_').toLowerCase()];
    });
    this.filters.push((row) => terms.some(([column, text]) => (row[column] ?? '').toLowerCase().includes(text)));
    return this;
  }

  order(column, { ascending = true } = {}) {
    this.orders.push([column, ascending]);
    return this;
  }

  range(from, to) {
    return Object.assign(this, { bounds: [from, to] });
  }

  maybeSingle() {
    return Object.assign(this, { one: 'maybe' });
  }

  single() {
    return Object.assign(this, { one: 'exactly' });
  }

  then(onDone, onFail) {
    return respond(() => this.run()).then(onDone, onFail);
  }

  run() {
    const rows = db[this.table];
    const matches = (row) => READABLE[this.table](row) && this.filters.every((filter) => filter(row));
    if (this.action === 'insert') return this.insertRows();
    if (!me() && this.action !== 'select') throw NOT_SIGNED_IN();
    if (this.action === 'update') {
      if (this.table === 'profiles') checkProfileChanges(this.values);
      rows.filter(matches).forEach((row) => Object.assign(row, this.values));
      if (this.table === 'profiles' && this.values.username) {
        db.username_history.push({ id: db.username_history.length + 2, user_id: me(), username: this.values.username, set_at: new Date().toISOString() });
      }
      return { data: null };
    }
    if (this.action === 'delete') {
      db[this.table] = rows.filter((row) => !matches(row));
      return { data: null };
    }
    if (this.table === 'blocks' && !me()) throw NOT_SIGNED_IN();

    let found = rows.filter(matches);
    for (const [column, ascending] of [...this.orders].reverse()) {
      found = [...found].sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? '')) * (ascending ? 1 : -1));
    }
    const count = this.options.count ? found.length : null;
    if (this.bounds) found = found.slice(this.bounds[0], this.bounds[1] + 1);
    let data = found.map((row) => this.withRelations({ ...row }));
    if (this.options.head) data = null;
    if (this.one) {
      if (data.length === 0 && this.one === 'exactly') throw fail('PGRST116', 'JSON object requested, multiple (or no) rows returned');
      data = data[0] ?? null;
    }
    return { data, count };
  }

  // The joins the site asks for: a player's own username history, and the players someone has blocked
  withRelations(row) {
    if (this.table === 'profiles' && this.columns.includes('username_history')) {
      row.username_history = db.username_history.filter((entry) => entry.user_id === row.id).map(({ user_id: _, ...entry }) => entry);
    }
    if (this.table === 'blocks' && this.columns.includes('player:profiles')) row.player = profile(row.blocked) ?? null;
    return row;
  }

  insertRows() {
    if (!me()) throw NOT_SIGNED_IN();
    const added = [this.values].flat().map((values) => ({ user_id: me(), created_at: new Date().toISOString(), ...values }));
    for (const row of added) {
      if (['favorites', 'bookmarks'].includes(this.table) && db[this.table].some((r) => r.user_id === row.user_id && r.game_id === row.game_id)) {
        throw fail('23505', 'duplicate key value violates unique constraint');
      }
      if (this.table === 'feedback' && db.feedback.filter((r) => r.user_id === row.user_id).length >= 20) {
        throw fail('P0001', "That's a lot of feedback for one day. Thank you! Try again tomorrow.", 'feedback_limit');
      }
    }
    db[this.table].push(...added);
    return { data: null };
  }
}

// The database's rules for profile changes (supabase/migrations/*_accounts.sql), the ones a story can run into
const RESERVED = ['admin', 'gamehub', 'support', 'moderator', 'root'];
const checkProfileChanges = (changes) => {
  if (changes.username !== undefined && changes.username !== profile(me()).username) {
    if (RESERVED.includes(changes.username)) throw fail('P0001', 'reserved', 'reserved');
    if (db.profiles.some((row) => row.username === changes.username)) throw fail('23505', 'duplicate key value violates unique constraint "profiles_username_key"');
  }
};

// ==========================================
// supabase.rpc(fn, args)
// ==========================================

const signedInOnly = (fn) => (args) => {
  if (!me()) throw NOT_SIGNED_IN();
  return fn(args);
};
const pairOf = (a, b) => db.friendships.find((row) => row.user_a === [a, b].sort()[0] && row.user_b === [a, b].sort()[1]);
const asPlayer = ({ id, username, display_name: displayName, avatar_url: avatarUrl }) => ({ id, username, display_name: displayName, avatar_url: avatarUrl });

const FUNCTIONS = {
  ping: () => 1,
  is_username_available: ({ p_username: name }) => !RESERVED.includes(name) && !db.profiles.some((row) => row.username === name),
  delete_my_account: signedInOnly(() => null),

  rate_game: signedInOnly(({ p_game: gameId, p_score: score }) => {
    db.ratings = db.ratings.filter((row) => !(row.user_id === me() && row.game_id === gameId));
    if (score !== null) db.ratings.push({ user_id: me(), game_id: gameId, score, updated_at: new Date().toISOString() });
    return null;
  }),
  game_stats: ({ p_game: gameId }) => [GAME_STATS[gameId] ?? { rating_count: 0, rating_average: null, score_counts: [0, 0, 0, 0, 0], favorite_count: 0, bookmark_count: 0 }],

  // Play activity: as far as each player lets the viewer see it (here: everything but a blocked player's)
  player_played: ({ p_user: userId }) => (blockedBetween(userId, me()) || hiddenHistory(userId) ? [] : db.played[userId] ?? []),
  playing_now: ({ p_users: ids }) => ids
    .filter((id) => PLAYING_NOW[id] && !blockedBetween(id, me()) && !hiddenPlaying(id))
    .map((id) => ({ user_id: id, ...PLAYING_NOW[id] })),
  recent_activity: ({ p_limit: limit = 12 }) => db.recent
    .filter((row) => !blockedBetween(row.user_id, me()) && !hiddenHistory(row.user_id))
    .slice(0, limit),
  my_privacy: signedInOnly(() => [{ ...db.privacy }]),
  set_privacy: signedInOnly((args) => {
    const changes = {
      show_played: args.p_show_played, show_playing: args.p_show_playing, show_activity: args.p_show_activity,
      record_played: args.p_record_played,
    };
    Object.entries(changes).forEach(([key, value]) => {
      if (value !== null && value !== undefined) db.privacy[key] = value;
    });
    return null;
  }),
  // Nothing recorded while the player has turned it off (Settings → Privacy)
  start_play: signedInOnly(() => (db.privacy.record_played ? 'storybook-play-session' : null)),
  report_play: signedInOnly(() => (db.privacy.record_played ? 60 : null)),
  delete_my_play_history: signedInOnly(() => {
    const deleted = (db.played[me()] ?? []).reduce((sum, row) => sum + row.plays, 0);
    db.played[me()] = [];
    db.recent = db.recent.filter((row) => row.user_id !== me());
    return deleted;
  }),

  // Friends
  player_friends: ({ p_user: userId }) => db.friendships
    .filter((row) => row.status === 'accepted' && [row.user_a, row.user_b].includes(userId))
    .map((row) => ({ ...asPlayer(profile(row.user_a === userId ? row.user_b : row.user_a)), since: row.accepted_at }))
    .sort((a, b) => b.since.localeCompare(a.since)),
  my_friend_requests: signedInOnly(() => db.friendships
    .filter((row) => row.status === 'pending' && [row.user_a, row.user_b].includes(me()))
    .map((row) => ({
      ...asPlayer(profile(row.user_a === me() ? row.user_b : row.user_a)),
      direction: row.requested_by === me() ? 'outgoing' : 'incoming',
      sent_at: row.created_at,
    }))),
  send_friend_request: signedInOnly(({ p_user: userId }) => {
    if (userId === me()) throw fail('P0001', "You can't add yourself as a friend", 'self');
    if (db.blocks.some((row) => row.blocker === me() && row.blocked === userId)) throw fail('P0001', "You've blocked this player. Unblock them first.", 'blocked');
    if (db.blocks.some((row) => row.blocker === userId && row.blocked === me())) throw fail('P0001', "You can't add this player as a friend.", 'blocked');
    const existing = pairOf(me(), userId);
    if (existing) {
      if (existing.status === 'pending' && existing.requested_by === userId) {
        Object.assign(existing, { status: 'accepted', accepted_at: new Date().toISOString() });
        return 'accepted';
      }
      return existing.status;
    }
    const [userA, userB] = [me(), userId].sort();
    db.friendships.push({ user_a: userA, user_b: userB, requested_by: me(), status: 'pending', created_at: new Date().toISOString(), accepted_at: null });
    return 'pending';
  }),
  accept_friend_request: signedInOnly(({ p_user: userId }) => {
    const row = pairOf(me(), userId);
    if (!row || row.status !== 'pending' || row.requested_by !== userId) return false;
    Object.assign(row, { status: 'accepted', accepted_at: new Date().toISOString() });
    return true;
  }),
  remove_friend: signedInOnly(({ p_user: userId }) => {
    const row = pairOf(me(), userId);
    db.friendships = db.friendships.filter((r) => r !== row);
    return Boolean(row);
  }),

  // Blocks and reports
  block_player: signedInOnly(({ p_user: userId }) => {
    if (userId === me()) throw fail('P0001', "You can't block yourself", 'self');
    db.friendships = db.friendships.filter((row) => row !== pairOf(me(), userId));
    if (db.blocks.some((row) => row.blocker === me() && row.blocked === userId)) return false;
    db.blocks.push({ blocker: me(), blocked: userId, created_at: new Date().toISOString() });
    return true;
  }),
  unblock_player: signedInOnly(({ p_user: userId }) => {
    const before = db.blocks.length;
    db.blocks = db.blocks.filter((row) => !(row.blocker === me() && row.blocked === userId));
    return db.blocks.length < before;
  }),
  report_player: signedInOnly(({ p_user: userId, p_reason: reason, p_message: message }) => {
    if (reason === 'other' && !message?.trim()) throw fail('P0001', 'Say what happened, so the developer knows what to look for.', 'report_message');
    if (db.player_reports.some((row) => row.reported === userId)) {
      throw fail('P0001', "You've already reported this player today. The developer will look into it.", 'already_reported');
    }
    db.player_reports.push({ reporter: me(), reported: userId, reason, message });
    return null;
  }),

  // Checked runs
  my_records: signedInOnly(({ p_game: gameId }) => RECORDS[gameId] ?? []),
  // The runs kept on the server (data.js), when the story has runs; their made-up moves are never played here
  my_runs: signedInOnly(({ p_game: gameId }) => (scenario.game.runs ? serverRuns(gameId) : [])),
  my_run_inputs: signedInOnly(() => [0, 'U', 5, 'L']),
  issue_tickets: signedInOnly(({ p_game: gameId }) => Array.from({ length: 10 }, (_, i) => ({
    id: `${gameId}-fresh-ticket-${i}`,
    seed: 4000 + i,
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60_000).toISOString(),
  }))),
  start_ticket: signedInOnly(() => true),
  take_tickets: signedInOnly(({ p_tickets: tickets }) => tickets.length),

  // Cloud saves (the fake game bridge doesn't save, but a story could)
  save_game: signedInOnly(() => new Date().toISOString()),
  delete_game_save: signedInOnly(() => null),
};

// ==========================================
// Signing in
// ==========================================

const SESSION_USER = {
  id: ME.id,
  email: 'dany@example.com',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { full_name: 'Dany', avatar_url: ME.avatar_url },
};
const session = () => (signedIn() ? { access_token: 'storybook', token_type: 'bearer', expires_in: 3600, user: SESSION_USER } : null);
const authListeners = new Set();
const announce = (event) => authListeners.forEach((listener) => listener(event, session()));

const client = {
  from: (table) => {
    if (!db[table]) throw new Error(`Storybook's pretend Supabase has no table "${table}" (dev/storybook/mocks/supabase.js)`);
    return new Query(table);
  },
  rpc: (fn, args = {}) => {
    const run = FUNCTIONS[fn];
    if (!run) return respond(() => { throw fail('PGRST202', `Storybook's pretend Supabase has no function ${fn}`); });
    return respond(() => ({ data: run(args) }));
  },
  auth: {
    // Reads the session at once, like supabase-js does from storage (the toolbar's Server doesn't slow it down)
    onAuthStateChange(listener) {
      authListeners.add(listener);
      setTimeout(() => authListeners.has(listener) && listener('INITIAL_SESSION', session()));
      return { data: { subscription: { unsubscribe: () => authListeners.delete(listener) } } };
    },
    getSession: async () => ({ data: { session: session() }, error: null }),
    initialize: async () => ({ error: null }),
    // Storybook signs straight in, as if back from Google
    signInWithOAuth: async () => {
      await wait(400);
      scenario.account = 'signedIn';
      resetDatabase();
      announce('SIGNED_IN');
      return { data: {}, error: null };
    },
    signInWithOtp: async () => {
      await wait(400);
      return { data: {}, error: null };
    },
    signOut: async () => {
      scenario.account = 'guest';
      announce('SIGNED_OUT');
      return { error: null };
    },
  },
};

// ==========================================
// What src/lib/supabase.js exports
// ==========================================

/** The client, or null when the toolbar's Account is "Accounts off" (a site built without Supabase) */
export let supabase = client;
/** Whether the sign-in window offers the email link (only with the local Supabase on the real site) */
export let isLocalSupabase = false;
export const LOCAL_EMAILS_URL = 'http://127.0.0.1:54324';

/** Follows the scenario: called by the decorator before the story draws */
export const applyScenario = () => {
  supabase = scenario.account === 'off' ? null : client;
  isLocalSupabase = scenario.emailSignIn;
  resetDatabase();
};

export const rpcWithKeepalive = async () => null;

export const fetchAuthSettings = async () => {
  const { error } = await respond(() => ({ data: null }));
  if (error) throw new Error(error.message);
  return { external: { google: true, discord: false, email: scenario.emailSignIn } };
};
