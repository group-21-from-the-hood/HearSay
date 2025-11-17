import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useEffect, useState } from 'react';
import { sanitizeSearchQuery } from '../utils/sanitize';
import { onAuthChange, emitAuthChange } from '../utils/authBus';
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

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } finally {
      try { localStorage.removeItem('hs_user'); } catch {}
      setMe({ loading: false, authenticated: false, user: null });
      emitAuthChange({ authenticated: false });
      navigate('/');
    }
  };

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
      <div className="container mx-auto px-4 py-3">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-black dark:text-white hover:underline">
            HearSay
          </Link>
          
          <nav className="flex-1 mx-8">
            <ul className="flex justify-center space-x-8">
              {me.authenticated && (
                <li><Link to="/my-reviews" className="text-black dark:text-white hover:underline">my reviews</Link></li>
              )}
              <li><Link to="/discover" className="text-black dark:text-white hover:underline">discover</Link></li>
              <li><Link to="/random" className="text-black dark:text-white hover:underline">random</Link></li>
            </ul>
          </nav>

          <div className="flex items-center gap-4">
            <form onSubmit={handleSearch} className="h-10 flex items-center">
              <input
                type="search"
                placeholder="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-3 placeholder-gray-500 dark:placeholder-gray-400"
                maxLength={200}
              />
            </form>
            
            {me.authenticated ? (
              <div className="flex items-center gap-3">
                <Avatar src={me.user?.picture} name={me.user?.name || me.user?.email} size={32} />
                <Link to="/profile" className="text-black dark:text-white max-w-[160px] truncate hover:underline" title={me.user?.email || me.user?.name}>
                  {me.user?.name || me.user?.email || 'Signed in'}
                </Link>
                <button
                  onClick={handleLogout}
                  className="h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => navigate('/auth')}
                className="h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                login/register
              </button>
            )}

            <button
              onClick={toggleTheme}
              className="h-10 w-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-black dark:text-white hover:underline">
            HearSay
          </Link>
          
          <div className="flex items-center gap-2">
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

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t-2 border-black dark:border-white pt-4 space-y-4">
            <form onSubmit={handleSearch} className="w-full">
              <input
                type="search"
                placeholder="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-3 placeholder-gray-500 dark:placeholder-gray-400"
                maxLength={200}
              />
            </form>
            
            <nav>
              <ul className="space-y-2">
                {me.authenticated && (
                  <li>
                    <Link 
                      to="/my-reviews" 
                      className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      my reviews
                    </Link>
                  </li>
                )}
                <li>
                  <Link 
                    to="/discover" 
                    className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    discover
                  </Link>
                </li>
                <li>
                  <Link 
                    to="/random" 
                    className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    random
                  </Link>
                </li>
              </ul>
            </nav>
            
            {me.authenticated ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Avatar src={me.user?.picture} name={me.user?.name || me.user?.email} size={32} />
                  <Link 
                    to="/profile"
                    className="text-black dark:text-white hover:underline"
                    title={me.user?.email || me.user?.name}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {me.user?.name || me.user?.email || 'Signed in'}
                  </Link>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  logout
                </button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  navigate('/auth');
                  setMobileMenuOpen(false);
                }}
                className="w-full h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                login/register
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
