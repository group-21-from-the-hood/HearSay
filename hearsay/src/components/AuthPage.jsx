import { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();

  const validateEmail = (e) => /\S+@\S+\.\S+/.test(e);

  const handleLocalSubmit = async (ev) => {
    ev.preventDefault();
    setError(null);

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'signup') {
      if (password !== confirm) {
        setError('Passwords do not match.');
        return;
      }
      // Minimal client-side signup simulation: store a user record in localStorage
      setLoading(true);
      try {
        const users = JSON.parse(localStorage.getItem('hs_users') || '[]');
        if (users.find(u => u.email === email)) {
          setError('An account with that email already exists.');
          setLoading(false);
          return;
        }
        users.push({ email, password });
        localStorage.setItem('hs_users', JSON.stringify(users));
        // auto-login after signup
        localStorage.setItem('hs_user', JSON.stringify({ email }));
        navigate('/');
      } finally {
        setLoading(false);
      }
    } else {
      // login
      setLoading(true);
      try {
        const users = JSON.parse(localStorage.getItem('hs_users') || '[]');
        const user = users.find(u => u.email === email && u.password === password);
        if (!user) {
          setError('Invalid email or password.');
          setLoading(false);
          return;
        }
        localStorage.setItem('hs_user', JSON.stringify({ email }));
        navigate('/');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleGoogleSSO = () => {
    // In a real app this should redirect to your backend endpoint that starts the
    // Google OAuth flow (e.g. /auth/google). Here we open a placeholder.
    // Replace the URL with your server route once you implement it.
    window.location.href = import.meta.env.VITE_GOOGLE_OAUTH_URL || '/auth/google';
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-white">
      {/* Dark mode toggle (top-right) */}
      <button
        onClick={toggle}
        title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        className="absolute top-4 right-4 px-3 py-2 border border-gray-300 rounded"
      >
        {theme === 'dark' ? '🌞' : '🌙'}
      </button>

      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4 text-gray-900">{mode === 'login' ? 'Log in' : 'Sign up'}</h1>

        {error && (
          <div className="mb-4 p-3 border border-red-500 text-red-600">{error}</div>
        )}

        <form onSubmit={handleLocalSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-transparent text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 bg-transparent text-sm"
              required
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 bg-transparent text-sm"
                required
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <button
              type="submit"
              className="px-4 py-2 rounded btn-primary disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>

            <button
              type="button"
              className="text-sm underline"
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
            </button>
          </div>
        </form>

        <div className="my-6 border-t pt-6">
          <div className="text-center text-sm mb-3 muted">Or continue with</div>
          <button
            onClick={handleGoogleSSO}
            className="w-full flex items-center justify-center gap-3 border border-gray-300 px-4 py-2 rounded bg-white"
            aria-label="Sign in with Google"
          >
            <img src="/google-logo.svg" alt="Google" className="h-5 w-5" />
            <span className="text-sm accent-link">Continue with Google</span>
          </button>
        </div>
      </div>
    </div>
  );
}
