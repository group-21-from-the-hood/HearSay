import { useEffect, useState } from 'react';
import Avatar from './Avatar';

export default function ProfilePage() {
  const [state, setState] = useState({ loading: true, error: null, profile: null });

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
          }
        }
      } catch (e) {
        if (!cancelled) setState({ loading: false, error: String(e), profile: null });
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
            <dl className="space-y-2 text-black dark:text-white">
              <div className="flex justify-between"><dt className="text-gray-600 dark:text-gray-400">First Name</dt><dd>{p.firstname || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-600 dark:text-gray-400">Last Name</dt><dd>{p.lastname || '-'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-600 dark:text-gray-400">Email</dt><dd>{p.email || '-'}</dd></div>
            </dl>
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
          </div>
        </div>
      </div>
    </div>
  );
}