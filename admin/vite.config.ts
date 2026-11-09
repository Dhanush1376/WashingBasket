import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

import { mockRelay } from './mock-relay.ts';

/**
 * The admin portal is its own web app. It shares the customer app's design tokens, data models and
 * formatting (imported from ../mobile) so both stay one product, and never bundles any React Native code.
 * The laundry order system (orders, staff, locations) is the same plain-TypeScript engine the app uses
 * (../mobile/src/mock); `mockRelay` is the dev-only snapshot relay that keeps the two apps in step.
 */
export default defineConfig({
  // where it is served from: '/' on its own, '/admin/' when it is deployed inside the website
  base: process.env.ADMIN_BASE || '/',
  plugins: [react(), mockRelay()],
  // Compile everything, including the shared files under ../mobile, with the portal's own tsconfig. Otherwise
  // Vite picks up mobile/tsconfig.json for those files, whose `extends: "expo/tsconfig.base"` it can't resolve.
  tsconfig: './tsconfig.json',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@customer': fileURLToPath(new URL('../mobile/src', import.meta.url)),
      '@customer-assets': fileURLToPath(new URL('../mobile/assets', import.meta.url)),
    },
  },
  server: { port: 5180, fs: { allow: ['..'] } },
  preview: { port: 5181 },
});
