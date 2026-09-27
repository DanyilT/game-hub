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
  CiSettings,
  CiUser,
} from 'react-icons/ci';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './Sidebar.module.scss';

// Navigation items. `soon` marks pages that aren't built yet (see docs/V2_PLAN.md):
// they're shown greyed out with a badge instead of linking nowhere.
const mainNav = [
  { path: '/games', label: 'Games', icon: CiPizza },
  { path: '/users', label: 'Users', icon: CiCircleList, soon: true },
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
  const { user, userProfile, logout } = useAuth();
  const closeButtonRef = useRef(null);

  // Phone: move focus into the drawer when it opens
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  const userNav = user
    ? [
      { path: `/u/${userProfile?.username ?? ''}`, label: 'Profile', icon: CiUser },
      { path: '/settings', label: 'Settings', icon: CiSettings },
    ]
    : [];

  const accountNav = user ? [] : [{ path: '/sign-in', label: 'Sign in', icon: CiLogin, soon: true }];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  /**
   * Renders one navigation row: a NavLink, or a disabled row with a "soon" badge
   * @param {object} item - { path, label, icon, soon? }
   * @return {JSX.Element} - the list item
   */
  const renderNavItem = ({ path, label, icon: Icon, soon }) => {
    const content = (
      <>
        <Icon className={styles.navIcon} aria-hidden="true" />
        <span className={styles.navLabel}>{label}</span>
        {soon && <span className={styles.soonBadge}><span className="visually-hidden">coming </span>soon</span>}
      </>
    );

    return (
      <li key={path}>
        {soon ? (
          <span className={`${styles.navLink} ${styles.disabled}`} title={`${label}: coming soon`}>
            {content}
          </span>
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
          {mainNav.map(renderNavItem)}
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
          {[...accountNav, ...footerNav].map(renderNavItem)}

          {user && (
            <li>
              <button
                type="button"
                onClick={handleLogout}
                className={`${styles.navLink} ${styles.logoutBtn}`}
                title="Logout"
              >
                <CiLogout className={styles.navIcon} aria-hidden="true" />
                <span className={styles.navLabel}>Logout</span>
              </button>
            </li>
          )}
        </ul>

        {/* User Info (hidden while collapsed) */}
        {user && userProfile && (
          <div className={styles.userInfo}>
            <div className={styles.userAvatar} aria-hidden="true">
              {userProfile.username?.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userName}>{userProfile.displayName}</div>
              <div className={styles.userUsername}>@{userProfile.username}</div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
