import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CiCircleInfo, CiCircleMore, CiGlobe, CiPlay1 } from 'react-icons/ci';
import {
  getEmbedUrl, getPlatformIcon, getPlatformTypes, getSourceLinks, getStorePlatforms, getWebPlatform,
} from '../../../../data/games';
import styles from './GameCard.module.scss';

/**
 * A round icon action on the card: a button (`onClick`), a link inside the hub (`to`) or
 * a link out (`href`, new tab). The tooltip is short; the accessible name adds the game,
 * e.g. "Snake Game: Play in Hub" rather than six identical "View Code"s.
 */
const ActionButton = ({ icon: Icon, label, gameTitle, variant, onClick, to, href, ...rest }) => {
  const props = {
    title: label,
    'aria-label': `${gameTitle}: ${label}`,
    className: `${styles.actionButton} ${styles[variant] ?? ''}`,
    ...rest,
  };
  const icon = <Icon aria-hidden="true" />;
  if (onClick) return <button type="button" onClick={onClick} {...props}>{icon}</button>;
  if (to) return <Link to={to} {...props}>{icon}</Link>;
  return <a href={href} target="_blank" rel="noopener noreferrer" {...props}>{icon}</a>;
};

/**
 * A tag that toggles the same filter chip in the list
 * @param {string} kind - for the tooltip ("Genre: arcade")
 * @param {string} [className] - colour for the difficulty, genre and platform tags
 */
const TagButton = ({ tag, kind = 'Tag', className = '', selected, onToggle, ...rest }) => (
  <button
    type="button"
    title={`${kind}: ${tag}`}
    className={`${styles.gameTag} ${className} ${selected ? styles.active : ''}`}
    onClick={() => onToggle(tag)}
    aria-pressed={selected}
    {...rest}
  >
    {tag}
  </button>
);

const GameCard = ({ game, index = 0, onTagClick, selectedTags = [] }) => {
  const [showInfo, setShowInfo] = useState(false);
  const infoButtonRef = useRef(null);
  const infoPanelRef = useRef(null);
  const moveFocusRef = useRef(false); // set when the info panel is opened/closed from the keyboard
  const gamePage = `/games/${game.id}`;
  const embedUrl = getEmbedUrl(game); // null for entries that live on their own site or in a store
  const webPlatform = getWebPlatform(game);

  // Keyboard users: focus goes to the info panel when it opens and back to the Info button
  // when it closes. Mouse users keep their focus where it was (otherwise the card's
  // :focus-within reveal would stay on after the pointer leaves).
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

  const tag = (value, kind, className, attributes) => (
    <TagButton
      key={value}
      tag={value}
      kind={kind}
      className={className}
      selected={selectedTags.includes(value)}
      onToggle={onTagClick}
      {...attributes}
    />
  );

  return (
    <div
      className={styles.gameCard}
      style={{ '--card-index': index }} // staggers the drop-in animation
      onMouseLeave={() => { if (showInfo) closeInfo(false); }}
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

      {/* Hidden under the info panel while it's open, so it's taken out of the tab order then */}
      <div className={styles.gameOverlay} inert={showInfo || undefined}>
        <div className={styles.gameHeader}>
          <h3>{game.title}</h3>
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
          {getStorePlatforms(game).map((store) => (
            <ActionButton
              key={store.url}
              icon={getPlatformIcon(store)}
              label="Get it on Google Play"
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

      {/* No close button: a click closes it (except on its tags, which filter), and so do Escape,
          the pointer leaving the card, and focus moving out */}
      <div
        ref={infoPanelRef}
        className={`${styles.gameInfo} ${showInfo ? styles.show : ''}`}
        role="group"
        aria-label={`About ${game.title}`}
        tabIndex={-1}
        onClick={(e) => {
          if (e.target.closest('button') || window.getSelection()?.toString()) return; // a tag, or selecting text
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
          <h3>{game.title}</h3>
          <div className={styles.gameMetaTags}>
            {game.difficulty && tag(game.difficulty, 'Difficulty', styles[game.difficulty])}
            {game.genre.map((genre) => tag(genre, 'Genre', styles.genre))}
            {getPlatformTypes(game).map((platform) => tag(platform, 'Platform', styles.platform))}
          </div>
          <p className={styles.gameDescription}>{game.description}</p>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
