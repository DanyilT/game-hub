import { CiFloppyDisk, CiMobile3, CiShare1 } from 'react-icons/ci';
import { PiAppStoreLogo, PiGooglePlayLogo } from 'react-icons/pi';
import catalogIcons from 'virtual:catalog-icons';
import gamesData from 'virtual:catalog';

// The catalogue: the Supabase `games` table when the site is connected to Supabase, else src/data/games.json
// (vite.config.js and scripts/catalog-source.mjs; checked by scripts/check-catalog.mjs; the format is in the README).
// Each entry lists where it can be played in `platforms`:
//   { type: 'web', url, embed: true }   plays inside the hub (iframe)
//   { type: 'web', url, embed: false }  plays on a site of its own, opened in a new tab
//   { type: 'android', storeId, url }   Google Play listing (storeId: the app's package name)
//   { type: 'ios', url }                App Store listing
// A store platform may add `appLink`: a link the app opens itself with (chillzone://open, or an https App Link), used to
// open it from the hub once it's installed (src/lib/nativeApps.js).
// An optional `website` links to a homepage that isn't a way to play (e.g. ChillZone's landing page).
// `icon` fields name react-icons components; vite.config.js bundles just those (`virtual:catalog-icons`).
export const games = gamesData.games;

/** The catalogue's entries by id */
export const gamesById = new Map(games.map((game) => [game.id, game]));

// Icons for platforms that don't name one
const PLATFORM_ICONS = { web: CiShare1, android: CiMobile3, ios: CiMobile3 };

// The app stores: their name, what their button says, and their logo
const STORES = {
  android: { name: 'Google Play', get: 'Get it on Google Play', Icon: PiGooglePlayLogo },
  ios: { name: 'App Store', get: 'Download on the App Store', Icon: PiAppStoreLogo },
};

/** Links as the catalogue lists them, each with its `Icon` component (`fallback` when it names none) */
const withIcons = (links = [], fallback = null) => links.map((link) => ({ ...link, Icon: catalogIcons[link.icon] ?? fallback }));

const { projects, socials, ...person } = gamesData.developer;
/** The developer: `name` and `url` (the footer's © line), and the footer's lists of links */
export const developer = { ...person, projects: withIcons(projects), socials: withIcons(socials) };

/** The URL the hub embeds, or null if the entry can't be played inside the hub */
export const getEmbedUrl = (game) => game.platforms.find((p) => p.type === 'web' && p.embed)?.url ?? null;

/** Where the entry plays in a browser (the embedded game itself, or a site of its own) */
export const getWebPlatform = (game) => game.platforms.find((p) => p.type === 'web') ?? null;

/** App-store listings (Google Play, the App Store) */
export const getStorePlatforms = (game) => game.platforms.filter((p) => p.type in STORES);

/** A store listing's store: { name, get (its button's words), Icon (its logo) } */
export const getStore = (platform) => STORES[platform.type];

/** Platform names used for the chips and the Platform filter, e.g. ['web'] or ['android'] */
export const getPlatformTypes = (game) => [...new Set(game.platforms.map((p) => p.type))];

// The games list with some of its filter chips picked (a game's genres, difficulty, platforms and tags): they're in the
// address, /?tag=easy&tag=action, so a reload keeps them and the link can be shared
export const TAG_PARAM = 'tag';
export const gamesWithTags = (tags) => `/?${new URLSearchParams(tags.map((tag) => [TAG_PARAM, tag]))}`;

/** The icon for a link to a platform: the one it names, or its type's */
export const getPlatformIcon = (platform) => catalogIcons[platform.icon] ?? PLATFORM_ICONS[platform.type];

/** Links to the entry's code, as a list (`sourceCode` is one link or several); a floppy disk unless they name an icon */
export const getSourceLinks = (game) => withIcons([game.sourceCode ?? []].flat(), CiFloppyDisk);
