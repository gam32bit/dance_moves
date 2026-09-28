import { useEffect, useState } from 'react';
import type { Clip } from '../types';
import { deleteClip, updateClip, useBlobUrl } from '../hooks/useClips';
import { guard } from '../errors';

function ClipItem({
  clip,
  isMain,
  onUseAsMain,
}: {
  clip: Clip;
  isMain: boolean;
  onUseAsMain: () => void;
}) {
  const url = useBlobUrl(clip.blob);
  const [note, setNote] = useState(clip.note);

  // Adopt the stored note if it changes elsewhere (import, another tab).
  useEffect(() => setNote(clip.note), [clip.note]);
  const date = new Date(clip.recordedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <li className="clip">
      {url && <video src={url} controls playsInline className="clip-video" />}
      <div className="clip-meta">
        <span className="muted">{date} · {clip.source}</span>
        <input
          className="clip-note"
          value={note}
          placeholder="Add a note…"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() =>
            note !== clip.note &&
            void guard('Save clip note', () => updateClip(clip.id, { note }))
          }
        />
        <div className="clip-actions">
          {isMain ? (
            <span className="muted">Main clip</span>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={onUseAsMain}>
              Use as main
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => void guard('Delete clip', () => deleteClip(clip.id))}
          >
            Delete
          </button>
        </div>
      </div>
    </li>
  );
}

export default function ClipList({
  clips,
  mainClipId,
  onUseAsMain,
}: {
  clips: Clip[];
  mainClipId: string | undefined;
  onUseAsMain: (clipId: string) => void;
}) {
  if (clips.length === 0) return <p className="muted">No practice clips saved yet.</p>;
  return (
    <ul className="clip-list">
      {clips.map((c) => (
        <ClipItem
          key={c.id}
          clip={c}
          isMain={c.id === mainClipId}
          onUseAsMain={() => onUseAsMain(c.id)}
        />
      ))}
    </ul>
  );
}
