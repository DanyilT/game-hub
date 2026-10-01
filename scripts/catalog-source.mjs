// Where the game list comes from (vite.config.js loads it for every build and dev server start):
// - the Supabase `games` table, when the project is connected (VITE_SUPABASE_URL and
//   VITE_SUPABASE_PUBLISHABLE_KEY are set, as they are for accounts): its published rows, in `position` order;
// - src/data/games.json when it isn't (a fork, working offline).
// The file also always supplies the catalogue's `version` and `developer`, and `npm run catalog:pull`
// copies the table into it. Either way the list is checked by scripts/check-catalog.mjs.

import { readFile } from 'node:fs/promises';
import { CATALOG_PATH, findIcons, validateCatalog } from './check-catalog.mjs';

export const FILE_SOURCE = 'src/data/games.json';
export const TABLE_SOURCE = 'the Supabase games table';

// The table's columns, in games.json's key order, and the catalogue key for each
const COLUMNS = {
  id: 'id',
  kind: 'kind',
  title: 'title',
  description: 'description',
  released: 'released',
  style: 'style',
  genre: 'genre',
  tags: 'tags',
  features: 'features',
  difficulty: 'difficulty',
  controls: 'controls',
  icon_url: 'iconUrl',
  thumb: 'thumb',
  website: 'website',
  dimensions: 'dimensions',
  platforms: 'platforms',
  source_code: 'sourceCode',
};

/**
 * The Supabase project the site is connected to (the same rule as src/lib/supabase.js)
 * @param {object} env - VITE_* variables
 * @return {{url: string, key: string}|null}
 */
export const supabaseProject = (env) => (env.VITE_SUPABASE_URL && env.VITE_SUPABASE_PUBLISHABLE_KEY
  ? { url: env.VITE_SUPABASE_URL.replace(/\/+$/, ''), key: env.VITE_SUPABASE_PUBLISHABLE_KEY }
  : null);

/** A row of the games table as a catalogue entry: keys in games.json's order, empty columns left out */
export const rowToEntry = (row) => Object.fromEntries(Object.entries(COLUMNS)
  .filter(([column]) => row[column] !== null && row[column] !== undefined)
  .map(([column, key]) => [key, row[column]]));

/**
 * The published games, in order, through Supabase's REST API (anyone may read published rows)
 * @param {{url: string, key: string}} project
 * @return {Promise<object[]>} - catalogue entries
 */
export async function fetchGames({ url, key }) {
  const query = `select=${Object.keys(COLUMNS).join(',')}&published=eq.true&order=position.asc,id.asc`;
  const response = await fetch(`${url}/rest/v1/games?${query}`, {
    headers: { apikey: key, Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return (await response.json()).map(rowToEntry);
}

export const readCatalogFile = async () => JSON.parse(await readFile(CATALOG_PATH, 'utf8'));

/**
 * Loads and checks the game list.
 * @param {object} env - VITE_* variables
 * @param {object} [options]
 * @param {boolean} [options.fallbackOnError] - the dev server uses games.json (with a warning) when
 *   Supabase can't be reached. Builds fail instead: a silent fallback could ship an old list over
 *   edits made in the table, and a failed build leaves the live site as it is.
 * @return {Promise<{catalog: object, icons: Map<string, string>, source: string, connected: boolean, warning?: string}>}
 */
export async function loadCatalog(env, { fallbackOnError = false } = {}) {
  const file = await readCatalogFile();
  const project = supabaseProject(env);
  let catalog = file;
  let source = FILE_SOURCE;
  let warning;
  if (project) {
    try {
      catalog = { ...file, games: await fetchGames(project) };
      source = TABLE_SOURCE;
    } catch (error) {
      const problem = `Couldn't load the game list from Supabase (${project.url}): ${error.message}`;
      if (!fallbackOnError) {
        throw new Error(`${problem}\nThe live site keeps its current version. Check that the project isn't paused `
          + 'and has the games table (npx supabase db push); to build from games.json, leave VITE_SUPABASE_URL unset.');
      }
      warning = `${problem}\nUsing ${FILE_SOURCE} for now.`;
    }
  }
  const problems = validateCatalog(catalog);
  const found = problems.length ? { icons: new Map(), problems: [] } : await findIcons(catalog);
  problems.push(...found.problems);
  if (problems.length) {
    throw new Error(`The game list (${source}) has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  }
  return { catalog, icons: found.icons, source, connected: Boolean(project), warning };
}
