import styles from './GooglePlayBadge.module.scss';

// Official badge, loaded unmodified from Google. Brand rules: only link it to a live
// Play listing, don't change it, and keep clear space around it (the PNG has some built in).
const BADGE_SRC = 'https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png';

// Google asks for this line wherever space allows (pages can also show it below a row of badges)
export const GOOGLE_PLAY_TRADEMARK = 'Google Play and the Google Play logo are trademarks of Google LLC.';

/**
 * "Get it on Google Play" badge linking to a Play listing.
 * @param {string} url - the app's Play listing (https://play.google.com/store/apps/details?id=...)
 * @param {number} [height] - badge height in px
 * @param {boolean} [showLegal] - show the trademark line under the badge
 */
const GooglePlayBadge = ({ url, height = 64, showLegal = false }) => (
  <div className={styles.wrapper}>
    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
      {/* height as a style: the global reset's `img { height: auto }` would override the attribute */}
      <img src={BADGE_SRC} alt="Get it on Google Play" style={{ height }} className={styles.badge} />
    </a>
    {showLegal && <p className={styles.legal}>{GOOGLE_PLAY_TRADEMARK}</p>}
  </div>
);

export default GooglePlayBadge;
