// Short messages that float at the bottom of the screen for a few seconds ("Couldn't save…"), from
// anywhere in the app. components/common/Toasts shows them (MainLayout renders it).

let toasts = [];
let lastId = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

/** For useSyncExternalStore */
export const subscribeToasts = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getToasts = () => toasts;

export const dismissToast = (id) => {
  toasts = toasts.filter((toast) => toast.id !== id);
  emit();
};

/**
 * Shows a message. At most three are on screen; a fourth pushes out the oldest.
 * @param {string} text
 * @param {object} [options]
 * @param {'info'|'error'} [options.tone]
 * @param {number} [options.duration] - ms before it goes by itself; 0 keeps it until it's closed
 * @param {{label: string, onClick?: function}} [options.action] - a button that also closes it
 * @return {number} - its id, for dismissToast
 */
export const showToast = (text, { tone = 'info', duration = 5000, action = null } = {}) => {
  const id = ++lastId;
  toasts = [...toasts.slice(-2), { id, text, tone, action }];
  emit();
  if (duration) setTimeout(() => dismissToast(id), duration);
  return id;
};
