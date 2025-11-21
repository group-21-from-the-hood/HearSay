import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://backend:5174',
        changeOrigin: true,
        // rewrite: (path) => path.replace(/^\/api/, '') // use if backend expects /me instead of /api/me
      },
    },
  },
})
