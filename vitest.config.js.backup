import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  define: {
    // Force axiosInstance to use a real baseURL in tests so MSW can intercept.
    'import.meta.env.VITE_USE_REAL_API': JSON.stringify('true'),
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify('http://localhost:8080'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false, // Don't parse SCSS during tests — massive speedup
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        'src/assets/',
        '**/*.scss',
        '**/*.config.js',
        'src/main.jsx',
      ],
      thresholds: {
        // Start conservative; ratchet up as coverage grows.
        lines: 40,
        functions: 40,
        branches: 30,
        statements: 40,
      },
    },
    include: ['src/**/*.{test,spec}.{js,jsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
