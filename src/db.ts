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
db.on('close', () => {
  reportError(
    'Database connection',
    new Error('The database connection was closed. Reopening…'),
  );
  // Best effort: another tab upgrading, or the browser reclaiming storage, can
  // close us. Reopening restores live queries without a reload.
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

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
