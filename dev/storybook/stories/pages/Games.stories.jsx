import { within } from 'storybook/test';
import { AppRoutes } from '../../../../src/App';

/**
 * The home page: the games list with its filters, and the recent activity under it. Offline, games that aren't
 * downloaded are dimmed. On phones, after a game or two, it suggests installing the app.
 */
export default {
  title: 'Pages/Games list',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: {
    route: '/',
    scenario: (args) => ({
      downloads: args.downloaded,
      install: { bannerDue: args.installBanner, platform: args.installBanner ? 'android' : null },
      toast: args.toast ? { text: args.toast, tone: args.toastTone } : null,
    }),
  },
  argTypes: {
    downloaded: { control: 'check', options: ['snake', 'tetris', 'minesweeper', 'sudoku'], description: 'Games downloaded to play offline' },
    installBanner: { description: 'Phones: the install suggestion is due (see it at a phone width)' },
    toast: { control: 'text', description: 'A message at the bottom of the screen' },
    toastTone: { control: 'inline-radio', options: ['info', 'error'] },
  },
  args: { downloaded: [], installBanner: false, toast: '', toastTone: 'info' },
};

export const Default = {};

/** The filter box open */
export const Filters = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Filter games/ }));
  },
};

/** Two filters picked: easy, and arcade (the chips in the filter box, not the cards' tags) */
export const Filtered = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Filter games/ }));
    const filters = within(await canvas.findByRole('region', { name: 'Filters' }));
    await userEvent.click(filters.getByRole('button', { name: 'easy' }));
    await userEvent.click(filters.getByRole('button', { name: 'arcade' }));
  },
};

/** Filters from the address (/?tag=easy&tag=arcade): a reload keeps them, and the link can be shared */
export const FilteredByLink = { parameters: { route: '/?tag=easy&tag=arcade' } };

/** Your favorites only: the heart beside the filter box (Snake and Sudoku). The address keeps it: /?only=favorites */
export const Favorites = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Your favorites only' }));
    await canvas.findByText(/^2 of \d+ shown$/);
  },
};

/** Your favorites and your bookmarks: only games that are both (none here) */
export const FavoritesAndBookmarks = { parameters: { route: '/?only=favorites&only=bookmarks' } };

/** The lists in the open box: beside its group buttons, under Clear */
export const ListsWithFiltersOpen = {
  parameters: { route: '/?only=bookmarks' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Filter games/ }));
  },
};

/** A phone: the lists in the bar, both at its right when "Filter games" can stay in the middle */
export const ListsOnAPhone = { globals: { viewport: { value: 'mobile2', isRotated: false } } };

/** A small phone: one at each side of the bar */
export const ListsOnASmallPhone = { globals: { viewport: { value: 'mobile1', isRotated: false } } };

/** Signed out: the lists' buttons open the sign-in window */
export const ListsSignedOut = {
  globals: { account: 'guest' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Your bookmarks only' }));
    await within(document.body).findByRole('dialog');
  },
};

/** A game card's info, opened */
export const GameInfo = {
  // As a keyboard player opens it: a card shows its buttons while one of them has the focus (they take no clicks
  // while hidden, and a pretend hover doesn't show them)
  play: async ({ canvas, userEvent }) => {
    (await canvas.findByRole('button', { name: 'Snake: Game Info' })).focus();
    await userEvent.keyboard('{Enter}');
  },
};

/** Offline: only the downloaded games play (Snake and Sudoku here) */
export const Offline = { globals: { network: 'offline' }, args: { downloaded: ['snake', 'sudoku'] } };

/** A phone, once the player has opened a game or two: the install suggestion */
export const InstallSuggestion = { args: { installBanner: true }, globals: { viewport: { value: 'mobile2', isRotated: false } } };
