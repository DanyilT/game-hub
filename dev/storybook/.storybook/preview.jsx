import { configure } from 'storybook/test';
import { themes } from 'storybook/theming';
import '../../../src/styles/main.scss';
import { GLOBAL_DEFAULTS } from '../mocks/scenario';
import { fireFocusEventsWithoutWindowFocus } from './focusEvents';
import { withApp } from './withApp';

// The play functions type into fields even when Storybook's window isn't the active one (focusEvents.js)
fireFocusEventsWithoutWindowFocus();
// ...and wait up to 5 s for what they look for (findBy…), not 1 s: a browser slows the timers of a page it isn't
// showing, and the pretend server (mocks/supabase.js) answers on timers too
configure({ asyncUtilTimeout: 5000 });

/** @type { import('@storybook/react-vite').Preview } */
const preview = {
  decorators: [withApp],
  // The toolbar: who's using the site, and the world around it (mocks/scenario.js)
  globalTypes: {
    account: {
      description: 'Who is using the site',
      toolbar: {
        title: 'Account',
        icon: 'user',
        dynamicTitle: true,
        items: [
          { value: 'signedIn', title: 'Signed in' },
          { value: 'newPlayer', title: 'New player (no username yet)' },
          { value: 'guest', title: 'Guest' },
          { value: 'off', title: 'Accounts off (no Supabase)' },
        ],
      },
    },
    network: {
      description: 'Online or offline (navigator.onLine)',
      toolbar: {
        title: 'Network',
        icon: 'globe',
        dynamicTitle: true,
        items: [{ value: 'online', title: 'Online' }, { value: 'offline', title: 'Offline' }],
      },
    },
    server: {
      description: 'How the pretend Supabase answers',
      toolbar: {
        title: 'Server',
        icon: 'database',
        dynamicTitle: true,
        items: [
          { value: 'fast', title: 'Server: fast' },
          { value: 'slow', title: 'Server: slow (2 s)' },
          { value: 'down', title: 'Server: down (errors)' },
          { value: 'never', title: 'Server: never answers (loading)' },
        ],
      },
    },
    nav: {
      description: 'Settings → Preferences → Navigation',
      toolbar: {
        title: 'Navigation',
        icon: 'sidebar',
        dynamicTitle: true,
        items: [
          { value: 'sidebar', title: 'Sidebar' },
          { value: 'floating-right', title: 'Floating button, right' },
          { value: 'floating-left', title: 'Floating button, left' },
        ],
      },
    },
  },
  initialGlobals: { ...GLOBAL_DEFAULTS },
  parameters: {
    layout: 'fullscreen',
    // The site paints its own background
    backgrounds: { disable: true },
    docs: { theme: themes.dark },
    controls: { expanded: true, sort: 'requiredFirst' },
    // Accessibility problems show in the Accessibility tab without failing anything
    a11y: { test: 'todo' },
    options: {
      storySort: { order: ['Introduction', 'Design system', 'Pages', 'Layout', 'Game', 'Account', 'Common'] },
    },
  },
};

export default preview;
