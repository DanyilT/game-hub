import { PiBookmarkSimple, PiBookmarkSimpleFill, PiHeart, PiHeartFill } from 'react-icons/pi';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLibrary } from '../../../../contexts/LibraryContext';
import styles from './GameReactions.module.scss';

const compact = new Intl.NumberFormat('en', { notation: 'compact' });

/**
 * The favorite (heart) and bookmark buttons on a game's page, each with how many players have pressed
 * it. Favorites are public (the player's profile lists them); bookmarks are private, only the total shows.
 * Signed out, they open the sign-in window. Nothing shows on a site without accounts.
 * @param {object} game - the catalogue entry
 * @param {object|null} stats - the game's totals (useGameStats), null while they load
 */
const GameReactions = ({ game, stats }) => {
  const { isAvailable } = useAuth();
  const { favorites, bookmarks, toggleFavorite, toggleBookmark } = useLibrary();
  if (!isAvailable) return null;

  const favorite = favorites.has(game.id);
  const saved = bookmarks.has(game.id);

  return (
    <div className={styles.reactions}>
      <button
        type="button"
        className={`${styles.reaction} ${styles.favorite} ${favorite ? styles.on : ''}`}
        aria-pressed={favorite}
        onClick={() => toggleFavorite(game.id)}
        title={favorite ? 'In your favorites: it shows on your profile' : 'Add to favorites (they show on your profile)'}
      >
        {favorite ? <PiHeartFill aria-hidden="true" /> : <PiHeart aria-hidden="true" />}
        <span className="visually-hidden">Favorite</span>
        {stats && <span className={styles.count}>{compact.format(stats.favorite_count)}</span>}
      </button>
      <button
        type="button"
        className={`${styles.reaction} ${styles.bookmark} ${saved ? styles.on : ''}`}
        aria-pressed={saved}
        onClick={() => toggleBookmark(game.id)}
        title={saved ? 'Bookmarked to play later (only you see it)' : 'Bookmark it to play later (only you see it)'}
      >
        {saved ? <PiBookmarkSimpleFill aria-hidden="true" /> : <PiBookmarkSimple aria-hidden="true" />}
        <span className="visually-hidden">Bookmark</span>
        {stats && <span className={styles.count}>{compact.format(stats.bookmark_count)}</span>}
      </button>
    </div>
  );
};

export default GameReactions;
