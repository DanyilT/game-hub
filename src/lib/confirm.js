// Questions that need a yes before something happens ("Sign out of GameHub?"), from anywhere in the app, in the
// site's own window instead of the browser's confirm(). components/common/ConfirmDialog shows them (MainLayout
// renders it).

let question = null; // the one on screen: { id, title, message, confirmLabel, danger, resolve }
let lastId = 0;
const listeners = new Set();
const emit = () => listeners.forEach((listener) => listener());

/** For useSyncExternalStore */
export const subscribeQuestion = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getQuestion = () => question;

/**
 * Answers the question on screen, if it's still the one with this id (or any, without one)
 * @param {boolean} yes
 * @param {number} [id]
 */
export const answerQuestion = (yes, id = question?.id) => {
  if (!question || question.id !== id) return;
  const { resolve } = question;
  question = null;
  emit();
  resolve(yes);
};

/**
 * Asks before doing something. One question at a time: a new one answers the one before with no.
 * @param {object} options
 * @param {string} options.title - the question, e.g. 'Sign out of GameHub?'
 * @param {string} [options.message] - what happens, in a sentence or two
 * @param {string} [options.confirmLabel] - the yes button, e.g. 'Sign out'
 * @param {boolean} [options.danger] - the yes button is red (it removes something), and No has the focus
 * @return {Promise<boolean>} - whether the player said yes
 */
export const askToConfirm = ({ title, message = null, confirmLabel = 'OK', danger = false }) => new Promise((resolve) => {
  answerQuestion(false);
  question = { id: ++lastId, title, message, confirmLabel, danger, resolve };
  emit();
});
