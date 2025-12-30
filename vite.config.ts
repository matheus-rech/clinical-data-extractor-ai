import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    // Use VITE_BASE_PATH for GitHub Pages deployment, default to '/' for local dev
    const basePath = process.env.VITE_BASE_PATH || '/';

    return {
      // Base path for GitHub Pages (e.g., /clinical-data-extractor-ai/)
      base: basePath,
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY),
        'process.env.ANTHROPIC_API_KEY': JSON.stringify(env.ANTHROPIC_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Generate sourcemaps for debugging
        sourcemap: true,
        // Optimize chunk sizes
        rollupOptions: {
          output: {
            manualChunks: {
              'react-vendor': ['react', 'react-dom'],
              'anthropic': ['@anthropic-ai/sdk'],
            }
          }
        }
      }
    };
});
