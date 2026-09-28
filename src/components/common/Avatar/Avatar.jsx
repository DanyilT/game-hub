import { useState } from 'react';
import styles from './Avatar.module.scss';

/**
 * A player's picture, or the first letter of their name when there's none (or it fails to load).
 * Decorative: the name is always shown next to it.
 * @param {string|null} url - picture from Google / Discord
 * @param {string} name - display name or username, for the letter
 * @param {number} size - width and height in px
 */
const Avatar = ({ url, name = '', size = 40, className = '' }) => {
  const [failedUrl, setFailedUrl] = useState(null);
  const box = { width: size, height: size };

  if (url && url !== failedUrl) {
    return (
      <img
        src={url}
        alt=""
        className={`${styles.avatar} ${className}`}
        style={box}
        // Google's picture server can refuse requests that carry a referrer
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(url)}
      />
    );
  }

  return (
    <span className={`${styles.avatar} ${styles.letter} ${className}`} style={{ ...box, fontSize: size * 0.45 }} aria-hidden="true">
      {Array.from(name.trim())[0]?.toUpperCase() ?? '?'}
    </span>
  );
};

export default Avatar;
