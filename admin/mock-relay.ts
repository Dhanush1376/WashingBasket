/**
 * DEVELOPMENT-ONLY mock relay for the laundry demo. NOT a backend and NOT a database.
 *
 * The customer/staff app (Expo, :8081) and this portal (:5180) run on different origins, so they can't share
 * browser storage. This Vite plugin keeps the latest demo snapshot in memory (and in admin/.mock-relay/ so a dev
 * server restart keeps it) and hands it to whichever client asks:
 *
 *   GET  /__wb-mock/state[?after=rev]  → { rev, state } (204 when nothing is newer than `after`)
 *   PUT  /__wb-mock/state  { baseRev, state }  → { rev }, or 409 { rev, state } when someone else wrote first
 *   POST /__wb-mock/reset  { state }  → { rev }
 *
 * All business rules run in the clients (src/mock/engine); this file only stores the snapshot and refuses
 * stale writes. It runs on your machine only, inside `npm run dev` / `npm run preview`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '.mock-relay');
const FILE = join(DIR, 'state.json');

type Snapshot = { rev: number; state: unknown | null };

function load(): Snapshot {
  try {
    if (existsSync(FILE)) return JSON.parse(readFileSync(FILE, 'utf8')) as Snapshot;
  } catch {
    /* unreadable: start empty, the first client seeds it */
  }
  return { rev: 0, state: null };
}

let snap: Snapshot = load();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      mkdirSync(DIR, { recursive: true });
      writeFileSync(FILE, JSON.stringify(snap));
    } catch {
      /* the in-memory copy still works */
    }
  }, 200);
}

function body(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, data?: unknown) {
  res.statusCode = status;
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (data === undefined) return res.end();
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url ?? '/', 'http://local');
  if (!url.pathname.startsWith('/__wb-mock/')) return next();
  if (req.method === 'OPTIONS') return send(res, 204);
  try {
    if (url.pathname === '/__wb-mock/state' && req.method === 'GET') {
      const after = url.searchParams.get('after');
      if (after !== null && Number(after) === snap.rev) return send(res, 204);
      return send(res, 200, snap);
    }
    if (url.pathname === '/__wb-mock/state' && req.method === 'PUT') {
      const { baseRev, state } = (await body(req)) as { baseRev: number; state: unknown };
      if (!state || typeof state !== 'object') return send(res, 400, { error: 'state required' });
      if (snap.state !== null && baseRev !== snap.rev) return send(res, 409, snap);
      snap = { rev: snap.rev + 1, state };
      save();
      return send(res, 200, { rev: snap.rev });
    }
    if (url.pathname === '/__wb-mock/reset' && req.method === 'POST') {
      const { state } = (await body(req)) as { state: unknown };
      if (!state || typeof state !== 'object') return send(res, 400, { error: 'state required' });
      snap = { rev: snap.rev + 1, state };
      save();
      return send(res, 200, { rev: snap.rev });
    }
    return send(res, 404, { error: 'unknown mock relay route' });
  } catch {
    return send(res, 400, { error: 'bad request' });
  }
}

export function mockRelay(): Plugin {
  return {
    name: 'wb-mock-relay',
    configureServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next));
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => void handle(req, res, next));
    },
  };
}
