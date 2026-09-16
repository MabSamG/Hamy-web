// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import netlify from '@astrojs/netlify';

// https://astro.build/config
// The site stays static (prerendered) except for src/pages/api/notify.ts,
// which opts into server rendering (`export const prerender = false`) so it
// can call Resend with a secret API key without exposing it to the client.
export default defineConfig({
  adapter: netlify(),
  vite: {
    plugins: [tailwindcss()]
  }
});