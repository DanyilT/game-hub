import { useLayoutEffect } from 'react';

const MARGIN = 8; // px kept clear of the window's edges

/**
 * Keeps a popup (an ⓘ note, a menu) inside the window: while it's open, it moves sideways just enough not to be cut off
 * at the window's left or right edge. It sets --shift on the popup, which the popup mixin uses (`translate`), and
 * places it again when the window is resized.
 * @param {{ current: HTMLElement|null }} ref - the popup
 * @param {boolean} open - whether it's showing
 */
export const useKeepInView = (ref, open) => {
  useLayoutEffect(() => {
    const popup = ref.current;
    if (!open || !popup) return undefined;
    const place = () => {
      popup.style.setProperty('--shift', '0px');
      const { left, right } = popup.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      let shift = 0;
      if (right > width - MARGIN) shift = width - MARGIN - right;
      if (left + shift < MARGIN) shift = MARGIN - left;
      popup.style.setProperty('--shift', `${shift}px`);
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [ref, open]);
};
