# Storybook

Every page and part of GameHub, drawn by the site's own code, with the world outside the page faked. It lives here,
apart from the site: nothing in `src/` imports it, and the site's build never sees it.

```bash
npm run storybook        # http://localhost:6006
npm run storybook:build  # a static copy in dev/storybook/dist (not committed)
```

## How it works

- **`.storybook/main.js`** uses the site's own `vite.config.js` (minus the plugins for the site's build and dev
  server), so styles, the game list (`virtual:catalog`) and icons work as on the site. It never reads `.env`: the game
  list comes from `src/data/games.json`, and nothing reaches the real Supabase.
- **Stand-ins** (`mocks/`): `main.js` swaps four of the site's modules for these wherever they're imported:
  - `supabase.js` for `src/lib/supabase.js`: a pretend Supabase that answers the site's queries and database
    functions from `data.js`, in memory, seeing what the real row level security would let each player see
  - `gameBridge.js` for `src/lib/gameBridge.js`: what the game in the frame would report (it's the real game, but it
    can't talk to Storybook)
  - `runs.js` for `src/lib/runs.js`: replays from the story instead of IndexedDB
  - `install.js` for `src/lib/install.js`: the install state from the story instead of the browser
- **`.storybook/withApp.jsx`**, the decorator around every story: it sets the scenario (`mocks/scenario.js`) from the
  toolbar and the story, clears what the site keeps in `localStorage`, puts in the story's tickets, downloads and play
  time, and draws the story inside the site's router and its two contexts, as `src/index.jsx` does. A new scenario
  draws everything afresh.

## Writing a story

```jsx
import { AppRoutes } from '../../../../src/App';

export default {
  title: 'Pages/Game page',
  render: () => <AppRoutes />,
  parameters: {
    route: (args) => `/g/${args.game}`, // the address (a string, or a function of the controls)
    scenario: (args) => ({ // what the pretend world says (an object, or a function of the controls)
      game: { connected: true, save: 'failed' }, // the game in the frame (scenario.js: GAME_DEFAULTS)
      tickets: { snake: 3 }, // offline tickets kept in the browser
      downloads: ['snake'], // games downloaded to play offline
      toast: { text: 'A message', tone: 'info' }, // a message at the bottom of the screen
    }),
  },
  args: { game: 'snake' },
};

export const Offline = { globals: { network: 'offline' } }; // a story can fix the toolbar too
```

A part on its own renders the component directly; the decorator still gives it the router, the contexts, and the
site's messages and questions (`Toasts`, `ConfirmDialog`).

When the site asks Supabase for something new (a table, a database function), the pretend one says so in the console:
add it to `mocks/supabase.js`, and its data to `mocks/data.js`.
