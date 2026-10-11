import { AppRoutes } from '../../../../src/App';

/**
 * Settings: the profile (picture, display name), the username (once every 30 days), privacy (who sees what you play,
 * and who you've blocked), preferences (the navigation), the account, and deleting it. Signed out, only preferences.
 */
export default {
  title: 'Pages/Settings',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/settings' },
};

export const SignedIn = {};

/**
 * Privacy: the play history off (nothing recorded, and no one sees what you're playing now; who sees what goes with it,
 * kept for when it's back on)
 */
export const PlayHistoryOff = { parameters: { scenario: { privacy: { record_played: false } } } };

/** Saving the display name: the message under the form slides in once there is one */
export const SaveDisplayName = {
  play: async ({ canvas, userEvent }) => {
    const input = await canvas.findByLabelText('Display name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Dany T');
    await userEvent.click(canvas.getByRole('button', { name: 'Save profile' }));
    await canvas.findByText('Saved.');
  },
};

/** Developers (Dany) have Settings → Developer: a link that isn't an https address is pointed out before saving */
export const DeveloperBadLink = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Add a link' }));
    await userEvent.type(canvas.getByRole('textbox', { name: 'Link 4' }), 'github.com/dany');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await canvas.findByText(/Use a whole https address/);
  },
};

/** Saving the bio and links: they're on the profile at once */
export const DeveloperSave = {
  play: async ({ canvas, userEvent }) => {
    const bio = await canvas.findByLabelText('Bio');
    await userEvent.type(bio, ' New games soon!');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await canvas.findByText(/It’s on your profile/);
  },
};

/** Delete my play history: it asks first */
export const DeletePlayHistory = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Delete my play history' }));
  },
};

/** Your own Played tab, with the history off */
export const PlayedTabHistoryOff = {
  parameters: { route: '/u/dany?tab=played', scenario: { privacy: { record_played: false } } },
};

/** A new player can change their username at once (an old one waits 30 days after the last change) */
export const NewPlayer = { globals: { account: 'newPlayer' } };

export const SignedOut = { globals: { account: 'guest' } };

export const AccountsOff = { globals: { account: 'off' } };

/** Deleting the account: typing the username enables the button, which asks first */
export const DeleteAccount = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.type(await canvas.findByLabelText(/Type your username/), 'dany');
    await userEvent.click(canvas.getByRole('button', { name: 'Delete my account' }));
  },
};

export const CantLoad = { globals: { server: 'down' } };
