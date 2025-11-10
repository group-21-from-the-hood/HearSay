import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import Header from './Header';

const MIN_LOADING_TIME = 1000; // milliseconds
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function LandingPage() {
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchPopularMusic = async () => {
    try {
      setAlbumsLoading(true);
      setSongsLoading(true);
      setError(null);

      const loadingStartTime = Date.now();

      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);
      const countryCode = navigator.language?.split('-')[1] || 'US';

      // Fetch both requests in parallel
      const [albumsResponse, tracksResponse] = await Promise.all([
        spotifyApi.getNewReleases({
          limit: 50,
          country: countryCode
        }),
        spotifyApi.searchTracks('year:2024', {
          limit: 50,
          market: countryCode
        })
      ]);

      // Process both responses before updating state
      const randomAlbums = albumsResponse.body.albums.items
        .sort(() => 0.5 - Math.random())
        .slice(0, 5)
        .map(album => ({
          id: album.id,
          title: album.name,
          artist: album.artists[0].name,
          coverArt: album.images?.[0]?.url
        }));

      const randomSongs = tracksResponse.body.tracks.items
        .sort(() => 0.5 - Math.random())
        .slice(0, 5)
        .map(track => ({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          coverArt: track.album?.images?.[0]?.url
        }));

      // Calculate remaining delay needed
      const elapsed = Date.now() - loadingStartTime;
      const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);
      
      // Wait for minimum loading time
      await delay(remainingDelay);

      // Update all state at once after delay
      setAlbums(randomAlbums);
      setSongs(randomSongs);
      setAlbumsLoading(false);
      setSongsLoading(false);
    } catch (error) {
      console.error('Error fetching music:', error);
      setError(error.message);
      setAlbumsLoading(false);
      setSongsLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularMusic();
  }, []);

  return (
  <div className="min-h-screen">
      <Header />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {error && (
          <div className="text-red-500 mb-4 p-4 border border-red-500">
            {error}
          </div>
        )}

        {/* Popular Albums */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold mb-2 accent">Popular Albums</h2>
          <div className="p-4">
            {albumsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-lg">Loading albums...</div>
              </div>
            ) : (
              (albums.length > 0) ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                  {albums.map(album => (
                    <div
                      key={album.id}
                      className="flex flex-col cursor-pointer group card card-shadow rounded-lg overflow-hidden transition-shadow bg-black text-white"
                      onClick={() => navigate('/album-rating', { state: { item: album } })}
                    >
                      <div className="aspect-square mb-0">
                        {album.coverArt ? (
                          <img
                            src={album.coverArt}
                            alt={album.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-black flex items-center justify-center text-white">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <p className="font-medium group-hover:underline truncate text-white">{album.title}</p>
                        <p className="text-sm text-gray-300 truncate">{album.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">No albums found.</div>
              )
            )}
          </div>
        </section>

        {/* Popular Songs */}
        <section>
          <h2 className="text-xl font-semibold mb-2 accent">Popular Songs</h2>
          <div className="p-4">
            {songsLoading ? (
              <div className="h-64 flex items-center justify-center">
                <div className="text-lg">Loading songs...</div>
              </div>
            ) : (
              (songs.length > 0) ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
                  {songs.map(song => (
                    <div
                      key={song.id}
                      className="flex flex-col cursor-pointer group card card-shadow rounded-lg overflow-hidden transition-shadow bg-black text-white"
                      onClick={() => navigate('/song-rating', { state: { item: song } })}
                    >
                      <div className="aspect-square mb-0">
                        {song.coverArt ? (
                          <img
                            src={song.coverArt}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-black flex items-center justify-center text-white">
                            No Image
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <p className="font-medium group-hover:underline truncate text-white">{song.title}</p>
                        <p className="text-sm text-gray-300 truncate">{song.artist}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">No songs found.</div>
              )
            )}
          </div>
        </section>
      </main>
    </div>
  );
}