// The installed app's shortcuts: a long press on its icon on Android (a right-click on a computer) lists the games
// played right in GameHub, each opening its page. vite.config.js adds them to public/manifest.json as it writes the
// site (and the dev server's /manifest.json), so a new game shows up in them by itself.
// - The games: those GameHub embeds (as getEmbedUrl() in src/data/games.js), in the catalogue's order (the games
//   table's `position`). Chrome on Android shows the first 3 (its fourth place is the site's settings), a computer up to 10.
// - Each has an icon of its own, made from the game's (`iconUrl`) on the app's dark background: Android takes no SVG,
//   so they're PNGs, written next to the manifest (icons/games/<id>.png, and <id>-maskable.png for Android's icon
//   shapes). A game whose icon can't be read gets the app's own.
// - An installed app takes up a new manifest when Chrome next checks it (at most once a day, as the app opens).

import { readFile } from 'node:fs/promises';
import { gamePage } from './site-files.mjs';

const SIZE = 192; // px a side
const BACKGROUND = '#151414'; // the manifest's background_color
const CORNER = 40; // px: the rounded square the plain icon sits on
// How much of the icon the game's picture fills: a maskable icon keeps it in the middle circle Android always shows
const FILL = { plain: 0.68, maskable: 0.55 };
const ICONS_DIR = 'icons/games';

/** The games that get a shortcut: the ones GameHub plays in its own page */
export const shortcutGames = (catalog) => catalog.games.filter(
  (game) => game.kind === 'game' && game.platforms.some((platform) => platform.type === 'web' && platform.embed),
);

// "Snake Game" → "Snake", for the short label (Android shows it where the whole name doesn't fit)
const shortName = (title) => title.replace(/\s+game$/i, '') || title;

// The game's picture, drawn to fit `inner` px: an SVG at that size, and a small picture made bigger in whole steps (pixel art stays sharp), never smaller than it was
async function fitted(sharp, source, inner) {
  const { format, width = inner, height = inner } = await sharp(source).metadata();
  if (format === 'svg') {
    const density = Math.min(2400, Math.ceil((72 * inner) / Math.min(width, height)) * 2);
    return sharp(source, { density }).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  }
  const scale = Math.max(width, height) < inner ? Math.max(1, Math.floor(inner / Math.max(width, height))) : inner / Math.max(width, height);
  return sharp(source).resize(Math.round(width * scale), Math.round(height * scale), {
    fit: 'contain', kernel: scale >= 1 && Number.isInteger(scale) ? 'nearest' : 'lanczos3', background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).png().toBuffer();
}

// One icon: the game's picture in the middle of the background (a rounded square, or the whole square for Android's shapes to cut)
async function drawIcon(sharp, source, look) {
  const picture = await fitted(sharp, source, Math.round(SIZE * FILL[look]));
  const shape = look === 'maskable'
    ? `<rect width="${SIZE}" height="${SIZE}" fill="${BACKGROUND}"/>`
    : `<rect width="${SIZE}" height="${SIZE}" rx="${CORNER}" fill="${BACKGROUND}"/>`;
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${shape}</svg>`);
  return sharp(tile).composite([{ input: picture, gravity: 'center' }]).png().toBuffer();
}

async function readIcon(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * The manifest with its shortcuts, and their icons
 * @param {object} options - { catalog, manifestFile (public/manifest.json), base ('/'), warn(message) }
 * @return {Promise<{manifest: object, icons: Map<string, Buffer>}>} - icons by file name (icons/games/snake.png)
 */
export async function appManifest({ catalog, manifestFile, base = '/', warn = console.warn }) {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  const games = shortcutGames(catalog);
  const icons = new Map();

  let sharp = null;
  try {
    sharp = (await import('sharp')).default;
  } catch (error) {
    warn(`App shortcuts: no sharp to draw the games' icons (${error.message}), so they get the app's own`);
  }

  const appIcons = manifest.icons.filter((icon) => icon.sizes === `${SIZE}x${SIZE}` && icon.purpose !== 'monochrome');
  manifest.shortcuts = await Promise.all(games.map(async (game) => {
    let gameIcons = appIcons;
    if (sharp && game.iconUrl) {
      try {
        const source = await readIcon(game.iconUrl);
        const [plain, maskable] = await Promise.all([drawIcon(sharp, source, 'plain'), drawIcon(sharp, source, 'maskable')]);
        icons.set(`${ICONS_DIR}/${game.id}.png`, plain);
        icons.set(`${ICONS_DIR}/${game.id}-maskable.png`, maskable);
        gameIcons = [
          { src: `${base}${ICONS_DIR}/${game.id}.png`, sizes: `${SIZE}x${SIZE}`, type: 'image/png' },
          { src: `${base}${ICONS_DIR}/${game.id}-maskable.png`, sizes: `${SIZE}x${SIZE}`, type: 'image/png', purpose: 'maskable' },
        ];
      } catch (error) {
        warn(`App shortcuts: ${game.id}'s icon (${game.iconUrl}) couldn't be drawn (${error.message}), so it gets the app's own`);
      }
    }
    return { name: game.title, short_name: shortName(game.title), url: `${base}${gamePage(game)}`, icons: gameIcons };
  }));
  return { manifest, icons };
}
