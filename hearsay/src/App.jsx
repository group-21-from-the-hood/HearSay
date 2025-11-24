import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import AuthCallback from './components/AuthCallback';
import SearchPage from './components/SearchPage';
import AlbumRatingPage from './components/AlbumRatingPage';
import SongRatingPage from './components/SongRatingPage';
import ArtistPage from './components/ArtistPage';
import MyReviewsPage from './components/MyReviewsPage';
import ProfilePage from './components/ProfilePage';
import RandomPage from './components/RandomPage';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <Router>
          <div className="min-h-screen bg-white dark:bg-gray-900">
            <Header />
            <div className="pt-20">
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/artist/:artistId" element={<ArtistPage />} />
                <Route path="/album/:albumId" element={<AlbumRatingPage />} />
                <Route path="/song/:songId" element={<SongRatingPage />} />
                <Route path="/my-reviews" element={<ProtectedRoute><MyReviewsPage /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
                <Route path="/random" element={<RandomPage />} />
              </Routes>
            </div>
          </div>
        </Router>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
