import { db } from './db';
import type { Clip, Move } from './types';

interface BackupFile {
  format: 'dance-moves-backup';
  version: 1;
  exportedAt: string;
  moves: Move[];
  clips: Array<Omit<Clip, 'blob'> & { blobBase64: string }>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportBackup(): Promise<void> {
  const moves = await db.moves.toArray();
  const ids = await db.clips.orderBy('recordedAt').primaryKeys();

  // Assembled as Blob parts rather than one JSON.stringify of everything: a few
  // hundred MB of video base64-encodes into a single string that exceeds the
  // engine's max string length, so the old version failed on exactly the
  // libraries big enough to be worth backing up.
  const parts: BlobPart[] = [
    `{"format":"dance-moves-backup","version":1,"exportedAt":${JSON.stringify(
      new Date().toISOString(),
    )},"moves":${JSON.stringify(moves)},"clips":[`,
  ];

  let first = true;
  for (const id of ids) {
    const clip = await db.clips.get(id as string);
    if (!clip) continue;
    const { blob, ...rest } = clip;
    const entry = { ...rest, blobBase64: await blobToBase64(blob) };
    parts.push((first ? '' : ',') + JSON.stringify(entry));
    first = false;
  }
  parts.push(']}');

  const url = URL.createObjectURL(new Blob(parts, { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dance-moves-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download before it starts.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function importBackup(file: File): Promise<void> {
  const data: BackupFile = JSON.parse(await file.text());
  if (data.format !== 'dance-moves-backup') throw new Error('Not a Dance Moves backup file');
  const clips: Clip[] = data.clips.map(({ blobBase64, ...rest }) => ({
    ...rest,
    blob: base64ToBlob(blobBase64, rest.mime),
  }));
  await db.transaction('rw', db.moves, db.clips, async () => {
    await db.moves.clear();
    await db.clips.clear();
    await db.moves.bulkAdd(data.moves);
    await db.clips.bulkAdd(clips);
  });
}
