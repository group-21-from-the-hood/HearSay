import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  return (
  <header className="fixed top-0 left-0 right-0 z-50 border-b border-black header-bg">
    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-3xl md:text-4xl font-extrabold cursor-pointer accent-link" onClick={() => navigate('/')}>
            HearSay
          </div>
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-6 text-sm">
              <li><a href="/my-reviews" className="accent-link">my reviews</a></li>
              <li><a href="/discover" className="accent-link">discover</a></li>
              <li><a href="/random" className="accent-link">random</a></li>
            </ul>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <input
              type="search"
              placeholder="Search"
              className="px-3 py-2 rounded border border-gray-300 bg-white text-sm w-48"
            />
          </div>

          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded btn-primary"
          >
            Login
          </button>

          <button
            onClick={toggle}
            title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            {theme === 'dark' ? '🌞' : '🌙'}
          </button>
        </div>
      </div>
    </header>
  );
}
