import GameList from '../../components/layout/game/GameList/GameList';
import { InstallBanner } from '../../components/install/InstallApp';
import { games } from '../../data/games';

// The catalogue ships with the site (src/data/games.json), so the list works without any backend.
// The header already says "GameHub", so this page's heading is only there for screen readers.
const Games = () => (
  <>
    <h1 className="visually-hidden">Games</h1>
    <InstallBanner />
    <GameList games={games} />
  </>
);

export default Games;
