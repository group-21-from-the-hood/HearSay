import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const removeToastNow = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const beginDismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    // Allow exit transition to play
    setTimeout(() => removeToastNow(id), 180);
  }, [removeToastNow]);

  const addToast = useCallback((message, opts = {}) => {
    const { type = 'info', duration = 2000 } = opts;
    const id = `${Date.now()}-${counterRef.current++}`;
    setToasts((prev) => [...prev, { id, message, type, leaving: false }]);
    if (duration > 0) {
      setTimeout(() => beginDismiss(id), duration);
    }
    return id;
  }, [beginDismiss]);

  const api = useMemo(() => ({
    show: (msg, opts) => addToast(msg, opts),
    success: (msg, duration = 2000) => addToast(msg, { type: 'success', duration }),
    error: (msg, duration = 3000) => addToast(msg, { type: 'error', duration }),
    info: (msg, duration = 2000) => addToast(msg, { type: 'info', duration }),
    dismiss: (id) => beginDismiss(id),
  }), [addToast, beginDismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Viewport */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'pointer-events-auto min-w-[200px] max-w-xs border-2 px-3 py-2 text-sm shadow-md transition-all duration-150',
              t.leaving ? 'opacity-0 translate-x-2' : 'opacity-100 translate-x-0',
              'bg-white dark:bg-gray-900',
              t.type === 'success' && 'border-green-600 dark:border-green-500 text-green-700 dark:text-green-400',
              t.type === 'error' && 'border-red-600 dark:border-red-500 text-red-700 dark:text-red-400',
              t.type === 'info' && 'border-gray-700 dark:border-gray-400 text-black dark:text-white',
            ].filter(Boolean).join(' ')}
          >
            <div className="flex items-start gap-2">
              <span className="flex-1 break-words">{t.message}</span>
              <button
                onClick={() => beginDismiss(t.id)}
                className="ml-2 text-xs opacity-70 hover:opacity-100"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

export default ToastContext;
