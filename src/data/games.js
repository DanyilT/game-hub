import { CiFloppyDisk, CiMobile3, CiShare1 } from 'react-icons/ci';
import catalogIcons from 'virtual:catalog-icons';
import gamesData from './games.json';

// The catalogue (src/data/games.json, checked by scripts/check-catalog.mjs; the format is in the README).
// Each entry lists where it can be played in `platforms`:
//   { type: 'web', url, embed: true }   plays inside the hub (iframe)
//   { type: 'web', url, embed: false }  plays on a site of its own, opened in a new tab
//   { type: 'android', storeId, url }   Google Play listing
// An optional `website` links to a homepage that isn't a way to play (e.g. ChillZone's landing page).
// `icon` fields name react-icons components; vite.config.js bundles just those (`virtual:catalog-icons`).
export const games = gamesData.games;

// Icons for platforms that don't name one
const PLATFORM_ICONS = { web: CiShare1, android: CiMobile3 };

/** Links as the catalogue lists them, each with its `Icon` component (`fallback` when it names none) */
const withIcons = (links = [], fallback = null) => links.map((link) => ({ ...link, Icon: catalogIcons[link.icon] ?? fallback }));

const { projects, repos, socials, ...person } = gamesData.developer;
/** The developer: `name` and `url` (the footer's © line), and the footer's lists of links */
export const developer = { ...person, projects: withIcons(projects), repos: withIcons(repos), socials: withIcons(socials) };

/** The URL the hub embeds, or null if the entry can't be played inside the hub */
export const getEmbedUrl = (game) => game.platforms.find((p) => p.type === 'web' && p.embed)?.url ?? null;

/** Where the entry plays in a browser (the embedded game itself, or a site of its own) */
export const getWebPlatform = (game) => game.platforms.find((p) => p.type === 'web') ?? null;

/** App-store listings (Google Play today) */
export const getStorePlatforms = (game) => game.platforms.filter((p) => p.type === 'android');

/** Platform names used for the chips and the Platform filter, e.g. ['web'] or ['android'] */
export const getPlatformTypes = (game) => [...new Set(game.platforms.map((p) => p.type))];

/** The icon for a link to a platform: the one it names, or its type's */
export const getPlatformIcon = (platform) => catalogIcons[platform.icon] ?? PLATFORM_ICONS[platform.type];

/** Links to the entry's code, as a list (`sourceCode` is one link or several); a floppy disk unless they name an icon */
export const getSourceLinks = (game) => withIcons([game.sourceCode ?? []].flat(), CiFloppyDisk);
