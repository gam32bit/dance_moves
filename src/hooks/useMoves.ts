import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Move, MoveStatus } from '../types';

const rank: Record<MoveStatus, number> = { not_started: 0, in_progress: 0, ready: 1 };

/** All moves, with "Ready" moves pushed to the bottom. */
export function useMoves(): Move[] | undefined {
  return useLiveQuery(async () => {
    const moves = await db.moves.toArray();
    return moves.sort(
      (a, b) => rank[a.status] - rank[b.status] || a.sortIndex - b.sortIndex,
    );
  });
}

/** `undefined` while loading, `null` when there is no such move. */
export function useMove(id: string | undefined): Move | null | undefined {
  return useLiveQuery(
    async () => (id ? ((await db.moves.get(id)) ?? null) : null),
    [id],
  );
}

export async function updateMove(id: string, patch: Partial<Move>): Promise<void> {
  await db.moves.update(id, patch);
}

export async function createMove(name: string): Promise<string> {
  const max = await db.moves.orderBy('sortIndex').last();
  const id = uid();
  await db.moves.add({
    id,
    name: name.trim() || 'New Move',
    notes: '',
    status: 'not_started',
    seedClip: null,
    poster: null,
    createdAt: Date.now(),
    sortIndex: (max?.sortIndex ?? -1) + 1,
  });
  return id;
}

export async function deleteMove(id: string): Promise<void> {
  await db.transaction('rw', db.moves, db.clips, async () => {
    await db.clips.where('moveId').equals(id).delete();
    await db.moves.delete(id);
  });
}
