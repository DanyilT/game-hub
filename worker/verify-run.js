import { claimMatches, replayRun } from './games/index.js';

// ==========================================
// Checking a run: POST /api/verify-run
// ==========================================
// The hub sends a run that ended on a ticket (src/lib/checks.js), with the signed-in player's access
// token (Authorization: Bearer …) and { game, run } (the run as the game recorded it, its ticket's id
// in run.ticket). This plays it again from the ticket's seed with the game's own rules (./games/),
// and records what *that* gave in the player's account (record_run(), with the secret key): never
// the game's claim. See supabase/migrations/*_checked_runs.sql.
// - A ticket is the player's, good for one run, for 14 days.
// - A run can't have lasted longer than the time since its ticket was started (online) or issued.
// - A run that doesn't play out (or lasted too long) is kept as refused. One that plays out, but whose
//   game said something else, or whose inputs came too fast for a person, counts, flagged for a look.
// Answers 200 with { status: 'checked', outcome, result, best } or { status: 'refused', reason }.
// Otherwise the run waits to be sent again: 401 (sign in again), 400 or 413 (not a run: never),
// 409 (its ticket can't be used: never), 502 (Supabase didn't answer), 503 (not set up).
// A 502 or 503 says why in the Worker's Logs (the dashboard's Logs tab, or npx wrangler tail), and a
// 502's body says which step failed.
// The Worker (worker/index.js) serves it on the live site, and the dev server (vite.config.js) locally.

const MAX_BODY = 300 * 1024; // bytes
const LEEWAY_MS = 30_000; // between the server's clock and the run's
const FAST_MS = 50; // a game without a tick: inputs closer than this on average are flagged
const OUTCOMES = ['won', 'lost', 'over'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCode = (code) => (Number.isSafeInteger(code) && code >= 0) || (typeof code === 'string' && code.length > 0 && code.length <= 16);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// What's wrong with the Worker's settings (Worker secrets: README → Deploy), or null. Never their
// values: it goes to the Logs.
const settingsProblem = (env) => {
  const missing = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY'].filter((name) => !env[name]);
  if (missing.length > 0) return `${missing.join(', ')} not set`;
  if (!URL.canParse(env.SUPABASE_URL) || !/^https?:$/.test(new URL(env.SUPABASE_URL).protocol)) {
    return "SUPABASE_URL isn't the project's URL (https://<project ref>.supabase.co)";
  }
  return null;
};

// Supabase didn't answer as it should: why goes to the Logs, and the run waits to be sent again
const unreachable = (step, detail) => {
  console.error(`verify-run: ${step} failed:`, detail instanceof Error ? String(detail) : JSON.stringify(detail));
  return json({ error: 'unreachable', step }, 502);
};

// The body's run, checked for shape (what it gives is the replay's business): { game, ticket, … } or null
const readRun = (body) => {
  if (!isObject(body) || typeof body.game !== 'string' || !isObject(body.run)) return null;
  const { ticket, seed, mode, tick, length, inputs, outcome, result } = body.run;
  const valid = typeof ticket === 'string' && UUID.test(ticket)
    && Number.isSafeInteger(seed) && seed >= 0 && seed < 2 ** 32
    && (mode === null || (typeof mode === 'string' && mode.length <= 32))
    && (tick === null || (Number.isSafeInteger(tick) && tick >= 1 && tick <= 10000))
    && Number.isSafeInteger(length) && length >= 0
    && Array.isArray(inputs) && inputs.length > 0 && inputs.length % 2 === 0 && inputs.length <= 40000
    && inputs.every((value, i) => (i % 2 === 0 ? Number.isSafeInteger(value) && value >= 0 : isCode(value)))
    && OUTCOMES.includes(outcome) && Array.isArray(result) && result.length <= 3;
  return valid ? { game: body.game, ticket: ticket.toLowerCase(), seed, mode, tick, length, inputs, outcome, result } : null;
};

// The signed-in player's id, from their access token (null when it isn't one)
const playerFrom = async (env, token) => {
  const response = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error(`Supabase auth: HTTP ${response.status}`);
  return (await response.json())?.id ?? null;
};

// One of the database's functions for the Worker, with the secret key: { ok, data } or { ok: false, error }
const rpc = async (env, fn, args) => {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SECRET_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const data = await response.json().catch(() => null);
  return response.ok ? { ok: true, data } : { ok: false, error: { status: response.status, ...data } };
};

/**
 * Checks a run (see the top of this file)
 * @param {Request} request
 * @param {object} env - SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY
 * @return {Promise<Response>}
 */
export const verifyRun = async (request, env) => {
  if (request.method !== 'POST') return json({ error: 'method' }, 405);
  const problem = settingsProblem(env);
  if (problem) {
    console.error(`verify-run: not set up: ${problem}`);
    return json({ error: 'not-set-up' }, 503);
  }
  const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!token) return json({ error: 'sign-in' }, 401);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'too-big' }, 413);
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ error: 'not-a-run' }, 400);
  }
  const run = readRun(body);
  if (!run) return json({ error: 'not-a-run' }, 400);

  let step = 'auth';
  try {
    const userId = await playerFrom(env, token);
    if (!userId) return json({ error: 'sign-in' }, 401);

    // The ticket: the player's, for this game, unused and in date
    step = 'ticket_to_check';
    const looked = await rpc(env, 'ticket_to_check', { p_user: userId, p_ticket: run.ticket });
    if (!looked.ok) return unreachable(step, looked.error);
    const ticket = looked.data?.[0];
    if (!ticket || ticket.game_id !== run.game || ticket.used_at || Date.parse(ticket.expires_at) <= Date.now()) {
      return json({ status: 'refused', reason: 'ticket' }, 409);
    }

    // Longer than the time since its ticket started: refused before it's played again, so a run can't make the Worker
    // replay more than real time allows (a Bounce run could say 1,000,000 steps: about a second of CPU)
    const playedMs = run.tick ? run.length * run.tick : run.length;
    const since = Date.parse(ticket.started_at ?? ticket.issued_at);
    const tooLong = playedMs > Date.now() - since + LEEWAY_MS;

    // Played again, from the ticket's seed (not the run's say-so)
    step = 'replay';
    const found = tooLong
      ? { ok: false, reason: 'too-long' }
      : replayRun(run.game, { seed: Number(ticket.seed), mode: run.mode, tick: run.tick, length: run.length, inputs: run.inputs });
    let status = 'checked';
    let reason = null;
    const flags = [];
    if (!found.ok) {
      status = 'refused';
      reason = found.reason;
    } else {
      if (run.seed !== Number(ticket.seed)) flags.push('seed');
      if (found.outcome !== run.outcome || !claimMatches(run.result, found.result)) flags.push('claim');
      if (!run.tick && run.inputs.length >= 20 && playedMs / (run.inputs.length / 2) < FAST_MS) flags.push('fast');
    }

    step = 'record_run';
    const recorded = await rpc(env, 'record_run', {
      p_user: userId,
      p_ticket: run.ticket,
      p_status: status,
      p_reason: reason,
      p_mode: run.mode,
      p_outcome: found.ok ? found.outcome : null,
      p_score: found.ok ? found.score : null,
      p_time_ms: found.ok ? found.timeMs : null,
      p_result: found.ok ? found.result : [],
      p_claimed: run.result,
      p_flags: flags,
      p_played_ms: playedMs,
      p_tick: run.tick,
      p_length: run.length,
      p_inputs: run.inputs,
    });
    if (!recorded.ok) {
      // Its ticket was used meanwhile (the same run sent twice at once)
      if (recorded.error.hint === 'ticket') return json({ status: 'refused', reason: 'ticket' }, 409);
      return unreachable(step, recorded.error);
    }
    return status === 'checked'
      ? json({ status, outcome: found.outcome, result: found.result, best: recorded.data?.[0]?.best === true })
      : json({ status, reason });
  } catch (error) {
    return unreachable(step, error);
  }
};
