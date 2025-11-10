import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('hearsay:theme') || 'light';
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
