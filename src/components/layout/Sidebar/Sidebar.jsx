import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router';
import { CiCircleChevLeft, CiCircleChevRight, CiCircleRemove } from 'react-icons/ci';
import { useAuth } from '../../../contexts/AuthContext';
import Avatar from '../../common/Avatar/Avatar';
import useNavItems from '../useNavItems';
import styles from './Sidebar.module.scss';

/**
 * Site sidebar (Settings → Preferences can swap it for the floating button, FloatingNav).
 * - Desktop: a fixed rail, collapsed to icons or expanded with labels (state lives in MainLayout).
 * - Phone: an off-canvas drawer, opened from the header's menu button.
 * The items come from useNavItems, shared with the floating button.
 * @param {boolean} isExpanded - desktop: show the wide sidebar with labels
 * @param {function} onToggleExpanded - desktop: collapse/expand
 * @param {boolean} isOpen - phone: drawer is open
 * @param {function} onClose - phone: close the drawer
 */
const Sidebar = ({ isExpanded = false, onToggleExpanded = () => {}, isOpen = false, onClose = () => {} }) => {
  const { user, profile } = useAuth();
  // Actions (sign in, install) close the phone drawer first
  const nav = useNavItems(onClose);
  const closeButtonRef = useRef(null);

  // Phone: move focus into the drawer when it opens
  useEffect(() => {
    if (isOpen) closeButtonRef.current?.focus();
  }, [isOpen]);

  /**
   * Renders one navigation row: a NavLink, a button, or a disabled row with a "soon" badge
   * @param {object} item - from useNavItems
   * @return {JSX.Element} - the list item
   */
  const renderNavItem = ({ key, path, label, icon: Icon, soon, onClick, badge, danger }) => {
    const content = (
      <>
        <span className={styles.iconWrap}>
          <Icon className={styles.navIcon} aria-hidden="true" />
          {badge > 0 && <span className={styles.dot} aria-hidden="true" />}
        </span>
        <span className={styles.navLabel}>{label}</span>
        {soon && <span className={styles.soonBadge}><span className="visually-hidden">coming </span>soon</span>}
        {badge > 0 && (
          <span className={styles.countBadge}>
            {badge}<span className="visually-hidden"> {badge === 1 ? 'friend request' : 'friend requests'}</span>
          </span>
        )}
      </>
    );

    return (
      <li key={key}>
        {soon ? (
          <span className={`${styles.navLink} ${styles.disabled}`} title={`${label}: coming soon`}>
            {content}
          </span>
        ) : onClick ? (
          <button
            type="button"
            className={`${styles.navLink} ${danger ? styles.logoutBtn : ''}`}
            onClick={onClick}
            title={label}
          >
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
          {nav.main.map(renderNavItem)}
        </ul>

        {/* User Section */}
        <div className={styles.navDivider} />
        <ul className={styles.navList}>
          {nav.user.map(renderNavItem)}
        </ul>
      </nav>

      {/* Footer Navigation */}
      <div className={styles.sidebarFooter}>
        <ul className={styles.navList}>
          {nav.footer.map(renderNavItem)}
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
