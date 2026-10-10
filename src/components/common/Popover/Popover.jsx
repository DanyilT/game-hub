import { useRef } from 'react';
import { useKeepInView } from '../../../lib/keepInView';
import styles from './Popover.module.scss';

/**
 * A small box under what opened it (an ⓘ note, a menu, the style details): the popup surface, placed under its
 * opener's wrapper (which must be `position: relative`), and kept inside the window (useKeepInView).
 * @param {boolean} open
 * @param {'start'|'end'} [align] - lines up with its opener's left edge and opens to the right (start), or with its
 *   right edge and opens to the left (end)
 * @param {boolean} [keepMounted] - stays in the page while closed, hidden from sight but not from screen readers (a
 *   note a button's aria-describedby points to)
 * @param {string} [as] - its element: div (the default), span, ul…
 * @param {object} [ref] - the element, for its owner (a menu moving the focus through it)
 */
const Popover = ({ open, align = 'start', keepMounted = false, as: Element = 'div', className = '', ref, children, ...rest }) => {
  const ownRef = useRef(null);
  const popupRef = ref ?? ownRef;
  useKeepInView(popupRef, open);
  if (!open && !keepMounted) return null;
  const classes = open
    ? [styles.popover, styles[align], className].filter(Boolean).join(' ')
    : 'visually-hidden';
  return <Element ref={popupRef} className={classes} {...rest}>{children}</Element>;
};

export default Popover;
