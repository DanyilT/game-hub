import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CiBurger } from 'react-icons/ci';
import styles from './Header.module.scss';

/**
 * Site header: the GameHub logo, plus a menu button on phones that opens the sidebar drawer.
 * It slides away while you scroll down and comes back when you scroll up.
 * @param {function} [onMenuToggle] - opens the sidebar drawer (no button is rendered without it)
 * @param {boolean} [isMenuOpen] - whether the drawer is open (for aria-expanded)
 * @param {object} [menuButtonRef] - ref to the menu button, so focus can return to it when the drawer closes
 */
const Header = ({ onMenuToggle, isMenuOpen = false, menuButtonRef }) => {
  const [isHidden, setIsHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      // Only re-renders when this flips (React skips an unchanged state)
      setIsHidden(scrollY > lastScrollY.current && scrollY > 100);
      lastScrollY.current = scrollY;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${isHidden ? styles.hidden : ''}`}>
      {onMenuToggle && (
        <button
          ref={menuButtonRef}
          type="button"
          className={styles.menuButton}
          onClick={onMenuToggle}
          aria-label="Open menu"
          aria-expanded={isMenuOpen}
          aria-controls="site-sidebar"
        >
          <CiBurger aria-hidden="true" />
        </button>
      )}
      <Link to="/" className={styles.titleLogo}>GameHub</Link>
    </header>
  );
};

export default Header;
