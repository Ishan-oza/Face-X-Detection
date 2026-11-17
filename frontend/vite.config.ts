import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // API_PROXY_TARGET (e.g. in .env.local) points the dev proxy at the FastAPI
  // server. It has no VITE_ prefix, so it is never exposed to browser code.
  const env = loadEnv(mode, '.', '');
  const target = env.API_PROXY_TARGET || 'http://127.0.0.1:8001';

  // Requests to /api and /outputs are proxied to FastAPI so the browser never needs CORS.
  // 127.0.0.1 avoids IPv6 `localhost` resolution issues.
  const apiProxy = {
    '/api': { target, changeOrigin: true },
    '/outputs': { target, changeOrigin: true },
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy: apiProxy },
    preview: { port: 4173, proxy: apiProxy },
  };
});
