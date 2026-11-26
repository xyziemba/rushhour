import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works when served from https://<user>.github.io/rushhour/
export default defineConfig({
  base: './',
  plugins: [
    VitePWA({
      // A new version waits until the player is back on the home screen (see src/main.ts),
      // so an update never reloads the page in the middle of a level.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Puzzle Lot',
        short_name: 'Puzzle Lot',
        description: 'Small puzzle games you can play in any browser, even offline.',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#2b2d42',
        theme_color: '#2b2d42',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything in the build, including every lazily loaded game, so all
        // games work offline after the first online visit.
        globPatterns: ['**/*.{html,js,css,svg,png,json,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
