// `npm run games:pull`: copies each checked game's rules from the game itself (DanyilT/dt-games: its js/rules.js, served
// at https://<id>.dt-games.pages.dev/js/rules.js) into worker/games/<id>.js, where GameHub's server plays runs again
// with them (worker/games/index.js), so the rules are written once, in the game.
// - The game's file is a plain script that declares `const GameRules`; the copy adds `export const { simulate } =
//   GameRules;` after it, which makes it a module.
// - Copied by hand, not loaded while the Worker runs: a Worker can't run code it fetches (no eval, no imports from a
//   URL), and this one holds Supabase's secret key, so what it runs is tested (`npm run test:worker`), reviewed and
//   committed. Deploys use the committed copies.
// - `--from <folder>` reads local worktrees instead (<folder>/<id>/js/rules.js, e.g. ~/Projects/dt-games), to try a
//   game's change before it's pushed.
// A game's rules changing means runs played under the old ones (offline, checked later) may stop checking out, and
// worker/games/fixtures.json may need runs recorded again.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import vm from 'node:vm';
import { CHECKED_GAMES } from '../worker/games/list.js';

const GAMES_DIR = new URL('../worker/games/', import.meta.url);
const EXPORT = 'export const { simulate } = GameRules;';

const args = process.argv.slice(2);
const fromAt = args.indexOf('--from');
const from = fromAt >= 0 ? resolve(args[fromAt + 1] ?? '') : null;
if (fromAt >= 0 && !args[fromAt + 1]) {
  console.error('Usage: npm run games:pull [-- --from <folder with a worktree per game>]');
  process.exit(2);
}

// A game's rules file: from the games' site, or a local worktree
const read = async (id) => {
  if (from) {
    const path = join(from, id, 'js/rules.js');
    return { where: path, source: await readFile(path, 'utf8') };
  }
  const url = `https://${id}.dt-games.pages.dev/js/rules.js`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  // The games' site answers a file it doesn't have with the game's page (HTML, and a 200)
  if (!response.ok || !/javascript/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error(`${url}: no rules file there (HTTP ${response.status}, ${response.headers.get('content-type')})`);
  }
  return { where: url, source: await response.text() };
};

// Whether it's what GameHub expects: a plain script that declares GameRules, with simulate(), and needs nothing but the
// language (no page, timers or storage)
const check = (id, { where, source }) => {
  if (/^\s*(import|export)\b/m.test(source)) throw new Error(`${where}: must be a plain script (no import or export)`);
  let rules;
  try {
    rules = vm.runInNewContext(`${source}\n;GameRules`, Object.create(null), { filename: where });
  } catch (error) {
    throw new Error(`${where}: doesn't load on its own (${error.message})`);
  }
  if (typeof rules?.simulate !== 'function') throw new Error(`${where}: GameRules.simulate must be a function`);
};

// Every game first, so a problem with one leaves every copy as it was
const pulled = [];
try {
  for (const id of CHECKED_GAMES) {
    const file = await read(id);
    check(id, file);
    pulled.push({ id, ...file });
  }
} catch (error) {
  console.error(`${error.message}\nNothing was copied.`);
  process.exit(1);
}

const changed = [];
for (const { id, where, source } of pulled) {
  const hash = createHash('sha256').update(source).digest('hex');
  const copy = `// ${id}'s rules: a copy of the game's own js/rules.js (DanyilT/dt-games, branch ${id}), made by \`npm run games:pull\`
// (worker/games/index.js plays runs again with it). Don't change it here: change the game, then pull again.
// Source sha-256: ${hash}

${source.trimEnd()}

${EXPORT}
`;
  const path = new URL(`${id}.js`, GAMES_DIR);
  const before = await readFile(path, 'utf8').catch(() => null);
  if (before === copy) continue;
  await writeFile(path, copy);
  changed.push(`${id} (from ${where})`);
}

console.log(changed.length
  ? `Copied: ${changed.join(', ')}.\nNow run \`npm run test:worker\`, and read \`git diff worker/games\` before committing.`
  : `No changes: worker/games has each game's current rules (${CHECKED_GAMES.join(', ')}).`);
