import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    // Build for the car's Chrome (101) instead of Vite's newer default
    build: {
      target: 'chrome100',
      cssTarget: 'chrome100',
    },
    server: {
      // HMR is disabled in AI Studio preview iframe to prevent WebSocket connection errors
      hmr: false,
      watch: null,
    },
  };
});
