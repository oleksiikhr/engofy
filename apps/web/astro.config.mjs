import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// The Nest API and this Astro server sit behind one domain. In production a
// reverse proxy routes `/api/*` to Nest (stripping the prefix); in dev the
// Vite proxy below does the same so browser-side HTMX calls to `/api/...`
// reach Nest without CORS. SSR code calls Nest directly via `src/lib/api.ts`
// using API_ORIGIN, so it does not depend on this proxy.
// The Nest web server listens on PORT (default 8080 — see
// src/core/config/app.config.ts). Override API_ORIGIN per environment.
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:8080';

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: 4321, host: true },
  // No `<Image>` usage — skip the sharp-based optimizer (and its churny
  // platform binaries) entirely.
  image: { service: { entrypoint: 'astro/assets/services/noop' } },
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: API_ORIGIN,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  },
});
