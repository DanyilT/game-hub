import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useParams } from 'react-router';
import MainLayout from './components/layout/MainLayout/MainLayout';
import Games from './pages/Games/Games';
import GamePage from './pages/GamePage/GamePage.jsx';
import About from './pages/Legal/About.jsx';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import ErrorPage from './pages/ErrorPage/ErrorPage';
import AuthCallback from './pages/Account/AuthCallback';
import Me from './pages/Account/Me';
import Players from './pages/Account/Players';
import Profile from './pages/Account/Profile';
import Settings from './pages/Account/Settings';

// Follows Vite's `base` ("/" on Cloudflare), so there's no hard-coded /game-hub prefix
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

/**
 * An address that moved (MOVED in vite.config.js). On Cloudflare, _redirects answers these with a
 * 301 before the app loads; this covers the dev server, and links followed in a page opened earlier.
 * @param {string|function} to - the new path, or a function of the route's params that returns it
 */
const Moved = ({ to }) => {
  const params = useParams();
  const { search, hash } = useLocation();
  return <Navigate to={`${typeof to === 'function' ? to(params) : to}${search}${hash}`} replace />;
};

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        {/* Main Layout Routes. A new page also goes in PAGES in vite.config.js: the build writes
            a file for each, and on Cloudflare any path without one is a 404. */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Games />} />
          <Route path="g/:gameId" element={<GamePage />} />
          <Route path="players" element={<Players />} />
          <Route path="u/:username" element={<Profile />} />
          {/* Your own profile, without knowing your username. No player can be called "me":
              usernames have at least 3 characters. */}
          <Route path="me" element={<Me />} />
          <Route path="u/me" element={<Me />} />
          <Route path="settings" element={<Settings />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route path="about" element={<About />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          {/* Old addresses */}
          <Route path="games" element={<Moved to="/" />} />
          <Route path="games/:gameId" element={<Moved to={({ gameId }) => `/g/${gameId}`} />} />
          <Route path="users" element={<Moved to="/players" />} />
          <Route path="users/:username" element={<Moved to={({ username }) => `/u/${username}`} />} />
          <Route path="players/:username" element={<Moved to={({ username }) => `/u/${username}`} />} />
          {/* Unknown paths */}
          <Route path="*" element={<ErrorPage status={404} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
