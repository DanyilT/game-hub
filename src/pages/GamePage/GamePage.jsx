import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import {
  CiCircleQuestion, CiFilter, CiGlobe, CiMaximize1, CiMaximize2, CiMinimize1, CiSquareChevLeft,
} from 'react-icons/ci';
import { LuChevronsLeftRight, LuChevronsRightLeft } from 'react-icons/lu';
import { PiPlayFill, PiResizeDuotone, PiStarFill } from 'react-icons/pi';
import {
  games, gamesWithTags, getEmbedUrl, getPlatformIcon, getPlatformTypes, getSourceLinks, getStore, getStorePlatforms,
  getWebPlatform,
} from '../../data/games.js';
import Button from '../../components/common/Button/Button';
import { Collapsible, DisclosureButton, useDisclosure } from '../../components/common/Disclosure/Disclosure';
import ExternalLink from '../../components/common/ExternalLink/ExternalLink';
import Message from '../../components/common/Message/Message';
import Popover from '../../components/common/Popover/Popover';
import Status from '../../components/common/Status/Status';
import Tag from '../../components/common/Tag/Tag';
import GooglePlayBadge, { GOOGLE_PLAY_TRADEMARK } from '../../components/common/GooglePlayBadge/GooglePlayBadge.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { useGameStats } from '../../contexts/LibraryContext';
import { fetchRunInputs, mergeRuns, useRecords, useServerRuns, useTicketsLeft } from '../../lib/checks';
import { askToConfirm } from '../../lib/confirm';
import { calendarDate } from '../../lib/dates';
import { useGameBridge } from '../../lib/gameBridge';
import { noteGameOpened } from '../../lib/install';
import { canOpenApp, openAppUrl } from '../../lib/nativeApps';
import { useDownloads, useOnline } from '../../lib/offline';
import { usePlayTime } from '../../lib/playTime';
import { useRuns } from '../../lib/runs';
import { useFit } from '../../lib/useFit';
import { onOverlay } from '../../lib/overlays';
import { showToast } from '../../lib/toast';
import DownloadGame from '../../components/layout/game/DownloadGame/DownloadGame.jsx';
import GameControls from '../../components/layout/game/GameControls/GameControls.jsx';
import GameHelp from '../../components/layout/game/GameHelp/GameHelp.jsx';
import GameProgress from '../../components/layout/game/GameProgress/GameProgress.jsx';
import GameReactions from '../../components/layout/game/GameReactions/GameReactions.jsx';
import RateGame from '../../components/layout/game/RateGame/RateGame.jsx';
import ErrorPage from '../ErrorPage/ErrorPage.jsx';
import styles from './GamePage.module.scss';

const MIN_FRAME_SIZE = 200; // px, when dragging the game frame's edges
const RESIZE_EDGES = ['bottom', 'right', 'corner'];
// Expand / Collapse Width only shows when the game's own width is at least this much narrower than
// its column (px); otherwise it would change nothing you'd see (on phones, or a wide game)
const MIN_WIDTH_CHANGE = 16;

// Wide screens have the info beside the game; narrower ones have it below, where the game already
// has the whole row, so there's nothing to maximize or resize. Must match the 1024px breakpoint in
// GamePage.module.scss.
const WIDE_QUERY = '(width > 1024px)';
const subscribeToWideScreen = (onChange) => {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
};
const isWideScreen = () => window.matchMedia(WIDE_QUERY).matches;

// The info cards under the game (narrower screens, maximized) are at least this wide (px), in as
// many columns as fit
const MIN_CARD_WIDTH = 340;

// GameHub running on this computer (the dev server) or on the local network. A game from the internet
// in its frame then loads the bridge (/hub-bridge.js) from a local address, which Chrome only allows
// once the player says so (Local Network Access), and a frame may only ask when the page lets it. On
// the live site the bridge comes from the internet like the game, so it never asks.
const LOCAL_HUB = /^(localhost|.+\.localhost|127(\.\d+){3}|\[::1\]|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2})$/
  .test(window.location.hostname);
const FRAME_ALLOW = LOCAL_HUB ? 'loopback-network; local-network' : undefined;

/**
 * Packs the info cards under the game like bricks: columns that each stack their cards with no gaps.
 * The cards take the columns in turn (first, second, …, then first again), so they read across, and
 * a card that grows (Details opening) only pushes down the ones under it. The grid there
 * (GamePage.module.scss) has 1px rows: each card spans as many as it's tall, plus the gap under it.
 * Beside the game the cards are a plain column, and this leaves them alone.
 * @param {object} ref - the cards' container
 * @param {boolean} underGame - whether they're under the game: laid out at once when that changes
 */
const useCardColumns = (ref, underGame) => {
  useLayoutEffect(() => {
    const grid = ref.current;
    if (!grid) return undefined;
    const layout = () => {
      const style = getComputedStyle(grid);
      if (style.display !== 'grid') return;
      const gap = parseFloat(style.columnGap) || 0;
      const columns = Math.max(1, Math.floor((grid.clientWidth + gap) / (MIN_CARD_WIDTH + gap)));
      const cards = [...grid.children];
      grid.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
      cards.forEach((card, i) => {
        card.style.gridColumn = String((i % columns) + 1);
      });
      const heights = cards.map((card) => card.getBoundingClientRect().height);
      cards.forEach((card, i) => {
        const last = i + columns >= cards.length; // nothing under it
        card.style.gridRowEnd = `span ${Math.max(1, Math.ceil(heights[i] + (last ? 0 : gap)))}`;
      });
    };
    // A card growing, or the column getting wider: laid out again on the next frame, after the
    // ResizeObserver round (doing it inside one would resize what it's still observing)
    let frame = null;
    const relayout = () => {
      if (frame === null) frame = requestAnimationFrame(() => {
        frame = null;
        layout();
      });
    };
    const resizes = new ResizeObserver(relayout);
    const watch = () => {
      resizes.disconnect();
      resizes.observe(grid);
      [...grid.children].forEach((card) => resizes.observe(card));
    };
    // Cards come and go (the controls move under the game, and back)
    const changes = new MutationObserver(() => {
      watch();
      relayout();
    });
    changes.observe(grid, { childList: true });
    watch();
    layout();
    return () => {
      resizes.disconnect();
      changes.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [ref, underGame]);
};

// Whether the controls were left expanded (under the game), remembered on this device. Storage can
// be unavailable (private mode, blocked site data), so it's best-effort.
const CONTROLS_KEY = 'gamehub:controls-expanded';
const readControlsExpanded = () => {
  try {
    return localStorage.getItem(CONTROLS_KEY) === 'true';
  } catch {
    return false;
  }
};

/**
 * Asks an embedded game to put its play area in the middle of the frame (games.json
 * `dimensions.center`). The hub can't scroll another site's page, so the game does it when it
 * gets this message (the few lines it needs are in the README).
 */
const askToCenter = (frame) => frame?.contentWindow?.postMessage({ type: 'gamehub:center' }, new URL(frame.src).origin);

/**
 * Tells an embedded game how it's shown, after each load and whenever its frame goes in or out of full
 * screen: 'full' while the frame fills the screen (the game shows its whole page), 'frame' otherwise (it
 * shows only what's needed to play, as it chooses). The game's own gamehub.js answers it, setting
 * data-gamehub-view on its page; games without it ignore the message.
 */
const tellView = (frame) => {
  if (!frame?.contentWindow) return;
  const full = (document.fullscreenElement ?? document.webkitFullscreenElement) === frame;
  frame.contentWindow.postMessage({ type: 'gamehub:view', view: full ? 'full' : 'frame' }, new URL(frame.src).origin);
};

/**
 * Tells an embedded game to pause (gamehub:pause) when the player can't see or reach it: its frame scrolled mostly out
 * of view, a GameHub window or sheet over it, or the frame about to be replaced (a replay, a reload). Games that move by
 * themselves pause and save; the others ignore it. Safe to send any time.
 */
const pauseGame = (frame) => {
  if (!frame?.contentWindow || !frame.src) return;
  frame.contentWindow.postMessage({ type: 'gamehub:pause' }, new URL(frame.src).origin);
};

// The frame's "Loading…" cover lifts when the game says it's playable (gamehub:playable). A game that doesn't say so
// (its hello has no `playable`) is uncovered at the frame's load; one that hasn't said hello by HELLO_WAIT after the
// load never will (no gamehub.js); and none stays covered longer than COVER_MAX after the load.
const HELLO_WAIT = 1500; // ms
const COVER_MAX = 6000; // ms

/**
 * The game's size for a frame `width` pixels wide, from its `dimensions.sizes` (narrowest first): the widest
 * that fits, or the narrowest when none does. A part of a pixel doesn't count.
 * @return {{w: number, h: number}}
 */
const sizeFor = (sizes, width) => sizes.findLast((size) => size.w <= Math.floor(width)) ?? sizes[0];

/** The players' average rating, beside the favorite and bookmark buttons: a gold star and the average (how many rated is in its tooltip) */
const RatingChip = ({ stats }) => {
  const average = Number(stats.rating_average).toFixed(1);
  const ratings = `${stats.rating_count} ${stats.rating_count === 1 ? 'rating' : 'ratings'}`;
  return (
    <span className={styles.ratingChip} title={`Average rating: ${average} out of 5, from ${ratings}`}>
      <PiStarFill aria-hidden="true" />
      <span className="visually-hidden">Rated </span>
      {average}
      <span className="visually-hidden"> out of 5, from {ratings}</span>
    </span>
  );
};

/**
 * The Tags card: the game's genres, difficulty and platforms, then its tags. Each can be picked, and with some picked,
 * a button opens the games list filtered to the games that have them all (the list's own chips: GameList).
 */
const GameTags = ({ game }) => {
  const [picked, setPicked] = useState([]);
  const toggle = (tag) => setPicked((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  // A chip, by kind: genre, difficulty (easy, medium, hard), platform, or a plain tag
  const chip = (tag, kind = 'tag') => (
    <Tag key={`${kind}:${tag}`} kind={kind} size="md" selected={picked.includes(tag)} onClick={() => toggle(tag)}>
      {tag}
    </Tag>
  );
  return (
    <div className={styles.tagsCard} role="group" aria-label="Pick tags to find games that have them all">
      <div className={styles.gameMeta}>
        {game.genre.map((genre) => chip(genre, 'genre'))}
        {game.difficulty && chip(game.difficulty, game.difficulty)}
        {getPlatformTypes(game).map((platform) => chip(platform, 'platform'))}
      </div>
      <div className={styles.tagsContainer}>{game.tags.map((tag) => chip(tag))}</div>
      {picked.length > 0 && (
        <div className={styles.tagsFind}>
          <Button to={gamesWithTags(picked)} variant="outline" icon={CiFilter}>
            {picked.length === 1 ? `Find games tagged ${picked[0]}` : `Find games with these ${picked.length}`}
          </Button>
          <Button variant="text" onClick={() => setPicked([])}>Clear</Button>
        </div>
      )}
    </div>
  );
};

/** Who made the game: their name, linking to their page when the catalogue has one */
const DeveloperName = ({ developer }) => (developer.url ? (
  <ExternalLink href={developer.url} arrow>{developer.name}</ExternalLink>
) : developer.name);

/**
 * Where the game's progress is going, under the game: the account (signed in, once the game has
 * connected) or this browser; offline, this device, and for a game whose runs are checked, how many
 * tickets are left (src/lib/checks.js)
 * @param {number|null} ticketsLeft - null when the game's runs aren't checked
 */
const SaveStatus = ({ bridge, signedIn, accountsAvailable, online, ticketsLeft, title }) => {
  if (!online) {
    if (signedIn && ticketsLeft === 0) {
      return (
        <Message tone="warning" role="status">
          You&rsquo;re offline, and out of tickets for {title}: the games you play now won&rsquo;t be saved to your
          account, only on this device (they can&rsquo;t be checked). Your progress still goes up once you&rsquo;re
          back online. Connect to the internet to get more tickets.
        </Message>
      );
    }
    return (
      <Message>
        You&rsquo;re offline. Your progress is kept on this device
        {signedIn ? ', and goes up to your account the next time you play this game online.' : '.'}
        {signedIn && ticketsLeft > 0 && (
          <>
            {' '}{ticketsLeft} {ticketsLeft === 1 ? 'ticket' : 'tickets'} left: the games you play on them are
            checked and saved to your account once you&rsquo;re back online.
          </>
        )}
      </Message>
    );
  }
  // Games only connect a moment after they load; until then (or if they never do) nothing is claimed
  if (!accountsAvailable || !bridge.connected) return null;
  if (!signedIn) {
    return <Message>Your progress is saved in this browser. Sign in to keep it in your account.</Message>;
  }
  let text = 'Your progress is saved to your account.';
  if (bridge.saving) text = 'Saving to your account…';
  else if (bridge.saveFailed) text = "Couldn't reach your account. Your progress is safe in this browser, and it'll try again.";
  else if (bridge.savedAt) text = `Saved to your account at ${bridge.savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}.`;
  return <Message tone={bridge.saveFailed ? 'warning' : 'note'}>{text}</Message>;
};

const GamePageContent = ({ gameId }) => {
  const game = games.find((g) => g.id === gameId);
  const { isAvailable: accountsAvailable, sessionReady, session, user } = useAuth();
  const stats = useGameStats(gameId);
  const [helpOpen, setHelpOpen] = useState(false);

  // Back to where the player came from, or to the games when this page was the first of the visit (a
  // link from somewhere else): React Router keys that first page "default"
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1));
  // Touch screens: the title goes back too (they have no pointer to bring up the back arrow with)
  const backOnTouch = () => {
    if (window.matchMedia('(hover: none)').matches) goBack();
  };

  // The controls: under the game (expanded), or small in the info column. Maximized has a choice of
  // its own, expanded whenever it's entered, so leaving it brings back the one from before.
  const [controlsExpanded, setControlsExpanded] = useState(readControlsExpanded);
  const [controlsExpandedMaximized, setControlsExpandedMaximized] = useState(true);
  const focusControlsRef = useRef(false); // their own button moved them, so focus goes with them
  const [showStyle, setShowStyle] = useState(false);
  const features = useDisclosure();
  // The frame (Enable Resize): Maximize puts the game across the whole row, with the info below;
  // Collapse Width gives it the game's own width instead of its column's; dragging an edge gives it
  // a width or height of its own
  const [maximized, setMaximized] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [customHeight, setCustomHeight] = useState(null);
  const [customWidth, setCustomWidth] = useState(null);
  const iframeRef = useRef(null);
  const frameContainerRef = useRef(null);
  const frameSectionRef = useRef(null);
  const infoRef = useRef(null); // the info cards
  // The title with its buttons beside it, at full size if they fit, else smaller; else the buttons on a row of their own
  const [headerLook, headerRef] = useFit(['', styles.compact, `${styles.compact} ${styles.stacked}`]);
  const [columnWidth, setColumnWidth] = useState(null); // the game's column, for Expand / Collapse Width
  const dragRef = useRef(null); // the drag in progress: which edge, where it started
  const dimensions = game?.dimensions; // the game frame's sizes and centring (the catalogue), if it has them
  const sizes = dimensions?.sizes ?? null;
  // The game's size for its column (none until the column is measured, and none for games without sizes)
  const frameSize = sizes && columnWidth !== null ? sizeFor(sizes, columnWidth) : null;

  // Games that run in the hub get the iframe player; the rest (other sites, store apps) get a picture
  // with links out. The game in the frame talks to the hub through the bridge (cloud saves, and the
  // panel under it).
  const embedUrl = game ? getEmbedUrl(game) : null;
  // The game's controls, with GameHub's own F (full screen) on the keyboard of a game played here with keys
  const gameControls = useMemo(() => {
    const keys = game?.controls?.keys;
    if (!embedUrl || !keys?.length || keys.some((binding) => binding.keys.includes('f'))) return game?.controls;
    return { ...game.controls, keys: [...keys, { keys: ['f'], action: 'Full screen on or off (GameHub)' }] };
  }, [game, embedUrl]);
  // A run being watched again: { row, speed, key }. The frame then holds the game opened to play it
  // (#gamehub-replay), a fresh one each time (key), and the game the player was playing comes back after.
  const [replay, setReplay] = useState(null);
  const replayCountRef = useRef(0);
  const bridge = useGameBridge({
    frameRef: iframeRef,
    gameId,
    origin: embedUrl ? new URL(embedUrl).origin : null,
    session,
    replay: replay && { run: replay.row.run, speed: replay.speed, key: replay.key },
  });
  // How long they play, for their activity and the panel (counted only while they press keys or tap in
  // the game, and not while they watch a replay)
  const played = usePlayTime({ gameId, session, activity: bridge.activity, paused: Boolean(replay) });
  // Offline, a game plays only if it's downloaded (the record can be out of date, so there's a way
  // to try anyway)
  const online = useOnline();
  const downloads = useDownloads();
  const [tryAnyway, setTryAnyway] = useState(false);
  const blockedOffline = Boolean(embedUrl) && !online && !downloads[gameId] && !tryAnyway;

  // The game starts again when the player signs in or out (so it loads their save), and after a
  // reset. Online, it waits until we know who's signed in, so it doesn't load twice. Offline it
  // starts at once: finding out can take a while then (Supabase spends half a minute trying to
  // refresh a sign-in that's over an hour old), and the game can't reach the account anyway. When
  // we do find out, a game started that way carries on as that player's.
  const player = sessionReady ? user?.id ?? 'guest' : null; // null until we know
  // A game started offline before we knew: { frameKey, player } (who it turned out to be, or null)
  const [offlineStart, setOfflineStart] = useState(null);
  const startedOffline = offlineStart?.frameKey === bridge.frameKey;
  if (!startedOffline && player === null && !online && !blockedOffline) {
    setOfflineStart({ frameKey: bridge.frameKey, player: null });
  } else if (startedOffline && offlineStart.player === null && player !== null) {
    setOfflineStart({ frameKey: bridge.frameKey, player });
  }
  let frameId = null;
  if (startedOffline && (offlineStart.player === null || offlineStart.player === player)) {
    frameId = `offline:${bridge.frameKey}`;
  } else if (player !== null) {
    frameId = `${player}:${bridge.frameKey}`;
  }
  if (frameId && replay) frameId += `:replay${replay.key}`;

  // The frame's "Loading…" cover: which frame has loaded, has said it's playable, or was uncovered without that
  const [loadedFrame, setLoadedFrame] = useState(null);
  const [playableFrame, setPlayableFrame] = useState(null);
  const [uncoveredFrame, setUncoveredFrame] = useState(null);
  const frameCovered = Boolean(frameId) && playableFrame !== frameId && uncoveredFrame !== frameId;
  useEffect(() => {
    if (!frameId || loadedFrame !== frameId) return undefined;
    const uncover = () => setUncoveredFrame(frameId);
    if (bridge.connected && !bridge.playable) {
      uncover(); // it doesn't say when it's playable: loaded will do
      return undefined;
    }
    const timer = setTimeout(uncover, bridge.connected ? COVER_MAX : HELLO_WAIT);
    return () => clearTimeout(timer);
  }, [frameId, loadedFrame, bridge.connected, bridge.playable]);

  // The player's runs of the game, to watch again: the ones kept in this browser (src/lib/runs.js), and
  // a signed-in player's kept on GameHub's server, from any browser; and their records: their best
  // runs that the server has checked (src/lib/checks.js). Both are read again as runs here change.
  const localRuns = useRuns(player, gameId);
  const serverRuns = useServerRuns(user?.id ?? null, gameId, localRuns);
  const runs = useMemo(() => mergeRuns(localRuns, serverRuns), [localRuns, serverRuns]);
  const records = useRecords(user?.id ?? null, gameId, localRuns);

  // Offline, a signed-in player's games are checked once back online, on the tickets they have left:
  // using the last one says so (a run without one can't go to their account)
  const ticketsLeft = useTicketsLeft(bridge.gameVersion === 3 ? user?.id : null, gameId);
  const ticketsBeforeRef = useRef(ticketsLeft);
  useEffect(() => {
    const before = ticketsBeforeRef.current;
    ticketsBeforeRef.current = ticketsLeft;
    if (!online && before > 0 && ticketsLeft === 0) {
      showToast(
        `That was your last offline ticket for ${game?.title}: your next games won’t be saved to your account. Connect to the internet to get more.`,
        { duration: 12000 },
      );
    }
  }, [ticketsLeft, online, game?.title]);

  // Watching a run again: asks first when a game under way would be lost (the frame reloads for it)
  const watchRun = async (row) => {
    if (!replay && bridge.gameStatus?.ongoing) {
      const yes = await askToConfirm({
        title: 'Watch the replay?',
        message: 'The game you’re playing now ends.',
        confirmLabel: 'Watch',
      });
      if (!yes) return;
    }
    // A run this browser doesn't keep: its moves come from the server first
    let watched = row;
    if (!row.run.inputs) {
      let inputs = null;
      try {
        inputs = await fetchRunInputs(row.serverId);
      } catch {
        showToast('Couldn’t load that replay. Check your connection and try again.', { tone: 'error' });
        return;
      }
      if (!inputs) {
        showToast('That replay is no longer kept on GameHub’s server.');
        return;
      }
      watched = { ...row, run: { ...row.run, inputs } };
    }
    pauseGame(iframeRef.current); // the frame is replaced: the game in it pauses (and saves) first
    replayCountRef.current += 1;
    setReplay((current) => ({ row: watched, speed: current?.speed ?? 1, key: replayCountRef.current }));
  };
  const watchAgain = () => {
    pauseGame(iframeRef.current);
    replayCountRef.current += 1;
    setReplay((current) => current && { ...current, key: replayCountRef.current });
  };
  const controlReplay = (command) => {
    if (command.action === 'speed') setReplay((current) => current && { ...current, speed: command.speed });
    bridge.controlReplay(command);
  };

  // Signing in or out, or a reset, starts the game afresh: a replay being watched ends with it
  const [replayFrameKey, setReplayFrameKey] = useState(bridge.frameKey);
  const [replayPlayer, setReplayPlayer] = useState(player);
  if (replayFrameKey !== bridge.frameKey || replayPlayer !== player) {
    setReplayFrameKey(bridge.frameKey);
    setReplayPlayer(player);
    setReplay(null);
  }

  // A game that loaded offline can't reach the account, so back online, a reload sends its progress up
  const [offlineSinceLoad, setOfflineSinceLoad] = useState(() => !navigator.onLine);
  useEffect(() => {
    setOfflineSinceLoad(!navigator.onLine);
  }, [frameId]);
  useEffect(() => {
    if (!online) setOfflineSinceLoad(true);
  }, [online]);
  const offerReload = online && offlineSinceLoad && Boolean(user) && !bridge.connected;

  useEffect(() => {
    try {
      localStorage.setItem(CONTROLS_KEY, String(controlsExpanded));
    } catch {
      // storage unavailable: the choice just isn't remembered
    }
  }, [controlsExpanded]);

  // Counts toward the install suggestion on the games page, which waits for a game or two
  useEffect(() => {
    if (game) noteGameOpened();
  }, [game]);

  // Size the game frame, before it's painted (maximized is a class on the page, see render).
  // - Its width: the column's (the whole row's when maximized), by default. With Collapse Width, the
  //   game's own (its size's, never wider than the column), in the middle. Or a dragged width.
  // - Its height: the game's at that width (dimensions.sizes: the game lays out differently at
  //   different widths), or a dragged height, or 16:9 for games without sizes.
  useLayoutEffect(() => {
    const container = frameContainerRef.current;
    if (!container) return;

    const size = customWidth && sizes ? sizeFor(sizes, Math.min(customWidth, columnWidth ?? customWidth)) : frameSize;
    let width = '100%';
    if (customWidth) width = `${customWidth}px`;
    else if (collapsed && size) width = `min(100%, ${size.w}px)`;
    let height = size ? `${size.h}px` : '';
    if (customHeight) height = `${customHeight}px`;
    container.style.width = width;
    container.style.height = height;
    container.style.aspectRatio = height ? 'auto' : '16/9'; // 'auto', as '' would bring back the stylesheet's 16/9
  }, [sizes, frameSize, columnWidth, collapsed, customHeight, customWidth]);

  // How wide the game's column is (it changes with the window, the sidebar and Maximize). Measured
  // before the frame is first painted, so the frame starts at the right size.
  useLayoutEffect(() => {
    const section = frameSectionRef.current;
    if (!section || !sizes) return undefined;
    setColumnWidth(section.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setColumnWidth(entry.contentRect.width));
    observer.observe(section);
    return () => observer.disconnect();
  }, [sizes]);

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
  }, [dimensions, frameId]);

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
  }, [frameId]);

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
    // Width-only drags keep today's height, unless the game has sizes (then it gets its height for the width)
    if (edge === 'right' && !sizes) setCustomHeight((height) => height ?? container.offsetHeight);
  };

  const moveResize = (e) => {
    const drag = dragRef.current;
    if (!drag) return;
    // The frame is centred in its column, so its right edge moves half as far as its width
    // changes: the width changes twice as much as the pointer moves, keeping the edge under it
    const width = drag.width + 2 * (e.clientX - drag.x);
    const height = drag.height + (e.clientY - drag.y);
    if (drag.edge !== 'bottom' && width > MIN_FRAME_SIZE) setCustomWidth(width);
    if (drag.edge !== 'right' && height > MIN_FRAME_SIZE) setCustomHeight(height);
  };

  const endResize = () => {
    dragRef.current = null;
  };

  // Expanded is the default: the frame across its column, at the game's height. Collapse Width and
  // Expand Width each drop a dragged size, so after a drag, Expand Width brings back the default.
  const dragged = Boolean(customWidth || customHeight);
  const expanded = !collapsed && !dragged;
  const toggleWidth = () => {
    setCustomWidth(null);
    setCustomHeight(null);
    setCollapsed(expanded);
  };

  // Maximize and Minimize drop a dragged size too. Maximizing expands the controls.
  const toggleMaximized = () => {
    setCustomWidth(null);
    setCustomHeight(null);
    if (!maximized) setControlsExpandedMaximized(true);
    setMaximized(!maximized);
  };

  // Resizing is for wide screens, where the game shares the row with the info. Narrower screens
  // already give the game the whole row: no resizing there (the frame goes back to its default),
  // and Fullscreen moves onto the frame. Collapse Width also needs the game's own width to be
  // narrower than its column.
  const wideScreen = useSyncExternalStore(subscribeToWideScreen, isWideScreen);
  const [wasWideScreen, setWasWideScreen] = useState(wideScreen);
  if (wasWideScreen !== wideScreen) {
    setWasWideScreen(wideScreen);
    if (!wideScreen) {
      setResizeEnabled(false);
      setMaximized(false);
      setCollapsed(false);
      setCustomWidth(null);
      setCustomHeight(null);
    }
  }
  const canCollapse = Boolean(frameSize) && columnWidth - frameSize.w >= MIN_WIDTH_CHANGE;
  useCardColumns(infoRef, maximized || !wideScreen);

  // Whether the game has the focus (the player is in it): the fullscreen button on the frame steps
  // aside then. Focus goes into the game a moment after this page loses it. A tap anywhere on this
  // page is outside the game (iOS doesn't move the focus for a tap on nothing in particular).
  const [gameFocused, setGameFocused] = useState(false);
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return undefined;
    let timer;
    const update = () => setGameFocused(document.activeElement === frame);
    const onBlur = () => {
      clearTimeout(timer);
      timer = setTimeout(update);
    };
    const onPagePointer = () => setGameFocused(false);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', update);
    document.addEventListener('focusin', update);
    document.addEventListener('pointerdown', onPagePointer);
    update();
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', update);
      document.removeEventListener('focusin', update);
      document.removeEventListener('pointerdown', onPagePointer);
      clearTimeout(timer);
    };
  }, [frameId, blockedOffline]);

  // Focus follows the controls to their new place only when their own button moved them
  // (not when Maximize did), once
  const takeControlsFocus = useCallback(() => {
    const take = focusControlsRef.current;
    focusControlsRef.current = false;
    return take;
  }, []);

  const enterFullscreen = () => {
    const frame = iframeRef.current;
    // Older Safari only has the prefixed version; a refusal (Safari, without the player's own click) changes nothing
    const request = frame?.requestFullscreen ?? frame?.webkitRequestFullscreen;
    Promise.resolve(request?.call(frame)).catch(() => {});
  };
  // Out of the full screen, when it's the game's frame that fills it
  const leaveFullscreen = () => {
    if ((document.fullscreenElement ?? document.webkitFullscreenElement) !== iframeRef.current) return;
    Promise.resolve((document.exitFullscreen ?? document.webkitExitFullscreen)?.call(document)).catch(() => {});
  };
  // F: the game full screen, or back
  const toggleFullscreen = () => {
    if ((document.fullscreenElement ?? document.webkitFullscreenElement) === iframeRef.current) leaveFullscreen();
    else enterFullscreen();
  };

  // F on this page (while the game doesn't have the keyboard; in the game, hub-bridge.js passes it up). Not while
  // typing, nor in a window open over the page.
  useEffect(() => {
    if (!embedUrl || blockedOffline) return undefined;
    const onKeyDown = (e) => {
      if (e.key?.toLowerCase() !== 'f' || e.ctrlKey || e.metaKey || e.altKey || e.repeat || e.defaultPrevented) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable], dialog') || !iframeRef.current) return;
      e.preventDefault();
      toggleFullscreen();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [embedUrl, blockedOffline]);

  // What the game's page tells this one outside gameBridge.js:
  // - its own gamehub.js: it's playable (the cover lifts), and its full screen (GameHub.fullScreen: a game's own
  //   button, Minesweeper's □) when it needs GameHub: out of the full screen GameHub put the frame in (only GameHub can
  //   end it), or in, when the browser refused the game's own request;
  // - hub-bridge.js: F was pressed in the game. The browser counts the key press for this page too, so it may still
  //   go full screen.
  useEffect(() => {
    const onMessage = (event) => {
      const frame = iframeRef.current;
      if (!frame || event.source !== frame.contentWindow || event.origin !== new URL(frame.src).origin) return;
      const message = event.data;
      if (message?.type === 'gamehub:playable') setPlayableFrame(frame.dataset.frame);
      else if (message?.type === 'gamehub:fullscreen' && message.full === true) enterFullscreen();
      else if (message?.type === 'gamehub:fullscreen' && message.full === false) leaveFullscreen();
      else if (message?.type === 'gamehub:fullscreen-key') toggleFullscreen();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // The player can't see or reach the game: it pauses when its frame scrolls mostly out of view, and when a window or
  // sheet of GameHub's opens over it (src/lib/overlays.js)
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame) return undefined;
    let inView = true;
    const observer = new IntersectionObserver(([entry]) => {
      const nowInView = entry.intersectionRatio >= 0.5;
      if (inView && !nowInView) pauseGame(frame);
      inView = nowInView;
    }, { threshold: 0.5 });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameId, blockedOffline]);
  useEffect(() => onOverlay(() => pauseGame(iframeRef.current)), []);

  // Full screen, the game shows its whole page; back in its frame, what's needed to play (tellView)
  useEffect(() => {
    const onChange = () => tellView(iframeRef.current);
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  if (!game) {
    return <ErrorPage status={404} title="Game not found" text="There's no game at this address. Maybe it has a new name?" />;
  }

  const webPlatform = getWebPlatform(game);
  const WebIcon = webPlatform && getPlatformIcon(webPlatform);
  const storePlatforms = getStorePlatforms(game);
  const app = storePlatforms.find(canOpenApp); // on Android, Play on its picture tries the app
  const sourceLinks = getSourceLinks(game);
  // When it came out, and who made it: with the features (or under the description, for entries without any)
  const credits = (game.released || game.developer) && (
    <Message className={styles.credits}>
      {game.released && <>Released <time dateTime={game.released}>{calendarDate(game.released)}</time></>}
      {game.developer && <>{game.released ? ' by ' : 'By '}<DeveloperName developer={game.developer} /></>}
    </Message>
  );
  // The keys, mouse buttons and gestures the game uses: small in the info column at first, or
  // every device under the game (or its picture)
  const showControlsExpanded = maximized ? controlsExpandedMaximized : controlsExpanded;
  const controls = gameControls && (
    <GameControls
      controls={gameControls}
      expanded={showControlsExpanded}
      onToggleExpanded={() => {
        focusControlsRef.current = true;
        (maximized ? setControlsExpandedMaximized : setControlsExpanded)((open) => !open);
      }}
      takeFocus={takeControlsFocus}
    />
  );

  return (
    <div className={`${styles.gamePage} ${maximized ? styles.maximized : ''}`}>
      <div ref={headerRef} className={`${styles.gameHeader} ${headerLook}`}>
        {/* The title, after the game's icon, which is also the way back: pointing at it (or tabbing to
            it) slides a back arrow in before it. Touch screens get no arrow: tapping the icon or the
            title goes back. A game without an icon shows the arrow when its title is pointed at. */}
        <div className={`${styles.gameTitle} ${game.iconUrl ? '' : styles.noIcon}`}>
          <button type="button" className={styles.back} onClick={goBack} title="Back" aria-label="Back">
            <span className={styles.backArrow}><CiSquareChevLeft aria-hidden="true" /></span>
            {game.iconUrl && <img src={game.iconUrl} alt="" className={styles.gameIcon} />}
          </button>
          <h1 onClick={backOnTouch}>{game.title}</h1>
        </div>
        <div className={styles.gameReactions}>
          {stats?.rating_count > 0 && <RatingChip stats={stats} />}
          <GameReactions game={game} stats={stats} />
          {embedUrl && (
            <DownloadGame game={game} offline={bridge.offline} recorded={Boolean(downloads[gameId])} onSetDownload={bridge.setDownload} />
          )}
          <Button
            variant="soft"
            shape="round"
            icon={CiCircleQuestion}
            label="Help"
            title="Help: report a bug, reset progress"
            onClick={() => setHelpOpen(true)}
            aria-haspopup="dialog"
          />
        </div>
      </div>
      {helpOpen && (
        <GameHelp
          game={game}
          onReset={embedUrl ? bridge.resetProgress : null}
          connected={bridge.connected}
          onClose={() => setHelpOpen(false)}
        />
      )}

      <div className={styles.gameContent}>
        {embedUrl ? (
          <section ref={frameSectionRef} className={styles.gameFrameSection}>
            <div
              ref={frameContainerRef}
              className={`${styles.gameFrameContainer} ${resizeEnabled ? styles.resizable : ''}`}
            >
              {blockedOffline && (
                <div className={styles.offlineNotice} role="status">
                  <p>You&rsquo;re offline, and {game.title} isn&rsquo;t downloaded.</p>
                  <Message className={styles.offlineHint}>
                    Connect to the internet to play it. To play it offline next time, download it from this page
                    (the Download button at the top).
                  </Message>
                  <Button variant="outline" font="secondary" shape="rounded" onClick={() => setTryAnyway(true)}>Try anyway</Button>
                </div>
              )}
              {frameId && !blockedOffline && (
                <iframe
                  key={frameId}
                  ref={iframeRef}
                  data-frame={frameId}
                  src={replay ? `${embedUrl}#gamehub-replay` : embedUrl}
                  title={replay ? `${game.title}: replay` : game.title}
                  className={styles.gameFrame}
                  // A game's own full screen (Minesweeper's □) asks for its page from inside the frame
                  allowFullScreen
                  allow={FRAME_ALLOW}
                  onLoad={(e) => {
                    const frame = e.currentTarget;
                    setLoadedFrame(frameId);
                    tellView(frame);
                    if (dimensions?.center) askToCenter(frame);
                    // Keys work at once: the game gets the keyboard, unless something else took it meanwhile, and not
                    // on touch screens (where it would bring up nothing useful)
                    if (document.activeElement === document.body && !window.matchMedia('(pointer: coarse)').matches) {
                      frame.focus({ preventScroll: true });
                    }
                  }}
                />
              )}
              {/* Over the frame until the game is on screen and ready (it says so: gamehub:playable) */}
              {frameId && !blockedOffline && (
                <div className={`${styles.frameCover} ${frameCovered ? '' : styles.uncovered}`} aria-hidden={!frameCovered}>
                  {game.iconUrl && <img src={game.iconUrl} alt="" className={styles.coverIcon} />}
                  <Status kind="loading">Loading {game.title}…</Status>
                </div>
              )}

              {/* Narrower screens (nothing to resize): Fullscreen sits on the frame instead of under
                  it, out of the way while the game has the focus */}
              {!wideScreen && frameId && !blockedOffline && (
                <Button
                  font="secondary"
                  shape="rounded"
                  icon={CiMaximize2}
                  label="Fullscreen"
                  title="Fullscreen (F)"
                  aria-keyshortcuts="F"
                  className={`${styles.frameFullscreen} ${gameFocused ? styles.hidden : ''}`}
                  onClick={enterFullscreen}
                />
              )}

              {resizeEnabled && RESIZE_EDGES.map((edge) => (
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

            {wideScreen && (
              <div className={styles.gameFrameActions}>
                <div className={styles.resizeControls}>
                  {/* Pink while on, like the dashed line and the handles it shows */}
                  <Button
                    tone={resizeEnabled ? 'secondary' : 'primary'}
                    font="secondary"
                    shape="rounded"
                    icon={PiResizeDuotone}
                    onClick={() => setResizeEnabled((enabled) => !enabled)}
                  >
                    {resizeEnabled ? 'Disable Resize' : 'Enable Resize'}
                  </Button>

                  {resizeEnabled && (
                    <div className={styles.sizeControls}>
                      {/* Collapse Width: the game's own width. Expand Width: back to the default (the
                          column's width, at the game's height), also after a drag. Only when it would
                          change something. */}
                      {(canCollapse || dragged) && (
                        <Button
                          variant="outline"
                          font="secondary"
                          shape="rounded"
                          icon={expanded ? LuChevronsRightLeft : LuChevronsLeftRight}
                          active={expanded}
                          onClick={toggleWidth}
                        >
                          {expanded ? 'Collapse Width' : 'Expand Width'}
                        </Button>
                      )}
                      {/* Maximize: the game across the whole row, the info below */}
                      <Button
                        variant="outline"
                        font="secondary"
                        shape="rounded"
                        icon={maximized ? CiMinimize1 : CiMaximize1}
                        active={maximized}
                        onClick={toggleMaximized}
                      >
                        {maximized ? 'Minimize' : 'Maximize'}
                      </Button>
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  font="secondary"
                  shape="rounded"
                  icon={CiMaximize2}
                  label="Fullscreen"
                  title="Fullscreen (F)"
                  aria-keyshortcuts="F"
                  className={styles.fullscreenButton}
                  onClick={enterFullscreen}
                />
              </div>
            )}
            {/* Up once the game has connected, and through the reloads for a replay and back */}
            {!blockedOffline && (bridge.connected || replay || bridge.gameStatus) && (
              <GameProgress
                status={bridge.gameStatus}
                played={played}
                runs={runs}
                records={records}
                canReplay={bridge.gameVersion === 3}
                signedIn={Boolean(user)}
                replay={replay}
                replayState={bridge.replayState}
                onWatch={watchRun}
                onControlReplay={controlReplay}
                onReplayAgain={watchAgain}
                onStopReplay={() => setReplay(null)}
              />
            )}
            {!blockedOffline && !replay && (
              <SaveStatus
                bridge={bridge}
                signedIn={Boolean(user)}
                accountsAvailable={accountsAvailable}
                online={online}
                ticketsLeft={ticketsLeft}
                title={game.title}
              />
            )}
            {offerReload && (
              <Message>
                You&rsquo;re back online. Reload the game to send the progress you made offline to your account.{' '}
                <Button
                  variant="text"
                  onClick={() => {
                    pauseGame(iframeRef.current); // it saves before the frame starts again
                    bridge.reloadGame();
                  }}
                >
                  Reload the game
                </Button>
              </Message>
            )}
            {showControlsExpanded && controls}
          </section>
        ) : (
          <section className={styles.heroSection}>
            {/* An app, on Android: glassed over, with Play in the middle, which opens it (or its store's page) */}
            <div className={`${styles.heroPicture} ${app ? styles.withPlay : ''}`}>
              {game.thumb ? (
                <img src={game.thumb} alt={game.title} className={styles.heroImage} />
              ) : (
                <div className={`${styles.heroImage} ${styles.heroFallback}`} aria-hidden="true">
                  <span>{game.title}</span>
                </div>
              )}
              {app && (
                <Button
                  href={openAppUrl(app)}
                  sameTab
                  size="lg"
                  icon={PiPlayFill}
                  title={`Opens ${game.title}, or ${getStore(app).name} if it isn't installed`}
                  className={styles.heroPlay}
                >
                  Play
                </Button>
              )}
            </div>
            <div className={styles.heroActions}>
              {storePlatforms.map((store) => (store.type === 'android' ? (
                <GooglePlayBadge key={store.url} url={store.url} />
              ) : (
                <Button key={store.url} href={store.url} tone="warning" size="lg" icon={getStore(store).Icon} arrow>
                  {getStore(store).get}
                </Button>
              )))}
              {webPlatform && (
                <Button href={webPlatform.url} size="lg" icon={WebIcon} arrow>
                  Open {game.title}
                </Button>
              )}
              {game.website && (
                <Button href={game.website} variant={webPlatform ? 'outline' : 'filled'} size="lg" icon={CiGlobe} arrow>
                  Visit website
                </Button>
              )}
            </div>
            {storePlatforms.some((store) => store.type === 'android') && (
              <Message className={styles.storeLegal}>{GOOGLE_PLAY_TRADEMARK}</Message>
            )}
            {showControlsExpanded && controls}
          </section>
        )}

        <aside ref={infoRef} className={styles.gameInfoAside}>
          <section>
            {game.features?.length > 0 ? (
              <>
                <div className={styles.sectionHeader}>
                  <h2>Details</h2>
                  <DisclosureButton label={features.open ? 'Hide features' : 'Show features'} {...features.buttonProps} />
                </div>
                <p>{game.description}</p>
                <Collapsible className={styles.gameFeatures} {...features.panelProps}>
                  <h2>Features</h2>
                  <ul>
                    {game.features.map((feature) => (
                      <li key={feature}>{feature}</li>
                    ))}
                  </ul>
                  {credits}
                </Collapsible>
              </>
              ) : (
              <>
                <h2>Description</h2>
                <p>{game.description}</p>
                {credits}
              </>
            )}
          </section>

          <RateGame game={game} stats={stats} />

          {!showControlsExpanded && controls}

          {/* Optional sections: only shown when the catalogue entry has them */}
          {game.style && (
            <section>
              <h2>Style</h2>
              <div className={styles.styleToggle}>
                <Button
                  variant="dashed"
                  shape="rounded"
                  block
                  onMouseEnter={() => setShowStyle(true)}
                  onMouseLeave={() => setShowStyle(false)}
                  onFocus={() => setShowStyle(true)}
                  onBlur={() => setShowStyle(false)}
                  aria-expanded={showStyle}
                >
                  View style details
                </Button>
                <Popover open={showStyle} className={styles.stylePopup}>
                  <p>{game.style}</p>
                </Popover>
              </div>
            </section>
          )}

          <section>
            <h2>Tags</h2>
            {/* A new game, new picks */}
            <GameTags key={game.id} game={game} />
          </section>

          {(embedUrl || sourceLinks.length > 0) && (
            <section className={styles.gameLinks}>
              {embedUrl && (
                <Button href={embedUrl} size="lg" icon={WebIcon} arrow>
                  Play Directly
                </Button>
              )}
              {sourceLinks.map(({ url, label, Icon }) => (
                <Button key={url} href={url} variant="outline" size="lg" icon={Icon} arrow>
                  {label ?? 'View Source Code'}
                </Button>
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
