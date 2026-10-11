import { AppRoutes } from '../../../../src/App';

/**
 * /admin, for admins only (Dany): players' reports (open, resolved or all, each with Resolve or Reopen) and the
 * developers (make a player one by username, or take the role away). Anyone else gets the 404 page.
 */
export default {
  title: 'Pages/Admin',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/admin' },
};

/** The open reports, newest first */
export const Reports = {};

export const ResolvedReports = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('radio', { name: 'Resolved' }));
  },
};

/** Resolving one: it leaves the open ones, and the tab's count goes down */
export const ResolveOne = {
  play: async ({ canvas, userEvent }) => {
    const [resolve] = await canvas.findAllByRole('button', { name: 'Resolve' });
    await userEvent.click(resolve);
  },
};

export const Developers = { parameters: { route: '/admin?tab=developers' } };

/** Making a player a developer by username: it asks first */
export const MakeDeveloper = {
  parameters: { route: '/admin?tab=developers' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('Make a player a developer'), 'turbo_taco19');
    await userEvent.click(canvas.getByRole('button', { name: 'Make developer' }));
  },
};

/** No such player */
export const NoSuchPlayer = {
  parameters: { route: '/admin?tab=developers' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText('Make a player a developer'), 'nobody_here');
    await userEvent.click(canvas.getByRole('button', { name: 'Make developer' }));
    await canvas.findByText(/no player called/);
  },
};

/** Not an admin (here, signed out): the 404 page */
export const NotAnAdmin = { globals: { account: 'guest' } };

export const CantLoad = { globals: { server: 'down' } };
