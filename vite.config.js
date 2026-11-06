import { resolve } from 'path';
import { defineConfig } from 'vite';
import { createOmdbMiddleware } from './src/server/omdbMiddleware.js';

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  plugins: [
    {
      name: 'omdb-backend-api',
      configureServer(server) {
        server.middlewares.use(createOmdbMiddleware(() => server.config.root, () => server.config.mode));
      },
      configurePreviewServer(server) {
        server.middlewares.use(createOmdbMiddleware(() => server.config.root, () => server.config.mode));
      }
    }
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Requirement 8: Disable source maps in production
    sourcemap: false,
    // Requirement 10: Optimize the JavaScript production bundle
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        explore: resolve(__dirname, 'explore.html'),
        insights: resolve(__dirname, 'insights.html'),
        evaluation: resolve(__dirname, 'evaluation.html'),
        notFound: resolve(__dirname, '404.html')
      },
      output: {
        manualChunks: {
          recommender: ['./src/scripts/recommender.js', './src/scripts/poster.js']
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  server: {
    port: 3000,
    open: false
  }
}));
