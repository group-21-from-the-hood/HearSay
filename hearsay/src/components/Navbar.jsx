import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    // Navigate or refresh as needed
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-16">
          <div className="absolute inset-y-0 left-0 flex items-center sm:hidden">
            {/* Mobile menu button*/}
          </div>
          <div className="flex-1 flex items-center justify-center sm:items-stretch sm:justify-start">
            <div className="flex-shrink-0">
              <Link to="/" className="text-xl font-bold text-gray-900">
                HearSay
              </Link>
            </div>
            <div className="hidden sm:block sm:ml-6">
              <div className="flex space-x-4">
                <Link
                  to="/"
                  className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Home
                </Link>
                <Link
                  to="/about"
                  className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
                >
                  About
                </Link>
                {/* Add more links as needed */}
              </div>
            </div>
          </div>
          <div className="hidden sm:block">
            {user ? (
              <button
                onClick={handleLogout}
                className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => navigate('/login')}
                className="text-gray-900 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Login/Register
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}