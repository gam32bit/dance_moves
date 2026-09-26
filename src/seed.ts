import { db, getMeta, setMeta, uid } from './db';
import type { ClipIndexEntry, Move } from './types';

const SEED_VERSION = 1;

/**
 * On first run, create one move per bundled clip from public/clips/index.json.
 * On every run, bring seed moves' posters in line with the index.
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

  await syncPosters(entries);

  const done = await getMeta<number>('seededVersion');
  if (done === SEED_VERSION) return;

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
