// Storybook for GameHub: every page and part of the site, on its own and in its page, with the world
// outside the page faked (dev/storybook/README.md). Everything for it lives in dev/storybook, apart from
// the site's code and build. Run it with `npm run storybook`.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const storybook = resolve(dirname(fileURLToPath(import.meta.url)), '..'); // dev/storybook
const root = resolve(storybook, '../..'); // the project

// The site's modules that reach outside the page, and Storybook's stand-ins for them (dev/storybook/mocks)
const MOCKS = {
  'src/lib/supabase.js': 'mocks/supabase.js', // the database and sign-in
  'src/lib/gameBridge.js': 'mocks/gameBridge.js', // the game in the frame
  'src/lib/runs.js': 'mocks/runs.js', // runs kept in IndexedDB
  'src/lib/install.js': 'mocks/install.js', // the browser's install dialog
};

// vite.config.js's plugins for the site's own build (pages, root files, headers, service worker) and
// dev server (the run checker): Storybook has neither
const SITE_ONLY_PLUGINS = [
  'gamehub-app-pages', 'gamehub-root-files', 'gamehub-security-headers', 'gamehub-service-worker', 'gamehub-run-checker',
];

/** Swaps the site's modules for the stand-ins, wherever they're imported from (except in the stand-ins themselves) */
const mockModules = () => {
  const swaps = new Map(Object.entries(MOCKS).map(([real, mock]) => [resolve(root, real), resolve(storybook, mock)]));
  const mocks = new Set(swaps.values());
  return {
    name: 'gamehub-storybook-mocks',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!importer || mocks.has(importer.split('?')[0])) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return (resolved && swaps.get(resolved.id.split('?')[0])) ?? null;
    },
  };
};

export default {
  stories: ['../stories/**/*.mdx', '../stories/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-docs', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-vite',
    // The site's own Vite config (Storybook would look for one in dev/storybook)
    options: { strictMode: true, builder: { viteConfigPath: resolve(root, 'vite.config.js') } },
  },
  // The site's icons and pictures, at the same addresses
  staticDirs: [resolve(root, 'public')],
  core: { disableTelemetry: true },
  async viteFinal(config) {
    // Nothing reaches the real Supabase: the game list comes from src/data/games.json. (Storybook copies
    // .env.local into the environment, where Vite would find these whatever envDir says.)
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const plugins = config.plugins.flat(Infinity).filter((plugin) => !SITE_ONLY_PLUGINS.includes(plugin?.name));
    return {
      ...config,
      // No .env files: the game list comes from src/data/games.json, and nothing reaches the real Supabase
      envDir: storybook,
      plugins: [mockModules(), ...plugins],
      // Storybook's own files are big; that's no worry for a tool that isn't the site
      build: { ...config.build, chunkSizeWarningLimit: 2000 },
    };
  },
};
