export const AUTH_EVENT = 'hs-auth-changed';

export function emitAuthChange(detail = {}) {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail }));
  } catch {}
}

export function onAuthChange(handler) {
  const fn = (e) => {
    try { handler(e.detail); } catch {}
  };
  window.addEventListener(AUTH_EVENT, fn);
  return () => window.removeEventListener(AUTH_EVENT, fn);
}
