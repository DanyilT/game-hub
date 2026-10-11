import { AppRoutes } from '../../../../src/App';

/**
 * Player profiles: /u/<username>. The tabs: Played (another player's only when they let you see it), Friends,
 * Favorites, and on your own the private ones (a lock on the icon): Bookmarks, Ratings, and your friend requests
 * inside Friends. Someone else's has, at the top right, the friend button (Add friend, or a menu once there's something
 * between you: Friends, Request sent, Friend request, Blocked) and the ⋯ menu (block while you aren't friends, report).
 * A developer's (Dany, Nora) has a Developer badge and card: their bio, links and the games they made. An admin (Dany)
 * also has Make developer, or Take away developer role, in the ⋯.
 * The made-up players are in dev/storybook/mocks/data.js.
 */
export default {
  title: 'Pages/Profile',
  component: AppRoutes,
  render: () => <AppRoutes />,
  parameters: { route: '/u/dany' },
};

/** Your own: the Played tab first */
export const YourProfile = {};
export const YourFriends = { parameters: { route: '/u/dany?tab=friends' } };
/** Your friend requests: a tab inside Friends (the address is still ?tab=requests) */
export const YourFriendRequests = { parameters: { route: '/u/dany?tab=requests' } };
export const YourFavorites = { parameters: { route: '/u/dany?tab=favorites' } };
export const YourBookmarks = { parameters: { route: '/u/dany?tab=bookmarks' } };
export const YourRatings = { parameters: { route: '/u/dany?tab=ratings' } };

/** A private tab's lock, hovered */
export const PrivateTabTip = {
  play: async ({ canvas, userEvent }) => {
    const tab = await canvas.findByRole('tab', { name: /Bookmarks/ });
    await userEvent.hover(tab.querySelector('span'));
  },
};

/** A friend, playing Tetris right now. She's a developer too: one link, and no games here yet. */
export const AFriend = { parameters: { route: '/u/cosmic_narwhal42' } };

/** Dany's profile as a visitor sees it: the Developer card with the bio, links and games */
export const ADeveloper = { parameters: { route: '/u/dany' }, globals: { account: 'guest' } };

/** An admin's ⋯ on a player who isn't a developer: Make developer */
export const AdminMenu = {
  parameters: { route: '/u/turbo_taco19' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
    await canvas.findByRole('menuitem', { name: 'Make developer' });
  },
};

/** Make developer asks first */
export const MakeDeveloper = {
  parameters: { route: '/u/turbo_taco19' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
    await userEvent.click(await canvas.findByRole('menuitem', { name: 'Make developer' }));
  },
};

/** A friend's Friends menu: remove them, or block them */
export const FriendMenu = {
  parameters: { route: '/u/cosmic_narwhal42' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Friends' }));
    await canvas.findByRole('menuitem', { name: 'Remove friend' });
  },
};

/** Someone you could add */
export const SomeoneElse = { parameters: { route: '/u/turbo_taco19' } };

/** You asked them; they haven't answered */
export const RequestSent = { parameters: { route: '/u/mystic_yeti88' } };

/** They asked you */
export const TheyAsked = { parameters: { route: '/u/mega_muffin31' } };

/** Someone you've blocked */
export const Blocked = { parameters: { route: '/u/silly_goblin46' } };

/** The ⋯ menu on someone else's profile */
export const PlayerMenu = {
  parameters: { route: '/u/turbo_taco19' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
  },
};

/** Report… from the ⋯ menu */
export const ReportWindow = {
  parameters: { route: '/u/turbo_taco19' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
    await userEvent.click(await canvas.findByRole('menuitem', { name: 'Report…' }));
  },
};

/** Block from the ⋯ menu: it asks first */
export const BlockQuestion = {
  parameters: { route: '/u/turbo_taco19' },
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'More for Taco Tim' }));
    await userEvent.click(await canvas.findByRole('menuitem', { name: 'Block' }));
  },
};

/** Someone's profile, signed out */
export const SignedOutVisitor = { parameters: { route: '/u/cosmic_narwhal42' }, globals: { account: 'guest' } };

export const NoSuchPlayer = { parameters: { route: '/u/nobody_here' } };

/** /me, signed out: it offers sign-in (signed in, it opens your profile) */
export const MeSignedOut = { parameters: { route: '/me' }, globals: { account: 'guest' } };

/** Loading (the server never answers) */
export const Loading = { parameters: { route: '/u/cosmic_narwhal42' }, globals: { server: 'never' } };

/** The server is down */
export const CantLoad = { parameters: { route: '/u/cosmic_narwhal42' }, globals: { server: 'down' } };
