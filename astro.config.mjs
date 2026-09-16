// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

// https://astro.build/config
// The site stays static (prerendered) except for src/pages/api/notify.ts,
// which opts into server rendering (`export const prerender = false`) so it
// can call Resend with a secret API key without exposing it to the client.
export default defineConfig({
  adapter: netlify({
    // We only use one plain server route (src/pages/api/notify.ts) — no
    // Netlify Edge Functions, Image CDN, or linked-site env vars. Netlify's
    // local emulation of those (which needs Deno for edge functions) was
    // hanging/crashing `astro dev`, so disable it.
    devFeatures: {
      environmentVariables: false,
      images: false,
      edgeFunctions: false,
    },
  }),
  vite: {
    plugins: [tailwindcss()]
  }
});