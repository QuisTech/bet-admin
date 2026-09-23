import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3010,
    strictPort: true,
    host: true,
    proxy: {
      '/api/fpl': {
        target: 'https://fantasy.premierleague.com/api',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fpl/, ''),
      },
      '/api/odds': {
        target: 'https://api.the-odds-api.com/v4',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/odds/, ''),
      },
    },
  },
});
