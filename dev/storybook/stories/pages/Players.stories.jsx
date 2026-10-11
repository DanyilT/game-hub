import { AppRoutes } from '../../../../src/App';

/**
 * Users: everyone with an account (/players), or only the developers (/developers): the switch beside the title. Each
 * has a search and two orders; developers among the players have a "dev" badge.
 */
export default {
  title: 'Pages/Users',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/players' },
};

export const Default = {};

export const AToZ = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'A–Z' }));
  },
};

export const Search = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole('searchbox', { name: /Search players/ }), 'panda');
  },
};

export const NoMatch = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByRole('searchbox', { name: /Search players/ }), 'zzz');
  },
};

/** The developers: how many games each has made here (or since when they're a developer) */
export const Developers = { parameters: { route: '/developers' } };

/** The switch, from the players to the developers */
export const SwitchToDevelopers = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Developers' }));
    await canvas.findByText('2 developers');
  },
};

export const Loading = { globals: { server: 'never' } };
export const CantLoad = { globals: { server: 'down' } };
export const AccountsOff = { globals: { account: 'off' } };
