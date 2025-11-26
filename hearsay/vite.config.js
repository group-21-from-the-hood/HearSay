import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: mode === 'production' ? 'http://backend:5174' : 'http://localhost:5174',
        changeOrigin: true,
      },
    },
  },
}));
