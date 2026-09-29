import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import {
  CiCircleChevLeft,
  CiCircleChevRight,
  CiCircleInfo,
  CiCircleList,
  CiCircleRemove,
  CiLogin,
  CiLogout,
  CiPizza,
  CiSaveDown2,
  CiSettings,
  CiUser,
} from 'react-icons/ci';
import { useAuth } from '../../../contexts/AuthContext';
import { canInstall, install } from '../../../lib/install';
import { useInstall } from '../../install/InstallApp';
import Avatar from '../../common/Avatar/Avatar';
import styles from './Sidebar.module.scss';

// Navigation items. `soon` marks pages that aren't built yet: they're shown greyed out with a
// badge instead of linking nowhere. `needsAccounts` pages are "soon" on a site without Supabase.
const mainNav = [
  { path: '/', label: 'Games', icon: CiPizza },
  { path: '/players', label: 'Players', icon: CiCircleList, needsAccounts: true },
];

const footerNav = [
  { path: '/about', label: 'About', icon: CiCircleInfo, soon: true },
];

/**
 * Site sidebar.
 * - Desktop: a fixed rail, collapsed to icons or expanded with labels (state lives in MainLayout).
 * - Phone: an off-canvas drawer, opened from the header's menu button.
 * @param {boolean} isExpanded - desktop: show the wide sidebar with labels
 * @param {function} onToggleExpanded - desktop: collapse/expand
 * @param {boolean} isOpen - phone: drawer is open
 * @param {function} onClose - phone: close the drawer
 */
const Sidebar = ({ isExpanded = false, onToggleExpanded = () => {}, isOpen = false, onClose = () => {} }) => {
  const { isAvailable, loading, user, profile, signOut, openSignIn } = useAuth();
  const installState = useInstall();
  const closeButtonRef = useRef(null);

  // Phone: move focus into the drawer when it opens
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  const userNav = user
    ? [
      // The profile link needs the username, so it appears once the profile has loaded
      ...(profile ? [{ path: `/u/${profile.username}`, label: 'Profile', icon: CiUser }] : []),
      { path: '/settings', label: 'Settings', icon: CiSettings },
    ]
    : [];

  // Opens the sign-in window over this page (and closes the phone drawer first). Nothing is shown
  // until we know whether someone is signed in, so "Sign in" doesn't flash for players who are.
  const accountNav = user || loading
    ? []
    : [{
      key: 'sign-in',
      label: 'Sign in',
      icon: CiLogin,
      soon: !isAvailable,
      onClick: () => {
        onClose();
        openSignIn();
      },
    }];

  // Installing the site as an app (src/lib/install.js): only where the browser can, and not in the app itself
  const installNav = canInstall(installState)
    ? [{
      key: 'install',
      label: 'Install app',
      icon: CiSaveDown2,
      onClick: () => {
        onClose();
        install();
      },
    }]
    : [];

  const handleSignOut = async () => {
    if (window.confirm('Sign out of GameHub?')) {
      await signOut();
    }
  };

  /**
   * Renders one navigation row: a NavLink, or a disabled row with a "soon" badge
   * @param {object} item - { path, label, icon, soon? } or, for a button, { key, label, icon, onClick }
   * @return {JSX.Element} - the list item
   */
  const renderNavItem = ({ path, key, label, icon: Icon, soon, onClick }) => {
    const content = (
      <>
        <Icon className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{label}</span>
        {soon && <span className={styles.soonBadge}><span className="visually-hidden">coming </span>soon</span>}
      </>
    );

    return (
      <li key={path ?? key}>
        {soon ? (
          <span className={`${styles.navLink} ${styles.disabled}`} title={`${label}: coming soon`}>
            {content}
          </span>
        ) : onClick ? (
          <button type="button" className={styles.navLink} onClick={onClick} title={label}>
            {content}
          </button>
        ) : (
          <NavLink
            to={path}
            end // lit up only on that page itself: not on a game's page for Games
            title={label}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}
          >
            {content}
          </NavLink>
        )}
      </li>
    );
  };

  const sidebarClassName = [
    styles.sidebar,
    !isExpanded && styles.collapsed,
    isOpen && styles.open,
  ].filter(Boolean).join(' ');

  return (
    <aside
      id="site-sidebar"
      className={sidebarClassName}
      aria-label="Site navigation"
      role={isOpen ? 'dialog' : undefined}
      aria-modal={isOpen || undefined}
    >
      <div className={styles.sidebarHeader}>
        {/* Desktop: collapse / expand */}
        <button
          type="button"
          className={`${styles.iconButton} ${styles.toggleBtn}`}
          onClick={onToggleExpanded}
          aria-label={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <CiCircleChevLeft className={styles.toggleIcon} aria-hidden="true" />
          ) : (
            <CiCircleChevRight className={styles.toggleIcon} aria-hidden="true" />
          )}
        </button>

        {/* Phone: close the drawer */}
        <button
          ref={closeButtonRef}
          type="button"
          className={`${styles.iconButton} ${styles.closeBtn}`}
          onClick={onClose}
          aria-label="Close menu"
        >
          <CiCircleRemove className={styles.toggleIcon} aria-hidden="true" />
        </button>
      </div>

      {/* Main Navigation */}
      <nav className={styles.sidebarNav} aria-label="Main">
        <ul className={styles.navList}>
          {mainNav.map((item) => renderNavItem({ ...item, soon: item.soon || (item.needsAccounts && !isAvailable) }))}
        </ul>

        {/* User Section */}
        {userNav.length > 0 && (
          <>
            <div className={styles.navDivider} />
            <ul className={styles.navList}>
              {userNav.map(renderNavItem)}
            </ul>
          </>
        )}
      </nav>

      {/* Footer Navigation */}
      <div className={styles.sidebarFooter}>
        <ul className={styles.navList}>
          {[...accountNav, ...installNav, ...footerNav].map(renderNavItem)}

          {user && (
            <li>
              <button
                type="button"
                onClick={handleSignOut}
                className={`${styles.navLink} ${styles.logoutBtn}`}
                title="Sign out"
              >
                <CiLogout className={styles.navIcon} aria-hidden="true" />
                <span className={styles.navLabel}>Sign out</span>
              </button>
            </li>
          )}
        </ul>

        {/* User Info (hidden while collapsed) */}
        {user && profile && (
          <div className={styles.userInfo}>
            <Avatar url={profile.avatar_url} name={profile.display_name ?? profile.username} size={40} />
            <div className={styles.userDetails}>
              <div className={styles.userName}>{profile.display_name ?? profile.username}</div>
              <div className={styles.userUsername}>@{profile.username}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
