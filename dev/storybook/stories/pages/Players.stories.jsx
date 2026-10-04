import { AppRoutes } from '../../../../src/App';

/** Everyone with an account: /players, with a search and two orders */
export default {
  title: 'Pages/Players',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/players' },
};

export const Default = {};

export const AToZ = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'A–Z' }));
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

export const Loading = { globals: { server: 'never' } };
export const CantLoad = { globals: { server: 'down' } };
export const AccountsOff = { globals: { account: 'off' } };
