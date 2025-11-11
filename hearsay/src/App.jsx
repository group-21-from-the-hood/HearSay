import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AlbumRatingPage from './components/AlbumRatingPage';
import SongRatingPage from './components/SongRatingPage';
import MyReviewsPage from './components/MyReviewsPage';
import DiscoverPage from './components/DiscoverPage';
import RandomPage from './components/RandomPage';
import AuthPage from './components/AuthPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/album-rating" element={<AlbumRatingPage />} />
            <Route path="/song-rating" element={<SongRatingPage />} />
            <Route path="/my-reviews" element={<MyReviewsPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/random" element={<RandomPage />} />
            <Route path="/auth" element={<AuthPage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
