# GameHub Project

Welcome to the **GameHub** project! This repository contains the source code for a React-based web application.

## 📖 Overview

Hub for all games, that was created by me.

This is **v2** (branch [`main-v2`](https://github.com/DanyilT/game-hub/tree/main-v2)): a rewrite on Vite, hosted on Cloudflare Workers. It adds accounts (sign in with Google, with Discord coming, and public profiles), with ratings and activity on the way.

> [!NOTE]
> ### 🕹️ v1
>
> The original site stays on GitHub Pages at [danyilt.github.io/game-hub](https://danyilt.github.io/game-hub). Its source is the [`main-v1`](https://github.com/DanyilT/game-hub/tree/main-v1) branch (tag `v0.1.0`).

## ☁️ Hosting

v2 is a **static site**: `npm run build` turns it into plain HTML/CSS/JS files in `dist/`, and Cloudflare serves those files from its CDN. There is no web server to run. The build writes a copy of `index.html` for every page (`games.html`, `games/snake.html`, `terms.html`…), so opening or refreshing any page works, and React Router shows it. Profiles (`/u/<username>`) can't have a file each, so a rule in `_redirects` serves the app for all of them. Any other path gets `404.html` with a real 404 status (`not_found_handling: "404-page"` in `wrangler.jsonc`), and the site shows its 404 page, with a cat from [http.cat](https://http.cat).

- **Accounts** live in [Supabase](https://supabase.com) (sign-in, database, access rules). The browser talks to it directly.
- **Security headers:** the build also writes `dist/_headers` (see `vite.config.js`), so Cloudflare sends a Content-Security-Policy that allows only the sites the pages use.
- **Files at the root:** the build writes the usual ones from the catalogue (their text is in `scripts/site-files.mjs`): `robots.txt`, `sitemap.xml`, `llms.txt` (for AI assistants), `humans.txt` and `.well-known/security.txt`. For full URLs they use the site's address, `SITE_URL` in `vite.config.js` (https://game-hub.danyt.workers.dev). Change it there if the site moves, e.g. to a domain of its own.

## 🚀 Getting Started

Requires **Node 22.22+**.

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Accounts (optional)**: copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key. Without them, the site runs with accounts switched off ("Sign in" shows "soon").
3. **Start the development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view it in your browser. If port 3000 is already taken, the command stops with an error (it won't silently switch ports).
4. **Build for production**:
   ```bash
   npm run build
   ```
   This will create an optimized production build in the `dist` folder.
5. **Try the production build on Cloudflare's local runtime** (this is where the security headers apply):
   ```bash
   npm run cf:preview
   ```
6. **Deploy to Cloudflare** (the first time, log in with `npx wrangler login`). The build reads `.env.local`, so accounts go live with it:
   ```bash
   npm run deploy
   ```
   It prints the site's address, which should match `SITE_URL` in `vite.config.js` (see Hosting).

   The daily keep-alive for the free Supabase project is a separate Worker:
   ```bash
   npm run deploy:keepalive
   ```
7. **Local Supabase (optional, needs Docker)**: the same database and sign-in server on your machine, for trying schema changes and running the database tests.
   ```bash
   npm run db:start    # then: npm run test:db, or npm run dev:local (the site against it)
   npm run db:reset    # a fresh local database, with 240 mock players (supabase/seed.sql)
   npm run db:stop
   ```

## 🎮 Adding a game

Everything shown in the hub comes from one file, [`src/data/games.json`](src/data/games.json). To add a game, add one entry and push. The build checks the file (`npm run check:catalog` runs the same check on its own) and publishes it as `/catalog.json`.

```jsonc
{
  "id": "my-game",                  // URL: /games/my-game (a-z, 0-9, -)
  "kind": "game",                   // "game", or "portal" for a collection like Flashback Arcade
  "title": "My Game",
  "description": "One or two sentences.",
  "style": "What it looks like.",                        // optional
  "genre": ["puzzle"],
  "tags": ["classic"],
  "features": ["Mobile-friendly"],                       // optional
  "difficulty": "easy",                                  // optional: easy, medium or hard
  "controls": { "keys": [{ "keys": ["w", "up"], "action": "Go up" }], "mobile": true },  // optional (below)
  "thumb": "https://…/screenshot.png",                   // optional: without one the card shows a title tile
  "website": "https://…",                                // optional: a homepage that isn't a way to play
  "dimensions": { "w": 460, "h": 740, "center": true },  // optional, embedded games: the frame's size (below)
  "platforms": [                                         // where it can be played; one entry per type
    { "type": "web", "url": "https://danyilt-games.pages.dev/my-game/", "embed": true, "icon": "CiShare1" }  // plays inside the hub
    // { "type": "web", "url": "https://…", "embed": false }  // plays on its own site, opened in a new tab
    // { "type": "android", "storeId": "com.example.game",
    //   "url": "https://play.google.com/store/apps/details?id=com.example.game", "icon": "CiMobile3" }
  ],
  "sourceCode": { "url": "https://github.com/…" }        // optional: one link, or a list of them (below)
}
```

- **Embedded games** get the in-hub player. They must be hosted on `danyilt-games.pages.dev`, the only site the hub will put in an iframe (`EMBED_ORIGINS` in `scripts/check-catalog.mjs`).
- **Everything else** gets a details page with its picture and links out. Android apps get the official "Get it on Google Play" badge.
- **Platform chips and the Platform filter** come from `platforms`, so a `website` doesn't make an Android game count as "web".
- **Icons** (`icon` on platforms and links) are [react-icons](https://react-icons.github.io/react-icons) names, like `CiGlobe` or `FaGithub`. The build bundles only the icons the catalogue names, and the check rejects a name react-icons doesn't have. Without an `icon`, a web platform shows `CiShare1`, Android shows `CiMobile3` and source code shows a floppy disk (`CiFloppyDisk`).
- **`sourceCode`** is one link or a list of links, each `{ "url": "…", "label": "…", "icon": "…" }`. `label` and `icon` are optional for a single link; a list needs a `label` on each link, so they can be told apart ("View Code" otherwise).
- **`dimensions`** (embedded games only): `h` is the game frame's height and `w` the game's own width, in pixels. The frame starts stretched across its column (the Expand Width button, on by default). Turned off, the frame takes the game's own width (never wider than the column), in the middle. Without `dimensions` the frame is 16:9 across the column. With `"center": true`, the hub asks the game to scroll its play area to the middle of the frame, when it loads and after the frame changes size. The hub can't scroll another site's page, so the game does it. It needs these lines, e.g. in a script every game loads:
  ```js
  // GameHub sends { type: 'gamehub:center' } to put the play area in the middle of its frame
  window.addEventListener('message', (event) => {
    if (event.source !== window.parent || event.data?.type !== 'gamehub:center') return;
    const game = document.querySelector('canvas, #game-board, .sudoku-grid'); // the play area
    if (!game) return;
    const box = game.getBoundingClientRect();
    window.scrollBy({ top: box.top - (innerHeight - box.height) / 2, left: box.left - (innerWidth - box.width) / 2 });
  });
  ```
- **`description`** is the one text about a game: the game page and the card's info panel both show it.
- **`controls`** fill the game page's Controls card: the keys drawn where they sit on a keyboard, mouse buttons on a mouse, and gestures on a 16:9 phone. Hovering or tapping one shows what it does. The card starts small in the info column (the keyboard, with an arrow to show the phone instead); maximize puts every device side by side under the game.
  ```jsonc
  "controls": {
    "keys": [                                              // keyboard and mouse
      { "keys": ["w", "up"], "action": "Go up" },          // "w" or "up"; `action` is optional
      { "keys": ["shift+space"], "action": "Flag a cell" }, // a chord
      { "keys": ["right-click"], "action": "Place a flag" }
    ],
    "mobile": true,                                        // plays on phones (false: "Not made for phones")
    "touch": [{ "gesture": "swipe", "action": "Turn" }]    // phone controls (needs "mobile": true)
  }
  ```
  Key names are letters, digits, punctuation and `esc`, `tab`, `capslock`, `shift`, `ctrl`, `alt`, `meta`, `space`, `enter`, `backspace`, `delete`, `insert`, `home`, `end`, `pageup`, `pagedown`, `up`, `down`, `left`, `right`, plus `click`, `right-click` and `wheel` for the mouse. The gestures are `tap`, `double-tap`, `long-press`, `swipe`, `drag`, `pinch` and `move` (the phone itself, for AR). Both lists are in `src/data/controls.js`.
- **The check rejects** unknown keys (and names what an old key like `imageUrl` or `repoLink` became), non-https links, unknown icons, a Play URL that doesn't match its `storeId`, and embedding a `portal`.

### The developer section

The top of `games.json` describes you. It fills the footer:

```jsonc
"developer": {
  "name": "Dany",                                    // footer: "More by Dany", "© 2025-2026 Dany"
  "url": "https://github.com/DanyilT",               // where the © name links
  "projects": [{ "label": "ChillZone", "url": "https://…" }],                  // "More by Dany"
  "repos": [{ "label": "Repo of This", "url": "https://…" }],                  // under Legal
  "socials": [{ "label": "GitHub", "url": "https://…", "icon": "FaGithub" }]   // Social
}
```

Each list is optional, and every link needs a `label`. A new game on another site or store doesn't appear in "More by Dany" by itself: add it to `projects`.

## 🛠️ Technologies Used

- **React 19** + **React Router 8**: UI and routing.
- **Vite 8**: dev server and build.
- **SCSS modules**: component styles (`*.module.scss`, `@use` only). Colours, sizes, fonts and timings are Sass variables in `src/styles/abstracts/_variables.scss`, and shared mixins are in `_mixins.scss` next to it.
- **Fonts** (Google Fonts): Doto for the site, and Chakra Petch (easier to read small) for game tags. To change one, edit `$font-primary` / `$font-secondary` in `_variables.scss` and the Google Fonts link in `index.html`.
- **react-icons**: interface icons, and the icons the catalogue names.
- **Supabase**: sign-in (Google; Discord is coming), Postgres with row level security. Schema changes are migrations in `supabase/migrations/`, applied with `npx supabase db push`.
- **Cloudflare Workers (static assets)**: hosting, plus a cron Worker that keeps Supabase awake.

## 📂 Project Structure

```
game-hub/
├── public/                  # copied as-is into dist/ (favicon, manifest)
├── scripts/
│   ├── check-catalog.mjs    # checks src/data/games.json (also run by vite.config.js)
│   ├── site-files.mjs       # robots.txt, sitemap.xml, llms.txt, humans.txt, security.txt (written by the build)
│   └── dev-local.mjs        # `npm run dev:local`: the dev server against the local Supabase
├── src/
│   ├── components/account/  # SignInModal, UsernameDialog (new players pick a username), UsernameField (🎲)
│   ├── components/common/   # Avatar, Button, ErrorBoundary, GooglePlayBadge, InfoTip, Modal (the neon window)
│   ├── components/layout/   # Header, Footer, Sidebar, MainLayout, game/GameCard, game/GameList, game/GameControls
│   ├── contexts/            # AuthContext: the signed-in player and their profile (useAuth())
│   ├── data/                # games.json (the catalogue), games.js (helpers), controls.js (key and gesture names)
│   ├── lib/                 # supabase.js (the client), account.js (username rules, helpers)
│   ├── pages/               # Games, GamePage, Account/ (users, profile, settings, sign-in callback), Legal/ (terms, privacy), ErrorPage
│   ├── styles/              # Sass variables, mixins, buttons and forms, shared animations, reset, base
│   ├── App.jsx              # routes
│   └── index.jsx            # entry point
├── supabase/
│   ├── config.toml          # Supabase CLI settings
│   ├── migrations/          # database schema, applied with `npx supabase db push`
│   ├── seed.sql             # 240 mock players, local only (`npm run db:reset`; never pushed)
│   └── tests/               # database tests (pgTAP), `npm run test:db`
├── workers/keepalive/       # daily cron Worker that keeps the free Supabase project awake
├── .env.example             # template for .env.local (Supabase URL + publishable key)
├── index.html
├── vite.config.js           # also writes /catalog.json, the catalogue's icons module, the security headers (dist/_headers), _redirects and the root files; SITE_URL is here
├── wrangler.jsonc           # Cloudflare config
└── package.json
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
