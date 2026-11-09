import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** The Washing Basket website: a standalone marketing site, separate from the mobile app and the admin portal. */
export default defineConfig({
  plugins: [react()],
  server: { port: 5190, host: true },
  preview: { port: 5191, host: true },
});
