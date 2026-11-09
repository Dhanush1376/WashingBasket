/**
 * Puts the admin portal's build inside the website's, so the one deployment serves both:
 * washingbasket.in for the site and washingbasket.in/admin for the portal.
 * (The portal is built first with ADMIN_BASE=/admin/; see vercel.json.)
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const from = fileURLToPath(new URL('../../admin/dist', import.meta.url));
const to = fileURLToPath(new URL('../dist/admin', import.meta.url));

if (!existsSync(from)) {
  console.error('admin/dist is missing: build the admin portal first (ADMIN_BASE=/admin/ npm --prefix ../admin run build)');
  process.exit(1);
}
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });
console.log('admin portal copied into dist/admin');
