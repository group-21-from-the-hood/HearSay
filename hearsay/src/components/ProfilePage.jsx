import { useEffect, useState } from 'react';
import Avatar from './Avatar';
import { useNavigate } from 'react-router-dom';
import { emitAuthChange } from '../utils/authBus';

// Google PKCE helpers (duplicated; consider refactoring to shared util later)
function base64urlencode(a) {
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
  return base64urlencode(array);
}
async function createCodeChallenge(verifier) {
  const hashed = await sha256(verifier);
  return base64urlencode(hashed);
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, error: null, profile: null });
  const [edit, setEdit] = useState({ firstname: '', lastname: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  // Local account linking state (creating a password for Google-only users)
  const [linkingLocal, setLinkingLocal] = useState(false);
  const [localPw1, setLocalPw1] = useState('');
  const [localPw2, setLocalPw2] = useState('');
  const [localLinkLoading, setLocalLinkLoading] = useState(false);
  const [localLinkError, setLocalLinkError] = useState(null);
  const [localLinkSuccess, setLocalLinkSuccess] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/profile', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok || !data?.ok) {
            setState({ loading: false, error: data?.error || 'Failed to load profile', profile: null });
          } else {
            setState({ loading: false, error: null, profile: data.profile });
            setEdit({ firstname: data.profile.firstname || '', lastname: data.profile.lastname || '' });
          }
        }
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: String(e), profile: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    if (logoutLoading) return;
    if (!confirm('Log out now?')) return;
    setLogoutLoading(true);
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('Logout request failed', e);
    } finally {
      try { localStorage.removeItem('hs_user'); } catch {}
      emitAuthChange({ authenticated: false });
      setLogoutLoading(false);
      navigate('/');
    }
  };

  if (state.loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse h-32 bg-gray-200 dark:bg-gray-800" />
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-red-600">{state.error}</div>
      </div>
    );
  }

  const p = state.profile || {};
  const displayName = [p.firstname, p.lastname].filter(Boolean).join(' ') || p.name || p.email || 'Your Profile';
  let cachedUserPicture;
  try {
    const u = localStorage.getItem('hs_user');
    if (u) cachedUserPicture = JSON.parse(u)?.picture;
  } catch {}
  const pictureSrc = p.picture || cachedUserPicture;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto border-2 border-black dark:border-white bg-white dark:bg-gray-900">
        <div className="p-6 border-b-2 border-black dark:border-white flex items-center gap-4">
          <Avatar src={pictureSrc} name={displayName} size={64} />
          <div>
            <h1 className="text-2xl font-bold text-black dark:text-white"><span className="text-black dark:text-white">{displayName}</span></h1>
            {p.email && <div className="text-gray-700 dark:text-gray-300">{p.email}</div>}
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border-2 border-black dark:border-white p-4">
            <h2 className="font-semibold text-black dark:text-white mb-2"><span className="text-black dark:text-white">Basic Info</span></h2>
            {!isEditing && (
              <div className="space-y-2">
                <div className="flex justify-between text-black dark:text-white"><span className="text-gray-600 dark:text-gray-400">First Name</span><span>{p.firstname || '-'}</span></div>
                <div className="flex justify-between text-black dark:text-white"><span className="text-gray-600 dark:text-gray-400">Last Name</span><span>{p.lastname || '-'}</span></div>
                <div className="flex justify-between text-black dark:text-white"><span className="text-gray-600 dark:text-gray-400">Email</span><span>{p.email || '-'}</span></div>
                {saveSuccess && <div className="text-green-600 text-sm">Profile updated.</div>}
                <div className="flex gap-3">
                  <button
                    onClick={() => { setIsEditing(true); setSaveError(null); setSaveSuccess(false); setEdit({ firstname: p.firstname || '', lastname: p.lastname || '' }); }}
                    className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    disabled={logoutLoading}
                    className="border-2 border-red-600 text-red-700 dark:text-red-400 dark:border-red-500 bg-white dark:bg-gray-900 px-4 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    {logoutLoading ? 'Logging out…' : 'Logout'}
                  </button>
                </div>
              </div>
            )}
            {isEditing && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSaveError(null);
                  setSaveSuccess(false);
                  setSaving(true);
                  try {
                    const resp = await fetch('/api/profile/update', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ firstname: edit.firstname, lastname: edit.lastname })
                    });
                    const data = await resp.json().catch(() => ({}));
                    if (!resp.ok || !data.ok) {
                      setSaveError(data.error || 'Update failed');
                    } else {
                      setState(s => ({ ...s, profile: data.profile }));
                      setSaveSuccess(true);
                      setIsEditing(false);
                    }
                  } catch (err) {
                    setSaveError('Network error');
                  } finally {
                    setSaving(false);
                  }
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-400">First Name</label>
                  <input
                    type="text"
                    value={edit.firstname}
                    onChange={(e) => setEdit(v => ({ ...v, firstname: e.target.value }))}
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-400">Last Name</label>
                  <input
                    type="text"
                    value={edit.lastname}
                    onChange={(e) => setEdit(v => ({ ...v, lastname: e.target.value }))}
                    className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                    maxLength={100}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-600 dark:text-gray-400">Email</label>
                  <input
                    type="text"
                    value={p.email || ''}
                    readOnly
                    className="w-full border-2 border-black dark:border-white bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2"
                  />
                </div>
                {saveError && <div className="text-red-600 text-sm">{saveError}</div>}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditing(false); setSaveError(null); setEdit({ firstname: p.firstname || '', lastname: p.lastname || '' }); }}
                    className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="border-2 border-black dark:border-white p-4">
            <h2 className="font-semibold text-black dark:text-white mb-2"><span className="text-black dark:text-white">Connected Accounts</span></h2>
            <ul className="list-disc pl-5 text-black dark:text-white">
              {(p.accounts || []).length ? (
                (p.accounts || []).map((a, idx) => (
                  <li key={idx}>{a.kind}</li>
                ))
              ) : (
                <li className="text-gray-600 dark:text-gray-400">None</li>
              )}
            </ul>
            {!(p.accounts || []).some(a => a.kind === 'Google') && (
              <button
                onClick={async () => {
                  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
                  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/callback`;
                  if (!clientId) { alert('Missing VITE_GOOGLE_CLIENT_ID'); return; }
                  const verifier = randomString(64);
                  const challenge = await createCodeChallenge(verifier);
                  try { localStorage.setItem('google_pkce_verifier', verifier); } catch { sessionStorage.setItem('google_pkce_verifier', verifier); }
                  const params = new URLSearchParams({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    response_type: 'code',
                    scope: 'openid profile email',
                    access_type: 'offline',
                    include_granted_scopes: 'true',
                    code_challenge: challenge,
                    code_challenge_method: 'S256',
                    prompt: 'select_account'
                  });
                  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
                }}
                className="mt-4 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Link Google Account
              </button>
            )}
            {!(p.accounts || []).some(a => a.kind === 'Local') && (
              <div className="mt-6">
                {!linkingLocal && !localLinkSuccess && (
                  <button
                    onClick={() => { setLinkingLocal(true); setLocalLinkError(null); setLocalPw1(''); setLocalPw2(''); }}
                    className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    Create Local Password
                  </button>
                )}
                {linkingLocal && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setLocalLinkError(null);
                      setLocalLinkSuccess(false);
                      if (localPw1.length < 6) { setLocalLinkError('Password must be at least 6 characters.'); return; }
                      if (localPw1 !== localPw2) { setLocalLinkError('Passwords do not match.'); return; }
                      setLocalLinkLoading(true);
                      try {
                        const resp = await fetch('/api/auth/local/set-password', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ password: localPw1 })
                        });
                        const data = await resp.json().catch(() => ({}));
                        if (!resp.ok || !data.ok) {
                          setLocalLinkError(data.error || 'Failed to link local account');
                        } else {
                          // Update profile state to include Local account
                          setState(s => ({ ...s, profile: { ...s.profile, accounts: [...(s.profile.accounts || []), { kind: 'Local' }] } }));
                          setLocalLinkSuccess(true);
                          setLinkingLocal(false);
                        }
                      } catch (err) {
                        setLocalLinkError('Network error');
                      } finally {
                        setLocalLinkLoading(false);
                      }
                    }}
                    className="space-y-3"
                  >
                    <div>
                      <label className="block text-sm mb-1 text-gray-600 dark:text-gray-400">New Password</label>
                      <input
                        type="password"
                        value={localPw1}
                        onChange={(e) => setLocalPw1(e.target.value)}
                        className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm mb-1 text-gray-600 dark:text-gray-400">Confirm Password</label>
                      <input
                        type="password"
                        value={localPw2}
                        onChange={(e) => setLocalPw2(e.target.value)}
                        className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-3 py-2"
                      />
                    </div>
                    {localLinkError && <div className="text-red-600 text-sm">{localLinkError}</div>}
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={localLinkLoading}
                        className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        {localLinkLoading ? 'Linking...' : 'Save Password'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setLinkingLocal(false); setLocalLinkError(null); }}
                        className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
                {localLinkSuccess && (
                  <div className="text-green-600 text-sm mt-2">Local account linked.</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
