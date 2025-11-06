import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function SongRatingPage() {
  const location = useLocation();
  const song = location.state?.item;
  const [songDetails, setSongDetails] = useState(null);
  const [rating, setRating] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSongData = async () => {
      if (!song?.id) return;

      try {
        setLoading(true);
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        const trackResponse = await spotifyApi.getTrack(song.id);
        
        setSongDetails({
          ...song,
          duration: trackResponse.body.duration_ms,
          album: trackResponse.body.album.name
        });
      } catch (error) {
        console.error('Error fetching song data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSongData();
  }, [song?.id]);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  // Add header component for consistency
  const Header = () => (
    <header className="border-b border-black">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">LOGO</Link>
        <nav className="flex-1 mx-8">
          <ul className="flex justify-center space-x-8">
            <li><Link to="/my-reviews" className="hover:underline">my reviews</Link></li>
            <li><Link to="/discover" className="hover:underline">discover</Link></li>
            <li><Link to="/random" className="hover:underline">random</Link></li>
          </ul>
        </nav>
        <div className="flex items-center space-x-4">
          <input type="search" placeholder="search" className="border border-black px-3 py-1" />
          <button className="border border-black px-4 py-1 hover:bg-gray-100">login/register</button>
        </div>
      </div>
    </header>
  );

  return (
    <div className="min-h-screen bg-white">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl">Loading song details...</div>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Left: Cover Art */}
            <div className="w-1/2">
              <div className="aspect-square border-2 border-black">
                {song?.coverArt && (
                  <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                )}
              </div>
            </div>

            {/* Right: Song Info */}
            <div className="w-1/2">
              <div className="border-2 border-black p-6">
                <h1 className="text-3xl font-bold mb-2">{song?.title}</h1>
                <p className="text-xl mb-2">{song?.artist}</p>
                <p className="text-gray-600 mb-4">
                  Album: {songDetails?.album}<br />
                  Duration: {formatDuration(songDetails?.duration)}
                </p>
                
                {/* Star Rating */}
                <div className="mb-6">
                  <select 
                    className="w-32 border-2 border-black px-4 py-2 text-xl"
                    value={rating}
                    onChange={(e) => setRating(e.target.value)}
                  >
                    <option value="">Rate</option>
                    {[1,2,3,4,5].map(num => (
                      <option key={num} value={num}>{'★'.repeat(num)}</option>
                    ))}
                  </select>
                </div>

                {/* Review Section */}
                <div>
                  <h2 className="font-bold mb-2">Review</h2>
                  <textarea 
                    className="w-full h-32 border-2 border-black p-2 resize-none mb-4"
                    placeholder="Write your review here..."
                  />
                  <button className="w-full border-2 border-black py-2 hover:bg-gray-100">
                    Submit Review
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
