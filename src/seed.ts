import { db, getMeta, setMeta, uid } from './db';
import type { ClipIndexEntry, Move } from './types';

/**
 * The clips bundled in the first release. A device that was seeded back then
 * (`seededVersion` 1) has already been offered these, so they must not come
 * back if the user deleted the move. Explicit rather than "whatever moves exist
 * now", which can't tell a deleted seed move from a new one.
 */
const FIRST_BATCH = [
  'IMG_3758.mp4', 'IMG_3759.mp4', 'IMG_3768.mp4', 'IMG_3769.mp4', 'IMG_3770.mp4',
  'IMG_3771.mp4', 'IMG_3772.mp4', 'IMG_3773.mp4', 'IMG_3774.mp4', 'IMG_3775.mp4',
  'IMG_3776.mp4', 'IMG_3777.mp4', 'IMG_3778.mp4', 'IMG_3779.mp4', 'IMG_3780.mp4',
  'IMG_3781.mp4', 'IMG_3782.mp4', 'IMG_3783.mp4', 'IMG_3784.mp4', 'IMG_3785.mp4',
  'IMG_3786.mp4', 'IMG_3787.mp4', 'IMG_3788.mp4', 'IMG_3789.mp4', 'IMG_3790.mp4',
  'IMG_3791.mp4', 'IMG_3792.mp4', 'IMG_3793.mp4',
];

/**
 * Create a move for every bundled clip in public/clips/index.json this device
 * hasn't been offered yet, so clips added in later releases show up on phones
 * that were seeded earlier. Also brings seed moves' posters in line with the index.
 */
export async function seedIfNeeded(baseUrl: string): Promise<void> {
  let entries: ClipIndexEntry[] = [];
  try {
    const res = await fetch(`${baseUrl}clips/index.json`);
    if (res.ok) entries = await res.json();
  } catch {
    // Offline on very first load with no cached index — try again next launch.
    return;
  }
  if (entries.length === 0) return;

  await syncPosters(entries);

  let offered = await getMeta<string[]>('seededClips');
  if (!offered) {
    offered = (await getMeta<number>('seededVersion')) === 1 ? FIRST_BATCH : [];
  }
  const known = new Set(offered);
  const existing = await db.moves.toArray();
  const present = new Set(existing.map((m) => m.seedClip));
  const fresh = entries.filter((e) => !known.has(e.clip) && !present.has(e.clip));

  if (fresh.length > 0) {
    const now = Date.now();
    const maxSort = existing.reduce((max, m) => Math.max(max, m.sortIndex), -1);
    const moves: Move[] = fresh.map((e, i) => ({
      id: uid(),
      name: e.defaultName,
      notes: '',
      status: 'not_started',
      seedClip: e.clip,
      poster: e.poster,
      createdAt: now + i,
      sortIndex: maxSort + 1 + i,
    }));
    await db.moves.bulkAdd(moves);
  }

  for (const e of entries) known.add(e.clip);
  await setMeta('seededClips', [...known]);
}

/**
 * Posters live in the move row, so a new still in the index would otherwise
 * never reach moves seeded before it. Runs each launch; only writes changes.
 */
async function syncPosters(entries: ClipIndexEntry[]): Promise<void> {
  const byClip = new Map(entries.map((e) => [e.clip, e.poster]));
  const moves = await db.moves.filter((m) => m.seedClip !== null).toArray();
  for (const m of moves) {
    const poster = byClip.get(m.seedClip!);
    if (poster !== undefined && poster !== m.poster) {
      await db.moves.update(m.id, { poster });
    }
  }
}
