import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import MainLayout from './components/layout/MainLayout/MainLayout';
import Games from './pages/Games/Games';
import GamePage from './pages/GamePage/GamePage.jsx';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import ErrorPage from './pages/ErrorPage/ErrorPage';
import AuthCallback from './pages/Account/AuthCallback';
import Profile from './pages/Account/Profile';
import Users from './pages/Account/Users';
import Settings from './pages/Account/Settings';

// Follows Vite's `base` ("/" on Cloudflare), so there's no hard-coded /game-hub prefix
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

function App() {
  return (
    <Router basename={basename}>
      <Routes>
        {/* Main Layout Routes. A new page also goes in PAGES in vite.config.js: the build writes
            a file for each, and on Cloudflare any path without one is a 404. */}
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="games" replace />} />
          <Route path="games" element={<Games />} />            {/* TODO: accept games as path but redirect to / and make / as home/games page */}
          <Route path="games/:gameId" element={<GamePage />} /> {/* TODO: games/:gameId --> g/:gameId */}
          <Route path="users" element={<Users />} />
          <Route path="u/:username" element={<Profile />} />    {/* TODO: redirect from me to u/:username (to authed username page) */}
          <Route path="settings" element={<Settings />} />
          <Route path="auth/callback" element={<AuthCallback />} />
          <Route path="terms" element={<Terms />} />
          <Route path="privacy" element={<Privacy />} />
          {/* Unknown paths */}
          <Route path="*" element={<ErrorPage status={404} />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
