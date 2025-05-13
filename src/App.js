import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/layout/Header';
import GameList from './components/games/GameList';
import GamePage from './pages/GamePage';
import Terms from './pages/Terms';
import Footer from './components/layout/Footer';
import { games } from './data/games';
import './App.css';

function App() {
  return (
    <Router>
    <div className="App">
      <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/games" replace />} />
            <Route path="/games" element={<GameList games={games} />} />
            <Route path="/games/:gameId" element={<GamePage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
    </div>
    </Router>
  );
}

export default App; 
