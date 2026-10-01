// `npm run catalog:pull`: copies the Supabase games table (its published rows) into
// src/data/games.json, the list the site builds from when it isn't connected to Supabase.
// It uses the project in .env.local, like the build; commit the file when you like.

import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';
import { CATALOG_PATH, validateCatalog } from './check-catalog.mjs';
import { fetchGames, readCatalogFile, supabaseProject } from './catalog-source.mjs';

const project = supabaseProject(loadEnv('development', process.cwd(), 'VITE_'));
if (!project) {
  console.error('Not connected to Supabase: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (.env.local).');
  process.exit(1);
}

const file = await readCatalogFile();
const catalog = { ...file, games: await fetchGames(project) };
const problems = validateCatalog(catalog);
if (problems.length) {
  console.error(`The games table has ${problems.length} problem(s), so games.json is unchanged:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

const was = new Map(file.games.map((game) => [game.id, JSON.stringify(game)]));
const ids = catalog.games.map((game) => game.id);
const added = ids.filter((id) => !was.has(id));
const removed = [...was.keys()].filter((id) => !ids.includes(id));
const changed = catalog.games.filter((game) => was.has(game.id) && was.get(game.id) !== JSON.stringify(game)).map((game) => game.id);
const moved = JSON.stringify(ids.filter((id) => was.has(id))) !== JSON.stringify([...was.keys()].filter((id) => ids.includes(id)));

await writeFile(CATALOG_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
const list = (label, items) => (items.length ? ` ${label}: ${items.join(', ')}.` : '');
console.log(`games.json: ${ids.length} games from ${project.url}.${list('Added', added)}${list('Removed', removed)}`
  + `${list('Changed', changed)}${moved ? ' The order changed.' : ''}${added.length + removed.length + changed.length || moved ? '' : ' No changes.'}`);
