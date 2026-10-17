import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CiCircleInfo, CiCircleMore, CiGlobe, CiPlay1 } from 'react-icons/ci';
import { PiBookmarkSimple, PiBookmarkSimpleFill, PiCloudCheck } from 'react-icons/pi';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLibrary } from '../../../../contexts/LibraryContext';
import {
  getEmbedUrl, getPlatformIcon, getPlatformTypes, getSourceLinks, getStore, getStorePlatforms, getWebPlatform,
} from '../../../../data/games';
import { calendarDate } from '../../../../lib/dates';
import { useDownloads, useOnline } from '../../../../lib/offline';
import Badge from '../../../common/Badge/Badge';
import Button from '../../../common/Button/Button';
import Tag from '../../../common/Tag/Tag';
import styles from './GameCard.module.scss';

// Each kind of action's colour (its glass): Info has none; an app's store is yellow
const ACTION_TONES = { info: 'neutral', play: 'success', direct: 'info', code: 'primary', store: 'warning' };

/**
 * A round icon action on the card (a glass Button over the picture): a button (`onClick`), a link inside the hub (`to`)
 * or a link out (`href`, new tab). The tooltip is short; the accessible name adds the game, e.g. "Snake: Play in Hub"
 * rather than six identical "View Code"s.
 */
const ActionButton = ({ icon, label, gameTitle, variant, href, ...rest }) => (
  <Button
    variant="glass"
    tone={ACTION_TONES[variant]}
    shape="round"
    icon={icon}
    label={`${gameTitle}: ${label}${href ? ' (opens in a new tab)' : ''}`}
    title={label}
    className={styles.actionButton}
    href={href}
    {...rest}
  />
);

const GameCard = ({ game, index = 0, onTagClick, selectedTags = [] }) => {
  const { isAvailable } = useAuth();
  const { bookmarks, toggleBookmark } = useLibrary();
  const bookmarked = bookmarks.has(game.id);
  const downloaded = Boolean(useDownloads()[game.id]);
  const online = useOnline();
  const [showInfo, setShowInfo] = useState(false);
  const infoButtonRef = useRef(null);
  const infoPanelRef = useRef(null);
  const moveFocusRef = useRef(false); // set when the info panel is opened/closed from the keyboard
  const gamePage = `/g/${game.id}`;
  const embedUrl = getEmbedUrl(game); // null for entries that live on their own site or in a store
  const webPlatform = getWebPlatform(game);
  // Offline, only downloaded games play: the rest are dimmed
  const needsInternet = !online && !downloaded;

  // Keyboard users: focus goes to the info panel when it opens and back to the Info button
  // when it closes. Mouse users keep their focus where it was.
  const openInfo = (fromKeyboard) => {
    moveFocusRef.current = fromKeyboard;
    setShowInfo(true);
  };
  const closeInfo = (fromKeyboard) => {
    moveFocusRef.current = fromKeyboard;
    setShowInfo(false);
  };
  useEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    (showInfo ? infoPanelRef : infoButtonRef).current?.focus();
  }, [showInfo]);

  // Touch screens can't hover: a tap on the card opens it (the title, the tags and the buttons' colours, as hovering
  // does with a mouse), and a tap anywhere else closes it. Hidden, the title and tags take no taps
  // (GameCard.module.scss), so a first tap can't open a link nobody could see.
  const [open, setOpen] = useState(false);
  const cardRef = useRef(null);
  const pointerRef = useRef('mouse'); // what pressed the card last
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (!cardRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);
  const tapCard = (e) => {
    // A mouse hovers instead, a key press has the focus ring, and a button or link (or the info panel) does its own thing
    if (pointerRef.current === 'mouse' || e.detail === 0 || showInfo || e.target.closest('a, button')) return;
    setOpen((value) => !value);
  };

  // A tag that toggles the same filter chip in the list
  const tag = (value, kind = 'tag') => (
    <Tag
      key={`${kind}:${value}`}
      kind={kind}
      selected={selectedTags.includes(value)}
      onClick={() => onTagClick(value)}
      className={styles.gameTag}
    >
      {value}
    </Tag>
  );

  return (
    <div
      ref={cardRef}
      className={`${styles.gameCard} ${needsInternet ? styles.needsInternet : ''} ${open ? styles.open : ''}`}
      style={{ '--card-index': index }} // staggers the drop-in animation
      onMouseLeave={() => { if (showInfo) closeInfo(false); }}
      onPointerDown={(e) => { pointerRef.current = e.pointerType; }}
      onClick={tapCard}
    >
      <div className={styles.gameImageContainer}>
        {game.thumb ? (
          <img src={game.thumb} alt={game.title} className={styles.gameImage} />
        ) : (
          // No picture yet: a title tile in the site's neon style
          <div className={`${styles.gameImage} ${styles.imageFallback}`} aria-hidden="true">
            <span>{game.title}</span>
          </div>
        )}
      </div>

      {/* Downloaded to play offline (from the game's page), or, offline, a game that needs the internet */}
      {(downloaded || needsInternet) && (
        <Badge
          variant="soft"
          tone={downloaded ? 'accent' : 'neutral'}
          icon={downloaded ? PiCloudCheck : null}
          className={styles.offlineBadge}
          title={downloaded ? 'Downloaded: plays offline' : 'Needs the internet'}
        >
          {downloaded ? 'Offline' : 'Needs internet'}
        </Badge>
      )}

      {/* Bookmark to play later (private; the profile lists them). Always shown once bookmarked,
          otherwise with the rest of the card's buttons. Signed out, it opens the sign-in window. */}
      {isAvailable && (
        <Button
          variant="glass"
          tone="neutral"
          shape="round"
          icon={bookmarked ? PiBookmarkSimpleFill : PiBookmarkSimple}
          label={`${game.title}: Bookmark`}
          title={bookmarked ? 'Bookmarked to play later (only you see it)' : 'Bookmark to play later'}
          className={`${styles.bookmarkButton} ${bookmarked ? styles.bookmarked : ''}`}
          onClick={() => toggleBookmark(game.id)}
          aria-pressed={bookmarked}
          inert={showInfo || undefined}
        />
      )}

      {/* Hidden under the info panel while it's open, so it's taken out of the tab order then */}
      <div className={styles.gameOverlay} inert={showInfo || undefined}>
        <div className={styles.gameHeader}>
          {/* The title opens the game's page, like Play in Hub (or Details) */}
          <h3>
            <Link to={gamePage} className={styles.titleLink}>
              {game.iconUrl && <img src={game.iconUrl} alt="" className={styles.titleIcon} />}
              {game.title}
            </Link>
          </h3>
          <div className={styles.gameTags}>
            {game.tags.map((value) => tag(value))}
          </div>
        </div>
        <div className={styles.gameActions}>
          <ActionButton
            ref={infoButtonRef}
            icon={CiCircleInfo}
            label="Game Info"
            gameTitle={game.title}
            variant="info"
            onClick={(e) => (showInfo ? closeInfo(e.detail === 0) : openInfo(e.detail === 0))}
            aria-expanded={showInfo}
          />
          {embedUrl ? (
            <>
              <ActionButton icon={CiPlay1} label="Play in Hub" gameTitle={game.title} variant="play" to={gamePage} />
              <ActionButton
                icon={getPlatformIcon(webPlatform)}
                label="Play Directly"
                gameTitle={game.title}
                variant="direct"
                href={embedUrl}
              />
            </>
          ) : (
            <>
              <ActionButton icon={CiCircleMore} label="Details" gameTitle={game.title} variant="play" to={gamePage} />
              {webPlatform && (
                <ActionButton
                  icon={getPlatformIcon(webPlatform)}
                  label="Open site"
                  gameTitle={game.title}
                  variant="direct"
                  href={webPlatform.url}
                />
              )}
            </>
          )}
          {game.website && (
            <ActionButton icon={CiGlobe} label="Website" gameTitle={game.title} variant="direct" href={game.website} />
          )}
          {/* An app: its store's page (Google Play, the App Store), in yellow with the store's logo */}
          {getStorePlatforms(game).map((store) => (
            <ActionButton
              key={store.url}
              icon={getStore(store).Icon}
              label={getStore(store).get}
              gameTitle={game.title}
              variant="store"
              href={store.url}
            />
          ))}
          {getSourceLinks(game).map(({ url, label, Icon }) => (
            <ActionButton key={url} icon={Icon} label={label ?? 'View Code'} gameTitle={game.title} variant="code" href={url} />
          ))}
        </div>
      </div>

      {/* No close button: a click closes it (except on its tags, which filter, and its title, which
          opens the game's page), and so do Escape, the pointer leaving the card, and focus moving out */}
      <div
        ref={infoPanelRef}
        className={`${styles.gameInfo} ${showInfo ? styles.show : ''}`}
        role="group"
        aria-label={`About ${game.title}`}
        tabIndex={-1}
        onClick={(e) => {
          if (e.target.closest('button, a') || window.getSelection()?.toString()) return; // a tag, the title, or selecting text
          closeInfo(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') closeInfo(true);
        }}
        onBlur={(e) => {
          if (showInfo && !e.currentTarget.contains(e.relatedTarget)) closeInfo(false);
        }}
      >
        <div className={styles.gameInfoContent}>
          <h3><Link to={gamePage} className={styles.titleLink}>{game.title}</Link></h3>
          <div className={styles.gameMetaTags}>
            {game.difficulty && tag(game.difficulty, game.difficulty)}
            {game.genre.map((genre) => tag(genre, 'genre'))}
            {getPlatformTypes(game).map((platform) => tag(platform, 'platform'))}
          </div>
          <p className={styles.gameDescription}>{game.description}</p>
          {(game.released || game.developer) && (
            <p className={styles.gameCredits}>
              {game.released && <>Released <time dateTime={game.released}>{calendarDate(game.released)}</time></>}
              {game.developer && `${game.released ? ' by ' : 'By '}${game.developer.name}`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCard;
