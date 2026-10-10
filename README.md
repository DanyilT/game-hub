# GameHub Project

Welcome to the **GameHub** project! This repository contains the source code for a React-based web application.

## 📖 Overview

Hub for all games, that was created by me.

This is **v2** (branch [`main-v2`](https://github.com/DanyilT/game-hub/tree/main-v2)): a rewrite on Vite, hosted on Cloudflare Workers. It adds accounts (sign in with Google, with Discord coming): public profiles, game progress saved to the account, 1–5 ratings with a feedback box, favorites (public) and bookmarks (private), and friends, with blocking and reporting players. The navigation is a sidebar, or a floating round button (Settings → Preferences).

> [!NOTE]
> ### 🕹️ v1
>
> The original site stays on GitHub Pages at [danyilt.github.io/game-hub](https://danyilt.github.io/game-hub). Its source is the [`main-v1`](https://github.com/DanyilT/game-hub/tree/main-v1) branch (tag `v0.1.0`).

## ☁️ Hosting

v2 is a **static site**: `npm run build` turns it into plain HTML/CSS/JS files in `dist/`, and Cloudflare serves those files from its CDN. There is no web server to run. The build writes a copy of `index.html` for every page (`g/snake.html`, `players.html`, `terms.html`…; the games list is the home page, `index.html` itself), so opening or refreshing any page works, and React Router shows it. Profiles (`/u/<username>`) can't have a file each, so a rule in `_redirects` serves the app for all of them, and old addresses (`/games`, `/games/<id>`, `/users`) get a 301 to the new ones (`MOVED` in `vite.config.js`). Any other path gets `404.html` with a real 404 status (`not_found_handling: "404-page"` in `wrangler.jsonc`), and the site shows its 404 page, with a cat from [http.cat](https://http.cat).

- **Accounts** live in [Supabase](https://supabase.com) (sign-in, database, access rules). The browser talks to it directly.
- **Game saves** reach the account through the game bridge (see "Saving progress" below): `public/hub-bridge.js` runs inside the game's page, and `src/lib/gameBridge.js` answers it in the hub.
- **Offline:** the site's service worker (`src/service-worker.js`, built into `/sw.js`) keeps the app on the device, so GameHub opens without a network, and downloaded games play offline (see "Offline play" below).
- **Security headers:** the build also writes `dist/_headers` (see `vite.config.js`), so Cloudflare sends a Content-Security-Policy that allows only the sites the pages use.
- **Files at the root:** the build writes the usual ones from the catalogue (their text is in `scripts/site-files.mjs`): `robots.txt`, `sitemap.xml`, `llms.txt` (for AI assistants), `humans.txt` and `.well-known/security.txt`. For full URLs they use the site's address, `SITE_URL` in `vite.config.js` (https://gamehub.foo). Change it there if the site moves.
- **The address:** the site is at its own domain, **https://gamehub.foo**, the Worker's custom domain (`routes` in `wrangler.jsonc`). Its workers.dev address is off (`"workers_dev": false`, so a deploy doesn't turn it back on).
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
   The site is at https://gamehub.foo, `SITE_URL` in `vite.config.js` (see Hosting).

   **Database changes go first:** when `supabase/migrations/` has new files, apply them before deploying the site that uses them (it asks for the database password):
   ```bash
   npx supabase db push
   ```

   The same Worker keeps the free Supabase project awake: a cron in `wrangler.jsonc` pings the database every 6 hours. It also checks runs (`/api/verify-run`, see "Checked runs" below). With accounts on, give it the project's URL, publishable key and secret key once, as Worker secrets (they stay set across deploys). The secret key (Supabase → Project Settings → API Keys, `sb_secret_…`) only ever goes here, never in a `VITE_` variable:
   ```bash
   npx wrangler secret put SUPABASE_URL              # https://<project ref>.supabase.co
   npx wrangler secret put SUPABASE_PUBLISHABLE_KEY  # sb_publishable_…
   npx wrangler secret put SUPABASE_SECRET_KEY       # sb_secret_…
   ```
   Paste each value as it is, without quotes. If games stay "Not checked yet", the Worker's Logs (Workers & Pages → game-hub → Logs, or `npx wrangler tail`) say which setting or step is wrong.

   **Rebuilding when the games change:** the database asks Cloudflare for a new build once your edits to the `games` table have stopped for 30 seconds. It needs Cloudflare building the site from GitHub (Workers & Pages → game-hub → Settings → Build), and a deploy hook:
   1. In the same Build settings, under **Deploy Hooks**, create one for the production branch and copy its URL. Anyone with the URL can start builds, so treat it like a password.
   2. In Supabase's SQL editor, store it in Vault: `select vault.create_secret('<the hook URL>', 'deploy_hook_url');`

   To check it's working: `select * from private.site_rebuild;` shows when the games last changed and when a build was last asked for. `select * from net._http_response order by created desc limit 5;` shows Cloudflare's replies.
7. **Local Supabase (optional, needs Docker)**: the same database and sign-in server on your machine, for trying schema changes and running the database tests.
   ```bash
   npm run db:start    # then: npm run test:db, or npm run dev:local (the site against it)
   npm run test:worker # the run checkers (worker/games/) against runs recorded from the games, and /api/verify-run with Supabase faked; no database needed
   npm run db:reset    # a fresh local database, with 240 mock players (supabase/seed.sql)
   npm run db:stop
   ```
   With the local Supabase, the sign-in window offers an email link instead of Google; the emails land in the local inbox at http://127.0.0.1:54324.

## 🧩 Storybook

Every page and part of the site, drawn by the site's own code, with the world outside the page faked: a pretend Supabase with made-up players, and the game in the frame reporting what the story says.

```bash
npm run storybook        # http://localhost:6006
npm run storybook:build  # a static copy in dev/storybook/dist
```

The toolbar switches between signed in, a new player, a guest and a site without accounts; online and offline; a fast, slow, failing or silent server; and the sidebar or the floating button. Each page story has controls for what's on it (the game page: the game, its panel, the save and download, offline tickets, a replay, a message at the bottom of the screen). Everything for it is in `dev/storybook/`, apart from the site's code and build: see its README.

## 💾 Saving progress

Games keep their progress in the browser, and in the player's account when they play in the hub signed in. The game never talks to Supabase, and never gets the player's sign-in:

1. Each game (in [`DanyilT/dt-games`](https://github.com/DanyilT/dt-games)) loads `js/gamehub.js` first, and saves only through it: `GameHub.load()` and `GameHub.save(data)` (one JSON object per game, at most 64 KB).
2. Inside the hub, `gamehub.js` loads the hub's `/hub-bridge.js` (only from the hub's own addresses: the live site and `http://localhost:3000`). That script runs in the game's page and passes loads and saves to the hub page with `postMessage`. The messages are listed at the top of `public/hub-bridge.js`.
3. The hub page (`src/lib/gameBridge.js`) only listens to its own game frame, from the game's own address. It reads the save from the `game_saves` table, and writes the game's saves with `save_game()`: at most one every 10 seconds, plus whatever's waiting when the page is hidden or left, or before signing out.
4. Signed in, the account's save wins, with two exceptions, where the player's own copy in the browser goes up instead: the account has none for that game yet, or the copy carries on from the account's save with progress it doesn't have yet (made offline, or a save that didn't land). Signing in or out reloads the game.
5. **Each player keeps their own copy in the browser.** The browser has one save slot per game, whoever is playing, so the bridge sorts it out before the game reads it: the copy there is put aside under its owner's name (`<key>@<owner>`), and the current player's comes back. Each player is a name the hub gives the bridge (a hash of their account and the game), or `guest`. So one player's progress never shows for another, nor goes up to their account, and a guest's progress stays the guest's: it never goes into an account. Copies saved before this had no owner: one that never came from an account is the guest's, and one that did is a player's only when it carries on from their account's save.
6. The **?** button on a game's page resets its progress: the browser's copy (through the bridge), then the account's (`delete_game_save()`), then reloads the game.

Saves are the player's own and can't be made tamper-proof (they're in their browser), so nothing other players see is ever taken from a save: records come only from runs the server has played again itself ("Checked runs and records" below).

## 📊 The panel under the game, and replays

Under a game played in the hub, a panel shows the player's progress (`src/components/layout/game/GameProgress`). Games with `gamehub.js` version 3 fill it in:

1. **The game's numbers:** the game says what to show with `GameHub.status({ main, more, ongoing })`, whenever they change: up to 4 shown large (the score now, the best), and sections behind **More** (wins and best times per level: the rest of what it saves). The hub checks them (`src/lib/gameStatus.js`), since they come from another site: labels with numbers or short texts, never markup. With the numbers comes the time played (below).
2. **Runs:** a game records each game it plays, from start to end: `GameHub.startRun({ mode, tick })` gives it random numbers from a seed (`run.random()`, mulberry32), and it records each input that changes the game with the step it came after (games that move by themselves: Snake, Tetris) or its time (games that wait for the player: Minesweeper, Sudoku). Never pictures: a run is a few KB. When the game ends, the run goes to the hub, which keeps it in the browser (IndexedDB, `src/lib/runs.js`), with that player's runs of the game: the latest 20, and their 5 newest best ones however old. A guest's runs are the guest's. Resetting the game's progress deletes them too.
3. **Replays:** a run's ▶ button (only that: not the rest of its row) reloads the game with `#gamehub-replay` at the end of its address. The game then saves nothing and records nothing, and plays the run itself: `gamehub.js` gives it the run's seed and calls it with each input at its step or time (1×, 2× or 4×, and long waits between a game's inputs cut to 2 s). Back to the game reloads it as it was. Starting a replay while a game is under way (`ongoing`) asks first.
4. A signed-in player's runs played on a ticket also go to the server to be checked, and are kept there, so they can be watched in any browser: see "Checked runs" below.

## ✅ Checked runs and records

Saves are in the player's browser and can say anything, so records come only from runs GameHub's server has played again itself (`supabase/migrations/*_checked_runs.sql`, `worker/`, `src/lib/checks.js`):

1. **Tickets:** a signed-in player's game takes one for each run: a seed the server chose (`issue_tickets()`, 10 ready per game, good for 14 days). The hub keeps them in the browser and hands them to the game (`gamehub:tickets`); a game that starts a run as it loads waits for them (`GameHub.ready()`). So games played offline get them too. The server hears a ticket was taken as its run starts (`start_ticket()`, which also starts that run's clock), or once back online (`take_tickets()`).
2. **Checking:** when a run on a ticket ends, the hub sends it to the site's Worker (`POST /api/verify-run`, `worker/verify-run.js`), or keeps it until back online. The Worker plays it again from the ticket's seed with the game's own rules (`worker/games/`: a copy of each game's own `js/rules.js`, the same code the game plays with) and records what *its* replay gave (`record_run()`, with the secret key): never the game's claim. A ticket is good for one run, and a run can't have lasted longer than the time since its ticket was started (online) or issued, plus 30 s. Runs that don't play out are kept as refused; ones whose game said otherwise, or whose inputs came too fast, count but are flagged for a look. Inputs are kept 30 days, or while a run is a record (`private.tidy_runs()`, daily).
3. **What players see:** under the game, each run says whether it counts, is waiting to be checked, didn't count, or stays on the device (played without a ticket, offline once they ran out: the hub warns as the last one goes, and says so while offline). Back online, the hub gets new tickets for the downloaded games and checks the runs that waited (`MainLayout`), with a note. **More** shows the player's checked records (`my_records()`).
4. **In any browser** (`supabase/migrations/*_runs_on_any_browser.sql`): the list joins the runs kept on the server (`my_runs()`: those whose inputs are still kept, records first, 100 at most) to this browser's, one row per ticket, with the server's word on each check. Each one kept there shows the days left before its inputs go (none for a record); one this browser doesn't have gets its inputs from the server when it's watched (`my_run_inputs()`).
5. **When a game's rules change:** pull them again, `npm run games:pull` (`scripts/games-pull.mjs`). It copies each checked game's `js/rules.js` from the games' site into `worker/games/<id>.js` and adds the one line that makes it a module (`--from ~/Projects/dt-games` reads local worktrees instead, to try a change before it's pushed). Then `npm run test:worker` replays runs recorded from the games (`worker/games/fixtures.json`; record new ones when the rules change), and you read the diff and commit it: deploys use the committed copies. The Worker never loads a game's code while it runs (Workers can't run fetched code, and this one holds the secret key). Runs played under the old rules (offline, checked later) may stop checking out.
6. **Locally:** `npm run dev:local` runs the same checker in the dev server (with the local project's secret key). Against the hosted project, set `SUPABASE_SECRET_KEY` in `.env.local` (not `VITE_`) to check runs; without it, they wait.

## ⏱ Play activity

The hub counts how long players play each game (`src/lib/playTime.js`); the games aren't involved. A second counts while the game's page is on screen, the player has pressed a key or tapped in the game in the last 2 minutes (the bridge says when), and no replay is playing. A guest's time is kept in the browser only, for the panel. A signed-in player's goes to their account, while online: a play session starts at the first such second, and reports go up about once a minute (`report_play()`), when the page is hidden, and when it's left. The server never adds more time than has really passed, and a session counts as a play from a minute.

From the sessions come a profile's **Played** tab, the play time, the games page's **Recent activity** (each play once it's over), and **Playing now** on profiles and friends lists (a session reported in the last 2 minutes). In Settings → Privacy each player can turn their play history off: then nothing is recorded (`start_play()` and `report_play()` store nothing, whatever the site sends), what was kept is only theirs, and no one sees what they're playing now. While it's on, they pick who sees each of the three (everyone, friends, or only them; out of the box: everyone for played games and recent activity, friends for playing now). They can also delete their play history (`delete_my_play_history()`). The database applies all of it itself (`supabase/migrations/*_play_activity.sql`, `*_activity_controls.sql`): the tables are only read through its functions.

**Blocking and reporting** (`supabase/migrations/*_blocks_and_reports.sql`): the ⋯ on another player's profile blocks them or reports them. Blocking ends a friendship (and drops a request either way), stops friend requests between the two, and hides each one's activity from the other, whatever their choices say; the blocked player isn't told. Settings → Privacy lists the players you've blocked. A report (cheating, with the game if known, or something else, with what happened) can't be read back: read them in Supabase's Table Editor → `player_reports`, and for cheating, the player's checked games in `game_runs`. At most one report a day about the same player, and 10 a day in all.

To try saves (and the panel under the game) locally, the dev server has to run on port 3000 (the address `gamehub.js` trusts), with the games loaded from their live addresses. A game from the internet then loads the bridge from `localhost`, which Chrome blocks until you allow it (Local Network Access): on a local address the hub lets the game's frame ask (`allow="loopback-network; local-network"`, GamePage.jsx), so Chrome shows a prompt for the game's site; allow it. Until then the game never connects, so there's no panel and saves stay in the browser. Privacy extensions (uBlock Origin's "Block Outsider Intrusion into LAN" list, Brave Shields) block it too (`net::ERR_BLOCKED_BY_CLIENT`): allow it for `dt-games.pages.dev`. Or try it all on the live site.

## ✈ Offline play

GameHub opens offline, and a game downloaded from its page plays offline too, in the browser or the installed app:

1. **The site:** its service worker (`src/service-worker.js`; `vite.config.js` builds it into `/sw.js` with the list of the app's files) keeps the app when it installs. Pages come from the network when there is one, and from that copy when there isn't. Production builds only: the dev server never registers it.
2. **A game:** its page in GameHub has a **Download** button. A page's service worker can't answer for a frame from another site, so each game has a worker of its own (`sw.js` in every `dt-games` branch). The bridge, running in the game's page, keeps the game's files in the game's storage and registers that worker. From then on the game's files come from the network, refreshing the copy, and from the copy when there's no network. The button removes the download too.
3. **Progress made offline isn't lost:** `gamehub.js` version 2 keeps a note next to the save of which account save it carries on from (`<game>GameSync`). Back online, if the account hasn't changed meanwhile, the browser's progress wins and goes up; if another device saved meanwhile, the account's save wins.
4. The games list remembers which games are downloaded (`src/lib/offline.js`). Offline, it marks them, and fades the ones that need the internet. A game page offline shows a note in place of a game that isn't downloaded.

Games whose `gamehub.js` is still version 1 can't be downloaded: their Download button stays hidden.

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
  "developer": { "name": "Dany", "url": "https://github.com/DanyilT" },  // who made it (the url is optional)
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
  "dimensions": { "sizes": [{ "w": 320, "h": 710 }, { "w": 601, "h": 730 }], "center": true },  // optional, embedded games (below)
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
- **Filter links:** the games list keeps the chips picked in its filter box in the address (`/?tag=easy&tag=arcade`), so a reload keeps them and the link can be shared. A game's page lets players pick its genres, difficulty, platforms and tags, and opens the list filtered to the games that have them all.
- **Icons** (`icon` on platforms and links) are [react-icons](https://react-icons.github.io/react-icons) names, like `CiGlobe` or `FaGithub`. The build bundles only the icons the catalogue names, and the check rejects a name react-icons doesn't have. Without an `icon`, a web platform shows `CiShare1`, Android shows `CiMobile3` and source code shows a floppy disk (`CiFloppyDisk`).
- **`sourceCode`** is one link or a list of links, each `{ "url": "…", "label": "…", "icon": "…" }`. `label` and `icon` are optional for a single link; a list needs a `label` on each link, so they can be told apart ("View Code" otherwise).
- **`developer`**: who made the game, `{ "name": "…", "url": "https://…" }` (`url` is optional). The game page shows it with the release date ("Released 24 April 2025 by Dany"), linking to `url`, and so does the card's info panel. It isn't the developer section below, which is about the site's owner.
- **`dimensions`** (embedded games only): `sizes` says how tall the game is (`h`) when its frame is `w` pixels wide, for one or more widths, narrowest first: a game lays out differently at different widths (Tetris is almost twice as tall on a phone). The frame takes the height of the widest size that fits it (the narrowest one's when none does), so a size covers the widths from its `w` up to the next one's: add one where the game's layout changes (its CSS breakpoints). Measure with the game's instructions closed: open, they may make the game scroll in its frame, and that's fine. To measure, open the game on its own at each width with the window shorter than the game, and run `document.documentElement.scrollHeight` in the console (for a game that shows less in GameHub's frame, first run `document.documentElement.dataset.gamehubView = 'frame'`). The frame starts stretched across its column. On wide screens (above 1024px), Enable Resize offers Collapse Width (the size's own width, never wider than the column, in the middle; Expand Width brings back the default, after a drag too) and Maximize (the whole row, with the info below). Dragging its width on its own gives it the game's height for that width. Narrower screens already give the game the whole row, so they keep the default frame. Without `dimensions` the frame is 16:9 across the column. The hub also tells the game how it's shown, after each load and when the frame goes in or out of full screen: `{ type: 'gamehub:view', view: 'frame' | 'full' }` (the games' `gamehub.js` puts it in `data-gamehub-view` on their `<html>`), so a game can show only what's needed to play in its frame, and its whole page full screen. With `"center": true`, the hub asks the game to scroll its play area to the middle of the frame, when it loads and after the frame changes size. The hub can't scroll another site's page, so the game does it. It needs these lines, e.g. in a script every game loads:
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
- **SCSS modules**: component styles (`*.module.scss`, `@use` only). Colours, sizes, fonts and timings are Sass variables in `src/styles/abstracts/_variables.scss`, shared mixins are in `_mixins.scss` next to it, and what content sits on (cards, panels, windows, popups) is in `_surfaces.scss`.
- **One design system** (`src/components/common`), each part in a `components` cascade layer (`@layer`), so a page's own class on one always wins: for where it goes, not a look of its own. Storybook shows them all under **Design system**.
  - `Button`: every button, and every link that looks like one (a variant, tone, size, shape and font, an icon; an action, a page of the site, or another site). `Tag`: a game's tag. `Badge`: a count, a dot or a word (soon, you).
  - The form fields (`Field`): `TextField`, `TextArea`, `Select`, `Checkbox`, `Switch` and `RadioGroup` (a list, cards, or segmented), each tying its label, hint and error to its control.
  - `Message` (a note, error, warning or success line) and `Status` (loading, nothing yet, couldn't load with Try again); `PageTitle`; `Disclosure` (a ▼ and the part it opens); `Tabs`; `Popover` (kept inside the window).
  - A link in running text (no class of its own) gets the site's link style from the base styles.
- **Fonts** (Google Fonts): Doto for the site, and Chakra Petch (easier to read small) for tags and small labels (a `Button`'s `font="secondary"`). To change one, edit `$font-primary` / `$font-secondary` in `_variables.scss` and the Google Fonts link in `index.html`.
- **react-icons**: interface icons, and the icons the catalogue names.
- **Supabase**: sign-in (Google; Discord is coming), Postgres with row level security: profiles, the game list, game saves, ratings, favorites, bookmarks, feedback, friends, blocks and reports, play activity and privacy settings. Schema changes are migrations in `supabase/migrations/`, applied with `npx supabase db push`, with pgTAP tests in `supabase/tests/`.
- **Cloudflare Workers (static assets)**: hosting, plus a small script (`worker/index.js`) whose cron trigger keeps Supabase awake.

## 📂 Project Structure

```
game-hub/
├── public/                  # copied as-is into dist/: hub-bridge.js (the game bridge, run in the game's page), favicon.ico/.svg, apple-touch-icon.png, manifest.json, icons/
├── dev/storybook/           # Storybook: its config (.storybook/), the stand-ins for Supabase, the game bridge, replays and installing (mocks/), and the stories (`npm run storybook`)
├── scripts/
│   ├── check-catalog.mjs    # checks the game list (`npm run check:catalog`: src/data/games.json)
│   ├── catalog-source.mjs   # where the build gets the game list: the Supabase games table, or games.json
│   ├── catalog-pull.mjs     # `npm run catalog:pull`: copies the games table into games.json
│   ├── games-pull.mjs       # `npm run games:pull`: copies each checked game's js/rules.js into worker/games/
│   ├── site-files.mjs       # robots.txt, sitemap.xml, llms.txt, humans.txt, security.txt (written by the build)
│   └── dev-local.mjs        # `npm run dev:local`: the dev server against the local Supabase
├── src/
│   ├── components/account/  # SignInModal, UsernameDialog (new players pick a username), UsernameField (🎲), ReportPlayer (the ⋯ → Report window)
│   ├── components/install/  # installing as an app: the steps for iPhone/iPad, the banner on phones, useInstall()
│   ├── components/common/   # the design system: Button, Tag, Badge, Field (the form fields), Message, Status, PageTitle, Disclosure, Tabs, Popover; and Avatar, ConfirmDialog ("Sign out?"), ErrorBoundary, ExternalLink (a link that opens a new tab), GooglePlayBadge, InfoTip, Menu (a ⋯ button with actions), Modal (the neon window), Toasts
│   ├── components/layout/   # Header, Footer, MainLayout, RecentActivity (the games page); the navigation: Sidebar or FloatingNav, both from useNavItems.js
│   ├── components/layout/game/  # GameCard, GameList, GameControls, GameReactions (favorites, bookmarks), DownloadGame (offline), GameProgress (the panel under the game, replays), RatingSlider, RateGame, GameHelp (the ? window)
│   ├── contexts/            # AuthContext (the signed-in player, useAuth()), LibraryContext (their favorites, bookmarks, ratings, friend requests: useLibrary())
│   ├── data/                # games.json (the game list without Supabase), games.js (helpers), controls.js (key and gesture names)
│   ├── lib/                 # supabase.js (the client), gameBridge.js (saves, downloads, the panel), runs.js (runs to replay), checks.js (tickets, checked runs, records), gameStatus.js (the panel's numbers), playTime.js (play time), activity.js (played games, playing now, privacy), offline.js, friends.js, blocks.js, reports.js, account.js (username rules), install.js, preferences.js (navigation style), support.js (bug report links), toast.js, confirm.js, dates.js
│   ├── service-worker.js    # the site's service worker: built into /sw.js by vite.config.js, not imported by the app
│   ├── pages/               # Games, GamePage, Account/ (players, profile, /me, settings, sign-in callback), Legal/ (about, terms, privacy), ErrorPage
│   ├── styles/              # Sass variables, mixins, surfaces (cards, panels, windows, popups) and forms, shared animations, reset, base
│   ├── App.jsx              # routes
│   └── index.jsx            # entry point
├── supabase/
│   ├── config.toml          # Supabase CLI settings
│   ├── migrations/          # database schema, applied with `npx supabase db push`
│   ├── seed.sql             # 240 mock players, local only (`npm run db:reset`; never pushed)
│   └── tests/               # database tests (pgTAP), `npm run test:db`
├── worker/index.js          # the Worker's script: checks runs (/api/verify-run: verify-run.js), passes other unmatched paths to the files, pings Supabase every 6 hours
├── worker/games/            # each game's rules, copied from the game (`npm run games:pull`), to play a run again on the server (`npm run test:worker`)
├── .env.example             # template for .env.local (Supabase URL + publishable key)
├── index.html
├── vite.config.js           # also loads the game list (virtual:catalog), writes /catalog.json, the catalogue's icons module, the security headers (dist/_headers), _redirects, the root files and /sw.js; SITE_URL is here
├── wrangler.jsonc           # Cloudflare config
└── package.json
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).
