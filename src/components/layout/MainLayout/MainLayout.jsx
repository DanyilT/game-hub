import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import Footer from '../Footer/Footer';
import ErrorBoundary from '../../common/ErrorBoundary/ErrorBoundary';
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
  // Back/Forward: the browser's own restoring of the old position is turned off.
  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
  }, []);
  useLayoutEffect(() => {
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

  return (
    <div className={`${styles.layout} ${isExpanded ? styles.sidebarExpanded : ''}`}>
      <Sidebar
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((expanded) => !expanded)}
        isOpen={isMenuOpen}
        onClose={closeMenu}
      />
      {isMenuOpen && <div className={styles.backdrop} onClick={closeMenu} aria-hidden="true" />}

      {/* Everything right of the fixed sidebar. Inert while the phone drawer is open,
          so keyboard focus and screen readers stay inside the drawer. */}
      <div className={styles.column} inert={isMenuOpen || undefined}>
        <Header
          onMenuToggle={() => setIsMenuOpen(true)}
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
    </div>
  );
};

export default MainLayout;
