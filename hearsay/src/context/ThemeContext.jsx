import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('hearsay:theme');
      if (stored) return stored;
      // Default to system preference if available
      if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      return 'light';
    } catch (e) {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('hearsay:theme', theme);
    } catch (e) {
      // ignore storage errors in environments where localStorage isn't available
    }
  }, [theme]);

  // Apply the `dark` class to the document root when theme is 'dark'
  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch (e) {
      // ignore if document isn't available (SSR) or other errors
    }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// Safe hook: returns default values if provider isn't mounted to avoid runtime crashes
export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { theme: 'light', toggle: () => {} };
}

export default ThemeContext;
