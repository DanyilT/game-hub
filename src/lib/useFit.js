import { useLayoutEffect, useState } from 'react';

// Whether a row's last child has gone onto a line of its own: it starts below the bottom of the first
const lastWraps = (row) => (
  row.lastElementChild.getBoundingClientRect().top >= row.firstElementChild.getBoundingClientRect().bottom - 1
);

/**
 * Picks the roomiest of a few looks in which a wrapping row (display: flex; flex-wrap: wrap) keeps its last child on its
 * first line: the game page's title with its buttons beside it, at full size, then smaller; the panel's numbers with
 * More, then with its ▼ alone. Each look is tried on the row itself, and measured, before anything is drawn (the classes
 * go back as they were), so it's always the look that fits now, with no flicking back and forth. It looks again
 * whenever the row or what's in it changes size, and once the fonts have loaded.
 * @param {string[]} looks - class names for the row, from the roomiest ('' for none) to the one used when none of the
 *   others fits (which isn't measured)
 * @return {[string, function]} - the look to give the row now, and a ref for the row
 */
export const useFit = (looks) => {
  const [row, setRow] = useState(null);
  const [look, setLook] = useState(looks[0]);
  const key = looks.join('|');

  useLayoutEffect(() => {
    if (!row) return undefined;
    const tries = key.split('|');
    const all = tries.flatMap((names) => names.split(' ')).filter(Boolean);
    const check = () => {
      if (!row.isConnected || !row.firstElementChild || row.firstElementChild === row.lastElementChild) return;
      const drawn = row.className;
      let fit = tries[tries.length - 1];
      for (const candidate of tries.slice(0, -1)) {
        row.classList.remove(...all);
        candidate.split(' ').filter(Boolean).forEach((name) => row.classList.add(name));
        if (!lastWraps(row)) {
          fit = candidate;
          break;
        }
      }
      row.className = drawn;
      setLook(fit);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(row);
    [...row.children].forEach((child) => observer.observe(child));
    document.fonts?.ready.then(check);
    return () => observer.disconnect();
  }, [row, key]);

  return [look, setRow];
};
