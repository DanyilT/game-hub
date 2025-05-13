import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import './GameCard.css';

const GameCard = ({ key, game, onTagClick, selectedTags }) => {
  const [showInfo, setShowInfo] = useState(false);
  const cardRef = useRef(null);
  const imageUrl = game.imageUrl || game.imagePath;
  const gameUrl = `./${game.id}`; // Create URL for the game page using the game's ID

  const handleInfoClick = (e) => {
    // Only hide if clicking the info container background
    if (e.target === e.currentTarget) {
      setShowInfo(false);
    }
  };

  const handleTagClick = (e, tag) => {
    e.preventDefault();
    e.stopPropagation();
    onTagClick(tag);
  };

  return (
    <div 
      ref={cardRef}
      className="game-card"
      onMouseLeave={() => {
        setShowInfo(false);
      }}
    >
      <div className="game-image-container">
        <img src={imageUrl} alt={game.title} className="game-image" />
      </div>
      <div className="game-overlay">
        <div className="game-header">
          <h3>{game.title}</h3>
          <div className="game-tags">
            {game.tags.map(tag => (
              <button
                key={tag}
                className={`game-tag ${selectedTags?.includes(tag) ? 'active' : ''}`}
                onClick={(e) => handleTagClick(e, tag)}
                title={`Tag: ${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="game-actions">
          <button 
            className="action-button info"
            onClick={(e) => {
              e.stopPropagation();
              setShowInfo(!showInfo);
            }}
            title="Game Info"
          >
            ℹ️
          </button>
          <Link to={gameUrl} className="action-button play" title="Play in Hub">
            ▶️
          </Link>
          <a 
            href={game.playLink} 
            className="action-button direct" 
            target="_blank" 
            rel="noopener noreferrer"
            title="Play Directly"
          >
            🎮
          </a>
          <a 
            href={game.repoLink} 
            className="action-button code" 
            target="_blank" 
            rel="noopener noreferrer"
            title="View Code"
          >
            🫣
          </a>
        </div>
      </div>
      <div 
        className={`game-info ${showInfo ? 'show' : ''}`}
        onClick={handleInfoClick}
      >
        <div className="info-content">
          <h3>{game.title}</h3>
          <div className="game-meta-tags">
            <button
                className={`game-tag difficulty ${selectedTags?.includes(game.difficulty) ? 'active' : ''}`}
                data-difficulty={game.difficulty}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick(game.difficulty);
                }}
                title={`Difficulty: ${game.difficulty}`}
            >
              {game.difficulty}
            </button>

            {Array.isArray(game.genre)
                ? game.genre.map((genre, index) => (
                    <button
                        key={index}
                        className={`game-tag genre ${selectedTags?.includes(genre) ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onTagClick(genre);
                        }}
                        title={`Genre: ${genre}`}
                    >
                      {genre}
                    </button>
                ))
                : <button
                    className={`game-tag genre ${selectedTags?.includes(game.genre) ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagClick(game.genre);
                    }}
                    title={`Genre: ${game.genre}`}
                >
                  {game.genre}
                </button>
            }
          </div>
          <div className="detail-item about">
            <p>{game.about}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameCard;
