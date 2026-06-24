/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// DropLab is a fully offline, local-only tool. The build emits static files
// (relative base) so the app can be opened from disk or served from any local
// static server with no network access. No CDN, fonts, analytics or telemetry.
export default defineConfig({
  plugins: [react()],
  // Relative base lets dist/index.html be opened directly (file://) or served
  // from any sub-path on a local static server.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Inline nothing to a remote; everything is bundled locally.
    assetsInlineLimit: 4096,
    // Disable the module-preload polyfill: it injects a fetch() helper for
    // local chunks. We bundle into a single chunk and never want any runtime
    // fetch, so removing it keeps the no-egress posture airtight.
    modulePreload: false,
    // An offline, single-bundle tool intentionally ships one larger JS file.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/engine/**', 'src/io/**'],
      reporter: ['text', 'html'],
    },
  },
});
