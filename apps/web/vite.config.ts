import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Read the repo-root .env so web and API share one config file.
  const env = loadEnv(mode, '../..', 'VITE_');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Same-origin /api in the browser: no CORS in dev, cookies just work.
      proxy: { '/api': env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000' },
    },
  };
});
