// `npm run dev:local`: the dev server, connected to the local Supabase (`npm run db:start`)
// instead of the hosted project in .env.local. Extra arguments go to Vite, e.g.
// `npm run dev:local -- --port 5173`.

import { execFileSync, spawn } from 'node:child_process';

let status;
try {
  const output = execFileSync('npx', ['supabase', 'status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  status = JSON.parse(output);
} catch {
  console.error("The local Supabase isn't running. Start it with: npm run db:start");
  process.exit(1);
}

const url = status.API_URL;
const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
console.log(`Local Supabase: ${url}`);
console.log(`  Studio (tables, users): ${status.STUDIO_URL}`);
if (status.MAILPIT_URL ?? status.INBUCKET_URL) console.log(`  Emails it would send: ${status.MAILPIT_URL ?? status.INBUCKET_URL}`);

// Variables set here win over .env.local (Vite never overwrites existing ones)
const vite = spawn('npx', ['vite', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key },
});
vite.on('exit', (code) => process.exit(code ?? 0));
