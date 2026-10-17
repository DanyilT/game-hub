import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CiCircleRemove, CiFilter } from 'react-icons/ci';
import { CgChevronDown } from 'react-icons/cg';
import { PiBookmarkSimple, PiBookmarkSimpleFill, PiHeart, PiHeartFill } from 'react-icons/pi';
import { useAuth } from '../../../../contexts/AuthContext';
import { useLibrary } from '../../../../contexts/LibraryContext';
import Badge from '../../../common/Badge/Badge';
import Button from '../../../common/Button/Button';
import Tag from '../../../common/Tag/Tag';
import GameCard from '../GameCard/GameCard';
import { TAG_PARAM, getPlatformTypes } from '../../../../data/games';
import styles from './GameList.module.scss';

// Filter groups: each narrows the chips to one kind of tag
const FILTER_GROUPS = [
  { key: 'genres', label: 'Genres' },
  { key: 'difficulties', label: 'Difficulty' },
  { key: 'platforms', label: 'Platform' },
  { key: 'tags', label: 'Tags' },
];
const MAX_CHIP_ROWS = 3;

// The signed-in player's own lists, beside the filter box (in the address too: /?only=favorites&only=bookmarks). The
// same buttons as the game page's (GameReactions): the heart, then the bookmark.
const LIST_PARAM = 'only';
const LISTS = [
  { key: 'favorites', name: 'favorites', tone: 'secondary', icon: PiHeart, pressedIcon: PiHeartFill },
  { key: 'bookmarks', name: 'bookmarks', tone: 'accent', icon: PiBookmarkSimple, pressedIcon: PiBookmarkSimpleFill },
];

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;
const sorted = (values) => [...values].sort();

// A chip matches a game's tags, genres, difficulty or platforms
const matchesTag = (game, tag) =>
  game.tags.includes(tag) || game.genre.includes(tag) || game.difficulty === tag || getPlatformTypes(game).includes(tag);

/**
 * Keeps the chips to MAX_CHIP_ROWS rows. They wrap inside the box when that's enough; otherwise
 * the rows get the narrowest width that fits them in MAX_CHIP_ROWS rows, and the box scrolls sideways.
 * @param {string[]} chips - the chips on show (laid out again when they change)
 * @return {object} - ref for the scrolling box (its first child holds the chips)
 */
const useChipRows = (chips) => {
  const boxRef = useRef(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const rows = box.firstElementChild;
    const rowCount = () => new Set([...rows.children].map((chip) => chip.offsetTop)).size;
    const layOut = () => {
      rows.style.width = '';
      if (rowCount() <= MAX_CHIP_ROWS) return;
      // Binary search between the box (too many rows) and one long row
      let tooNarrow = box.clientWidth;
      let wideEnough = rows.scrollWidth + [...rows.children].reduce((sum, chip) => sum + chip.offsetWidth, 0);
      while (wideEnough - tooNarrow > 1) {
        const width = Math.floor((tooNarrow + wideEnough) / 2);
        rows.style.width = `${width}px`;
        if (rowCount() <= MAX_CHIP_ROWS) wideEnough = width;
        else tooNarrow = width;
      }
      rows.style.width = `${wideEnough}px`;
    };
    layOut();
    // The box changes size with the window and sidebar, the chips when the web font arrives: laid out again on
    // the next frame, after the ResizeObserver round (doing it inside one resizes what it's still observing)
    let frame = null;
    const observer = new ResizeObserver(() => {
      if (frame === null) frame = requestAnimationFrame(() => {
        frame = null;
        layOut();
      });
    });
    observer.observe(box);
    observer.observe(rows);
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [chips]);

  return boxRef;
};

// A length from a custom property ('0.5rem', '8px') in px
const cssLength = (element, name) => {
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return value.endsWith('rem') ? parseFloat(value) * rem : parseFloat(value) || 0;
};

// How wide the games grid's columns are, all together (empty ones too: it's auto-fill), or null before it's laid out
const gridWidth = (grid) => {
  const style = getComputedStyle(grid);
  const tracks = style.gridTemplateColumns.split(' ').map(parseFloat).filter((width) => width > 0);
  if (tracks.length === 0) return null;
  return tracks.reduce((sum, width) => sum + width, 0) + (parseFloat(style.columnGap) || 0) * (tracks.length - 1);
};

// From the left of the first child to the right of the last: the toggle's icon, "Filter games", its badge and ▼
const contentWidth = (element) => {
  const children = [...element.children];
  if (children.length === 0) return 0;
  return children.at(-1).getBoundingClientRect().right - children[0].getBoundingClientRect().left;
};

const SAME_LAYOUT = ['place', 'inset', 'startRoom', 'endRoom', 'centered'];

/**
 * Where the favorites and bookmarks buttons go, and how much of the bar they (and Clear) take, so "Filter games" is
 * never under them:
 * - 'panel': the box is open, so beside its group buttons, under Clear;
 * - 'outside': closed, with room on its right: there, level with the games grid's right edge;
 * - 'bar': closed, in its bar, both at the right, when "Filter games" can still be in the middle;
 * - 'split': closed, in its bar, one at each side ("Filter games" in the middle if it fits, else between them);
 * - 'none': closed, and no buttons (a site without accounts).
 * Worked out from sizes before anything is drawn, and again when the list or what's in the bar changes size.
 * @param {object} refs - { toolbarRef, sectionRef, toggleRef, gridRef }
 * @param {object} state - { open, clearShown, listsShown, badge }: badge, the toggle's count (it changes the toggle's width)
 * @return {{place: string, inset: number, startRoom: number, endRoom: number, centered: boolean}}
 */
const useListsPlace = ({ toolbarRef, sectionRef, toggleRef, gridRef }, { open, clearShown, listsShown, badge }) => {
  const [layout, setLayout] = useState({ place: 'bar', inset: 0, startRoom: 0, endRoom: 0, centered: true });

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const measure = () => {
      const gap = cssLength(toolbar, '--lists-gap');
      const edge = cssLength(toolbar, '--lists-edge');
      const button = listsShown ? cssLength(toolbar, '--list-size-bar') : 0; // in the bar
      const both = listsShown ? 2 * button + gap : 0;
      const bothBeside = listsShown ? 2 * cssLength(toolbar, '--list-size') + gap : 0; // outside
      const clear = clearShown ? toolbar.querySelector('[data-clear]')?.offsetWidth ?? 0 : 0;
      const clearRoom = clear ? clear + edge : 0;
      const grid = gridWidth(gridRef.current) ?? toolbar.clientWidth;
      const box = Math.min(toolbar.clientWidth, cssLength(sectionRef.current, '--closed-width'));
      const fitsCentered = (start, end) => contentWidth(toggleRef.current) + 2 * Math.max(start, end) <= box - 2; // its border

      let next = { place: open ? 'panel' : 'none', startRoom: 0, endRoom: clearRoom };
      if (!open && listsShown) {
        const clearBeside = clear ? clear + gap : 0;
        if ((grid - box) / 2 >= bothBeside + edge) next = { place: 'outside', startRoom: 0, endRoom: clearRoom };
        else if (fitsCentered(0, clearBeside + both + edge)) next = { place: 'bar', startRoom: 0, endRoom: clearBeside + both + edge };
        else next = { place: 'split', startRoom: button + edge, endRoom: clearBeside + button + edge };
      }
      next.centered = !open && fitsCentered(next.startRoom, next.endRoom);
      next.inset = Math.max(0, (toolbar.clientWidth - grid) / 2);
      setLayout((previous) => (SAME_LAYOUT.every((key) => previous[key] === next[key]) ? previous : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    observer.observe(toggleRef.current);
    document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [toolbarRef, sectionRef, toggleRef, gridRef, open, clearShown, listsShown, badge]);

  return layout;
};

/**
 * The games grid, with a filter box (a small toggle until opened), the player's favorites and bookmarks beside it, and a
 * count of what's shown.
 * @param {object[]} games - catalogue entries (src/data/games.json)
 */
const GameList = ({ games }) => {
  const { isAvailable, user, openSignIn } = useAuth();
  const library = useLibrary();
  // The chips picked, from the address (/?tag=easy&tag=action: data/games.js), so a reload keeps them
  const [searchParams, setSearchParams] = useSearchParams();
  const tagParams = searchParams.getAll(TAG_PARAM).join('\n'); // the same list stays the same array
  const selectedTags = useMemo(() => (tagParams ? [...new Set(tagParams.split('\n'))] : []), [tagParams]);
  // The player's lists picked (only signed in: signed out, they have none)
  const listParams = searchParams.getAll(LIST_PARAM);
  const selectedLists = user ? LISTS.filter(({ key }) => listParams.includes(key)).map(({ key }) => key) : [];
  // Open from the start when the address picks some, to show which
  const [filtersOpen, setFiltersOpen] = useState(selectedTags.length > 0);
  const [openCount, setOpenCount] = useState(0); // the chips shoot in again on every opening
  const [filterGroup, setFilterGroup] = useState(null); // a FILTER_GROUPS key, or null for every chip

  // Chips for each group, from what's in the catalogue
  const chipGroups = useMemo(() => {
    const genres = new Set();
    const difficulties = new Set();
    const platforms = new Set();
    const tags = new Set();
    games.forEach((game) => {
      game.genre.forEach((genre) => genres.add(genre));
      if (game.difficulty) difficulties.add(game.difficulty);
      getPlatformTypes(game).forEach((platform) => platforms.add(platform));
      game.tags.forEach((tag) => tags.add(tag));
    });
    const grouped = new Set([...genres, ...difficulties, ...platforms]);
    return {
      all: sorted(new Set([...grouped, ...tags])),
      genres: sorted(genres),
      difficulties: sorted(difficulties),
      platforms: sorted(platforms),
      tags: sorted([...tags].filter((tag) => !grouped.has(tag))),
    };
  }, [games]);

  const chips = chipGroups[filterGroup ?? 'all'];
  const chipsBoxRef = useChipRows(chips);

  // Every selected chip has to match (so "easy" + "action" finds Snake), and every list picked
  const shownGames = games.filter((game) => selectedTags.every((tag) => matchesTag(game, tag))
    && selectedLists.every((list) => library[list].has(game.id)));
  const filtered = selectedTags.length > 0 || selectedLists.length > 0;

  // Picking a chip or a list changes the address in place: no new history entry, and the page stays where it is
  const setSelected = (param, values) => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete(param);
      values.forEach((value) => next.append(param, value));
      return next;
    }, { replace: true, state: { keepScroll: true } });
  };

  const toggleTag = (tag) => {
    setSelected(TAG_PARAM, selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]);
  };

  // Signed out, there's nothing to show yet: the sign-in window instead
  const toggleList = (list) => {
    if (!user) {
      openSignIn();
      return;
    }
    setSelected(LIST_PARAM, selectedLists.includes(list) ? selectedLists.filter((l) => l !== list) : [...selectedLists, list]);
  };

  const clearFilters = () => {
    setSearchParams((params) => {
      const next = new URLSearchParams(params);
      next.delete(TAG_PARAM);
      next.delete(LIST_PARAM);
      return next;
    }, { replace: true, state: { keepScroll: true } });
    setFilterGroup(null);
  };

  const toolbarRef = useRef(null);
  const sectionRef = useRef(null);
  const toggleRef = useRef(null);
  const gridRef = useRef(null);
  const listsShown = isAvailable;
  const layout = useListsPlace(
    { toolbarRef, sectionRef, toggleRef, gridRef },
    { open: filtersOpen, clearShown: filtered, listsShown, badge: selectedTags.length },
  );
  const { inset, startRoom, endRoom, centered } = layout;
  const place = listsShown ? layout.place : 'none';

  const listButton = ({ key, name, tone, icon, pressedIcon }) => {
    const pressed = selectedLists.includes(key);
    return (
      <Button
        key={key}
        variant="soft"
        tone={tone}
        shape="round"
        icon={pressed ? pressedIcon : icon}
        className={styles.listButton}
        aria-pressed={pressed}
        label={`Your ${name} only`}
        title={user ? `${pressed ? 'Showing' : 'Show'} only your ${name}` : `Sign in to see your ${name}`}
        onClick={() => toggleList(key)}
      />
    );
  };
  const [favoritesButton, bookmarksButton] = LISTS.map(listButton);
  const bothLists = <div className={styles.lists} role="group" aria-label="Your games">{favoritesButton}{bookmarksButton}</div>;

  const gameCount = games.filter((game) => game.kind === 'game').length;
  const collectionCount = games.filter((game) => game.kind === 'portal').length;
  const countText = filtered
    ? `${shownGames.length} of ${games.length} shown`
    : `${plural(gameCount, 'game')}${collectionCount > 0 ? ` + ${plural(collectionCount, 'collection')}` : ''} available`;

  // Nothing in a list picked yet: say how to add some (once the lists have loaded)
  const emptyLists = selectedLists.filter((list) => library.loaded && library[list].size === 0);
  const nothingShown = shownGames.length === 0 && (selectedLists.length === 0 || library.loaded);

  return (
    <div className={styles.gameList}>
      <div ref={toolbarRef} className={styles.toolbar} style={{ '--grid-inset': `${inset}px` }}>
        <section
          ref={sectionRef}
          className={[styles.filters, filtersOpen && styles.open, filtered && styles.picked].filter(Boolean).join(' ')}
          aria-label="Filters"
        >
          {/* The toggle fills the header row, so clicking anywhere on it opens or closes the box. What's at its sides
              (Clear, and on narrow screens the lists) sits over it, and it keeps "Filter games" clear of them. */}
          <div
            className={[styles.filtersBar, centered && styles.centered].filter(Boolean).join(' ')}
            style={{ '--start-room': `${startRoom}px`, '--end-room': `${endRoom}px` }}
          >
            <Button
              ref={toggleRef}
              variant="ghost"
              tone="neutral"
              size="lg"
              icon={CiFilter}
              className={styles.filtersToggle}
              onClick={() => {
                if (!filtersOpen) setOpenCount((count) => count + 1);
                setFiltersOpen(!filtersOpen);
              }}
              aria-expanded={filtersOpen}
              aria-controls="game-filters"
            >
              <span className={styles.toggleLabel}>Filter games</span>
              {selectedTags.length > 0 && (
                <Badge>{selectedTags.length}<span className="visually-hidden"> selected</span></Badge>
              )}
              <CgChevronDown className={styles.chevron} aria-hidden="true" />
            </Button>
            {place === 'split' && <div className={styles.barStart}>{favoritesButton}</div>}
            <div className={styles.barEnd}>
              {/* Clears without having to open the box */}
              {filtered && (
                <Button
                  data-clear
                  variant="outline"
                  shape="round"
                  size="sm"
                  font="secondary"
                  icon={CiCircleRemove}
                  label="Clear all filters"
                  title="Clear all filters"
                  className={styles.clearButton}
                  onClick={clearFilters}
                >
                  <span className={styles.clearText}>Clear</span>
                </Button>
              )}
              {place === 'bar' && bothLists}
              {place === 'split' && bookmarksButton}
            </div>
          </div>

          <div id="game-filters" className={styles.filtersPanel}>
            <div className={styles.panelContent}>
              <div className={styles.panelTop}>
                <div className={styles.groupButtons} role="group" aria-label="Show tags for">
                  {FILTER_GROUPS.map(({ key, label }) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      font="secondary"
                      shape="rounded"
                      onClick={() => setFilterGroup((current) => (current === key ? null : key))}
                      aria-pressed={filterGroup === key}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {place === 'panel' && bothLists}
              </div>

              <div ref={chipsBoxRef} className={styles.chipsBox}>
                <div className={styles.chips}>
                  {/* New keys whenever the box opens or the group changes, so the chips shoot in again
                      (not when one is picked). The row itself stays: useChipRows keeps measuring it. */}
                  {chips.map((tag, index) => (
                    <Tag
                      key={`${openCount}:${filterGroup ?? 'all'}:${tag}`}
                      style={{ '--chip-index': index }}
                      className={styles.chip}
                      selected={selectedTags.includes(tag)}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        {place === 'outside' && <div className={styles.outside}>{bothLists}</div>}
      </div>

      <p className={styles.count} role="status">{countText}</p>

      <div ref={gridRef} className={styles.gamesGrid}>
        {shownGames.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} onTagClick={toggleTag} selectedTags={selectedTags} />
        ))}
        {nothingShown && (
          <div className={styles.noGamesFound}>
            <p>No games match the selected filters.</p>
            {emptyLists.map((list) => (
              <p key={list} className={styles.emptyList}>
                {list === 'favorites'
                  ? 'You have no favorites yet: the heart on a game’s page adds one.'
                  : 'You have no bookmarks yet: the bookmark on a game’s page keeps one to play later.'}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameList;
