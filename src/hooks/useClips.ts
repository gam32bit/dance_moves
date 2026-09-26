import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, uid } from '../db';
import type { Clip } from '../types';

export function useClips(moveId: string | undefined): Clip[] | undefined {
  return useLiveQuery(
    () =>
      moveId
        ? db.clips.where('moveId').equals(moveId).reverse().sortBy('recordedAt')
        : [],
    [moveId],
  );
}

export async function addClip(
  moveId: string,
  blob: Blob,
  source: Clip['source'],
  note = '',
): Promise<string> {
  const id = uid();
  await db.clips.add({
    id,
    moveId,
    blob,
    mime: blob.type || 'video/mp4',
    note,
    recordedAt: Date.now(),
    source,
  });
  return id;
}

export async function updateClip(id: string, patch: Partial<Clip>): Promise<void> {
  await db.clips.update(id, patch);
}

export async function deleteClip(id: string): Promise<void> {
  await db.clips.delete(id);
}

/** Turn a stored Blob into an object URL that is revoked on unmount. */
export function useBlobUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      // Drop the old URL too; its blob's cleanup below has already revoked it.
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
