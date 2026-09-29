// Dates on the site are always in English, whatever the browser's language: the site's font (Doto)
// only has Latin letters, so a month in, say, Ukrainian would drop to a fallback font. British
// order, like the legal pages' "28 September 2026".
const LOCALE = 'en-GB';

/**
 * A month and year: "September 2026", or "Sept 2026" with month 'short'
 * @param {string|number|Date} date
 * @param {'long'|'short'} month
 * @return {string}
 */
export const monthYear = (date, month = 'long') =>
  new Intl.DateTimeFormat(LOCALE, { month, year: 'numeric' }).format(new Date(date));

/**
 * A full date: "28 September 2026"
 * @param {string|number|Date} date
 * @return {string}
 */
export const fullDate = (date) => new Intl.DateTimeFormat(LOCALE, { dateStyle: 'long' }).format(new Date(date));
