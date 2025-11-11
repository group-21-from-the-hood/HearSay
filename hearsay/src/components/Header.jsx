import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className="border-b-2 border-black dark:border-white bg-white dark:bg-gray-900 fixed top-0 left-0 right-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold hover:underline text-black dark:text-white">LOGO</Link>
        
        <nav className="flex-1 mx-8">
          <ul className="flex justify-center space-x-8">
            <li><Link to="/my-reviews" className="hover:underline text-black dark:text-white">my reviews</Link></li>
            <li><Link to="/discover" className="hover:underline text-black dark:text-white">discover</Link></li>
            <li><Link to="/random" className="hover:underline text-black dark:text-white">random</Link></li>
          </ul>
        </nav>

        <div className="flex items-center space-x-4">
          <button
            onClick={toggleTheme}
            className="p-2 border-2 border-black dark:border-white hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <input
            type="search"
            placeholder="search"
            className="border-2 border-black dark:border-white px-3 py-1 bg-white dark:bg-gray-800 text-black dark:text-white"
          />
          <button 
            onClick={() => navigate('/auth')}
            className="border-2 border-black dark:border-white px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white"
          >
            login/register
          </button>
        </div>
      </div>
    </header>
  );
}
