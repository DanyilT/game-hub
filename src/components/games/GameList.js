import React, {useState, useMemo, useEffect} from 'react';
import GameCard from './GameCard';
import './GameList.css';

const GameList = ({ games }) => {
  const [selectedTags, setSelectedTags] = useState([]);
  const [showOnlyGenres, setShowOnlyGenres] = useState(false);
  const [showOnlyDifficulties, setShowOnlyDifficulties] = useState(false);
  const [showOnlyOtherTags, setShowOnlyOtherTags] = useState(false);

  // Get all unique tags, genres, and difficulties from games
  const { allTags, allGenres, allDifficulties, allOtherTags } = useMemo(() => {
    const tags = new Set();
    const genres = new Set();
    const difficulties = new Set();
    const others = new Set();

    games.forEach(game => {
      // Get difficulty
      difficulties.add(game.difficulty);
      tags.add(game.difficulty);

      // Get genre(s)
      if (Array.isArray(game.genre)) {
        game.genre.forEach(g => {
          genres.add(g);
          tags.add(g);
        });
      } else if (game.genre) {
        genres.add(game.genre);
        tags.add(game.genre);
      }

      // Get all tags
      game.tags.forEach(tag => tags.add(tag));
    });

    // Other tags are those not in difficulties or genres
    tags.forEach(tag => {
      if (!Array.from(difficulties).includes(tag) &&
          !Array.from(genres).includes(tag)) {
        others.add(tag);
      }
    });

    return {
      allTags: Array.from(tags).sort(),
      allGenres: Array.from(genres).sort(),
      allDifficulties: Array.from(difficulties).sort(),
      allOtherTags: Array.from(others).sort()
    };
  }, [games]);

  // Filter games based on selected tags
  const filteredGames = useMemo(() => {
    if (selectedTags.length === 0) return games;
    return games.filter(game => {
      // Check tags
      const hasSelectedTags = selectedTags.every(tag => game.tags.includes(tag));

      // Check difficulties
      const hasDifficulty = selectedTags.every(tag =>
        game.difficulty === tag || game.tags.includes(tag)
      );

      // Check genres
      const hasGenre = selectedTags.every(tag => {
        if (Array.isArray(game.genre)) {
          return game.genre.includes(tag) || game.tags.includes(tag);
        }
        return game.genre === tag || game.tags.includes(tag);
      });

      return hasSelectedTags || hasDifficulty || hasGenre;
    });
  }, [games, selectedTags]);

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedTags([]);
    setShowOnlyGenres(false);
    setShowOnlyDifficulties(false);
    setShowOnlyOtherTags(false);
  };

  const toggleGenreFilter = () => {
    setShowOnlyGenres(!showOnlyGenres);
    setShowOnlyDifficulties(false);
    setShowOnlyOtherTags(false);
    // setSelectedTags([]);
  };

  const toggleDifficultyFilter = () => {
    setShowOnlyDifficulties(!showOnlyDifficulties);
    setShowOnlyGenres(false);
    setShowOnlyOtherTags(false);
    // setSelectedTags([]);
  };

  const toggleOtherTagsFilter = () => {
    setShowOnlyOtherTags(!showOnlyOtherTags);
    setShowOnlyGenres(false);
    setShowOnlyDifficulties(false);
    // setSelectedTags([]);
  };

  useEffect(() => {
    const cards = document.querySelectorAll('.games-grid .game-card');
    const baseDelay = 0.1; // seconds
    const cardAnimDuration = 0.7; // seconds - duration of card drop animation
    const maxDelay = 1.5; // cap maximum delay for many cards

    cards.forEach((card, index) => {
      // Calculate delay with a cap
      const delay = Math.min(baseDelay * (index + 1), maxDelay);
      card.style.animationDelay = `${delay}s`;

      // Image animation starts after card animation completes
      const image = card.querySelector('.game-image');
      if (image) {
        image.style.animationDelay = `${delay + cardAnimDuration - 0.2}s`;
      }
    });
  }, [filteredGames]);

  // Determine which tags to display based on active filter
  let displayTags = allTags;
  if (showOnlyGenres) displayTags = allGenres;
  else if (showOnlyDifficulties) displayTags = allDifficulties;
  else if (showOnlyOtherTags) displayTags = allOtherTags;

  return (
    <div className="games-page">
      <div className="games-filters">
        <div className="filters-header">
          <div className="filters-title">
            <h3>Filter Games</h3>
            <div className="types-filter">
              <button
                  className={`filter-type-button ${showOnlyGenres ? 'active' : ''}`}
                  onClick={toggleGenreFilter}
              >
                Genres
              </button>
              <button
                  className={`filter-type-button ${showOnlyDifficulties ? 'active' : ''}`}
                  onClick={toggleDifficultyFilter}
              >
                Difficulty
              </button>
              <button
                  className={`filter-type-button ${showOnlyOtherTags ? 'active' : ''}`}
                  onClick={toggleOtherTagsFilter}
              >
                Other
              </button>
            </div>
          </div>
          {selectedTags.length > 0 && (
            <button className="clear-filters" onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>

        <div className="tags-filter-container">
          <div className="tags-filter">
            {displayTags.map(tag => (
              <button
                key={tag}
                className={`filter-tag ${selectedTags.includes(tag) ? 'active' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="games-grid">
        {filteredGames.length > 0 ? (
          filteredGames.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onTagClick={toggleTag}
              selectedTags={selectedTags}
            />
          ))
        ) : (
          <div className="no-games">
            <p>No games found with the selected filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameList;

