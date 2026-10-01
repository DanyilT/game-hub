import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * The Supabase client, or null when the site is built without Supabase settings
 * (a fresh clone without .env.local). Then everyone is a guest and sign-in shows "soon".
 */
export const supabase = url && publishableKey
  ? createClient(url, publishableKey, {
    auth: {
      // PKCE: the sign-in redirect comes back with a one-time ?code= instead of tokens in the URL
      flowType: 'pkce',
      persistSession: true,
      autoRefreshToken: true,
      // Exchanges that ?code= for a session as soon as the site loads (on /auth/callback)
      detectSessionInUrl: true,
    },
  })
  : null;

/**
 * Calls a database function with fetch's `keepalive`, so the request still goes out while the page
 * closes (supabase-js can't ask for that). The body is JSON text.
 * @param {string} fn - e.g. 'save_game'
 * @param {string} body - its arguments, e.g. '{"p_game":"snake","p_data":{…}}'
 * @param {string} accessToken - the signed-in player's (session.access_token)
 * @return {Promise<*>} - what the function returned
 */
export const rpcWithKeepalive = async (fn, body, accessToken) => {
  const response = await fetch(`${url}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    keepalive: true,
    headers: { apikey: publishableKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body,
  });
  if (!response.ok) throw new Error(`Supabase ${fn}: HTTP ${response.status}`);
  return response.json();
};

/**
 * True with the local Supabase from `npm run dev:local`. Its emails never leave your machine:
 * they're caught at http://127.0.0.1:54324 ([local_smtp] in supabase/config.toml).
 */
export const isLocalSupabase = (() => {
  try {
    return Boolean(supabase) && ['127.0.0.1', 'localhost'].includes(new URL(url).hostname);
  } catch {
    return false;
  }
})();
export const LOCAL_EMAILS_URL = 'http://127.0.0.1:54324';

/**
 * Asks Supabase which sign-in providers are switched on in its dashboard. Also tells the
 * sign-in page when Supabase can't be reached (paused project, blocked by an extension).
 * @return {Promise<object>} - e.g. { external: { google: true, discord: false, email: false, … } }
 */
export const fetchAuthSettings = async () => {
  const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publishableKey } });
  if (!response.ok) throw new Error(`Supabase auth settings: HTTP ${response.status}`);
  return response.json();
};
