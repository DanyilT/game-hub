// Keep-alive for the free Supabase project, which pauses after about a week without requests.
// Once a day (the cron in wrangler.jsonc) this calls the database's ping() function.
// Deploy with `npm run deploy:keepalive`.

export default {
  async scheduled(controller, env) {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/ping`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    // A thrown error marks the run as failed in the dashboard (Workers → game-hub-keepalive)
    if (!response.ok) {
      throw new Error(`Supabase ping failed: HTTP ${response.status} ${await response.text()}`);
    }
  },
};
