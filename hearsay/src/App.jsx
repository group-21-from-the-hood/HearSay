import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import LandingPage from './components/LandingPage';
import AlbumRatingPage from './components/AlbumRatingPage';
import SongRatingPage from './components/SongRatingPage';
import MyReviewsPage from './components/MyReviewsPage';
import DiscoverPage from './components/DiscoverPage';
import RandomPage from './components/RandomPage';
import AuthPage from './components/AuthPage';
import SearchPage from './components/SearchPage';
import ArtistPage from './components/ArtistPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <div className="pt-16">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/artist/:artistId" element={<ArtistPage />} />
            <Route path="/album/:albumId" element={<AlbumRatingPage />} />
            <Route path="/song/:songId" element={<SongRatingPage />} />
            <Route path="/my-reviews" element={<MyReviewsPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            <Route path="/random" element={<RandomPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/api/test" element={<div>API Test Endpoint</div>} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
