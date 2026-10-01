# GameHub Project

Welcome to the **GameHub** project! This repository contains the source code for a React-based web application.

## 📖 Overview

Hub for all games, that was created by me.

This is **v2** (branch [`main-v2`](https://github.com/DanyilT/game-hub/tree/main-v2)): a rewrite on Vite, hosted on Cloudflare Workers. It adds accounts (sign in with Google, with Discord coming): public profiles, game progress saved to the account, 1–5 ratings with a feedback box, favorites (public) and bookmarks (private), and friends. The navigation is a sidebar, or a floating round button (Settings → Preferences).

> [!NOTE]
> ### 🕹️ v1
>
> The original site stays on GitHub Pages at [danyilt.github.io/game-hub](https://danyilt.github.io/game-hub). Its source is the [`main-v1`](https://github.com/DanyilT/game-hub/tree/main-v1) branch (tag `v0.1.0`).

## ☁️ Hosting

v2 is a **static site**: `npm run build` turns it into plain HTML/CSS/JS files in `dist/`, and Cloudflare serves those files from its CDN. There is no web server to run. The build writes a copy of `index.html` for every page (`g/snake.html`, `players.html`, `terms.html`…; the games list is the home page, `index.html` itself), so opening or refreshing any page works, and React Router shows it. Profiles (`/u/<username>`) can't have a file each, so a rule in `_redirects` serves the app for all of them, and old addresses (`/games`, `/games/<id>`, `/users`) get a 301 to the new ones (`MOVED` in `vite.config.js`). Any other path gets `404.html` with a real 404 status (`not_found_handling: "404-page"` in `wrangler.jsonc`), and the site shows its 404 page, with a cat from [http.cat](https://http.cat).

- **Accounts** live in [Supabase](https://supabase.com) (sign-in, database, access rules). The browser talks to it directly.
- **Game saves** reach the account through the game bridge (see "Saving progress" below): `public/hub-bridge.js` runs inside the game's page, and `src/lib/gameBridge.js` answers it in the hub.
- **Security headers:** the build also writes `dist/_headers` (see `vite.config.js`), so Cloudflare sends a Content-Security-Policy that allows only the sites the pages use.
- **Files at the root:** the build writes the usual ones from the catalogue (their text is in `scripts/site-files.mjs`): `robots.txt`, `sitemap.xml`, `llms.txt` (for AI assistants), `humans.txt` and `.well-known/security.txt`. For full URLs they use the site's address, `SITE_URL` in `vite.config.js` (https://game-hub.danyt.workers.dev). Change it there if the site moves, e.g. to a domain of its own.
- **Installable as an app (a PWA):** `public/manifest.json`. The icons are "GAME" over "HUB" in Doto's dots with the display-name gradient: transparent ones for tabs and desktops, maskable ones on the app's dark background (Android fills its icon shape with them), and a white silhouette for Android's themed icons (`purpose: monochrome`: the launcher recolours it and its background to match the icon theme). At 16 px they say "GH" instead: seven letters can't be read that small (`favicon.ico`'s 16 px frame, and `favicon.svg` switches when it's drawn at 24 px or less). They're in `public/icons/`, plus `favicon.ico`, `favicon.svg` and `apple-touch-icon.png`. Phones and tablets get "Install app" in the menu, and after a couple of games a suggestion floating at the bottom of the games page. It opens the browser's own install dialog where there is one (Chrome, Edge and Samsung Internet, once the site has been used for a bit), and otherwise shows the steps: the browser menu's Add to Home screen on Android, Share → Add to Home Screen on iPhone and iPad. Computers see it only once the browser's dialog is ready (`src/lib/install.js`). Installing needs HTTPS, so try it on the deployed site: a phone opening the dev server over your network (`http://192.168…`) can only add a shortcut.

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

   **Database changes go first:** when `supabase/migrations/` has new files, apply them before deploying the site that uses them (it asks for the database password):
   ```bash
   npx supabase db push
   ```

   The same Worker keeps the free Supabase project awake: a cron in `wrangler.jsonc` pings the database every 6 hours. With accounts on, give it the project's URL and publishable key once, as Worker secrets (they stay set across deploys):
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
   ```

   **Rebuilding when the games change:** the database asks Cloudflare for a new build once your edits to the `games` table have stopped for 30 seconds. It needs Cloudflare building the site from GitHub (Workers & Pages → game-hub → Settings → Build), and a deploy hook:
   1. In the same Build settings, under **Deploy Hooks**, create one for the production branch and copy its URL. Anyone with the URL can start builds, so treat it like a password.
   2. In Supabase's SQL editor, store it in Vault: `select vault.create_secret('<the hook URL>', 'deploy_hook_url');`

   To check it's working: `select * from private.site_rebuild;` shows when the games last changed and when a build was last asked for. `select * from net._http_response order by created desc limit 5;` shows Cloudflare's replies.
7. **Local Supabase (optional, needs Docker)**: the same database and sign-in server on your machine, for trying schema changes and running the database tests.
   ```bash
   npm run db:start    # then: npm run test:db, or npm run dev:local (the site against it)
   npm run db:reset    # a fresh local database, with 240 mock players (supabase/seed.sql)
   npm run db:stop
   ```
   With the local Supabase, the sign-in window offers an email link instead of Google; the emails land in the local inbox at http://127.0.0.1:54324.

## 💾 Saving progress

Games keep their progress in the browser, and in the player's account when they play in the hub signed in. The game never talks to Supabase, and never gets the player's sign-in:

1. Each game (in [`DanyilT/dt-games`](https://github.com/DanyilT/dt-games)) loads `js/gamehub.js` first, and saves only through it: `GameHub.load()` and `GameHub.save(data)` (one JSON object per game, at most 64 KB).
2. Inside the hub, `gamehub.js` loads the hub's `/hub-bridge.js` (only from the hub's own addresses: the live site and `http://localhost:3000`). That script runs in the game's page and passes loads and saves to the hub page with `postMessage`. The messages are listed at the top of `public/hub-bridge.js`.
3. The hub page (`src/lib/gameBridge.js`) only listens to its own game frame, from the game's own address. It reads the save from the `game_saves` table, and writes the game's saves with `save_game()`: at most one every 10 seconds, plus whatever's waiting when the page is hidden or left, or before signing out.
4. Signed in, the account's save wins. If the account has none for that game yet, the browser's goes up (a first sign-in on a device). Signing in or out reloads the game.
5. The **?** button on a game's page resets its progress: the browser's copy (through the bridge), then the account's (`delete_game_save()`), then reloads the game.

To try saves locally, the dev server has to run on port 3000 (the address `gamehub.js` trusts), with the games loaded from their live addresses.

## 🎮 Adding a game

The game list lives in one of two places, and the build bakes it into the site either way:
- **Connected to Supabase** (the `VITE_SUPABASE_*` variables are set): the **`games` table**. Add or edit a game in the dashboard's table editor (Table Editor → games). New rows start unpublished, so fill one in, then tick `published`. The site rebuilds itself a minute or two after you stop editing (see "Rebuilding when the games change" below). The columns are the fields below: nested ones are JSON, and `sourceCode` is `source_code`. `position` sets the order, lowest first.
- **Not connected** (a fork, or working offline): [`src/data/games.json`](src/data/games.json). `npm run catalog:pull` copies the table's published games into it, so the fallback can be kept current.

The build checks the list (`npm run check:catalog` checks `games.json` on its own) and publishes it as `/catalog.json`. A problem stops the build, and the live site stays as it was. The same goes for a connected build that can't reach Supabase: it fails instead of quietly using an older `games.json`.

```jsonc
{
  "id": "my-game",                  // URL: /g/my-game (a-z, 0-9, -)
  "kind": "game",                   // "game", or "portal" for a collection like Flashback Arcade
  "title": "My Game",
  "description": "One or two sentences.",
  "released": "2025-04-24",                              // optional: the release date (YYYY-MM-DD)
  "style": "What it looks like.",                        // optional
  "genre": ["puzzle"],
  "tags": ["classic"],
  "features": ["Mobile-friendly"],                       // optional
  "difficulty": "easy",                                  // optional: easy, medium or hard
  "controls": { "keys": [{ "keys": ["w", "up"], "action": "Go up" }], "mobile": true },  // optional (below)
  "iconUrl": "https://…/img/icon.png",                   // optional: the game's own icon, before its title
  "thumb": "https://…/screenshot.png",                   // optional: without one the card shows a title tile
  "website": "https://…",                                // optional: a homepage that isn't a way to play
  "dimensions": { "w": 460, "h": 740, "center": true },  // optional, embedded games: the frame's size (below)
  "platforms": [                                         // where it can be played; one entry per type
    { "type": "web", "url": "https://<game>.dt-games.pages.dev/", "embed": true, "icon": "CiShare1" }  // plays inside the hub
    // { "type": "web", "url": "https://…", "embed": false }  // plays on its own site, opened in a new tab
    // { "type": "android", "storeId": "com.example.game",
    //   "url": "https://play.google.com/store/apps/details?id=com.example.game", "icon": "CiMobile3" }
  ],
  "sourceCode": { "url": "https://github.com/…" }        // optional: one link, or a list of them (below)
}
```

- **Embedded games** get the in-hub player. The games live in [`DanyilT/dt-games`](https://github.com/DanyilT/dt-games), a branch per game, and Cloudflare Pages serves each branch at its own address (`https://<game>.dt-games.pages.dev/`). Those are the only sites the hub will put in an iframe (`EMBED_ORIGINS` in `scripts/check-catalog.mjs`).
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
- **Supabase**: sign-in (Google; Discord is coming), Postgres with row level security: profiles, the game list, game saves, ratings, favorites, bookmarks, feedback and friends. Schema changes are migrations in `supabase/migrations/`, applied with `npx supabase db push`, with pgTAP tests in `supabase/tests/`.
- **Cloudflare Workers (static assets)**: hosting, plus a small script (`worker/index.js`) whose cron trigger keeps Supabase awake.

## 📂 Project Structure

```
game-hub/
├── public/                  # copied as-is into dist/: hub-bridge.js (the game bridge, run in the game's page), favicon.ico/.svg, apple-touch-icon.png, manifest.json, icons/
├── scripts/
│   ├── check-catalog.mjs    # checks the game list (`npm run check:catalog`: src/data/games.json)
│   ├── catalog-source.mjs   # where the build gets the game list: the Supabase games table, or games.json
│   ├── catalog-pull.mjs     # `npm run catalog:pull`: copies the games table into games.json
│   ├── site-files.mjs       # robots.txt, sitemap.xml, llms.txt, humans.txt, security.txt (written by the build)
│   └── dev-local.mjs        # `npm run dev:local`: the dev server against the local Supabase
├── src/
│   ├── components/account/  # SignInModal, UsernameDialog (new players pick a username), UsernameField (🎲)
│   ├── components/install/  # installing as an app: the steps for iPhone/iPad, the banner on phones, useInstall()
│   ├── components/common/   # Avatar, Button, ErrorBoundary, GooglePlayBadge, InfoTip, Modal (the neon window), Toasts
│   ├── components/layout/   # Header, Footer, MainLayout; the navigation: Sidebar or FloatingNav, both from useNavItems.js
│   ├── components/layout/game/  # GameCard, GameList, GameControls, GameReactions (favorites, bookmarks), RatingSlider, RateGame, GameHelp (the ? window)
│   ├── contexts/            # AuthContext (the signed-in player, useAuth()), LibraryContext (their favorites, bookmarks, ratings, friend requests: useLibrary())
│   ├── data/                # games.json (the game list without Supabase), games.js (helpers), controls.js (key and gesture names)
│   ├── lib/                 # supabase.js (the client), gameBridge.js (saves), friends.js, account.js (username rules), install.js, preferences.js (navigation style), support.js (bug report links), toast.js, dates.js
│   ├── pages/               # Games, GamePage, About, Account/ (players, profile, /me, settings, sign-in callback), Legal/ (terms, privacy), ErrorPage
│   ├── styles/              # Sass variables, mixins, buttons and forms, shared animations, reset, base
│   ├── App.jsx              # routes
│   └── index.jsx            # entry point
├── supabase/
│   ├── config.toml          # Supabase CLI settings
│   ├── migrations/          # database schema, applied with `npx supabase db push`
│   ├── seed.sql             # 240 mock players, local only (`npm run db:reset`; never pushed)
│   └── tests/               # database tests (pgTAP), `npm run test:db`
├── worker/index.js          # the Worker's script: passes unmatched paths to the files, pings Supabase every 6 hours
├── .env.example             # template for .env.local (Supabase URL + publishable key)
├── index.html
├── vite.config.js           # also loads the game list (virtual:catalog), writes /catalog.json, the catalogue's icons module, the security headers (dist/_headers), _redirects and the root files; SITE_URL is here
├── wrangler.jsonc           # Cloudflare config
└── package.json
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
