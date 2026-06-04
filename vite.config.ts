import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:3001';
  const apiUrl = env.VITE_API_URL?.trim();

  if (mode === 'production' && process.env.VERCEL === '1' && !apiUrl) {
    throw new Error(
      'VITE_API_URL is required on Vercel. Set it to your Render backend URL (e.g. https://your-service.onrender.com) in Project Settings → Environment Variables, then redeploy.'
    );
  }

  if (mode === 'production' && !apiUrl) {
    console.warn(
      '[vite] VITE_API_URL is not set. Production API requests will use relative /api paths and hit the frontend host instead of Render.'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
        },
      },
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
