// The site's Worker script. Cloudflare serves the Vite build (dist/) by itself; this script only
// gets the requests no file matches, and hands them back to the files, which answer with the
// profile rule (_redirects) or the 404 page, as before.
//
// It also keeps the free Supabase project awake: Supabase pauses a free project after a week of
// low activity, and a few database requests a day are enough to prevent that. The cron in
// wrangler.jsonc calls the database's ping() every 6 hours.

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },

  async scheduled(controller, env) {
    // Worker secrets, set once (README → Deploy)
    const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error('Supabase keep-alive: the SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY secrets are missing');
    }
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ping`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    // A thrown error marks the run as failed in the dashboard
    if (!response.ok) {
      throw new Error(`Supabase keep-alive: ping failed with HTTP ${response.status} ${await response.text()}`);
    }
  },
};
