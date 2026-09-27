import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import MainLayout from './components/layout/MainLayout/MainLayout';
import Games from './pages/Games/Games';
import GamePage from './pages/GamePage/GamePage.jsx';
import Terms from './pages/Legal/Terms';
import Privacy from './pages/Legal/Privacy';
import ErrorPage from './pages/ErrorPage/ErrorPage';

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
          <Route path="games" element={<Games />} />
          <Route path="games/:gameId" element={<GamePage />} />
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
