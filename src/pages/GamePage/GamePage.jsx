import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { CiGlobe, CiMaximize2 } from 'react-icons/ci';
import { LuChevronsLeftRight, LuChevronsRightLeft } from 'react-icons/lu';
import { PiResizeDuotone } from 'react-icons/pi';
import {
  games, getEmbedUrl, getPlatformIcon, getPlatformTypes, getSourceLinks, getStorePlatforms, getWebPlatform,
} from '../../data/games.js';
import GooglePlayBadge, { GOOGLE_PLAY_TRADEMARK } from '../../components/common/GooglePlayBadge/GooglePlayBadge.jsx';
import GameControls from '../../components/layout/game/GameControls/GameControls.jsx';
import ErrorPage from '../ErrorPage/ErrorPage.jsx';
import styles from './GamePage.module.scss';

const MIN_FRAME_SIZE = 200; // px, when dragging the game frame's edges
const RESIZE_EDGES = ['bottom', 'right', 'corner'];
// Expand / Collapse Width only shows when the game's own width is at least this much narrower than
// its column (px); otherwise it would change nothing you'd see (on phones, or a wide game)
const MIN_WIDTH_CHANGE = 16;

/**
 * Asks an embedded game to put its play area in the middle of the frame (games.json
 * `dimensions.center`). The hub can't scroll another site's page, so the game does it when it
 * gets this message (the few lines it needs are in the README).
 */
const askToCenter = (frame) => frame?.contentWindow?.postMessage({ type: 'gamehub:center' }, new URL(frame.src).origin);

// Screen-reader note for links that open a new tab (the ↗ arrow itself is hidden from them)
const NewTabNote = () => (
  <>
    <span aria-hidden="true"> ↗</span>
    <span className="visually-hidden"> (opens in a new tab)</span>
  </>
);

const GamePageContent = ({ gameId }) => {
  const game = games.find((g) => g.id === gameId);

  // The controls: under the game (expanded), or small in the info column. Full Width has a choice of
  // its own, expanded whenever it's entered, so leaving it brings back the one from before.
  const [controlsExpanded, setControlsExpanded] = useState(false);
  const [controlsExpandedInFullWidth, setControlsExpandedInFullWidth] = useState(true);
  const focusControlsRef = useRef(false); // their own button moved them, so focus goes with them
  const [showStyle, setShowStyle] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const [sizeMode, setSizeMode] = useState('expanded'); // expanded (the default), game, full-width or custom (dragged)
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [customHeight, setCustomHeight] = useState(null);
  const [customWidth, setCustomWidth] = useState(null);
  const iframeRef = useRef(null);
  const frameContainerRef = useRef(null);
  const frameSectionRef = useRef(null);
  const [columnWidth, setColumnWidth] = useState(null); // the game's column, for Expand / Collapse Width
  const dragRef = useRef(null); // the drag in progress: which edge, where it started
  const dimensions = game?.dimensions; // the game's own frame size (games.json), if it has one

  // Size the game frame for the chosen mode ("full-width" is also a class on the page, see render).
  // The height is the game's own (dimensions.h), or 16:9 for games without dimensions.
  // - expanded (the default): as wide as the column, with the info beside it
  // - game: the game's own width (dimensions.w, no wider than the column), in the middle of the column
  // - full-width: the whole row, with the info below (its height can still be dragged)
  // - custom: what the edges were dragged to
  useEffect(() => {
    const container = frameContainerRef.current;
    if (!container) return;

    container.style.width = dimensions && sizeMode === 'game' ? `min(100%, ${dimensions.w}px)` : '100%';
    container.style.height = dimensions ? `${dimensions.h}px` : '';
    container.style.aspectRatio = dimensions ? 'auto' : '16/9'; // 'auto', as '' would bring back the stylesheet's 16/9

    // Dragged sizes: both in custom mode; in full-width only the height (the width is the row's)
    const draggedHeight = sizeMode === 'custom' || sizeMode === 'full-width' ? customHeight : null;
    const draggedWidth = sizeMode === 'custom' ? customWidth : null;
    if (draggedHeight || draggedWidth) container.style.aspectRatio = 'auto';
    if (draggedHeight) container.style.height = `${draggedHeight}px`;
    if (draggedWidth) container.style.width = `${draggedWidth}px`;
  }, [dimensions, sizeMode, customHeight, customWidth]);

  // How wide the game's column is (it changes with the window, the sidebar and Full Width)
  useEffect(() => {
    const section = frameSectionRef.current;
    if (!section || !dimensions) return undefined;
    const observer = new ResizeObserver(([entry]) => setColumnWidth(entry.contentRect.width));
    observer.observe(section);
    return () => observer.disconnect();
  }, [dimensions]);

  // Games with `center` get centred again whenever the frame changes size (once it stops)
  useEffect(() => {
    const frame = iframeRef.current;
    if (!dimensions?.center || !frame) return undefined;
    let timer;
    const observer = new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => askToCenter(frame), 150);
    });
    observer.observe(frame);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [dimensions]);

  // While the game has keyboard focus, the page stays where it is:
  // - keys that scroll (arrows, space, Page Up/Down) scroll the game's own page, and once that can't
  //   scroll any further the browser scrolls this page instead (html.game-focused in _base.scss
  //   stops that)
  // - some games scroll the page themselves, like scrollIntoView() when their instructions open
  //   (Safari and Firefox pass that on to this page): the page goes straight back
  // The game is another site, so the hub can't stop either in it. Only with a mouse: on touch
  // screens it would keep swipes over the game from scrolling the page. A mouse wheel over the page
  // still scrolls it, and clicking outside the game gives the keyboard back to the page.
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return undefined;
    const root = document.documentElement;
    let wheelTimer;
    let lockedAt = window.scrollY; // where the page stays while the game has focus
    const isLocked = () => root.classList.contains('game-focused');
    const stay = () => {
      if (isLocked() && Math.abs(window.scrollY - lockedAt) > 1) window.scrollTo({ top: lockedAt, behavior: 'instant' });
    };
    // Locked while the game has focus, if the page is long enough to scroll at all
    const update = () => {
      const gameHasFocus = document.activeElement === frame;
      root.classList.toggle('game-focused', gameHasFocus && root.scrollHeight > root.clientHeight);
      stay(); // in case the click that moved focus into the game already scrolled the page
    };
    const onBlur = () => {
      lockedAt = window.scrollY; // the page lost focus, maybe into the game: remember where it was
      setTimeout(update);
    };
    const onWheel = (e) => {
      // A locked page can't scroll, so this turn of the wheel was lost: do it by hand
      // (deltaMode: 0 = pixels, 1 = lines, 2 = pages)
      if (isLocked()) {
        root.classList.remove('game-focused');
        window.scrollBy({ top: e.deltaY * [1, 16, window.innerHeight][e.deltaMode], behavior: 'instant' });
      }
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { // locked again once the wheel stops, where it stopped
        lockedAt = window.scrollY;
        update();
      }, 400);
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', update);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('scroll', stay, { passive: true }); // an instant scroll also stops a smooth one
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', update);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('scroll', stay);
      clearTimeout(wheelTimer);
      root.classList.remove('game-focused');
    };
  }, []);

  // Dragging the frame's bottom edge, right edge or corner. Pointer capture keeps the drag
  // going while the pointer is over the game's iframe.
  const startResize = (edge) => (e) => {
    const container = frameContainerRef.current;
    e.preventDefault(); // no text selection while dragging
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      edge,
      x: e.clientX,
      y: e.clientY,
      width: container.offsetWidth,
      height: container.offsetHeight,
    };
    // Width-only drags keep today's height
    if (edge === 'right') setCustomHeight((height) => height ?? container.offsetHeight);
  };

  const moveResize = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    // The frame is centred in its column, so its right edge moves half as far as its width
    // changes: the width changes twice as much as the pointer moves, keeping the edge under it
    const width = drag.width + 2 * (e.clientX - drag.x);
    const height = drag.height + (e.clientY - drag.y);
    let resized = false;
    if (drag.edge !== 'bottom' && width > MIN_FRAME_SIZE) {
      setCustomWidth(width);
      resized = true;
    }
    if (drag.edge !== 'right' && height > MIN_FRAME_SIZE) {
      setCustomHeight(height);
      resized = true;
    }
    // Full width stays full width (only its height changes); other drags make a custom size
    if (resized && sizeMode !== 'full-width') setSizeMode('custom');
  };

  const endResize = () => {
    dragRef.current = null;
  };

  // Preset size modes drop any earlier drag sizes. Entering Full Width expands the controls.
  const selectSizeMode = (mode) => {
    setCustomWidth(null);
    setCustomHeight(null);
    if (mode === 'full-width' && sizeMode !== 'full-width') setControlsExpandedInFullWidth(true);
    setSizeMode(mode);
  };

  // Focus follows the controls to their new place only when their own button moved them
  // (not when Full Width did), once
  const takeControlsFocus = useCallback(() => {
    const take = focusControlsRef.current;
    focusControlsRef.current = false;
    return take;
  }, []);

  const enterFullscreen = () => {
    const frame = iframeRef.current;
    // Older Safari only has the prefixed version
    (frame?.requestFullscreen ?? frame?.webkitRequestFullscreen)?.call(frame);
  };

  if (!game) {
    return <ErrorPage status={404} title="Game not found" text="There's no game at this address. Maybe it has a new name?" />;
  }

  // Games that run in the hub get the iframe player; the rest (other sites, store apps)
  // get a picture with links out
  const embedUrl = getEmbedUrl(game);
  const webPlatform = getWebPlatform(game);
  const WebIcon = webPlatform && getPlatformIcon(webPlatform);
  const storePlatforms = getStorePlatforms(game);
  const sourceLinks = getSourceLinks(game);
  // The keys, mouse buttons and gestures the game uses: small in the info column at first, or
  // every device under the game (or its picture)
  const fullWidth = sizeMode === 'full-width';
  const showControlsExpanded = fullWidth ? controlsExpandedInFullWidth : controlsExpanded;
  const controls = game.controls && (
    <GameControls
      controls={game.controls}
      expanded={showControlsExpanded}
      onToggleExpanded={() => {
        focusControlsRef.current = true;
        (fullWidth ? setControlsExpandedInFullWidth : setControlsExpanded)((expanded) => !expanded);
      }}
      takeFocus={takeControlsFocus}
    />
  );

  return (
    <div className={`${styles.gamePage} ${fullWidth ? styles.fullWidth : ''}`}>
      <div className={styles.gameHeader}>
        <h1>{game.title}</h1>
        <div className={styles.gameMeta}>
          <span className={`${styles.metaChip} ${styles.genre}`} title="Genre">{game.genre.join(', ')}</span>
          {game.difficulty && (
            <span className={`${styles.metaChip} ${styles[game.difficulty]}`} title="Difficulty">{game.difficulty}</span>
          )}
          {getPlatformTypes(game).map((platform) => (
            <span key={platform} className={`${styles.metaChip} ${styles.platform}`} title="Platform">{platform}</span>
          ))}
        </div>
      </div>

      <div className={styles.gameContent}>
        {embedUrl ? (
          <section ref={frameSectionRef} className={styles.gameFrameSection}>
            <div
              ref={frameContainerRef}
              className={`${styles.gameFrameContainer} ${resizeEnabled ? styles.resizable : ''}`}
            >
              <iframe
                ref={iframeRef}
                src={embedUrl}
                title={game.title}
                className={styles.gameFrame}
                allowFullScreen
                onLoad={dimensions?.center ? (e) => askToCenter(e.currentTarget) : undefined}
              />

              {/* Full width keeps the row's width, so only the bottom edge can be dragged then */}
              {resizeEnabled && RESIZE_EDGES.filter((edge) => sizeMode !== 'full-width' || edge === 'bottom').map((edge) => (
                <div
                  key={edge}
                  className={`${styles.resizeHandle} ${styles[edge]}`}
                  onPointerDown={startResize(edge)}
                  onPointerMove={moveResize}
                  onPointerUp={endResize}
                  onPointerCancel={endResize}
                >
                  {edge !== 'corner' && <div className={styles.handleBar} />}
                </div>
              ))}
            </div>

            <div className={styles.gameFrameActions}>
              <div className={styles.resizeControls}>
                <button
                  type="button"
                  className={`${styles.resizeToggle} ${resizeEnabled ? styles.active : ''}`}
                  onClick={() => setResizeEnabled((enabled) => !enabled)}
                  aria-pressed={resizeEnabled}
                >
                  <PiResizeDuotone aria-hidden="true" />
                  {resizeEnabled ? 'Disable Resize' : 'Enable Resize'}
                </button>

                {resizeEnabled && (
                  <div className={styles.sizeControls}>
                    {[['expanded', 'Default'], ['full-width', 'Full Width']].map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        className={`${styles.sizeButton} ${sizeMode === mode ? styles.active : ''}`}
                        onClick={() => selectSizeMode(mode)}
                        aria-pressed={sizeMode === mode}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Always shown */}
              <div className={styles.frameButtons}>
                {/* On by default: the frame fills its column. Off: the game's own width. Only when that's
                    narrower than the column, and not in Full Width, where it would change nothing. */}
                {dimensions && !fullWidth && columnWidth - dimensions.w >= MIN_WIDTH_CHANGE && (
                  <button
                    type="button"
                    className={`${styles.sizeButton} ${sizeMode === 'expanded' ? styles.active : ''}`}
                    onClick={() => selectSizeMode(sizeMode === 'expanded' ? 'game' : 'expanded')}
                    aria-pressed={sizeMode === 'expanded'}
                  >
                    {sizeMode === 'expanded'
                      ? <LuChevronsRightLeft aria-hidden="true" />
                      : <LuChevronsLeftRight aria-hidden="true" />}
                    {sizeMode === 'expanded' ? 'Collapse Width' : 'Expand Width'}
                  </button>
                )}
                <button
                  type="button"
                  className={styles.fullscreenButton}
                  onClick={enterFullscreen}
                  title="Fullscreen"
                  aria-label="Fullscreen"
                >
                  <CiMaximize2 aria-hidden="true" />
                </button>
              </div>
            </div>
            {showControlsExpanded && controls}
          </section>
        ) : (
          <section className={styles.heroSection}>
            {game.thumb ? (
              <img src={game.thumb} alt={game.title} className={styles.heroImage} />
            ) : (
              <div className={`${styles.heroImage} ${styles.heroFallback}`} aria-hidden="true">
                <span>{game.title}</span>
              </div>
            )}
            <div className={styles.heroActions}>
              {storePlatforms.map((store) => (
                <GooglePlayBadge key={store.url} url={store.url} />
              ))}
              {webPlatform && (
                <a href={webPlatform.url} className={styles.openButton} target="_blank" rel="noopener noreferrer">
                  <WebIcon aria-hidden="true" />
                  Open {game.title}<NewTabNote />
                </a>
              )}
              {game.website && (
                <a href={game.website} className={styles.openButton} target="_blank" rel="noopener noreferrer">
                  <CiGlobe aria-hidden="true" />
                  Visit website<NewTabNote />
                </a>
              )}
            </div>
            {storePlatforms.length > 0 && <p className={styles.storeLegal}>{GOOGLE_PLAY_TRADEMARK}</p>}
            {showControlsExpanded && controls}
          </section>
        )}

        <aside className={styles.gameInfoAside}>
          <section>
            {game.features?.length > 0 ? (
              <>
                <div className={styles.sectionHeader}>
                  <h2>Details</h2>
                  <button
                    type="button"
                    className={styles.toggleFeaturesBtn}
                    onClick={() => setShowFeatures((shown) => !shown)}
                    aria-expanded={showFeatures}
                    aria-label={showFeatures ? "Hide features" : "Show features"}
                    title={showFeatures ? "Hide features" : "Show features"}
                  >
                    <span aria-hidden="true">{showFeatures ? '▲' : '▼'}</span>
                  </button>
                </div>
                <p>{game.description}</p>
                <div className={`${styles.gameFeatures} ${showFeatures ? styles.expanded : ''}`}>
                  <h2>Features</h2>
                  <ul>
                    {game.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                </div>
              </>
              ) : (
              <>
                <h2>Description</h2>
                <p>{game.description}</p>
              </>
            )}
          </section>

          {!showControlsExpanded && controls}

          {/* Optional sections: only shown when the catalogue entry has them */}
          {game.style && (
            <section>
              <h2>Style</h2>
              <div className={styles.styleToggle}>
                <button
                  type="button"
                  className={styles.styleButton}
                  onMouseEnter={() => setShowStyle(true)}
                  onMouseLeave={() => setShowStyle(false)}
                  onFocus={() => setShowStyle(true)}
                  onBlur={() => setShowStyle(false)}
                  aria-expanded={showStyle}
                >
                  View style details
                </button>
                {showStyle && (
                  <div className={styles.stylePopup}>
                    <p>{game.style}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          <section>
            <h2>Tags</h2>
            <div className={styles.tagsContainer}>
              {game.tags.map((tag) => (
                <span key={tag} className={styles.tag}>{tag}</span>
              ))}
            </div>
          </section>

          {(embedUrl || sourceLinks.length > 0) && (
            <section className={styles.gameLinks}>
              {embedUrl && (
                <a href={embedUrl} className={styles.playButton} target="_blank" rel="noopener noreferrer">
                  <WebIcon aria-hidden="true" />
                  Play Directly<NewTabNote />
                </a>
              )}
              {sourceLinks.map(({ url, label, Icon }) => (
                <a key={url} href={url} className={styles.sourceLink} target="_blank" rel="noopener noreferrer">
                  <Icon aria-hidden="true" />
                  {label ?? 'View Source Code'}<NewTabNote />
                </a>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
};

// Keyed by id, so moving from one game to another starts with a fresh page
// (size mode, resize handles and effects don't carry over)
const GamePage = () => {
  const { gameId } = useParams();
  return <GamePageContent key={gameId} gameId={gameId} />;
};

export default GamePage;
