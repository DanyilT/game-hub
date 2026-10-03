// ==========================================
// A game's numbers, for the panel under it
// ==========================================
// A game in the hub (gamehub.js version 3) says what its panel shows: GameHub.status({ main, more, ongoing }), and a
// result with each run it finishes (runs.js). They come from another site, so they're checked here before they're
// shown: only labels with numbers or short texts, never markup.

const MAX_LABEL = 40; // characters
const MAX_TEXT = 40;
const MAX_MAIN = 4; // numbers shown large
const MAX_SECTIONS = 8; // behind More
const MAX_ITEMS = 12; // per section

const isPlainObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * One number for the panel, checked: { label, value, format }, or null if it isn't one
 * - value: a number, a short text, or null (shown as —)
 * - format: 'time' for a number of seconds (shown as 1:05), else null
 */
export const cleanItem = (item) => {
  if (!isPlainObject(item) || typeof item.label !== 'string') return null;
  const label = item.label.trim().slice(0, MAX_LABEL);
  let { value } = item;
  if (typeof value === 'string') value = value.trim().slice(0, MAX_TEXT);
  else if (value === undefined) value = null;
  else if (value !== null && !(typeof value === 'number' && Number.isFinite(value))) return null;
  if (!label) return null;
  return { label, value, format: item.format === 'time' && typeof value === 'number' ? 'time' : null };
};

/** Up to `max` numbers for the panel, leaving out anything that isn't one */
export const cleanItems = (items, max) => (Array.isArray(items) ? items.slice(0, max).map(cleanItem).filter(Boolean) : []);

/**
 * What a game says its panel shows, checked: { main, more, ongoing }, or null if it isn't that
 * - main: up to 4 numbers, shown large (the score now, the best)
 * - more: up to 8 sections { title, items }, behind More (the rest of what it saves)
 * - ongoing: a game is under way that reloading the game would lose
 */
export const cleanStatus = (status) => {
  if (!isPlainObject(status)) return null;
  const more = Array.isArray(status.more) ? status.more.slice(0, MAX_SECTIONS).flatMap((section) => {
    if (!isPlainObject(section)) return [];
    const items = cleanItems(section.items, MAX_ITEMS);
    const title = typeof section.title === 'string' ? section.title.trim().slice(0, MAX_LABEL) : '';
    return items.length > 0 ? [{ title, items }] : [];
  }) : [];
  return { main: cleanItems(status.main, MAX_MAIN), more, ongoing: status.ongoing === true };
};

/**
 * A time on a clock: 0:42, 12:05, 1:02:09
 * @param {number} seconds
 * @return {string}
 */
export const clockTime = (seconds) => {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
};

/** A number from the panel, as it's shown: 12,400 · 1:05 · Expert · — */
export const formatValue = ({ value, format }) => {
  if (value === null || value === '') return '—';
  if (format === 'time') return clockTime(value);
  return typeof value === 'number' ? value.toLocaleString('en-GB') : value;
};
