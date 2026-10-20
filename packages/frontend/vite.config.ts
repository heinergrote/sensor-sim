import {defineConfig} from 'vitest/config';
import solid from '@solidjs/vite-plugin';
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    solid({
      start: true,
      diagnostics: false,
    }), // add `ssr: true` for streaming SSR
    tailwindcss(),
  ],
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest-setup.ts'],
    // if you have few tests, try commenting this
    // out to improve performance:
    isolate: false,
  },
  build: {
    target: 'esnext',
    // Keep images as asset files instead of inlining them into the JS bundle.
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000,
  },
  ssr: {
    noExternal: ['maplibre-gl'],
  },
});
