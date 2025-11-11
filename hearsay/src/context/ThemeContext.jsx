import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // Start with light mode by default, ignore localStorage initially
  const [theme, setTheme] = useState('light');
  const [mounted, setMounted] = useState(false);

  // Only load from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved && (saved === 'light' || saved === 'dark')) {
      setTheme(saved);
    }
    setMounted(true);
  }, []);

  // Update DOM when theme changes
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    
    // Force remove dark class
    root.classList.remove('dark');
    
    // Only add dark class if theme is dark
    if (theme === 'dark') {
      root.classList.add('dark');
    }
    
    // Save to localStorage
    localStorage.setItem('theme', theme);
    
    // Force log for debugging
    console.log('🎨 Theme updated:', theme);
    console.log('📋 HTML classes:', root.className);
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'light' ? 'dark' : 'light';
      console.log('🔄 Toggling:', prev, '→', newTheme);
      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
