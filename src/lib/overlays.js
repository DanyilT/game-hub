// Something of GameHub's opening over the page: a window (Modal: sign-in, help, a question before a replay, reporting
// a player…) or a sheet (the install steps). The game behind it can't be seen or reached any more, so the game page
// pauses it (GamePage.jsx: gamehub:pause).

const OPENED = 'gamehub-overlay-opened';

/** Says something has opened over the page */
export const announceOverlay = () => window.dispatchEvent(new Event(OPENED));

/** Calls `listener` whenever something opens over the page; returns the way to stop */
export const onOverlay = (listener) => {
  window.addEventListener(OPENED, listener);
  return () => window.removeEventListener(OPENED, listener);
};
