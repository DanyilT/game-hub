import { useEffect, useId, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router';
import { PiX } from 'react-icons/pi';
import Avatar from '../../common/Avatar/Avatar';
import useNavItems from '../useNavItems';
import styles from './FloatingNav.module.scss';

// Where the rings' buttons sit: a quarter circle from straight up to straight across (towards the
// middle of the screen). The inner ring runs from end to end; the outer ring's buttons sit between
// the inner ones' angles, so the two rings interleave.
const ringAngles = (count, inner) => Array.from({ length: count }, (_, i) => {
  if (count === 1) return 45;
  return inner ? (90 * i) / (count - 1) : (90 * (i + 0.5)) / count;
});

/**
 * The floating navigation (Settings → Preferences → Navigation: "Floating button"): a round button
 * in a bottom corner that opens into two rings of round buttons. The inner ring has the pages
 * (Games, Players, Profile or Sign in), the outer one the rest (Settings, About, Install, Sign out).
 * The items come from useNavItems, shared with the sidebar.
 * Escape, a click outside, or moving the focus away closes it; so does going to a page.
 * @param {'right'|'left'} corner - the bottom corner it sits in
 */
const FloatingNav = ({ corner = 'right' }) => {
  const [open, setOpen] = useState(false);
  const nav = useNavItems(() => setOpen(false));
  const location = useLocation();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const menuId = useId();

  // Closed after any navigation
  useEffect(() => {
    setOpen(false);
  }, [location.key]);

  // Open: focus goes to the first button, and Escape closes it, handing the focus back
  useEffect(() => {
    if (!open) return undefined;
    rootRef.current?.querySelector(`.${styles.item}:not([aria-disabled])`)?.focus();
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const isInner = (item) => ['profile', 'sign-in'].includes(item.key);
  const inner = [...nav.main, ...nav.user.filter(isInner), ...nav.footer.filter(isInner)];
  const outer = [...nav.user.filter((item) => !isInner(item)), ...nav.footer.filter((item) => !isInner(item))];
  const waiting = [...inner, ...outer].reduce((sum, item) => sum + (item.badge ?? 0), 0);
  const side = corner === 'left' ? 1 : -1; // which way "across" is

  // Arrow keys move between the buttons, in ring order
  const onMenuKeyDown = (e) => {
    const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const buttons = [...rootRef.current.querySelectorAll(`.${styles.item}:not([aria-disabled])`)];
    const at = buttons.indexOf(document.activeElement);
    buttons[(at + step + buttons.length) % buttons.length]?.focus();
  };

  const renderItem = (item, index, angle, ring) => {
    const { key, path, label, short, icon: Icon, soon, onClick, badge, danger, profile } = item;
    const style = {
      '--dx': (side * Math.sin((angle * Math.PI) / 180)).toFixed(4),
      '--dy': (-Math.cos((angle * Math.PI) / 180)).toFixed(4),
      '--i': index,
    };
    const className = [styles.item, styles[ring], danger && styles.danger, soon && styles.soon].filter(Boolean).join(' ');
    const content = (
      <>
        {profile?.avatar_url
          ? <Avatar url={profile.avatar_url} name={profile.display_name ?? profile.username} size={26} />
          : <Icon className={styles.icon} aria-hidden="true" />}
        <span className={styles.label}>{short ?? label}</span>
        {badge > 0 && (
          <span className={styles.badge}>
            {badge}<span className="visually-hidden"> {badge === 1 ? 'friend request' : 'friend requests'}</span>
          </span>
        )}
        {soon && <span className="visually-hidden"> (coming soon)</span>}
      </>
    );
    const common = { style, title: soon ? `${label}: coming soon` : label, tabIndex: open ? undefined : -1 };

    let element;
    if (soon) element = <span className={className} aria-disabled="true" {...common}>{content}</span>;
    else if (onClick) element = <button type="button" className={className} onClick={onClick} {...common}>{content}</button>;
    else {
      element = (
        <NavLink to={path} end className={({ isActive }) => `${className} ${isActive ? styles.active : ''}`} {...common}>
          {content}
        </NavLink>
      );
    }
    return <li key={key}>{element}</li>;
  };

  return (
    <>
      {/* Dims the page while it's open; a click on it closes the menu */}
      <div
        className={`${styles.backdrop} ${styles[corner]} ${open ? styles.shown : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div
        ref={rootRef}
        className={`${styles.floatingNav} ${styles[corner]} ${open ? styles.open : ''}`}
        onBlur={(e) => {
          if (open && !e.currentTarget.contains(e.relatedTarget) && e.relatedTarget) setOpen(false);
        }}
      >
        <nav id={menuId} aria-label="Site navigation" onKeyDown={onMenuKeyDown} inert={!open || undefined}>
          <ul className={styles.ring}>{inner.map((item, i) => renderItem(item, i, ringAngles(inner.length, true)[i], 'inner'))}</ul>
          <ul className={styles.ring}>
            {outer.map((item, i) => renderItem(item, inner.length + i, ringAngles(outer.length, false)[i], 'outer'))}
          </ul>
        </nav>
        <button
          ref={buttonRef}
          type="button"
          className={styles.mainButton}
          onClick={() => setOpen((isOpen) => !isOpen)}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? 'Close menu' : 'Open menu'}
          title={open ? 'Close menu' : 'Menu'}
        >
          <span className={styles.logo} aria-hidden="true">GH</span>
          <span className={styles.close} aria-hidden="true"><PiX /></span>
          {waiting > 0 && !open && <span className={styles.mainDot} aria-hidden="true" />}
        </button>
      </div>
    </>
  );
};

export default FloatingNav;
