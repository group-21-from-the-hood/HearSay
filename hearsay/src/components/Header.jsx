import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-b-2 border-black dark:border-white transition-colors">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
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
          {/* Search */}
          <form onSubmit={handleSearch} className="h-10 flex items-center">
            <input
              type="search"
              placeholder="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-3 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </form>
          
          {/* Login/Register */}
          <button 
            onClick={() => navigate('/auth')}
            className="h-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
          >
            login/register
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="h-10 w-10 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
