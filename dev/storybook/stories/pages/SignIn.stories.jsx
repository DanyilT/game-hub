import { AppRoutes } from '../../../../src/App';

/**
 * /auth/callback, where Google brings players back: a new player picks their username here, anyone else goes back to
 * the page they signed in from. Without a session, it says what went wrong.
 */
export default {
  title: 'Pages/Sign-in callback',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/auth/callback' },
};

/** A new player: the welcome window asks them to keep or change the username they got */
export const NewPlayer = { globals: { account: 'newPlayer' } };

/** Still finding out (the server never answers) */
export const SigningIn = { globals: { account: 'signedIn', server: 'never' } };

/** No session came back (the sign-in was cancelled, or ended on another address) */
export const DidntFinish = { globals: { account: 'guest' } };
