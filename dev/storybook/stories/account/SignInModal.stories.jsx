import SignInModal from '../../../../src/components/account/SignInModal/SignInModal';

/**
 * The sign-in window: Google (Discord says "soon"), and an email link that only works with the local Supabase. In
 * Storybook, Continue with Google signs straight in.
 */
export default {
  title: 'Account/Sign-in window',
  component: SignInModal,
  globals: { account: 'guest' },
  parameters: { scenario: (args) => ({ emailSignIn: args.emailLink }) },
  args: { emailLink: false },
  argTypes: { emailLink: { description: 'The email link works (the local Supabase from npm run dev:local)' } },
};

export const Default = {};

/** The email link, as it works with the local Supabase */
export const EmailLink = {
  args: { emailLink: true },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: /Sign in with email link/ }));
  },
};

/** The sign-in service can't be reached */
export const CantReach = { globals: { server: 'down' } };
