import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
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
              <li><Link to="/my-reviews" className="text-black dark:text-white hover:underline">my reviews</Link></li>
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
              />
            </form>
            
            <button 
              onClick={() => navigate('/auth')}
              className="h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
              login/register
            </button>

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
              />
            </form>
            
            <nav>
              <ul className="space-y-2">
                <li>
                  <Link 
                    to="/my-reviews" 
                    className="block py-2 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 border-2 border-black dark:border-white px-4"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    my reviews
                  </Link>
                </li>
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
            
            <button 
              onClick={() => {
                navigate('/auth');
                setMobileMenuOpen(false);
              }}
              className="w-full h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
              login/register
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
