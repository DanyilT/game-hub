import { addons } from 'storybook/manager-api';
import { create } from 'storybook/theming';

// Storybook's own frame in GameHub's colours
addons.setConfig({
  theme: create({
    base: 'dark',
    brandTitle: 'GameHub',
    brandUrl: 'https://game-hub.danyt.workers.dev',
    colorPrimary: '#c054f2',
    colorSecondary: '#662c91',
    appBg: '#151414',
    appContentBg: '#151414',
    appPreviewBg: '#151414',
    appBorderColor: '#3a2a46',
    barBg: '#232020',
    barSelectedColor: '#ff5cb3',
  }),
});
