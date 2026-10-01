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

/**
 * A calendar date with no time, like a game's release ("2025-04-24"): "24 April 2025", or "24 Apr 2025"
 * with month 'short'. Read as UTC and shown as UTC, so it's the same day in every time zone.
 * @param {string} date - YYYY-MM-DD
 * @param {'long'|'short'} month
 * @return {string}
 */
export const calendarDate = (date, month = 'long') =>
  new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month, year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`));
