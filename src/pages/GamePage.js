import React, {useState, useEffect, useRef} from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { games } from '../data/games';
import './GamePage.css';

const GamePage = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();

  const [game, setGame] = useState(null);
  const [showAbout, setShowAbout] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const iframeRef = useRef(null);
  const gameFrameContainerRef = useRef(null);
  const infoAsideRef = useRef(null);
  const [sizeMode, setSizeMode] = useState('default');
  const [resizeEnabled, setResizeEnabled] = useState(false);
  const [customHeight, setCustomHeight] = useState(null);
  const [customWidth, setCustomWidth] = useState(null);

  const bottomResizeRef = useRef(null);
  const rightResizeRef = useRef(null);
  const cornerResizeRef = useRef(null);

  useEffect(() => {
    const foundGame = games.find(g => g.id === gameId);

    if (foundGame) {
      setGame(foundGame);
    } else {
      // If game not found, redirect to home
      navigate('/');
    }
  }, [gameId, navigate]);

  useEffect(() => {
    if (!gameFrameContainerRef.current || !infoAsideRef.current) return;

    const container = gameFrameContainerRef.current;

    // Reset to default first
    container.style.width = '100%';
    container.style.height = '';
    container.style.aspectRatio = '16/9';
    document.body.classList.remove('game-full-width');

    if (sizeMode === 'info-height') {
      // Match height with info aside but keep width
      const currentWidth = container.offsetWidth;
      const infoHeight = infoAsideRef.current.offsetHeight;
      container.style.aspectRatio = '';
      container.style.width = `${currentWidth}px`;
      container.style.height = `${infoHeight}px`;
    } else if (sizeMode === 'full-width') {
      // Full width and keep 16:9 ratio
      document.body.classList.add('game-full-width');
    } else if (sizeMode === 'custom' && (customHeight || customWidth)) {
      container.style.aspectRatio = '';
      if (customHeight) container.style.height = `${customHeight}px`;
      if (customWidth) container.style.width = `${customWidth}px`;
    }
  }, [sizeMode, customHeight, customWidth]);

  // Handle resize functionality
  useEffect(() => {
    if (!resizeEnabled) return;

    const handleBottomResize = (e) => {
      const startY = e.clientY;
      const startHeight = gameFrameContainerRef.current.offsetHeight;

      const performResize = (moveEvent) => {
        const newHeight = startHeight + (moveEvent.clientY - startY);
        if (newHeight > 200) {
          setCustomHeight(newHeight);
          setSizeMode('custom');
        }
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', performResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', performResize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleRightResize = (e) => {
      const startX = e.clientX;
      const startWidth = gameFrameContainerRef.current.offsetWidth;

      const performResize = (moveEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        if (newWidth > 200) {
          setCustomWidth(newWidth);
          setSizeMode('custom');
        }
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', performResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', performResize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    const handleCornerResize = (e) => {
      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = gameFrameContainerRef.current.offsetWidth;
      const startHeight = gameFrameContainerRef.current.offsetHeight;

      const performResize = (moveEvent) => {
        const newWidth = startWidth + (moveEvent.clientX - startX);
        const newHeight = startHeight + (moveEvent.clientY - startY);

        if (newWidth > 200 && newHeight > 200) {
          setCustomWidth(newWidth);
          setCustomHeight(newHeight);
          setSizeMode('custom');
        }
      };

      const stopResize = () => {
        document.removeEventListener('mousemove', performResize);
        document.removeEventListener('mouseup', stopResize);
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', performResize);
      document.addEventListener('mouseup', stopResize);
      document.body.style.userSelect = 'none';
      e.preventDefault();
    };

    // Add event listeners
    if (bottomResizeRef.current) {
      bottomResizeRef.current.addEventListener('mousedown', handleBottomResize);
    }

    if (rightResizeRef.current) {
      rightResizeRef.current.addEventListener('mousedown', handleRightResize);
    }

    if (cornerResizeRef.current) {
      cornerResizeRef.current.addEventListener('mousedown', handleCornerResize);
    }

    // Cleanup
    return () => {
      if (bottomResizeRef.current) {
        bottomResizeRef.current.removeEventListener('mousedown', handleBottomResize);
      }

      if (rightResizeRef.current) {
        rightResizeRef.current.removeEventListener('mousedown', handleRightResize);
      }

      if (cornerResizeRef.current) {
        cornerResizeRef.current.removeEventListener('mousedown', handleCornerResize);
      }
    };
  }, [resizeEnabled]);

  const toggleResizeMode = () => {
    setResizeEnabled(prev => !prev);
  };

  const enterFullscreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      } else if (iframeRef.current.webkitRequestFullscreen) {
        iframeRef.current.webkitRequestFullscreen();
      } else if (iframeRef.current.msRequestFullscreen) {
        iframeRef.current.msRequestFullscreen();
      }
    }
  };

  if (!game) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="game-page">
      <div className="game-header">
        <button className="back-button" onClick={() => navigate('/games')}>
          &larr; Back to Games
        </button>
        <h2>{game.title}</h2>
        <div className="game-meta">
          <span className="game-genre" title="Genre">{Array.isArray(game.genre) ? game.genre.join(', ') : game.genre}</span>
          <span className={`game-difficulty ${game.difficulty}`} title="Difficulty">{game.difficulty}</span>
          <span className="game-rating" title="Rating">★ {game.rating}</span>
        </div>
      </div>

      <div className="game-content">
        <section className="game-frame-section">
          <div
            ref={gameFrameContainerRef}
            className={`game-frame-container ${resizeEnabled ? 'resizable' : ''}`}
          >
            <iframe
              ref={iframeRef}
              src={game.playLink}
              title={game.title}
              className="game-frame"
              allowFullScreen
            />

            {resizeEnabled && (
                <>
                  <div className="resize-handle bottom" ref={bottomResizeRef}>
                    <div className="handle-bar"></div>
                  </div>
                  <div className="resize-handle right" ref={rightResizeRef}>
                    <div className="handle-bar vertical"></div>
                  </div>
                  <div className="resize-handle corner" ref={cornerResizeRef}></div>
                </>
            )}
          </div>
          <div className="game-frame-actions">
            <div className="resize-controls">
                <button
                    className={`resize-toggle ${resizeEnabled ? 'active' : ''}`}
                    onClick={toggleResizeMode}
                >
                  {resizeEnabled ? 'Disable Resize' : 'Enable Resize'}
                </button>

                {resizeEnabled && (
                    <div className="size-controls">
                    <button
                      className={`size-button ${sizeMode === 'default' ? 'active' : ''}`}
                      onClick={() => setSizeMode('default')}
                      title="Default Size"
                    >
                      Default
                    </button>
                    <button
                      className={`size-button ${sizeMode === 'info-height' ? 'active' : ''}`}
                      onClick={() => setSizeMode('info-height')}
                      title="↕️"
                    >
                      Match Info Height
                    </button>
                    <button
                      className={`size-button ${sizeMode === 'full-width' ? 'active' : ''}`}
                      onClick={() => setSizeMode('full-width')}
                      title="↔️"
                    >
                      Full Width
                    </button>
                  </div>
                )}
            </div>
            <button className="fullscreen-button" onClick={enterFullscreen} title="Enter Fullscreen">
              Fullscreen
            </button>
          </div>
        </section>

        <aside className="game-info-aside" ref={infoAsideRef}>
          <section className="game-description">
            <h3>Description</h3>
            <p>{game.description}</p>

            <div className="info-toggle">
              <button
                className="info-button"
                onMouseEnter={() => setShowAbout(true)}
                onMouseLeave={() => setShowAbout(false)}
                aria-label="Show About Information"
              >
                ℹ
              </button>
              {showAbout && (
                <div className="info-popup">
                  <h4>About</h4>
                  <p>{game.about}</p>
                </div>
              )}
            </div>
          </section>

          <section className="game-controls">
            <h3>Controls</h3>
            <p>{game.controls}</p>
          </section>

          <section className="game-style-section">
            <h3>Style</h3>
            <div style={{ position: 'relative' }}>
              <button
                  className="style-button"
                  onMouseEnter={() => setShowStyle(true)}
                  onMouseLeave={() => setShowStyle(false)}
              >
                Hover to view style details
              </button>
              {showStyle && (
                  <div className="style-popup">
                    <p>{typeof game.style === 'string' ? game.style : 'Modern game design'}</p>
                  </div>
              )}
            </div>
          </section>

          <section className="game-features">
            <div className="section-header">
              <h3>Features</h3>
              <button
                  className="toggle-features-btn"
                  onClick={() => setShowFeatures(prev => !prev)}
                  aria-expanded={showFeatures}
                  title="Toggle Features"
              >
                {showFeatures ? '▲' : '▼'}
              </button>
            </div>
            <div className={`features-container ${showFeatures ? 'expanded' : ''}`}>
              <ul>
                {game.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
          </section>

          <section className="game-tags">
            <h3>Tags</h3>
            <div className="tags-container">
              {game.tags.map((tag, index) => (
                <span key={index} className="tag">{tag}</span>
              ))}
            </div>
          </section>

          <section className="game-links">
            <a href={game.playLink} className="play-button direct" target="_blank" rel="noopener noreferrer">
              Play Directly
            </a>
            <a href={game.repoLink} className="repo-link" target="_blank" rel="noopener noreferrer">
              View Source Code
            </a>
          </section>
        </aside>
      </div>
    </div>
  );
};

export default GamePage;
