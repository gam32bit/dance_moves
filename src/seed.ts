import { db, getMeta, setMeta, uid } from './db';
import type { ClipIndexEntry, Move } from './types';

const SEED_VERSION = 1;

/** On first run, create one move per bundled clip from public/clips/index.json. */
export async function seedIfNeeded(baseUrl: string): Promise<void> {
  const done = await getMeta<number>('seededVersion');
  if (done === SEED_VERSION) return;

  let entries: ClipIndexEntry[] = [];
  try {
    const res = await fetch(`${baseUrl}clips/index.json`);
    if (res.ok) entries = await res.json();
  } catch {
    // Offline on very first load with no cached index — try again next launch.
    return;
  }

  const existing = await db.moves.count();
  if (existing === 0 && entries.length > 0) {
    const now = Date.now();
    const moves: Move[] = entries.map((e, i) => ({
      id: uid(),
      name: e.defaultName,
      notes: '',
      status: 'not_started',
      seedClip: e.clip,
      poster: e.poster,
      createdAt: now + i,
      sortIndex: i,
    }));
    await db.moves.bulkAdd(moves);
  }

  await setMeta('seededVersion', SEED_VERSION);
}
