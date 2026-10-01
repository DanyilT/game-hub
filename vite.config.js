import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CATALOG_PATH, EMBED_ORIGINS } from './scripts/check-catalog.mjs';
import { loadCatalog } from './scripts/catalog-source.mjs';
import { gamePage, siteFiles } from './scripts/site-files.mjs';

// The game list, as `import gamesData from 'virtual:catalog'` (src/data/games.js)
const CATALOG_MODULE = 'virtual:catalog';
const RESOLVED_CATALOG_MODULE = `\0${CATALOG_MODULE}`;
// The react-icons the catalogue names (`"icon": "FaGithub"`), as `import icons from 'virtual:catalog-icons'`
const ICONS_MODULE = 'virtual:catalog-icons';
const RESOLVED_ICONS_MODULE = `\0${ICONS_MODULE}`;

/**
 * The game list every plugin here uses (scripts/catalog-source.mjs): the Supabase `games` table when
 * the project is connected, else src/data/games.json. The table is read once per build or dev server
 * start (restart the dev server to see edits made there); games.json is read afresh each time, so
 * the dev server picks up edits to it.
 */
const catalogSource = {
  env: {},
  serve: false,
  cached: null,
  async get() {
    if (this.cached) return this.cached;
    const result = await loadCatalog(this.env, { fallbackOnError: this.serve });
    if (result.connected) this.cached = result;
    return result;
  },
};

/**
 * Loads and checks the game list when the dev server starts and on every build (a broken entry
 * stops the build), gives it to the app as `virtual:catalog`, and publishes it as /catalog.json so
 * other apps can read the same list. Also builds the icons module: only the icons the catalogue
 * names get bundled, not whole icon packs.
 */
function gamesCatalog() {
  let logger;

  return {
    name: 'gamehub-catalog',
    configResolved(config) {
      catalogSource.env = config.env;
      catalogSource.serve = config.command === 'serve';
      logger = config.logger;
    },
    async buildStart() {
      this.addWatchFile(CATALOG_PATH);
      const { catalog, source, warning } = await catalogSource.get();
      if (warning) logger.warn(warning);
      logger.info(`Game list: ${catalog.games.length} entries from ${source}`);
    },
    resolveId(id) {
      if (id === CATALOG_MODULE) return RESOLVED_CATALOG_MODULE;
      if (id === ICONS_MODULE) return RESOLVED_ICONS_MODULE;
      return null;
    },
    async load(id) {
      if (id !== RESOLVED_CATALOG_MODULE && id !== RESOLVED_ICONS_MODULE) return null;
      this.addWatchFile(CATALOG_PATH); // built again when games.json changes
      const { catalog, icons } = await catalogSource.get();
      if (id === RESOLVED_CATALOG_MODULE) return `export default ${JSON.stringify(catalog)};`;
      const namesByPack = Map.groupBy(icons.keys(), (name) => icons.get(name)); // e.g. CiGlobe → ci
      return [
        ...[...namesByPack].map(([pack, names]) => `import { ${names.join(', ')} } from 'react-icons/${pack}';`),
        `export default { ${[...icons.keys()].join(', ')} };`,
      ].join('\n');
    },
    async generateBundle() {
      const { catalog } = await catalogSource.get();
      this.emitFile({ type: 'asset', fileName: 'catalog.json', source: JSON.stringify(catalog) });
    },
    configureServer(server) {
      // Re-check games.json on edit during development (the page itself reloads on its own). It's
      // also where `version` and `developer` come from, so a connected server reloads the table too.
      server.watcher.add(CATALOG_PATH);
      server.watcher.on('change', async (file) => {
        if (file !== CATALOG_PATH) return;
        catalogSource.cached = null;
        try {
          await catalogSource.get();
        } catch (error) {
          server.config.logger.error(error.message);
        }
      });
      // Serve /catalog.json like the build does: only that exact path (under `base`), only
      // GET/HEAD, and an error status (with the problems) when the list is invalid
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== `${server.config.base}catalog.json` || !['GET', 'HEAD'].includes(req.method)) return next();
        let body;
        try {
          body = JSON.stringify((await catalogSource.get()).catalog);
          res.statusCode = 200;
        } catch (error) {
          body = JSON.stringify({ problems: error.message.split('\n') });
          res.statusCode = 500;
        }
        res.setHeader('Content-Type', 'application/json');
        res.end(req.method === 'HEAD' ? undefined : body);
      });
    },
  };
}

// The app's pages besides the home page (index.html, the games list) and the games' own pages
// (g/<id>, from the catalogue). Keep in step with the routes in App.jsx.
const PAGES = ['players', 'about', 'terms', 'privacy'];
// Account pages get a file of their own too, but stay out of sitemap.xml (robots.txt keeps crawlers out)
const ACCOUNT_PAGES = ['settings', 'auth/callback', 'me'];
// Profiles (/u/<username>) can't have a file per player, so _redirects answers all of them with the app
const PROFILE_PATHS = '/u/*';
// Addresses that moved, sent on with a 301 (permanent, so bookmarks and search engines update).
// The same list is in App.jsx, for the dev server.
const MOVED = [
  ['/games', '/'],
  ['/games/:id', '/g/:id'],
  ['/users', '/players'],
  ['/users/:name', '/u/:name'],
  ['/players/:name', '/u/:name'],
];

// The site's address: the Worker's `name` (wrangler.jsonc) on the account's workers.dev subdomain.
// sitemap.xml and the other root files use it for full URLs. Change it if the site gets a domain.
const SITE_URL = 'https://game-hub.danyt.workers.dev';

/**
 * Gives every page of the app a file of its own, so the site stays static and still answers
 * with real status codes (wrangler.jsonc: "404-page"):
 * - PAGES, ACCOUNT_PAGES, and g/<id> for every catalogue entry, get a copy of the app
 *   (e.g. g/snake.html), so opening or refreshing them is a 200
 * - profiles get the app with a 200 from a rule in _redirects ("200" serves another file in
 *   place of the missing one, without redirecting), and MOVED addresses a 301 from it
 * - 404.html, another copy, is what Cloudflare sends with a 404 status for any other path;
 *   the app then shows its 404 page
 */
function appPages() {
  return {
    name: 'gamehub-app-pages',
    apply: 'build',
    generateBundle: {
      order: 'post', // after Vite has written index.html
      async handler(_options, bundle) {
        const { catalog } = await catalogSource.get();
        const app = bundle['index.html'].source;
        for (const page of [...PAGES, ...ACCOUNT_PAGES, ...catalog.games.map(gamePage), '404']) {
          this.emitFile({ type: 'asset', fileName: `${page}.html`, source: app });
        }
        const rules = [
          // With and without a trailing slash (/games/snake/ too)
          ...MOVED.flatMap(([from, to]) => [`${from} ${to} 301`, `${from}/ ${to} 301`]),
          // To "/", not "/index.html": Cloudflare shortens that to "/" itself, so it would count as a loop
          `${PROFILE_PATHS} / 200`,
        ];
        this.emitFile({ type: 'asset', fileName: '_redirects', source: `${rules.join('\n')}\n` });
      },
    },
  };
}

/**
 * Writes the files people and programs look for at the site's root: robots.txt, sitemap.xml,
 * llms.txt, humans.txt and .well-known/security.txt. Their text is in scripts/site-files.mjs.
 */
function rootFiles() {
  return {
    name: 'gamehub-root-files',
    apply: 'build',
    async generateBundle() {
      const { catalog } = await catalogSource.get();
      if (!SITE_URL) this.warn('no sitemap.xml: set SITE_URL in vite.config.js once the site has an address');
      const files = siteFiles({ catalog, pages: PAGES, accountPages: ACCOUNT_PAGES, siteUrl: SITE_URL });
      for (const [fileName, source] of Object.entries(files)) {
        this.emitFile({ type: 'asset', fileName, source });
      }
    },
  };
}

/**
 * Writes dist/_headers: headers Cloudflare adds to every response (Workers static assets read
 * this file). The Content-Security-Policy allows only the sites the pages really use, and is
 * built from the catalogue and the Supabase URL at build time, so it can't drift from them:
 * - frame-src: EMBED_ORIGINS (the only site games are embedded from)
 * - img-src: the catalogue's picture hosts (thumbnails and icons), the Google Play badge, http.cat (error pages), and
 *   profile pictures from Google (and Discord's, ready for when its sign-in is switched on)
 * - connect-src: this project's Supabase URL (none when accounts aren't configured)
 * The dev server doesn't send these; try them with `npm run cf:preview`.
 */
function securityHeaders() {
  let supabaseUrl;

  const contentSecurityPolicy = (catalog) => {
    const origins = (urls) => [...new Set(urls.map((url) => new URL(url).origin))];
    const pictures = origins(catalog.games.flatMap((game) => [game.thumb, game.iconUrl]).filter(Boolean));
    const hasStoreBadge = catalog.games.some((game) => game.platforms.some((p) => p.type === 'android'));
    const supabase = supabaseUrl ? new URL(supabaseUrl) : null;

    return [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' https://fonts.googleapis.com",
      'font-src https://fonts.gstatic.com',
      ["img-src 'self' data:", ...pictures, ...(hasStoreBadge ? ['https://play.google.com'] : []), 'https://http.cat',
        'https://*.googleusercontent.com', 'https://cdn.discordapp.com'].join(' '),
      ["connect-src 'self'",
        ...(supabase ? [supabase.origin, `${supabase.protocol === 'https:' ? 'wss' : 'ws'}://${supabase.host}`] : []),
      ].join(' '),
      `frame-src ${EMBED_ORIGINS.join(' ')}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; ');
  };

  return {
    name: 'gamehub-security-headers',
    apply: 'build',
    configResolved(config) {
      // Same rule as src/lib/supabase.js: accounts are on only with both values
      const { VITE_SUPABASE_URL: url, VITE_SUPABASE_PUBLISHABLE_KEY: key } = config.env;
      supabaseUrl = url && key ? url : undefined;
    },
    async generateBundle() {
      const { catalog } = await catalogSource.get();
      const source = [
        '/*',
        `  Content-Security-Policy: ${contentSecurityPolicy(catalog)}`,
        '  X-Content-Type-Options: nosniff',
        '  Referrer-Policy: strict-origin-when-cross-origin',
        '',
        // Built files have a content hash in their name, so browsers can keep them forever
        '/assets/*',
        '  Cache-Control: public, max-age=31536000, immutable',
        '',
      ].join('\n');
      this.emitFile({ type: 'asset', fileName: '_headers', source });
    },
  };
}

export default defineConfig({
  plugins: [react(), gamesCatalog(), appPages(), rootFiles(), securityHeaders()],
  build: {
    rolldownOptions: {
      output: {
        // Supabase's client (about 190 kB) gets a file of its own. It changes less often than the
        // site's code, so browsers keep it cached across deploys, and the main file stays small.
        codeSplitting: {
          groups: [{ name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ }],
        },
      },
    },
  },
  server: {
    port: 3000,
    strictPort: true, // fail instead of silently moving to another port
  },
});
