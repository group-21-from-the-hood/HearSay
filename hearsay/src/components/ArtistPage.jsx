import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function ArtistPage() {
  const location = useLocation();
  const artist = location.state?.artist;
  const navigate = useNavigate();
  
  const [artistDetails, setArtistDetails] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artist?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        // Fetch artist details and albums in parallel
        const [artistResponse, albumsResponse] = await Promise.all([
          spotifyApi.getArtist(artist.id),
          spotifyApi.getArtistAlbums(artist.id, {
            limit: 50,
            include_groups: 'album,single',
            market: 'US'
          })
        ]);

        setArtistDetails({
          name: artistResponse.body.name,
          image: artistResponse.body.images?.[0]?.url,
          followers: artistResponse.body.followers?.total,
          genres: artistResponse.body.genres
        });

        // Separate albums and singles
        const albumItems = [];
        const singleItems = [];
        const seenAlbums = new Map();
        const seenSingles = new Map();

        albumsResponse.body.items.forEach(item => {
          const key = item.name.toLowerCase().trim();
          
          if (item.album_type === 'album') {
            if (!seenAlbums.has(key)) {
              seenAlbums.set(key, item);
              albumItems.push(item);
            }
          } else if (item.album_type === 'single') {
            if (!seenSingles.has(key)) {
              seenSingles.set(key, item);
              singleItems.push(item);
            }
          }
        });

        // Get full details for albums
        const albumDetailsPromises = albumItems
          .slice(0, 50)
          .map(album => spotifyApi.getAlbum(album.id));

        const albumDetailsResponses = await Promise.all(albumDetailsPromises);

        const sortedAlbums = albumDetailsResponses
          .map(response => ({
            id: response.body.id,
            title: response.body.name,
            artist: response.body.artists[0]?.name,
            coverArt: response.body.images?.[0]?.url,
            releaseDate: response.body.release_date,
            totalTracks: response.body.total_tracks,
            popularity: response.body.popularity || 0,
            type: response.body.album_type,
            spotifyUrl: response.body.external_urls.spotify
          }))
          .sort((a, b) => b.popularity - a.popularity);

        // Get full details for singles
        const singleDetailsPromises = singleItems
          .slice(0, 50)
          .map(single => spotifyApi.getAlbum(single.id));

        const singleDetailsResponses = await Promise.all(singleDetailsPromises);

        const sortedSingles = singleDetailsResponses
          .map(response => ({
            id: response.body.id,
            title: response.body.name,
            artist: response.body.artists[0]?.name,
            coverArt: response.body.images?.[0]?.url,
            releaseDate: response.body.release_date,
            totalTracks: response.body.total_tracks,
            popularity: response.body.popularity || 0,
            type: response.body.album_type,
            spotifyUrl: response.body.external_urls.spotify
          }))
          .sort((a, b) => b.popularity - a.popularity);

        setAlbums(sortedAlbums);
        setSingles(sortedSingles);
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('An error occurred while loading artist data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [artist?.id]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Loading artist...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500">
          {error}
        </div>
      </main>
    );
  }

  if (!artist?.id) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Artist not found</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Artist Header */}
      <div className="mb-12">
        <div className="flex items-start gap-8">
          <div className="w-64 h-64 flex-shrink-0 border-2 border-black dark:border-white">
            {artistDetails?.image ? (
              <img 
                src={artistDetails.image} 
                alt={artistDetails.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-4xl font-bold mb-4">
              <span className="text-black dark:text-white">{artistDetails?.name}</span>
            </h1>
            <div className="space-y-3 text-base text-black dark:text-white">
              <p>
                <span className="font-semibold">Followers:</span>{' '}
                {artistDetails?.followers?.toLocaleString()}
              </p>
              {artistDetails?.genres && artistDetails.genres.length > 0 && (
                <p>
                  <span className="font-semibold">Genres:</span>{' '}
                  {artistDetails.genres.join(', ')}
                </p>
              )}
              <div>
                <p className="font-semibold mb-2">About:</p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {artist?.name || artistDetails?.name} is a {artistDetails?.genres?.[0] || 'music'} artist with{' '}
                  {artistDetails?.followers?.toLocaleString()} followers on Spotify. 
                  {artistDetails?.genres && artistDetails.genres.length > 1 && (
                    <> Their music spans across {artistDetails.genres.slice(0, 3).join(', ')} genres.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Albums Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">
          <span className="text-black dark:text-white">Albums ({albums.length})</span>
        </h2>
        {albums.length > 0 ? (
          <div className="grid grid-cols-5 gap-4">
            {albums.map(album => (
              <div
                key={album.id}
                className="cursor-pointer group"
                onClick={() => navigate('/album-rating', { state: { item: album } })}
              >
                <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                  {album.coverArt ? (
                    <img 
                      src={album.coverArt} 
                      alt={album.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                      No Image
                    </div>
                  )}
                </div>
                <p className="font-medium text-center truncate text-black dark:text-white group-hover:underline">
                  {album.title}
                </p>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 truncate">
                  {album.releaseDate?.split('-')[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No albums found for this artist</p>
        )}
      </section>

      {/* Singles Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">
          <span className="text-black dark:text-white">Singles ({singles.length})</span>
        </h2>
        {singles.length > 0 ? (
          <div className="grid grid-cols-5 gap-4">
            {singles.map(single => (
              <div
                key={single.id}
                className="cursor-pointer group"
                onClick={() => navigate('/song-rating', { state: { item: single } })}
              >
                <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                  {single.coverArt ? (
                    <img 
                      src={single.coverArt} 
                      alt={single.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                      No Image
                    </div>
                  )}
                </div>
                <p className="font-medium text-center truncate text-black dark:text-white group-hover:underline">
                  {single.title}
                </p>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 truncate">
                  {single.releaseDate?.split('-')[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No singles found for this artist</p>
        )}
      </section>
    </main>
  );
}
