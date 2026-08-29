export type MoveStatus = 'not_started' | 'in_progress' | 'ready';

export const STATUS_LABELS: Record<MoveStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  ready: 'Ready',
};

export const STATUS_ORDER: MoveStatus[] = ['not_started', 'in_progress', 'ready'];

export interface Move {
  id: string;
  name: string;
  notes: string;
  status: MoveStatus;
  /** Filename in /clips for a bundled seed clip, or null for a user-created move. */
  seedClip: string | null;
  poster: string | null;
  createdAt: number;
  sortIndex: number;
}

export interface Clip {
  id: string;
  moveId: string;
  blob: Blob;
  mime: string;
  note: string;
  recordedAt: number;
  source: 'recorded' | 'uploaded';
}

export interface ClipIndexEntry {
  clip: string;
  poster: string | null;
  originalName: string;
  defaultName: string;
}
