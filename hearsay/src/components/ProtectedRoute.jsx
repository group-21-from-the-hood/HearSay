import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const [state, setState] = useState({ loading: true, authenticated: false });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Quick optimistic check using cached user to reduce flicker
        let cachedAuth = false;
        try {
          const u = localStorage.getItem('hs_user');
          if (u) cachedAuth = true;
        } catch {}
        if (!cancelled && cachedAuth) setState({ loading: false, authenticated: true });

        const res = await fetch('/api/me', { credentials: 'include' });
        const data = await res.json().catch(() => ({ authenticated: false }));
        if (!cancelled) setState({ loading: false, authenticated: !!data.authenticated });
      } catch {
        if (!cancelled) setState({ loading: false, authenticated: false });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state.loading) {
    return null; // or a small loader if desired
  }

  if (!state.authenticated) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return children;
}
