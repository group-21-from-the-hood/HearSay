import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';
import { sanitizeSearchQuery } from '../utils/sanitize';
import { onAuthChange } from '../utils/authBus';
import Avatar from './Avatar';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [me, setMe] = useState({ loading: true, authenticated: false, user: null });

  useEffect(() => {
    let cancelled = false;
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({ authenticated: false }));
        if (!cancelled) setMe({ loading: false, authenticated: !!data.authenticated, user: data.user || null });
      } catch {
        if (!cancelled) setMe({ loading: false, authenticated: false, user: null });
      }
    };

    // Initial check
    fetchMe();

    // Refresh when an auth change is broadcast
    const offAuth = onAuthChange(() => fetchMe());

    // Also refresh when tab regains focus (common after OAuth flow)
    const onFocus = () => fetchMe();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      offAuth?.();
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  
  const handleSearch = (e) => {
    e.preventDefault();
    const sanitizedQuery = sanitizeSearchQuery(searchQuery.trim());
    
    if (sanitizedQuery) {
      navigate(`/search?q=${encodeURIComponent(sanitizedQuery)}`);
      setSearchQuery('');
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b-2 border-black dark:border-white transition-colors">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="hidden md:block text-xl font-bold hover:underline text-black dark:text-white">HearSay</Link>
        
        {/* Hide desktop nav on small screens to avoid overlapping mobile controls */}
        <nav aria-label="Primary navigation" className="hidden md:flex flex-1 mx-8">
          <ul className="flex justify-center space-x-8">
            <li><Link to="/recent-reviews" className="hover:underline text-black dark:text-white">Recent Reviews</Link></li>
            <li><Link to="/my-reviews" className="hover:underline text-black dark:text-white">My Reviews</Link></li>
            <li><Link to="/random" className="hover:underline text-black dark:text-white">Random</Link></li>
          </ul>
        </nav>

        {/* Desktop controls: hide on small screens so mobile header/menu is reachable */}
        <div className="hidden md:flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="p-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <form onSubmit={handleSearch} role="search" aria-label="Site search" className="flex">
            <input
              type="search"
              aria-label="Search for artists, albums or tracks"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-2 border-black dark:border-white px-3 py-1 bg-white dark:bg-gray-800 text-black dark:text-white"
              maxLength={200}
            />
          </form>
          {me.authenticated ? (
            <div className="flex items-center gap-2">
              <Avatar src={me.user?.picture} name={me.user?.name || me.user?.email} size={32} />
              <Link to="/profile" className="text-black dark:text-white hover:underline">
                {me.user?.name || me.user?.email || 'Profile'}
              </Link>
            </div>
          ) : (
            <button
              onClick={() => navigate('/auth')}
              className="border-2 border-black dark:border-white px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white"
            >
              Login/Register
            </button>
          )}
        </div>

        {/* Mobile Header (visible only on small screens) */}
        <div className="md:hidden flex items-center w-full">
          <Link to="/" className="text-xl font-bold text-black dark:text-white hover:underline">
            HearSay
          </Link>
          
          {/* push buttons to the right */}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="h-10 w-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="h-10 w-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu panel — fixed and accessible. Increase z-index so it receives clicks above page content (but stays below header visual top). */}
      {mobileMenuOpen && (
        <div
          id="mobile-menu"
          role="menu"
          aria-labelledby="mobile-menu-button"
          className="md:hidden fixed top-16 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t-2 border-black dark:border-white p-4 shadow-lg"
        >
          <form onSubmit={handleSearch} className="w-full mb-3" role="search" aria-label="Mobile site search">
            <input
              type="search"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-3 placeholder-gray-500 dark:placeholder-gray-400"
              maxLength={200}
            />
          </form>

          <nav role="navigation" aria-label="Mobile primary">
            <ul className="space-y-3">
              <li>
                <Link
                  to="/recent-reviews"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                >
                  Recent Reviews
                </Link>
              </li>
              {me?.authenticated && (
                <li>
                  <Link
                    to="/my-reviews"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                  >
                    My Reviews
                  </Link>
                </li>
              )}
              <li>
                <Link
                  to="/random"
                  onClick={() => setMobileMenuOpen(false)}
                  className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                >
                  Random
                </Link>
              </li>
            </ul>
          </nav>

          <div className="mt-4">
            {me?.authenticated ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar src={me.user?.picture} name={me.user?.name || me.user?.email} size={32} />
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-black dark:text-white hover:underline"
                  >
                    {me.user?.name || me.user?.email || 'Profile'}
                  </Link>
                </div>
              </div>
            ) : (
               <button
                 onClick={() => { navigate('/auth'); setMobileMenuOpen(false); }}
                 className="w-full h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
               >
                 Login / Register
               </button>
             )}
          </div>
        </div>
      )}
    </header>
  );
}
