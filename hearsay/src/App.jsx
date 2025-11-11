import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './components/LandingPage';
import AlbumRatingPage from './components/AlbumRatingPage';
import SongRatingPage from './components/SongRatingPage';
import MyReviewsPage from './components/MyReviewsPage';
import DiscoverPage from './components/DiscoverPage';
import RandomPage from './components/RandomPage';
import AuthPage from './components/AuthPage';
import AuthCallback from './components/AuthCallback';

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/album-rating" element={<AlbumRatingPage />} />
          <Route path="/song-rating" element={<SongRatingPage />} />
          <Route path="/my-reviews" element={<MyReviewsPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
          <Route path="/random" element={<RandomPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
