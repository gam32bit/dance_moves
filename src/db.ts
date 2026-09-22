import Dexie, { type Table } from 'dexie';
import { reportError } from './errors';
import type { Clip, Move } from './types';

export class DanceMovesDB extends Dexie {
  moves!: Table<Move, string>;
  clips!: Table<Clip, string>;
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('dance-moves');
    this.version(1).stores({
      moves: 'id, status, sortIndex, createdAt',
      clips: 'id, moveId, recordedAt',
      meta: 'key',
    });
  }
}

export const db = new DanceMovesDB();

// A closed or blocked IndexedDB connection is this app's worst failure mode:
// every pending and future read/write stays pending forever, so the UI sits on
// "Saving…" and "Loading…" with nothing thrown and nothing to report. These
// handlers turn that silent hang into something visible.
// Reopening is attempted exactly once. Dexie also fires `close` when it closes
// the connection itself, so an unconditional reopen can cycle
// close -> open -> blocked -> close on the very device that is already wedged.
let reopenAttempted = false;

db.on('close', () => {
  reportError(
    'Database connection',
    new Error(
      'The database connection was closed. Reload the app to get your moves back.',
    ),
  );
  // Queries that were already pending stay pending even after a successful
  // reopen, so this only helps future ones — reloading is the real recovery.
  if (reopenAttempted) return;
  reopenAttempted = true;
  db.open().catch((err) => reportError('Reopen database', err));
});

db.on('blocked', () => {
  reportError(
    'Database connection',
    new Error(
      'Another tab is holding the database open. Close other copies of this app.',
    ),
  );
});

/**
 * A one-line snapshot of why a database operation might have failed, for the
 * error toast. The bugs worth diagnosing here only show up on a real phone, so
 * the app has to report this itself.
 */
export async function storageDiagnostics(): Promise<string> {
  const parts = [`db ${db.isOpen() ? 'open' : 'closed'}`];
  try {
    const est = await navigator.storage?.estimate?.();
    if (est && est.usage != null && est.quota != null) {
      const mb = (n: number) => Math.round(n / 1e6);
      parts.push(`storage ${mb(est.usage)}MB used of ${mb(est.quota)}MB`);
    }
  } catch {
    // estimate() is optional and may throw in private browsing.
  }
  return parts.join(', ');
}

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
