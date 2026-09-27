import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CiCircleRemove, CiFilter } from 'react-icons/ci';
import { CgChevronDown } from 'react-icons/cg';
import GameCard from '../GameCard/GameCard';
import { getPlatformTypes } from '../../../../data/games';
import styles from './GameList.module.scss';

// Filter groups: each narrows the chips to one kind of tag
const FILTER_GROUPS = [
  { key: 'genres', label: 'Genres' },
  { key: 'difficulties', label: 'Difficulty' },
  { key: 'platforms', label: 'Platform' },
  { key: 'tags', label: 'Tags' },
];
const MAX_CHIP_ROWS = 3;

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
    // The box changes size with the window and sidebar, the chips when the web font arrives
    const observer = new ResizeObserver(layOut);
    observer.observe(box);
    observer.observe(rows);
    return () => observer.disconnect();
  }, [chips]);

  return boxRef;
};

/**
 * The games grid, with a filter box (a small toggle until opened) and a count of what's shown.
 * @param {object[]} games - catalogue entries (src/data/games.json)
 */
const GameList = ({ games }) => {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [openCount, setOpenCount] = useState(0); // the chips shoot in again on every opening
  const [filterGroup, setFilterGroup] = useState(null); // a FILTER_GROUPS key, or null for every chip
  const [selectedTags, setSelectedTags] = useState([]);

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

  // Every selected chip has to match (so "easy" + "action" finds Snake)
  const shownGames = useMemo(
    () => games.filter((game) => selectedTags.every((tag) => matchesTag(game, tag))),
    [games, selectedTags],
  );

  const toggleTag = (tag) => {
    setSelectedTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setFilterGroup(null);
  };

  const gameCount = games.filter((game) => game.kind === 'game').length;
  const collectionCount = games.filter((game) => game.kind === 'portal').length;
  const countText = selectedTags.length > 0
    ? `${shownGames.length} of ${games.length} shown`
    : `${plural(gameCount, 'game')}${collectionCount > 0 ? ` + ${plural(collectionCount, 'collection')}` : ''} available`;

  return (
    <div className={styles.gameList}>
      <section className={`${styles.filters} ${filtersOpen ? styles.open : ''}`} aria-label="Filters">
        {/* The toggle fills the header row, so clicking anywhere on it opens or closes the box */}
        <div className={styles.filtersBar}>
          <button
            type="button"
            className={styles.filtersToggle}
            onClick={() => {
              if (!filtersOpen) setOpenCount((count) => count + 1);
              setFiltersOpen(!filtersOpen);
            }}
            aria-expanded={filtersOpen}
            aria-controls="game-filters"
          >
            <CiFilter aria-hidden="true" />
            <span className={styles.toggleLabel}>Filter games</span>
            {selectedTags.length > 0 && (
              <span className={styles.selectedCount}>
                {selectedTags.length}<span className="visually-hidden"> selected</span>
              </span>
            )}
            <CgChevronDown className={styles.chevron} aria-hidden="true" />
          </button>
          {/* Clears without having to open the box */}
          {selectedTags.length > 0 && (
            <button
              type="button"
              className={styles.clearButton}
              onClick={clearFilters}
              aria-label="Clear all filters"
              title="Clear all filters"
            >
              <CiCircleRemove aria-hidden="true" />
              <span className={styles.clearText}>Clear</span>
            </button>
          )}
        </div>

        <div id="game-filters" className={styles.filtersPanel}>
          <div className={styles.panelContent}>
            <div className={styles.groupButtons} role="group" aria-label="Show tags for">
              {FILTER_GROUPS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.groupButton} ${filterGroup === key ? styles.active : ''}`}
                  onClick={() => setFilterGroup((current) => (current === key ? null : key))}
                  aria-pressed={filterGroup === key}
                >
                  {label}
                </button>
              ))}
            </div>

            <div ref={chipsBoxRef} className={styles.chipsBox}>
              <div className={styles.chips}>
                {/* New keys whenever the box opens or the group changes, so the chips shoot in again
                    (not when one is picked). The row itself stays: useChipRows keeps measuring it. */}
                {chips.map((tag, index) => (
                  <button
                    key={`${openCount}:${filterGroup ?? 'all'}:${tag}`}
                    type="button"
                    style={{ '--chip-index': index }}
                    className={`${styles.chip} ${selectedTags.includes(tag) ? styles.active : ''}`}
                    onClick={() => toggleTag(tag)}
                    aria-pressed={selectedTags.includes(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <p className={styles.count} role="status">{countText}</p>

      <div className={styles.gamesGrid}>
        {shownGames.map((game, index) => (
          <GameCard key={game.id} game={game} index={index} onTagClick={toggleTag} selectedTags={selectedTags} />
        ))}
        {shownGames.length === 0 && (
          <div className={styles.noGamesFound}>
            <p>No games match the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameList;
