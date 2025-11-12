import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';
import HeadphoneRating from './HeadphoneRating';

export default function AlbumRatingPage() {
  const { albumId } = useParams();
  const { theme } = useTheme();
  const [album, setAlbum] = useState(null);
  const [albumDetails, setAlbumDetails] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackRatings, setTrackRatings] = useState({});
  const [relatedAlbums, setRelatedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!albumId) return;

      try {
        setLoading(true);
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        // Fetch album details and tracks in parallel
        const [albumResponse, tracksResponse] = await Promise.all([
          spotifyApi.getAlbum(albumId),
          spotifyApi.getAlbumTracks(albumId)
        ]);

        const albumData = {
          id: albumResponse.body.id,
          title: albumResponse.body.name,
          artist: albumResponse.body.artists[0]?.name,
          coverArt: albumResponse.body.images?.[0]?.url,
          releaseDate: albumResponse.body.release_date,
          totalTracks: albumResponse.body.total_tracks,
          label: albumResponse.body.label,
          popularity: albumResponse.body.popularity,
          spotifyUrl: albumResponse.body.external_urls.spotify
        };

        setAlbum(albumData);
        setAlbumDetails(albumData);

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
  }, [albumId]);

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
    <main className="container mx-auto px-4 py-8">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-black dark:text-white">Loading album details...</div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Cover Art and Info */}
          <div className="col-span-4">
            <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900 mb-4">
              {album?.coverArt && (
                <img src={album.coverArt} alt={album.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Album Info */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <div className="text-sm space-y-2">
                <p><span className="font-semibold">Release Date:</span> {albumDetails?.releaseDate}</p>
                <p><span className="font-semibold">Label:</span> {albumDetails?.label}</p>
                <p><span className="font-semibold">Total Tracks:</span> {albumDetails?.totalTracks}</p>
              </div>
            </div>
          </div>

          {/* Middle Column - Player and Review */}
          <div className="col-span-5">
            {/* Embedded Player */}
            <div className="border-2 border-black dark:border-white overflow-hidden mb-4" style={{ backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
              <iframe
                key={album?.id}
                style={{ borderRadius: '0' }}
                src={`https://open.spotify.com/embed/album/${album?.id}?utm_source=generator`}
                width="100%"
                height="352"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full"
              />
            </div>
            
            {/* Review */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Review</span>
              </h2>
              <textarea 
                className="w-full h-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 resize-none"
                placeholder="Write your review here..."
              />
              <button className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white">
                Submit Review
              </button>
            </div>
          </div>

          {/* Track List */}
          <div className="col-span-3">
            <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
              <h2 className="font-semibold p-4 pb-2 border-b-2 border-black dark:border-white">
                <span className="text-black dark:text-white">Track List</span>
              </h2>
              <div className="overflow-y-auto p-4 pt-2 flex-1">
                <div className="space-y-3">
                  {tracks.map((track) => (
                    <div key={track.id} className="flex flex-col gap-1 py-2 border-b border-black dark:border-white last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="w-6 text-gray-500 dark:text-gray-400 text-sm">{track.trackNumber}</span>
                        <span className="flex-1 text-sm truncate">{track.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">{formatDuration(track.duration)}</span>
                      </div>
                      <div className="ml-8">
                        <HeadphoneRating
                          size="small"
                          value={trackRatings[track.id] || 0}
                          onChange={(rating) => handleTrackRating(track.id, rating)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related Albums */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">
          <span className="text-black dark:text-white">Related Albums</span>
        </h2>
        <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900">
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
  );
}
