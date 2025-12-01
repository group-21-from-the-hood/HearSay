import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emitAuthChange } from '../utils/authBus';

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
      if (!code) {
        setError('No code returned from Google');
        return;
      }

      let code_verifier = null;
      try {
        code_verifier = localStorage.getItem('google_pkce_verifier') || sessionStorage.getItem('google_pkce_verifier');
      } catch (e) {
        code_verifier = sessionStorage.getItem('google_pkce_verifier');
      }
      if (!code_verifier) {
        console.error('Missing PKCE verifier in storage.');
        setError('Missing PKCE verifier. Make sure you completed the login in the same tab.');
        return;
      }

      try {
        const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
        const proxyRes = await fetch(`/api/auth/google/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code, redirect_uri: redirectUri, code_verifier }),
        });

        if (!proxyRes.ok) {
          const errText = await proxyRes.text().catch(() => null);
          console.error('Proxy exchange failed:', proxyRes.status, errText);
          throw new Error(`Token exchange failed: ${proxyRes.status} ${errText || ''}`);
        }

        await proxyRes.json();

        // Clean up verifier
        try {
          localStorage.removeItem('google_pkce_verifier');
        } catch {
          sessionStorage.removeItem('google_pkce_verifier');
        }

        // Fetch fresh session state from server to ensure auth is reflected
        const meRes = await fetch('/api/me', { credentials: 'include' });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated) {
            // Cache user for UI convenience
            try {
              localStorage.setItem('hs_user', JSON.stringify(meData.user));
            } catch {}
            // Notify app of auth state change
            emitAuthChange({ authenticated: true, user: meData.user });
          }
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
