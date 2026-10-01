import { useSyncExternalStore } from 'react';

// Choices from Settings → Preferences. They're about this screen (a phone may suit the floating
// button, a computer the sidebar), so they're kept on the device, in localStorage, and don't follow
// the account. Storage can be unavailable (private mode, blocked site data): then the defaults hold
// and changes last until the page is reloaded.

const OPTIONS = {
  // The site's navigation: the sidebar, or a round button in a corner that opens into a ring of buttons
  navStyle: { key: 'gamehub:nav-style', values: ['sidebar', 'floating'] },
  // Which bottom corner the floating button sits in
  navCorner: { key: 'gamehub:nav-corner', values: ['right', 'left'] },
};

const read = () => Object.fromEntries(Object.entries(OPTIONS).map(([name, { key, values }]) => {
  let stored = null;
  try {
    stored = localStorage.getItem(key);
  } catch {
    // storage unavailable: the default
  }
  return [name, values.includes(stored) ? stored : values[0]];
}));

let preferences = read();
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

const onStorage = (e) => {
  if (Object.values(OPTIONS).some(({ key }) => key === e.key)) {
    preferences = read();
    emit();
  }
};

const subscribe = (listener) => {
  if (listeners.size === 0) window.addEventListener('storage', onStorage); // changed in another tab
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
};

const getPreferences = () => preferences;

/** The preferences, kept up to date: { navStyle: 'sidebar'|'floating', navCorner: 'right'|'left' } */
export const usePreferences = () => useSyncExternalStore(subscribe, getPreferences);

/**
 * Changes a preference (on this device)
 * @param {'navStyle'|'navCorner'} name
 * @param {string} value - one of its values
 */
export const setPreference = (name, value) => {
  const option = OPTIONS[name];
  if (!option?.values.includes(value)) return;
  try {
    localStorage.setItem(option.key, value);
  } catch {
    // storage unavailable: it lasts until the page is reloaded
  }
  preferences = { ...preferences, [name]: value };
  emit();
};
