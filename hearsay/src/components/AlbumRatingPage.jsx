import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function AlbumRatingPage() {
  const location = useLocation();
  const album = location.state?.item;
  const [albumDetails, setAlbumDetails] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackRatings, setTrackRatings] = useState({});
  const [relatedAlbums, setRelatedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!album?.id) return;

      try {
        setLoading(true);
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        // Fetch album details and tracks in parallel
        const [albumResponse, tracksResponse] = await Promise.all([
          spotifyApi.getAlbum(album.id),
          spotifyApi.getAlbumTracks(album.id)
        ]);

        setAlbumDetails({
          ...album,
          releaseDate: albumResponse.body.release_date,
          totalTracks: albumResponse.body.total_tracks,
          label: albumResponse.body.label,
          popularity: albumResponse.body.popularity
        });

        setTracks(tracksResponse.body.items.map(track => ({
          id: track.id,
          name: track.name,
          duration: track.duration_ms,
          trackNumber: track.track_number
        })));

      } catch (error) {
        console.error('Error fetching album data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumData();
  }, [album?.id]);

  const handleTrackRating = (trackId, rating) => {
    setTrackRatings(prev => ({
      ...prev,
      [trackId]: rating
    }));
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  // Header component for consistency
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
            <div className="text-xl">Loading album details...</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Cover Art */}
            <div className="col-span-4">
              <div className="aspect-square border-2 border-black">
                {album?.coverArt && (
                  <img src={album.coverArt} alt={album.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p><span className="font-semibold">Release Date:</span> {albumDetails?.releaseDate}</p>
                <p><span className="font-semibold">Label:</span> {albumDetails?.label}</p>
                <p><span className="font-semibold">Total Tracks:</span> {albumDetails?.totalTracks}</p>
              </div>
            </div>

            {/* Album Info and Track List */}
            <div className="col-span-5">
              <div className="border-2 border-black p-4 mb-4">
                <h1 className="text-2xl font-bold">{album?.title}</h1>
                <p className="text-gray-600">{album?.artist}</p>
              </div>
              
              <div className="border-2 border-black p-4">
                <h2 className="font-semibold mb-4">Track List</h2>
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <span className="w-8 text-gray-500">{track.trackNumber}</span>
                      <span className="flex-1">{track.name}</span>
                      <span className="text-gray-500">{formatDuration(track.duration)}</span>
                      <select 
                        className="border border-black px-2 py-1"
                        value={trackRatings[track.id] || ''}
                        onChange={(e) => handleTrackRating(track.id, e.target.value)}
                      >
                        <option value="">★</option>
                        {[1,2,3,4,5].map(num => (
                          <option key={num} value={num}>{'★'.repeat(num)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Review Section */}
            <div className="col-span-3">
              <div className="border-2 border-black p-4 h-full">
                <h2 className="font-semibold mb-4">Review</h2>
                <textarea 
                  className="w-full h-48 border border-black p-2 resize-none"
                  placeholder="Write your review here..."
                />
                <button className="w-full mt-4 border-2 border-black py-2 hover:bg-gray-100">
                  Submit Review
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Related Albums */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold mb-4">Related Albums</h2>
          <div className="border-2 border-black p-4">
            <div className="grid grid-cols-5 gap-4">
              {relatedAlbums.map(related => (
                <div key={related.id} className="cursor-pointer">
                  <div className="aspect-square">
                    <img src={related.coverArt} alt={related.title} className="w-full h-full object-cover" />
                  </div>
                  <p className="mt-2 text-center truncate">{related.title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
