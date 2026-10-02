// The small files people and programs look for at the root of a site. vite.config.js writes
// them into dist/ on every build (try them with `npm run cf:preview`). They're built from the
// catalogue, so a new game shows up in them by itself. Each one ends with the cat.
//   robots.txt                what crawlers may visit (all but the account pages), and where the sitemap is
//   sitemap.xml               every page, for search engines
//   llms.txt                  the site for AI assistants (https://llmstxt.org)
//   humans.txt                who made the site (https://humanstxt.org)
//   .well-known/security.txt  where to report a security problem (RFC 9116)

// This site's code
const REPO_URL = 'https://github.com/DanyilT/game-hub';

const CAT = [
  '   /\\_/\\ ,---.',
  '  ( -.- )/// /)',
  "  ====`~~~~~'==",
];

// The cat in comment lines, for files where # starts a comment
const HASH_CAT = CAT.map((line) => `#${line}`);

const text = (lines) => `${lines.join('\n')}\n`;
const day = (date) => date.toISOString().slice(0, 10); // 2026-09-27

/** A game's page, without the leading slash: g/snake (the route in App.jsx) */
export const gamePage = (game) => `g/${game.id}`;

/**
 * The files, as { fileName: contents }.
 * - `pages`: the app's pages (PAGES in vite.config.js), besides the home page (the games list)
 *   and each catalogue entry's g/<id>, which are added here
 * - `accountPages`: pages crawlers have no use for (settings, the sign-in callback, /me)
 * - `siteUrl`: the site's address. A sitemap needs full URLs, so without it there's no
 *   sitemap.xml, and the other files link with paths (/catalog.json) instead.
 */
export function siteFiles({ catalog, pages, accountPages = [], siteUrl, date = new Date() }) {
  const origin = siteUrl ? new URL(siteUrl).origin : '';
  const url = (path) => `${origin}/${path}`;
  const { developer, games } = catalog;

  // Just under a year after the build (RFC 9116 asks for less than a year), so every deploy renews it
  const expires = new Date(date);
  expires.setUTCDate(expires.getUTCDate() + 364);

  const files = {
    'robots.txt': text([
      '# GameHub: every page is open to crawlers, except the account ones',
      'User-agent: *',
      ...accountPages.map((page) => `Disallow: /${page}`),
      'Allow: /',
      ...(origin ? ['', `Sitemap: ${url('sitemap.xml')}`] : []),
      '',
      ...HASH_CAT,
    ]),

    'llms.txt': text([
      '# GameHub',
      '',
      `> A collection of games by ${developer.name}. Browser games play right on the page; the others link out to their own site or to Google Play.`,
      '',
      'The pages are built in the browser with JavaScript, so fetching one returns an empty shell. Everything they show is in the catalogue.',
      '',
      '## Catalogue',
      '',
      `- [catalog.json](${url('catalog.json')}): every game as JSON, with its description, who made it, genre, difficulty, tags, controls, where to play it, and its source code`,
      '',
      '## Games',
      '',
      ...games.map((game) => `- [${game.title}](${url(gamePage(game))}): ${game.description}`),
      '',
      '## Optional',
      '',
      `- [Terms & Conditions](${url('terms')})`,
      `- [Privacy Policy](${url('privacy')})`,
      `- [Source code](${REPO_URL})`,
      `- [${developer.name}](${developer.url}): the developer`,
      '',
      '```',
      ...CAT,
      '```',
    ]),

    'humans.txt': text([
      '/* TEAM */',
      `  Developer: ${developer.name}`,
      `  Site: ${developer.url}`,
      '',
      '/* THANKS */',
      '  Error page cats: https://http.cat',
      '  Fonts: Doto and Chakra Petch, from Google Fonts',
      '  Icons: react-icons',
      '',
      '/* SITE */',
      `  Last update: ${day(date).replaceAll('-', '/')}`,
      '  Language: English',
      '  Standards: HTML5, CSS3',
      '  Components: React, React Router, react-icons',
      '  Software: Vite, Sass, Wrangler',
      '  Hosting: Cloudflare Workers',
      `  Source: ${REPO_URL}`,
      '',
      ...CAT,
    ]),

    '.well-known/security.txt': text([
      '# Found a security problem in GameHub? Please report it privately (RFC 9116)',
      `Contact: ${REPO_URL}/security/advisories/new`,
      `Expires: ${day(expires)}T00:00:00Z`,
      'Preferred-Languages: en',
      ...(origin ? [`Canonical: ${url('.well-known/security.txt')}`] : []),
      '',
      ...HASH_CAT,
    ]),
  };

  if (origin) {
    files['sitemap.xml'] = text([
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      // '' is the home page, the games list
      ...['', ...pages, ...games.map(gamePage)].map((path) => `  <url><loc>${url(path)}</loc></url>`),
      '</urlset>',
      // An XML comment can't contain "--" (the cat's back has "---"), so the cat is a processing instruction
      '<?cat',
      ...CAT,
      '?>',
    ]);
  }

  return files;
}
