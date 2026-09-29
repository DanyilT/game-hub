// Checks src/data/games.json (the games catalogue).
// - `npm run check:catalog` runs it on its own.
// - vite.config.js runs it on every dev start and build, so a broken entry fails early.

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { GESTURES, KEYBOARD_KEYS, MOUSE_BUTTONS } from '../src/data/controls.js';

export const CATALOG_PATH = fileURLToPath(new URL('../src/data/games.json', import.meta.url));

const KINDS = ['game', 'portal'];
// iOS can be added here once the site shows App Store links
const PLATFORM_TYPES = ['web', 'android'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];
// Sites the hub may put in an iframe. The CSP's `frame-src` is built from this list (vite.config.js).
export const EMBED_ORIGINS = ['https://*.dt-games.pages.dev'];

/**
 * Whether the hub may embed a page from this origin (EMBED_ORIGINS, `*.` wildcards included)
 * @param {string} origin - e.g. "https://snake.dt-games.pages.dev"
 * @return {boolean}
 */
export const isEmbedOrigin = (origin) => EMBED_ORIGINS.some((allowed) => {
  if (!allowed.includes('://*.')) return origin === allowed;
  const [scheme, host] = allowed.split('://*.');
  const url = new URL(origin);
  return url.protocol === `${scheme}:` && !url.port && url.hostname.endsWith(`.${host}`);
});

// Known keys, so leftovers and typos (`imagePath`) don't slip through
const ENTRY_KEYS = ['id', 'kind', 'title', 'description', 'style', 'genre', 'tags', 'features', 'difficulty',
  'controls', 'thumb', 'sourceCode', 'website', 'dimensions', 'platforms'];
const PLATFORM_KEYS = ['type', 'url', 'embed', 'storeId', 'icon'];
const DIMENSION_KEYS = ['w', 'h', 'center'];
const CONTROLS_KEYS = ['keys', 'mobile', 'touch'];
const KEY_NAMES = new Set([...KEYBOARD_KEYS, ...MOUSE_BUTTONS].map((key) => key.name));
const GESTURE_NAMES = GESTURES.map((gesture) => gesture.name);
// A game frame's width and height, in px (200 is also the smallest a drag can make it)
const FRAME_SIZE = { min: 200, max: 4000 };
const LINK_KEYS = ['label', 'url', 'icon'];
const DEVELOPER_KEYS = ['name', 'url', 'projects', 'repos', 'socials'];
const DEVELOPER_LISTS = ['projects', 'repos', 'socials'];
// Keys from earlier versions of the format, and what took their place
const RETIRED_KEYS = {
  playLink: 'replaced by `platforms`',
  imageUrl: 'renamed to `thumb`',
  repoLink: 'renamed to `sourceCode`',
  rating: 'removed: ratings will come from player accounts',
  about: 'removed: `description` is the one text about a game',
  github: 'moved to `socials`',
  googlePlay: 'moved to `projects`',
};

// react-icons component names, like CiGlobe or FaGithub
const ICON_NAME = /^[A-Z][a-z]+[A-Z0-9][A-Za-z0-9]*$/;
// Each react-icons pack is named after its prefix (CiGlobe is in `ci`). Font Awesome, Heroicons
// and Ionicons come in two versions that share a prefix: the newer one is tried first.
const ICON_PACKS = { Fa: ['fa6', 'fa'], Hi: ['hi2', 'hi'], Io: ['io5', 'io'] };

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};
const isText = (value) => typeof value === 'string' && value.trim() !== '';
const isStringList = (value) => Array.isArray(value) && value.every(isText);
const unknownKeys = (object, known) => Object.keys(object).filter((key) => !known.includes(key));
const unknownKey = (key) => `unknown key \`${key}\`${RETIRED_KEYS[key] ? ` (${RETIRED_KEYS[key]})` : ''}`;

const checkIcon = (icon, at) => {
  if (icon !== undefined && !(typeof icon === 'string' && ICON_NAME.test(icon))) {
    at('`icon` must be a react-icons name, like `CiGlobe` or `FaGithub`');
  }
};

/**
 * Checks a link: `{ "url": "https://…", "label": "…", "icon": "FaGithub" }`.
 * @param {Function} at - records a problem with this link
 * @param {string} [labelRequired] - why `label` is required here (optional otherwise)
 */
const checkLink = (link, at, labelRequired) => {
  if (!isObject(link)) {
    at('must be an object with a `url`');
    return;
  }
  for (const key of unknownKeys(link, LINK_KEYS)) at(unknownKey(key));
  if (!isHttpsUrl(link.url)) at('`url` must be an https URL');
  if (labelRequired && !isText(link.label)) at(`\`label\` is required ${labelRequired}`);
  else if (link.label !== undefined && !isText(link.label)) at('`label` must be text');
  checkIcon(link.icon, at);
};

/**
 * Checks a game's controls: `keys` (what keys and mouse buttons do), `mobile` (plays on phones?)
 * and `touch` (what gestures do on a phone). The names come from src/data/controls.js.
 * @param {Function} at - records a problem with the controls
 */
const checkControls = (controls, at) => {
  if (typeof controls === 'string') {
    at('is now an object with `keys`, `mobile` and `touch`, not text (see "Adding a game" in the README)');
    return;
  }
  if (!isObject(controls)) {
    at('must be an object with `keys`, `mobile` or `touch`');
    return;
  }
  for (const key of unknownKeys(controls, CONTROLS_KEYS)) at(unknownKey(key));
  if (!CONTROLS_KEYS.some((key) => controls[key] !== undefined)) at('needs `keys`, `mobile` or `touch`');

  // `keys`: [{ "keys": ["w", "up"], "action": "Move up" }], a chord written like "shift+enter"
  if (controls.keys !== undefined) {
    if (!Array.isArray(controls.keys)) at('`keys` must be a list');
    else {
      controls.keys.forEach((binding, i) => {
        const where = (message) => at(`keys[${i}]: ${message}`);
        if (!isObject(binding)) {
          where('must be an object with `keys`');
          return;
        }
        for (const key of unknownKeys(binding, ['keys', 'action'])) where(unknownKey(key));
        if (binding.action !== undefined && !isText(binding.action)) where('`action` must be text');
        if (!isStringList(binding.keys) || binding.keys.length === 0) {
          where('`keys` must list one or more keys, like ["w", "up"]');
          return;
        }
        for (const combo of binding.keys) {
          const parts = combo.split('+');
          const unknown = parts.filter((part) => !KEY_NAMES.has(part));
          if (unknown.length) where(`unknown key ${unknown.map((part) => `\`${part}\``).join(', ')} (the names are in src/data/controls.js)`);
          else if (new Set(parts).size !== parts.length) where(`\`${combo}\` has a key twice`);
        }
      });
    }
  }

  if (controls.mobile !== undefined && typeof controls.mobile !== 'boolean') at('`mobile` must be true or false');

  // `touch`: [{ "gesture": "swipe", "action": "Turn" }], only for games that play on phones
  if (controls.touch !== undefined) {
    if (controls.mobile !== true) at('`touch` needs `"mobile": true`');
    if (!Array.isArray(controls.touch)) at('`touch` must be a list');
    else {
      controls.touch.forEach((gesture, i) => {
        const where = (message) => at(`touch[${i}]: ${message}`);
        if (!isObject(gesture)) {
          where('must be an object with a `gesture`');
          return;
        }
        for (const key of unknownKeys(gesture, ['gesture', 'action'])) where(unknownKey(key));
        if (!GESTURE_NAMES.includes(gesture.gesture)) where(`\`gesture\` must be one of ${GESTURE_NAMES.join(', ')}`);
        if (gesture.action !== undefined && !isText(gesture.action)) where('`action` must be text');
      });
    }
  }
};

/**
 * Validates the parsed catalogue.
 * @param {object} catalog - parsed games.json
 * @return {string[]} - human-readable problems (empty when the catalogue is valid)
 */
export function validateCatalog(catalog) {
  const problems = [];
  if (!isObject(catalog)) return ['the catalogue must be a JSON object'];
  if (catalog.version !== 2) problems.push('`version` must be 2');
  if (!Array.isArray(catalog.games) || catalog.games.length === 0) return [...problems, '`games` must be a non-empty array'];

  const seen = new Set();
  catalog.games.forEach((game, index) => {
    if (!isObject(game)) {
      problems.push(`games[${index}]: must be an object`);
      return;
    }
    const where = `games[${index}]${isText(game.id) ? ` (${game.id})` : ''}`;
    const problem = (message) => problems.push(`${where}: ${message}`);

    if (!isText(game.id) || !/^[a-z0-9][a-z0-9-]{1,39}$/.test(game.id)) problem('`id` must be 2-40 chars of a-z, 0-9 and -');
    else if (seen.has(game.id)) problem('duplicate `id`');
    else seen.add(game.id);

    for (const key of unknownKeys(game, ENTRY_KEYS)) problem(unknownKey(key));
    if (!KINDS.includes(game.kind)) problem(`\`kind\` must be one of ${KINDS.join(', ')}`);
    for (const field of ['title', 'description']) {
      if (!isText(game[field])) problem(`\`${field}\` is required`);
    }
    if (game.style !== undefined && !isText(game.style)) problem('`style` must be text');
    if (game.controls !== undefined) checkControls(game.controls, (message) => problem(`controls: ${message}`));
    for (const field of ['genre', 'tags']) {
      if (!isStringList(game[field])) problem(`\`${field}\` must be a list of strings`);
    }
    if (game.features !== undefined && !isStringList(game.features)) problem('`features` must be a list of strings');
    if (game.difficulty !== undefined && !DIFFICULTIES.includes(game.difficulty)) problem(`\`difficulty\` must be one of ${DIFFICULTIES.join(', ')}`);
    for (const field of ['thumb', 'website']) {
      if (game[field] !== undefined && !isHttpsUrl(game[field])) problem(`\`${field}\` must be an https URL`);
    }

    // One link, or a list of links (each with a label then, so they can be told apart)
    if (game.sourceCode !== undefined) {
      const links = [game.sourceCode].flat();
      if (links.length === 0) problem('`sourceCode` must be a link or a list of links');
      links.forEach((link, i) => {
        const at = (message) => problem(`sourceCode${Array.isArray(game.sourceCode) ? `[${i}]` : ''}: ${message}`);
        checkLink(link, at, links.length > 1 ? 'when there is more than one link' : undefined);
      });
    }

    // The game frame's starting size, and whether to centre the game in it (embedded games only)
    if (game.dimensions !== undefined) {
      const { dimensions } = game;
      const at = (message) => problem(`dimensions: ${message}`);
      if (!isObject(dimensions)) at('must be an object with `w` and `h`');
      else {
        for (const key of unknownKeys(dimensions, DIMENSION_KEYS)) at(unknownKey(key));
        for (const side of ['w', 'h']) {
          const size = dimensions[side];
          if (!Number.isInteger(size) || size < FRAME_SIZE.min || size > FRAME_SIZE.max) {
            at(`\`${side}\` must be a whole number of pixels from ${FRAME_SIZE.min} to ${FRAME_SIZE.max}`);
          }
        }
        if (dimensions.center !== undefined && typeof dimensions.center !== 'boolean') at('`center` must be true or false');
        if (!(Array.isArray(game.platforms) && game.platforms.some((p) => isObject(p) && p.embed === true))) {
          at('only embedded games have a frame to size');
        }
      }
    }

    if (!Array.isArray(game.platforms) || game.platforms.length === 0) {
      problem('`platforms` must list at least one platform');
      return;
    }
    const types = new Set();
    game.platforms.forEach((platform, i) => {
      const at = (message) => problem(`platforms[${i}]: ${message}`);
      if (!isObject(platform)) {
        at('must be an object');
        return;
      }
      for (const key of unknownKeys(platform, PLATFORM_KEYS)) at(unknownKey(key));
      if (!PLATFORM_TYPES.includes(platform.type)) at(`\`type\` must be one of ${PLATFORM_TYPES.join(', ')}`);
      else if (types.has(platform.type)) at(`only one \`${platform.type}\` platform per entry`);
      else types.add(platform.type);
      if (!isHttpsUrl(platform.url)) at('`url` must be an https URL');
      if (platform.embed !== undefined && typeof platform.embed !== 'boolean') at('`embed` must be true or false');
      if (platform.embed === true) {
        if (platform.type !== 'web') at('only `web` platforms can be embedded');
        else if (isHttpsUrl(platform.url) && !isEmbedOrigin(new URL(platform.url).origin)) {
          at(`embedded games must be hosted on ${EMBED_ORIGINS.join(' or ')} (the site's iframe allow-list)`);
        }
      }
      if (platform.storeId !== undefined && platform.type !== 'android') at('`storeId` is only for android');
      if (platform.type === 'android') {
        if (!isText(platform.storeId) || !/^[a-zA-Z]\w*(\.[a-zA-Z]\w*)+$/.test(platform.storeId)) at('android needs a package name in `storeId`');
        else if (platform.url !== `https://play.google.com/store/apps/details?id=${platform.storeId}`) at('android `url` must be the Play listing for `storeId`');
      }
      checkIcon(platform.icon, at);
    });
    if (game.kind === 'portal' && game.platforms.some((p) => isObject(p) && p.embed === true)) problem('portals are linked, never embedded');
  });

  // The developer: name and page (the footer's © line), and the footer's lists of links
  const { developer } = catalog;
  if (!isObject(developer)) problems.push('`developer` must be an object with a `name` and `url`');
  else {
    const at = (message) => problems.push(`developer: ${message}`);
    for (const key of unknownKeys(developer, DEVELOPER_KEYS)) at(unknownKey(key));
    if (!isText(developer.name)) at('`name` is required');
    if (!isHttpsUrl(developer.url)) at('`url` must be an https URL');
    for (const list of DEVELOPER_LISTS) {
      const links = developer[list];
      if (links === undefined) continue;
      if (!Array.isArray(links)) at(`\`${list}\` must be a list of links`);
      else links.forEach((link, i) => checkLink(link, (message) => at(`${list}[${i}]: ${message}`), 'on footer links'));
    }
  }
  return problems;
}

/**
 * Where each icon is used, for error messages: name → entry ids (or "developer").
 * Call only on a catalogue that passed validateCatalog.
 */
const iconUses = (catalog) => {
  const uses = new Map();
  const add = (icon, user) => {
    if (icon) uses.set(icon, new Set(uses.get(icon)).add(user));
  };
  for (const game of catalog.games) {
    for (const link of [...game.platforms, ...[game.sourceCode ?? []].flat()]) add(link.icon, game.id);
  }
  for (const list of DEVELOPER_LISTS) {
    for (const link of catalog.developer[list] ?? []) add(link.icon, 'developer');
  }
  return uses;
};

/**
 * Finds the react-icons pack of every icon the catalogue names (vite.config.js imports them from there).
 * @return {Promise<{icons: Map<string, string>, problems: string[]}>} - icons: name → pack, e.g. CiGlobe → ci
 */
async function findIcons(catalog) {
  const icons = new Map();
  const problems = [];
  for (const [name, users] of iconUses(catalog)) {
    const prefix = name.match(/^[A-Z][a-z]+/)[0];
    for (const pack of ICON_PACKS[prefix] ?? [prefix.toLowerCase()]) {
      const packIcons = await import(`react-icons/${pack}`).catch(() => null); // no such pack
      if (packIcons && name in packIcons) {
        icons.set(name, pack);
        break;
      }
    }
    if (!icons.has(name)) {
      problems.push(`${[...users].join(', ')}: react-icons has no icon \`${name}\` (see https://react-icons.github.io/react-icons)`);
    }
  }
  return { icons, problems };
}

/**
 * Reads and validates the catalogue file, and finds the icons it names.
 * @return {Promise<{catalog: object, problems: string[], icons: Map<string, string>}>} - icons: name → react-icons pack
 */
export async function checkCatalogFile(path = CATALOG_PATH) {
  let catalog;
  try {
    catalog = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    return { catalog: null, problems: [`can't read ${path}: ${error.message}`], icons: new Map() };
  }
  const problems = validateCatalog(catalog);
  if (problems.length) return { catalog, problems, icons: new Map() };
  return { catalog, ...(await findIcons(catalog)) };
}

// CLI: `node scripts/check-catalog.mjs`
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { catalog, problems } = await checkCatalogFile();
  if (problems.length) {
    console.error(`games.json has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`games.json OK: ${catalog.games.length} entries`);
}
