import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import Header from './Header';

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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-16">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-xl dark:text-white">Loading album details...</div>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Cover Art */}
            <div className="col-span-4">
              <div className="aspect-square border-2 border-black dark:border-white">
                {album?.coverArt && (
                  <img src={album.coverArt} alt={album.title} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="mt-4 space-y-2 text-sm dark:text-white">
                <p><span className="font-semibold">Release Date:</span> {albumDetails?.releaseDate}</p>
                <p><span className="font-semibold">Label:</span> {albumDetails?.label}</p>
                <p><span className="font-semibold">Total Tracks:</span> {albumDetails?.totalTracks}</p>
              </div>
            </div>

            {/* Middle Column - Album Info and Review */}
            <div className="col-span-5">
              <div className="border-2 border-black dark:border-white p-4 mb-4 dark:text-white">
                <h1 className="text-2xl font-bold">{album?.title}</h1>
                <p className="text-gray-600">{album?.artist}</p>
              </div>
              
              <div className="border-2 border-black dark:border-white p-4 dark:text-white">
                <h2 className="font-semibold mb-4">Review</h2>
                <textarea 
                  className="w-full h-32 border-2 border-black dark:border-white dark:bg-gray-800 dark:text-white p-2 resize-none"
                  placeholder="Write your review here..."
                />
                <button className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-white">
                  Submit Review
                </button>
              </div>
            </div>

            {/* Track List */}
            <div className="col-span-3">
              <div className="border-2 border-black dark:border-white p-4 dark:text-white">
                <h2 className="font-semibold mb-4">Track List</h2>
                <div className="space-y-2">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex items-center gap-4 py-2 border-b last:border-0">
                      <span className="w-8 text-gray-500">{track.trackNumber}</span>
                      <span className="flex-1">{track.name}</span>
                      <span className="text-gray-500">{formatDuration(track.duration)}</span>
                      <select 
                        className="border border-black dark:border-white px-2 py-1"
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
