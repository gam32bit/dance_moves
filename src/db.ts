import Dexie, { type Table } from 'dexie';
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

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
