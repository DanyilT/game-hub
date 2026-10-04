import RecentActivity from '../../../../src/components/layout/RecentActivity/RecentActivity';

/** The games page's recent activity: who played what lately (only players who show it). Nothing at all without plays. */
export default {
  title: 'Layout/Recent activity',
  component: RecentActivity,
  parameters: { layout: 'padded' },
};

export const Default = {};
export const SignedOut = { globals: { account: 'guest' } };
/** The server is down: nothing shows */
export const NothingToShow = { globals: { server: 'down' } };
