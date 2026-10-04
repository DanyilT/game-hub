import { AppRoutes } from '../../../../src/App';
import ErrorPage from '../../../../src/pages/ErrorPage/ErrorPage';

/** The error pages, with http.cat's cats: a path that doesn't exist, a page that crashed (ErrorBoundary), a teapot */
export default {
  title: 'Pages/Error page',
  component: ErrorPage,
  argTypes: { status: { control: 'inline-radio', options: [404, 418, 500] } },
  args: { status: 404 },
};

/** An address with nothing at it, in the site's layout */
export const NotFound = { render: () => <AppRoutes />, parameters: { route: '/no-such-page' } };

/** The page on its own, for each status */
export const Status = { render: (args) => <ErrorPage {...args} />, args: { status: 500 } };

export const GameNotFound = {
  render: (args) => <ErrorPage {...args} />,
  args: { status: 404, title: 'Game not found', text: "There's no game at this address. Maybe it has a new name?" },
};
