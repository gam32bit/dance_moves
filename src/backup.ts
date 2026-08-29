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
  const clipRows = await db.clips.toArray();
  const clips = await Promise.all(
    clipRows.map(async ({ blob, ...rest }) => ({
      ...rest,
      blobBase64: await blobToBase64(blob),
    })),
  );
  const file: BackupFile = {
    format: 'dance-moves-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    moves,
    clips,
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(file)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = url;
  a.download = `dance-moves-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
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
