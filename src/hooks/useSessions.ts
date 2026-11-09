import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Session } from '../types';
import { createMove, updateMove } from './useMoves';
import { addClip } from './useClips';

/** Sessions delete themselves this long after they were recorded. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface SessionSummary {
  id: string;
  recordedAt: number;
}

/**
 * Newest first, without loading any video. Reads the recordedAt index and its
 * primary keys only — full rows would pull every long recording into memory.
 */
export function useSessionList(): SessionSummary[] | undefined {
  return useLiveQuery(async () => {
    const coll = () => db.sessions.orderBy('recordedAt').reverse();
    const [times, ids] = await Promise.all([coll().keys(), coll().primaryKeys()]);
    return ids.map((id, i) => ({ id: String(id), recordedAt: Number(times[i]) }));
  });
}

/** `undefined` while loading, `null` when there is no such session. */
export function useSession(id: string | undefined): Session | null | undefined {
  return useLiveQuery(
    async () => (id ? ((await db.sessions.get(id)) ?? null) : null),
    [id],
  );
}

export async function addSession(blob: Blob, source: Session['source']): Promise<string> {
  const id = uid();
  await db.sessions.add({
    id,
    blob,
    mime: blob.type || 'video/mp4',
    recordedAt: Date.now(),
    source,
  });
  return id;
}

export async function deleteSession(id: string): Promise<void> {
  await db.sessions.delete(id);
}

export async function purgeOldSessions(): Promise<void> {
  await db.sessions.where('recordedAt').below(Date.now() - SESSION_TTL_MS).delete();
}

export function daysLeft(recordedAt: number): number {
  return Math.max(0, Math.ceil((recordedAt + SESSION_TTL_MS - Date.now()) / 86_400_000));
}

/**
 * Turn a clip cut from a session into a gallery move: the cut becomes the
 * move's main clip and the picked frame its thumbnail. One transaction, so a
 * failure can't leave a move with no video.
 */
export async function addMoveFromCut(name: string, blob: Blob, still: string): Promise<string> {
  return db.transaction('rw', db.moves, db.clips, async () => {
    const moveId = await createMove(name);
    const clipId = await addClip(moveId, blob, 'recorded', 'Cut from a session');
    await updateMove(moveId, { mainClipId: clipId, still });
    return moveId;
  });
}
