import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { CATALOG_PATH, EMBED_ORIGINS, checkCatalogFile } from './scripts/check-catalog.mjs';
import { siteFiles } from './scripts/site-files.mjs';

// The react-icons the catalogue names (`"icon": "FaGithub"`), as `import icons from 'virtual:catalog-icons'`
const ICONS_MODULE = 'virtual:catalog-icons';
const RESOLVED_ICONS_MODULE = `\0${ICONS_MODULE}`;

/**
 * Checks src/data/games.json when the dev server starts and on every build (a broken
 * entry stops the build), and publishes it as /catalog.json so other apps (the planned
 * mobile app) can read the same list. Also builds the icons module: only the icons the
 * catalogue names get bundled, not whole icon packs.
 */
function gamesCatalog() {
  const loadCatalog = async () => {
    const { catalog, problems, icons } = await checkCatalogFile();
    if (problems.length) throw new Error(`games.json has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
    return { catalog, icons };
  };

  return {
    name: 'gamehub-catalog',
    async buildStart() {
      this.addWatchFile(CATALOG_PATH);
      await loadCatalog();
    },
    resolveId(id) {
      return id === ICONS_MODULE ? RESOLVED_ICONS_MODULE : null;
    },
    async load(id) {
      if (id !== RESOLVED_ICONS_MODULE) return null;
      this.addWatchFile(CATALOG_PATH); // built again when games.json changes
      const { icons } = await loadCatalog(); // name → pack, e.g. CiGlobe → ci
      const namesByPack = Map.groupBy(icons.keys(), (name) => icons.get(name));
      return [
        ...[...namesByPack].map(([pack, names]) => `import { ${names.join(', ')} } from 'react-icons/${pack}';`),
        `export default { ${[...icons.keys()].join(', ')} };`,
      ].join('\n');
    },
    async generateBundle() {
      const { catalog } = await loadCatalog();
      this.emitFile({ type: 'asset', fileName: 'catalog.json', source: JSON.stringify(catalog) });
    },
    configureServer(server) {
      // Re-check on edit during development (the page itself reloads on its own)
      server.watcher.add(CATALOG_PATH);
      server.watcher.on('change', async (file) => {
        if (file !== CATALOG_PATH) return;
        const { problems } = await checkCatalogFile();
        if (problems.length) server.config.logger.error(`games.json has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
      });
      // Serve /catalog.json like the build does: only that exact path (under `base`), only
      // GET/HEAD, and an error status (with the problems) when the file is invalid
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0];
        if (path !== `${server.config.base}catalog.json` || !['GET', 'HEAD'].includes(req.method)) return next();
        const { catalog, problems } = await checkCatalogFile();
        res.statusCode = problems.length ? 500 : 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(req.method === 'HEAD' ? undefined : JSON.stringify(problems.length ? { problems } : catalog));
      });
    },
  };
}

// The app's pages besides the home page (index.html). Keep in step with the routes in App.jsx.
const PAGES = ['games', 'users', 'terms', 'privacy'];
// Account pages get a file of their own too, but stay out of sitemap.xml (robots.txt keeps crawlers out)
const ACCOUNT_PAGES = ['settings', 'auth/callback'];
// Profiles (/u/<username>) can't have a file per player, so _redirects answers all of them with the app
const PROFILE_PATHS = '/u/*';

// The site's address: the Worker's `name` (wrangler.jsonc) on the account's workers.dev subdomain.
// sitemap.xml and the other root files use it for full URLs. Change it if the site gets a domain.
const SITE_URL = 'https://game-hub.danyt.workers.dev';

/**
 * Gives every page of the app a file of its own, so the site stays static and still answers
 * with real status codes (wrangler.jsonc: "404-page"):
 * - PAGES, ACCOUNT_PAGES, and games/<id> for every catalogue entry, get a copy of the app
 *   (e.g. games/snake.html), so opening or refreshing them is a 200
 * - profiles get the app with a 200 from a rule in _redirects ("200" serves another file in
 *   place of the missing one, without redirecting)
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
        const { catalog } = await checkCatalogFile();
        const app = bundle['index.html'].source;
        for (const page of [...PAGES, ...ACCOUNT_PAGES, ...catalog.games.map((game) => `games/${game.id}`), '404']) {
          this.emitFile({ type: 'asset', fileName: `${page}.html`, source: app });
        }
        // To "/", not "/index.html": Cloudflare shortens that to "/" itself, so it would count as a loop
        this.emitFile({ type: 'asset', fileName: '_redirects', source: `${PROFILE_PATHS} / 200\n` });
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
      const { catalog } = await checkCatalogFile();
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
 * - img-src: the catalogue's picture hosts, the Google Play badge, http.cat (error pages), and
 *   profile pictures from Google (and Discord's, ready for when its sign-in is switched on)
 * - connect-src: this project's Supabase URL (none when accounts aren't configured)
 * The dev server doesn't send these; try them with `npm run cf:preview`.
 */
function securityHeaders() {
  let supabaseUrl;

  const contentSecurityPolicy = (catalog) => {
    const origins = (urls) => [...new Set(urls.map((url) => new URL(url).origin))];
    const pictures = origins(catalog.games.filter((game) => game.thumb).map((game) => game.thumb));
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
      const { catalog } = await checkCatalogFile();
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
