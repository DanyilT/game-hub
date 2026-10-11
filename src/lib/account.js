// Account rules and helpers shared by the auth pages. The database enforces the same rules
// (supabase/migrations/*_accounts.sql); checking them here too just gives quicker feedback.

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_HINT = '3–20 characters: lowercase letters, numbers and _';
export const USERNAME_COOLDOWN_DAYS = 30;
export const DISPLAY_NAME_MAX = 40;

export const PROVIDER_NAMES = { google: 'Google', discord: 'Discord' };

/** A profile's public columns (the `profiles` table): what anyone can read about a player */
export const PROFILE_COLUMNS = 'id, username, display_name, avatar_url, created_at';
/** For a profile query: its roles (the ones the viewer may see) and, for a developer, their bio and links (roles.js) */
export const ROLE_COLUMNS = 'user_roles!user_roles_user_id_fkey (role), developer_profiles (bio, links)';

// A database without the roles migration yet (supabase/migrations/*_roles_and_developers.sql) has no roles to give:
// no such table (PGRST205, 42P01), or no such link from profiles (PGRST200)
const NO_ROLES_CODES = ['PGRST200', 'PGRST205', '42P01'];
/** Whether an error only says the database has no roles yet */
export const noRolesYet = (error) => NO_ROLES_CODES.includes(error?.code);
let rolesMissing = false; // known once, so later queries don't ask again

/**
 * Runs a profile query with the profiles' roles, or, on a database without them yet, without (so the site works
 * before and after the roles migration: no one is a developer or an admin until then)
 * @param {function} query - gets the columns to add (`, user_roles…`, or '') and returns the supabase-js query
 * @return {Promise<{data, error, count}>} - its answer
 */
export const withRoles = async (query) => {
  if (!rolesMissing) {
    const answer = await query(`, ${ROLE_COLUMNS}`);
    if (!noRolesYet(answer.error)) return answer;
    rolesMissing = true;
  }
  return query('');
};

// Word lists from the first GameHub rewrite. Keep them in step with private.random_username()
// in supabase/migrations/*_accounts.sql, which names new players the same way.
const ADJECTIVES = ['fluffy', 'speedy', 'sneaky', 'mighty', 'lazy', 'crazy', 'happy', 'grumpy',
  'bouncy', 'sleepy', 'hungry', 'dizzy', 'fuzzy', 'silly', 'witty', 'jolly',
  'spicy', 'cosmic', 'mystic', 'epic', 'legendary', 'turbo', 'mega', 'ultra',
  'chunky', 'sparkly', 'wobbly', 'zippy', 'zany', 'quirky', 'funky', 'wacky'];
const NOUNS = ['panda', 'ninja', 'unicorn', 'dragon', 'potato', 'waffle', 'penguin', 'taco',
  'wizard', 'pirate', 'robot', 'banana', 'muffin', 'pickle', 'noodle', 'donut',
  'cactus', 'llama', 'koala', 'sloth', 'phoenix', 'narwhal', 'yeti', 'gremlin',
  'goblin', 'toaster', 'nugget', 'burrito', 'pretzel', 'hamster', 'raccoon', 'fox'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** A random fun username like "cosmic_narwhal42" (at most 19 characters) */
export const randomUsername = () => `${pick(ADJECTIVES)}_${pick(NOUNS)}${Math.floor(Math.random() * 100)}`;

// Where to go after signing in. The sign-in redirect leaves the site, so it's kept in sessionStorage.
const RETURN_KEY = 'gamehub:auth-return';

/**
 * A path on this site that's safe to go to after signing in, or null.
 * Rejects other sites ("//evil.example", "https://…") and the sign-in pages themselves.
 * @param {*} path - e.g. "/g/snake"
 * @return {string|null}
 */
export const safeReturnPath = (path) => {
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return null;
  if (/^\/(sign-in|auth\/callback)([/?#]|$)/.test(path)) return null;
  return path;
};

export const rememberReturnPath = (path) => {
  try {
    sessionStorage.setItem(RETURN_KEY, safeReturnPath(path) ?? '/');
  } catch {
    // storage unavailable: the player lands on the home page instead
  }
};

export const takeReturnPath = () => {
  try {
    const path = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return safeReturnPath(path);
  } catch {
    return null;
  }
};

/**
 * Whether the player has picked or kept a username yet. Their history starts with that choice
 * (the name they got at sign-up only goes in once they keep it).
 * @param {object} profile - the player's own profile, with `username_history` (AuthContext)
 * @return {boolean}
 */
export const hasChosenUsername = (profile) => profile?.username_history?.length > 0;

/**
 * When the username can next be changed: 30 days after the current one was picked or kept.
 * @param {object} profile - the player's own profile, with `username_history` (AuthContext)
 * @return {Date|null} - null when it can be changed now
 */
export const nextUsernameChange = (profile) => {
  const latest = profile?.username_history?.at(-1);
  if (!latest) return null;
  const next = new Date(latest.set_at).getTime() + USERNAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return next > Date.now() ? new Date(next) : null;
};

/**
 * Turns a Supabase error from a profile change into a sentence for the page.
 * @param {object} error - a PostgrestError ({ code, message, details, hint }) or a network error
 * @return {string}
 */
export const describeProfileError = (error) => {
  const text = `${error?.message ?? ''} ${error?.details ?? ''}`;
  if (error?.code === '23505') return 'That username is already taken.';
  if (error?.hint === 'reserved') return 'That username is reserved. Try another one.';
  if (error?.hint === 'cooldown') return `Usernames can be changed once every ${USERNAME_COOLDOWN_DAYS} days.`;
  if (error?.hint === 'avatar') return "That picture can't be used.";
  if (error?.code === '23514') {
    if (text.includes('username_format')) return `Usernames are ${USERNAME_HINT}.`;
    if (text.includes('display_name_length')) return `Display names are 1–${DISPLAY_NAME_MAX} characters.`;
  }
  if (error?.code === '42501' || error?.code === 'PGRST301') return 'Your session has expired. Sign in again.';
  if (/fetch|network/i.test(text)) return "Couldn't reach the server. Check your connection and try again.";
  return 'Something went wrong. Try again.';
};
