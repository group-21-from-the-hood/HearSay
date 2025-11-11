import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Helper to decode JWT payload (unsafe; only used to extract basic profile claims)
function parseJwt (token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      if (!code) {
        setError('No code returned from Google');
        return;
      }

      // Try localStorage first (more robust across redirects/tabs), fall back to sessionStorage
      let code_verifier = null;
      try {
        code_verifier = localStorage.getItem('google_pkce_verifier') || sessionStorage.getItem('google_pkce_verifier');
      } catch (e) {
        code_verifier = sessionStorage.getItem('google_pkce_verifier');
      }
      if (!code_verifier) {
        console.error('Missing PKCE verifier in storage. Expected google_pkce_verifier in localStorage or sessionStorage.');
        setError('Missing PKCE verifier in storage. Make sure you completed the login in the same tab and that your redirect URI matches the app origin.');
        return;
      }

      try {
        const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
        const body = new URLSearchParams({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          code_verifier,
        });

        // Use backend proxy to perform token exchange (keeps client secret on server)
  const backend = import.meta.env.VITE_GOOGLE_BACKEND_URL || 'http://localhost:5174';
        console.log('Calling backend token exchange at', `${backend}/api/auth/google/exchange`);
        const proxyRes = await fetch(`${backend}/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier }),
        });

        if (!proxyRes.ok) {
          const errText = await proxyRes.text().catch(() => null);
          console.error('Proxy exchange failed response:', proxyRes.status, proxyRes.statusText, errText);
          throw new Error(`Token exchange failed: ${proxyRes.status} ${proxyRes.statusText} ${errText || ''}`);
        }

        const tokens = await proxyRes.json();
        // tokens contain access_token, id_token, expires_in, refresh_token (maybe)
        const idToken = tokens.id_token;
        const profile = parseJwt(idToken);

        // Minimal local sign-in: store user info in localStorage
        const user = {
          email: profile?.email,
          name: profile?.name,
          picture: profile?.picture,
          provider: 'google',
          tokens,
        };
        localStorage.setItem('hs_user', JSON.stringify(user));

        // Clean up verifier from storage
        try {
          localStorage.removeItem('google_pkce_verifier');
        } catch (e) {
          sessionStorage.removeItem('google_pkce_verifier');
        }

        // Redirect home
        navigate('/');
      } catch (e) {
        console.error(e);
        setError(e.message || String(e));
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="p-6">
        {error ? (
          <div className="text-red-600">Authentication error: {error}</div>
        ) : (
          <div>Signing in with Google…</div>
        )}
      </div>
    </div>
  );
}
