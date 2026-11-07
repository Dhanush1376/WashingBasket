/**
 * THE one mock data store for the laundry system. The customer screens, the staff screens and the admin portal all
 * read and change this state — never copies of it — so order WB-1001 is the same record everywhere.
 *
 * DEVELOPMENT-ONLY PERSISTENCE (not a backend):
 *  - Every change is saved on the device (AsyncStorage in the app, localStorage in the portal), so a refresh
 *    keeps the demo where it was. "Reset demo data" brings back the seed.
 *  - The customer app (Expo) and the admin portal (Vite) run on different origins, so they can't share browser
 *    storage. When the admin dev server is running it also serves a tiny mock relay at /__wb-mock (see
 *    admin/mock-relay.ts): each client pushes its latest snapshot there and polls for newer ones. Nothing leaves
 *    your machine and there is no database. Without the relay, each app keeps working on its own copy.
 *
 * Changes go through `transact`: the operation runs on a copy, and the copy replaces the state only if the
 * operation finished. Operations run one at a time, and before each one the latest snapshot is pulled, so a
 * second device can't pay or accept an order twice; a write that loses a race is re-run on the newer state,
 * where the engine's rules refuse it.
 */
import { clone, ctxNow } from '../engine/util.ts';
import { SCHEMA_VERSION } from '../engine/seed.ts';
import type { MockState, OpContext } from '../types.ts';

export type StorageAdapter = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

/** 'live': synced through the dev relay. 'local': this device only. 'starting': not loaded yet. */
export type SyncStatus = 'starting' | 'live' | 'local';

export type StoreView = { ready: boolean; state: MockState | null; rev: number; sync: SyncStatus };

type Config = {
  storage: StorageAdapter;
  /** e.g. "http://localhost:5180" or "" for same-origin; null turns the relay off. */
  relayUrl: string | null;
  seed: () => MockState;
  clientName: string;
};

type Persisted = { rev: number; syncedRev: number; state: MockState };

const KEY = `wb.laundry-demo.v${SCHEMA_VERSION}`;
const RELAY_PATH = '/__wb-mock';
const POLL_MS = 1500;
const POLL_LOCAL_MS = 6000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init?: RequestInit, timeoutMs = 2500): Promise<Response> {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const t = setTimeout(() => ctrl?.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl?.signal, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
  } finally {
    clearTimeout(t);
  }
}

class MockStore {
  private config: Config | null = null;
  private state: MockState | null = null;
  private rev = 0;
  private syncedRev = 0;
  private sync: SyncStatus = 'starting';
  private view: StoreView = { ready: false, state: null, rev: 0, sync: 'starting' };
  private listeners = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private readyPromise: Promise<void> | null = null;

  configure(config: Config) {
    if (this.config) return;
    this.config = config;
    this.readyPromise = this.boot();
  }

  ready(): Promise<void> {
    if (!this.readyPromise) throw new Error('Mock store used before configure()');
    return this.readyPromise;
  }

  getView = (): StoreView => this.view;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  /** The current state. Treat it as read-only: change it only through `transact`. */
  get(): MockState {
    if (!this.state) throw new Error('Mock store not ready');
    return this.state;
  }

  /** Runs one business operation; resolves with its result, or rejects (changing nothing) if a rule said no. */
  transact<R>(fn: (draft: MockState, ctx: OpContext) => R): Promise<R> {
    const run = async () => {
      await this.ready();
      for (let attempt = 0; attempt < 4; attempt++) {
        if (this.sync === 'live') await this.pull();
        const draft = clone(this.get());
        const result = fn(draft, ctxNow());
        const pushed = await this.push(draft);
        if (pushed === 'conflict') continue; // someone else changed it first: run again on their newer state
        return result;
      }
      throw new Error('The demo data is busy. Please try again.');
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }

  /** Puts the seed back, here and (when connected) on the relay, so every app starts over together. */
  async reset() {
    await this.ready();
    const seed = this.config!.seed();
    if (this.relayBase() !== null) {
      try {
        const res = await request(`${this.relayBase()}${RELAY_PATH}/reset`, { method: 'POST', body: JSON.stringify({ state: seed, by: this.config!.clientName }) });
        if (res.ok) {
          const { rev } = (await res.json()) as { rev: number };
          this.commit(seed, rev, rev, 'live');
          return;
        }
      } catch {
        /* relay away: reset this device only */
      }
    }
    this.commit(seed, this.rev + 1, this.syncedRev, this.sync === 'live' ? 'local' : this.sync);
  }

  /* ───────── internals ───────── */

  private relayBase(): string | null {
    return this.config?.relayUrl ?? null;
  }

  private async boot() {
    const { storage, seed } = this.config!;
    let local: Persisted | null = null;
    try {
      const raw = await storage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as Persisted) : null;
      if (parsed?.state?.schema === SCHEMA_VERSION) local = parsed;
    } catch {
      /* unreadable or blocked storage: start from the seed */
    }
    const fresh = seed();
    if (local?.state) {
      local.state.catalog = fresh.catalog;
      if (!local.state.catalog.categories.some((c) => c.id === 'only-wash')) {
        local = null;
      }
    }
    this.state = local?.state ?? fresh;
    this.rev = local?.rev ?? 0;
    this.syncedRev = local?.syncedRev ?? 0;
    await this.connect();
    this.publish();
    this.schedulePoll();
  }

  /** First contact with the relay: adopt its snapshot, or give it ours if it has none (or ours is the newer edit). */
  private async connect() {
    const base = this.relayBase();
    if (base === null) {
      this.sync = 'local';
      return;
    }
    try {
      const res = await request(`${base}${RELAY_PATH}/state`);
      if (!res.ok) throw new Error('relay');
      const remote = (await res.json()) as { rev: number; state: MockState | null };
      const remoteUsable = remote.state && remote.state.schema === SCHEMA_VERSION;
      const localDirty = this.rev > this.syncedRev;
      if (remoteUsable && !(localDirty && remote.rev === this.syncedRev)) {
        this.adopt(remote.state!, remote.rev);
      } else {
        const put = await request(`${base}${RELAY_PATH}/state`, { method: 'PUT', body: JSON.stringify({ baseRev: remote.rev, state: this.state, by: this.config!.clientName }) });
        if (!put.ok) throw new Error('relay');
        const { rev } = (await put.json()) as { rev: number };
        this.rev = rev;
        this.syncedRev = rev;
        this.persist();
      }
      this.sync = 'live';
    } catch {
      this.sync = 'local';
    }
  }

  private async pull() {
    const base = this.relayBase();
    if (base === null) return;
    try {
      const res = await request(`${base}${RELAY_PATH}/state?after=${this.syncedRev}`);
      if (res.status === 204) return;
      if (!res.ok) throw new Error('relay');
      const remote = (await res.json()) as { rev: number; state: MockState | null };
      if (remote.state && remote.state.schema === SCHEMA_VERSION && remote.rev !== this.syncedRev) {
        this.adopt(remote.state, remote.rev);
        this.publish();
      }
    } catch {
      if (this.sync === 'live') {
        this.sync = 'local';
        this.publish();
      }
    }
  }

  private async push(draft: MockState): Promise<'ok' | 'conflict'> {
    const base = this.relayBase();
    if (base !== null && this.sync === 'live') {
      try {
        const res = await request(`${base}${RELAY_PATH}/state`, { method: 'PUT', body: JSON.stringify({ baseRev: this.syncedRev, state: draft, by: this.config!.clientName }) });
        if (res.status === 409) {
          const remote = (await res.json()) as { rev: number; state: MockState };
          this.adopt(remote.state, remote.rev);
          this.publish();
          return 'conflict';
        }
        if (!res.ok) throw new Error('relay');
        const { rev } = (await res.json()) as { rev: number };
        this.commit(draft, rev, rev, 'live');
        return 'ok';
      } catch {
        // relay went away mid-way: keep the change on this device
        this.commit(draft, this.rev + 1, this.syncedRev, 'local');
        return 'ok';
      }
    }
    this.commit(draft, this.rev + 1, this.syncedRev, this.sync);
    return 'ok';
  }

  private adopt(state: MockState, rev: number) {
    this.state = state;
    this.rev = rev;
    this.syncedRev = rev;
    this.persist();
  }

  private commit(state: MockState, rev: number, syncedRev: number, sync: SyncStatus) {
    this.state = state;
    this.rev = rev;
    this.syncedRev = syncedRev;
    this.sync = sync;
    this.persist();
    this.publish();
  }

  private persist() {
    const value: Persisted = { rev: this.rev, syncedRev: this.syncedRev, state: this.state! };
    this.config!.storage.setItem(KEY, JSON.stringify(value)).catch(() => {
      /* storage full or blocked: the demo still works for this session */
    });
  }

  private publish() {
    this.view = { ready: !!this.state, state: this.state, rev: this.rev, sync: this.sync };
    this.listeners.forEach((fn) => fn());
  }

  private schedulePoll() {
    if (this.relayBase() === null) return;
    const tick = async () => {
      // queued writes pull first anyway; polling only keeps idle screens fresh
      await this.queue;
      if (this.sync === 'live') await this.pull();
      else {
        await this.connect();
        if ((this.sync as SyncStatus) === 'live') this.publish();
      }
      setTimeout(tick, this.sync === 'live' ? POLL_MS : POLL_LOCAL_MS);
    };
    setTimeout(tick, POLL_MS);
  }
}

/** The single store instance. Each app configures it once at start-up with its storage and relay address. */
export const mockStore = new MockStore();

/** Simulated network latency for the mock services: enough to show progress, never enough to annoy. */
export const simulateLatency = (ms = 450) => wait(ms);
