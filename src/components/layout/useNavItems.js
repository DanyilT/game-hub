import {
  CiCircleInfo, CiCircleList, CiLogin, CiLogout, CiPizza, CiSaveDown2, CiSettings, CiUser,
} from 'react-icons/ci';
import { useAuth } from '../../contexts/AuthContext';
import { useLibrary } from '../../contexts/LibraryContext';
import { askToConfirm } from '../../lib/confirm';
import { canInstall, install } from '../../lib/install';
import { useInstall } from '../install/InstallApp';

/**
 * The site's navigation, for both styles (Sidebar and FloatingNav), so the two never differ.
 * Each item is a page ({ key, path, label, icon }) or an action ({ key, onClick, label, icon }), plus:
 * - `soon`: not built yet (or needs accounts on a site without them): shown greyed out with a badge
 * - `badge`: a count to show on it (friend requests waiting on Profile)
 * - `danger`: signing out
 * - `short`: a shorter label, for the floating button's small circles
 * @param {function} [beforeAction] - runs before an action item's own onClick (e.g. closing a menu)
 * @return {{ main: object[], user: object[], footer: object[] }} - the groups, in order
 */
const useNavItems = (beforeAction = () => {}) => {
  const { isAvailable, loading, user, profile, signOut, openSignIn } = useAuth();
  const { requestCount } = useLibrary();
  const installState = useInstall();

  const action = (onClick) => () => {
    beforeAction();
    onClick();
  };

  const main = [
    { key: 'games', path: '/', label: 'Games', icon: CiPizza },
    { key: 'players', path: '/players', label: 'Players', icon: CiCircleList, soon: !isAvailable },
  ];

  const userItems = [
    // The profile link needs the username, so it appears once the profile has loaded
    ...(user && profile ? [{
      key: 'profile', path: `/u/${profile.username}`, label: 'Profile', icon: CiUser, badge: requestCount, profile,
    }] : []),
    // Also signed out: preferences like the navigation style are there
    { key: 'settings', path: '/settings', label: 'Settings', icon: CiSettings },
  ];

  const footer = [
    // Nothing until we know whether someone is signed in, so "Sign in" doesn't flash for players who are
    ...(!user && !loading ? [{
      key: 'sign-in', label: 'Sign in', icon: CiLogin, soon: !isAvailable, onClick: action(openSignIn),
    }] : []),
    // Installing the site as an app (src/lib/install.js): only where the browser can, and not in the app itself
    ...(canInstall(installState) ? [{
      key: 'install', label: 'Install app', short: 'Install', icon: CiSaveDown2, onClick: action(install),
    }] : []),
    { key: 'about', path: '/about', label: 'About', icon: CiCircleInfo },
    ...(user ? [{
      key: 'sign-out',
      label: 'Sign out',
      icon: CiLogout,
      danger: true,
      onClick: action(async () => {
        const yes = await askToConfirm({
          title: 'Sign out?',
          message: 'You’ll be signed out of GameHub on this device. Your progress stays in your account.',
          confirmLabel: 'Sign out',
          danger: true,
        });
        if (yes) await signOut();
      }),
    }] : []),
  ];

  return { main, user: userItems, footer };
};

export default useNavItems;
