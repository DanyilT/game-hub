// The run checker's route (`npm run test:worker`), with Supabase faked: a run that plays out is
// recorded with the replay's result, and when the Worker's settings or Supabase aren't right, the
// run waits to be sent again and the Logs say why.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afterEach, test } from 'node:test';
import { verifyRun } from './verify-run.js';

const fixtures = JSON.parse(readFileSync(new URL('./games/fixtures.json', import.meta.url), 'utf8'));
const USER = '0b9c8d7e-6f5a-4b3c-9d2e-1f0a9b8c7d6e';
const TICKET = '6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b';
const ENV = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
};
const run = { ...fixtures.snake, ticket: TICKET };
const ticket = {
  game_id: 'snake',
  seed: run.seed,
  issued_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  started_at: null,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  used_at: null,
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

// Supabase, faked: answers each path with [status, body], or throws an Error given instead. Returns
// the requests it got: [{ path, apikey, body }]
const fakeSupabase = (answers) => {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    const path = new URL(url).pathname;
    const headers = new Headers(init.headers);
    calls.push({ path, apikey: headers.get('apikey'), body: init.body ? JSON.parse(init.body) : null });
    const answer = answers[path] ?? [404, {}];
    if (answer instanceof Error) throw answer;
    return new Response(JSON.stringify(answer[1]), { status: answer[0] });
  };
  return calls;
};
const signedIn = { '/auth/v1/user': [200, { id: USER }], '/rest/v1/rpc/ticket_to_check': [200, [ticket]] };

const send = (env = ENV) => verifyRun(new Request('http://hub/api/verify-run', {
  method: 'POST',
  headers: { Authorization: 'Bearer a-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ game: 'snake', run }),
}), env);

test('a run that plays out is recorded with what the replay gave, using the secret key only for that', async () => {
  const calls = fakeSupabase({ ...signedIn, '/rest/v1/rpc/record_run': [200, [{ run_id: 'r1', best: true }]] });
  const response = await send();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'checked', outcome: 'over', result: [{ label: 'Score', value: 12, format: null }], best: true });

  const [auth, looked, recorded] = calls;
  assert.equal(auth.apikey, ENV.SUPABASE_PUBLISHABLE_KEY);
  assert.deepEqual([looked.apikey, recorded.apikey], [ENV.SUPABASE_SECRET_KEY, ENV.SUPABASE_SECRET_KEY]);
  assert.deepEqual(looked.body, { p_user: USER, p_ticket: TICKET });
  // PostgREST finds a function by its arguments' names, so all 15 go, even the empty ones
  assert.equal(Object.keys(recorded.body).length, 15);
  assert.equal(recorded.body.p_status, 'checked');
  assert.equal(recorded.body.p_reason, null);
  assert.equal(recorded.body.p_score, 12);
});

test("settings missing, or SUPABASE_URL not a URL: 503, and the Logs say which (never a value)", async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const calls = fakeSupabase(signedIn);
  for (const env of [
    { ...ENV, SUPABASE_SECRET_KEY: undefined },
    { ...ENV, SUPABASE_URL: 'example.supabase.co' },
    { ...ENV, SUPABASE_URL: '"https://example.supabase.co"' },
  ]) {
    const response = await send(env);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'not-set-up' });
  }
  assert.equal(calls.length, 0);
  const logged = log.mock.calls.map((call) => call.arguments.join(' '));
  assert.match(logged[0], /SUPABASE_SECRET_KEY not set/);
  assert.match(logged[1], /SUPABASE_URL isn't/);
  assert.ok(logged.every((line) => !line.includes('example.supabase.co') && !line.includes('sb_')));
});

test("a token Supabase Auth turns down: 401, so the run waits for the player's next sign-in", async () => {
  fakeSupabase({ '/auth/v1/user': [403, { error_code: 'bad_jwt' }] });
  const response = await send();
  assert.equal(response.status, 401);
});

test('Supabase failing at any step: 502 naming it, and the Logs say why', async (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const cases = [
    ['auth', { '/auth/v1/user': new TypeError('Network connection lost') }, /TypeError: Network connection lost/],
    ['auth', { '/auth/v1/user': [500, {}] }, /HTTP 500/],
    ['ticket_to_check', { ...signedIn, '/rest/v1/rpc/ticket_to_check': [401, { message: 'Invalid API key' }] }, /401.*Invalid API key/],
    ['record_run', { ...signedIn, '/rest/v1/rpc/record_run': [404, { code: 'PGRST202' }] }, /404.*PGRST202/],
  ];
  for (const [step, answers, why] of cases) {
    fakeSupabase(answers);
    const response = await send();
    assert.equal(response.status, 502, step);
    assert.deepEqual(await response.json(), { error: 'unreachable', step });
    assert.match(log.mock.calls.at(-1).arguments.join(' '), why);
  }
});

test('a ticket used meanwhile (the same run sent twice at once): refused, 409', async () => {
  fakeSupabase({ ...signedIn, '/rest/v1/rpc/record_run': [404, { code: 'P0002', hint: 'ticket' }] });
  const response = await send();
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { status: 'refused', reason: 'ticket' });
});
