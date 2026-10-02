import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import FloatingNav from '../FloatingNav/FloatingNav';
import Footer from '../Footer/Footer';
import ErrorBoundary from '../../common/ErrorBoundary/ErrorBoundary';
import ConfirmDialog from '../../common/ConfirmDialog/ConfirmDialog';
import Toasts from '../../common/Toasts/Toasts';
import UsernameDialog from '../../account/UsernameDialog/UsernameDialog';
import SignInModal from '../../account/SignInModal/SignInModal';
import { InstallSteps, useInstall } from '../../install/InstallApp';
import { useAuth } from '../../../contexts/AuthContext';
import { useOnline } from '../../../lib/offline';
import { usePreferences } from '../../../lib/preferences';
import { showToast } from '../../../lib/toast';
import styles from './MainLayout.module.scss';

// Remember whether the desktop sidebar was left expanded. Storage can be
// unavailable (private mode, blocked site data), so it's best-effort.
const EXPANDED_KEY = 'gamehub:sidebar-expanded';
const readExpanded = () => {
  try {
    return localStorage.getItem(EXPANDED_KEY) === 'true';
  } catch {
    return false;
  }
};

// Must match $breakpoint-mobile in styles/abstracts/_variables.scss
const DESKTOP_QUERY = '(width > 768px)';

const MainLayout = () => {
  const [isExpanded, setIsExpanded] = useState(readExpanded); // desktop: wide sidebar with labels
  const [isMenuOpen, setIsMenuOpen] = useState(false);        // phone: sidebar drawer
  const menuButtonRef = useRef(null);
  const wasMenuOpenRef = useRef(false);
  const location = useLocation();
  const { signInOpen } = useAuth();
  const { stepsOpen } = useInstall();
  // Settings → Preferences: the sidebar, or the floating button in a corner
  const { navStyle, navCorner } = usePreferences();
  const floating = navStyle === 'floating';

  // Losing or getting back the connection (and opening the site offline) says so
  const online = useOnline();
  const wasOnlineRef = useRef(true);
  useEffect(() => {
    if (online === wasOnlineRef.current) return;
    wasOnlineRef.current = online;
    showToast(online ? "You're back online." : "You're offline. Downloaded games still play.", { duration: online ? 4000 : 8000 });
  }, [online]);

  useEffect(() => {
    try {
      localStorage.setItem(EXPANDED_KEY, String(isExpanded));
    } catch {
      // storage unavailable: the choice just isn't remembered
    }
  }, [isExpanded]);

  const closeMenu = useCallback(() => setIsMenuOpen(false), []);

  // Close the drawer after any navigation (`key` changes even when the link is to the current page)
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.key]);

  // ...and when the window grows past the phone breakpoint
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP_QUERY);
    const onChange = (e) => { if (e.matches) setIsMenuOpen(false); };
    desktop.addEventListener('change', onChange);
    return () => desktop.removeEventListener('change', onChange);
  }, []);

  // Every page opens at the top, instantly (html has smooth scrolling on). That includes
  // Back/Forward: the browser's own restoring of the old position is turned off. Changes within a
  // page that only update the address (the profile's tabs) say so with `state.keepScroll`.
  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
  }, []);
  useLayoutEffect(() => {
    if (location.state?.keepScroll) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [location.key]);

  // When the drawer closes (X, backdrop, Escape, a link), hand focus back to the menu button
  // if it was inside the drawer. This runs after the page behind stops being inert.
  useEffect(() => {
    if (isMenuOpen) {
      wasMenuOpenRef.current = true;
      return;
    }
    if (!wasMenuOpenRef.current) return;
    wasMenuOpenRef.current = false;

    const focused = document.activeElement;
    const sidebar = document.getElementById('site-sidebar');
    if (!focused || focused === document.body || sidebar?.contains(focused)) {
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen]);

  // While the drawer is open: Escape closes it and the page behind doesn't scroll
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKeyDown = (e) => { if (e.key === 'Escape') closeMenu(); };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen, closeMenu]);

  const layoutClassName = [
    styles.layout,
    floating ? styles.floatingNav : isExpanded && styles.sidebarExpanded,
  ].filter(Boolean).join(' ');

  return (
    <div className={layoutClassName}>
      {floating ? (
        <FloatingNav corner={navCorner} />
      ) : (
        <>
          <Sidebar
            isExpanded={isExpanded}
            onToggleExpanded={() => setIsExpanded((expanded) => !expanded)}
            isOpen={isMenuOpen}
            onClose={closeMenu}
          />
          {isMenuOpen && <div className={styles.backdrop} onClick={closeMenu} aria-hidden="true" />}
        </>
      )}

      {/* Everything right of the fixed sidebar. Inert while the phone drawer is open,
          so keyboard focus and screen readers stay inside the drawer. */}
      <div className={styles.column} inert={isMenuOpen || undefined}>
        {/* The phone menu button opens the sidebar; the floating button needs none */}
        <Header
          onMenuToggle={floating ? undefined : () => setIsMenuOpen(true)}
          isMenuOpen={isMenuOpen}
          menuButtonRef={menuButtonRef}
        />
        <main className={styles.mainContent}>
          {/* A crashed page shows the error page; a new path gets a fresh try */}
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <Footer />
      </div>

      {/* The sign-in window, and new players keeping or changing the username they got */}
      {signInOpen && <SignInModal />}
      <UsernameDialog />
      {/* Phones and tablets: how to install the site as an app (floats at the bottom of the screen) */}
      {stepsOpen && <InstallSteps />}
      {/* Short messages ("Couldn't save…"), at the bottom of the screen */}
      <Toasts />
      {/* "Sign out of GameHub?" and other questions before something happens */}
      <ConfirmDialog />
    </div>
  );
};

export default MainLayout;
