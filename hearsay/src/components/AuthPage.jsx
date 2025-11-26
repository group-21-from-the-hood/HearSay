import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import Header from './Header';

// PKCE helpers
function base64urlencode(a) {
  // Convert the ArrayBuffer to string using Uint8 array.
  // btoa takes chars from 0-255 and base64 encodes.
  return btoa(String.fromCharCode.apply(null, new Uint8Array(a)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return await crypto.subtle.digest('SHA-256', data);
}

function randomString(length = 64) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  // convert to base64url
  return base64urlencode(array);
}

async function createCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

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
    // Client-side PKCE flow: generate code_verifier & code_challenge, store verifier
    (async () => {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
      const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
      if (!clientId) {
        alert('Missing VITE_GOOGLE_CLIENT_ID in environment');
        return;
      }

      const code_verifier = randomString(64);
      const code_challenge = await createCodeChallenge(code_verifier);
      // Store verifier in localStorage so it survives redirects/tab behavior in development
      // (sessionStorage can be lost if the redirect opens a new tab or origin changes).
      try {
        localStorage.setItem('google_pkce_verifier', code_verifier);
      } catch (e) {
        // fallback to sessionStorage if localStorage isn't available
        sessionStorage.setItem('google_pkce_verifier', code_verifier);
      }

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        access_type: 'offline',
        include_granted_scopes: 'true',
        code_challenge: code_challenge,
        code_challenge_method: 'S256',
        prompt: 'select_account',
      });

      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    })();
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 pt-16">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-6">
            <h1 className="text-2xl font-bold mb-6">
              <span className="text-black dark:text-white">{mode === 'login' ? 'Login' : 'Register'}</span>
            </h1>
            
            {error && (
              <div className="mb-4 p-3 border border-red-500 text-red-600">{error}</div>
            )}

            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSSO}
              className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center gap-3 mb-6 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.8 10.2273C19.8 9.51819 19.7364 8.83637 19.6182 8.18182H10V12.05H15.3818C15.15 13.3 14.4455 14.3591 13.3864 15.0682V17.5773H16.7182C18.6091 15.8364 19.8 13.2727 19.8 10.2273Z" fill="#4285F4"/>
                <path d="M10 20C12.7 20 14.9636 19.1045 16.7182 17.5773L13.3864 15.0682C12.4909 15.6682 11.3455 16.0227 10 16.0227C7.39545 16.0227 5.19091 14.2636 4.40455 11.9H0.963636V14.4909C2.70909 17.9591 6.09091 20 10 20Z" fill="#34A853"/>
                <path d="M4.40455 11.9C4.20455 11.3 4.09091 10.6591 4.09091 10C4.09091 9.34091 4.20455 8.7 4.40455 8.1V5.50909H0.963636C0.35 6.72727 0 8.11818 0 10C0 11.8818 0.35 13.2727 0.963636 14.4909L4.40455 11.9Z" fill="#FBBC04"/>
                <path d="M10 3.97727C11.4682 3.97727 12.7864 4.48182 13.8227 5.47273L16.7636 2.53182C14.9591 0.818182 12.6955 0 10 0C6.09091 0 2.70909 2.04091 0.963636 5.50909L4.40455 8.1C5.19091 5.73636 7.39545 3.97727 10 3.97727Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-black dark:border-white"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-gray-900 text-black dark:text-white">Or</span>
              </div>
            </div>
            
            <form onSubmit={handleLocalSubmit} className="space-y-4">
              <div>
                <label className="block mb-2 text-black dark:text-white">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                  placeholder="Enter your email"
                  required
                />
              </div>
              
              <div>
                <label className="block mb-2 text-black dark:text-white">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                  placeholder="Enter your password"
                  required
                />
              </div>
              
              {mode === 'signup' && (
                <div>
                  <label className="block mb-2 text-black dark:text-white">Confirm Password</label>
                  <input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              )}
              
              <button
                type="submit"
                className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                disabled={loading}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Register'}
              </button>
            </form>
            
            <div className="mt-4 text-center">
              <button
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-sm hover:underline text-black dark:text-white"
              >
                {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Login'}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
