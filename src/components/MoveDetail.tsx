import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BASE_URL, clipUrl } from '../App';
import { deleteMove, updateMove, useMove } from '../hooks/useMoves';
import { addClip, useClips } from '../hooks/useClips';
import { useDebouncedField } from '../hooks/useDebouncedField';
import { guard } from '../errors';
import type { MoveStatus } from '../types';
import StatusPicker from './StatusPicker';
import ClipList from './ClipList';
import ClipRecorder from './ClipRecorder';
import Modal from './Modal';
import PracticeTimer from './PracticeTimer';

export default function MoveDetail() {
  const { id } = useParams();
  const move = useMove(id);
  const clips = useClips(id);
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  const seedSrc = move?.seedClip ? clipUrl(BASE_URL, move.seedClip) : undefined;

  const name = useDebouncedField(move?.name, (value) => {
    if (move) void guard('Save name', () => updateMove(move.id, { name: value }));
  });
  const notes = useDebouncedField(move?.notes, (value) => {
    if (move) void guard('Save notes', () => updateMove(move.id, { notes: value }));
  });

  // useMove distinguishes these: undefined while loading, null when missing.
  if (move === undefined) {
    return <div className="page"><p className="muted">Loading…</p></div>;
  }
  if (move === null) {
    return (
      <div className="page">
        <p className="muted">Move not found. <Link to="/">Back to gallery</Link></p>
      </div>
    );
  }

  async function handleCapture(blob: Blob, source: 'recorded' | 'uploaded') {
    if (blob.size === 0) {
      // A zero-length recording would save fine and then play as a broken video.
      return;
    }
    setSaving(true);
    const id = await guard('Save practice clip', () => addClip(move!.id, blob, source));
    setSaving(false);
    // Only dismiss the recorder if the clip actually made it to disk.
    if (id !== undefined) setAdding(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="btn btn-ghost">‹ Gallery</Link>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (confirm(`Delete "${move.name}" and its clips?`)) {
              const ok = await guard('Delete move', () => deleteMove(move.id));
              if (ok !== undefined) navigate('/');
            }
          }}
        >
          Delete move
        </button>
      </header>

      <input
        className="title-input"
        value={name.value}
        onChange={(e) => name.onChange(e.target.value)}
        onBlur={name.onBlur}
      />

      {seedSrc ? (
        <video key={seedSrc} src={seedSrc} controls loop playsInline poster={move.poster ? `${BASE_URL}clips/${move.poster}` : undefined} className="hero-video" />
      ) : clips && clips.length > 0 ? (
        <p className="muted">Reference: your saved clips below.</p>
      ) : (
        <p className="muted">No reference clip. Add one below.</p>
      )}

      <StatusPicker
        value={move.status}
        onChange={(s: MoveStatus) =>
          void guard('Update status', () => updateMove(move.id, { status: s }))
        }
      />

      <PracticeTimer />

      <label className="field">
        <span>Notes</span>
        <textarea
          value={notes.value}
          rows={3}
          placeholder="Cues, counts, things to fix…"
          onChange={(e) => notes.onChange(e.target.value)}
          onBlur={notes.onBlur}
        />
      </label>

      <div className="section-head">
        <h2>Practice clips</h2>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add clip</button>
      </div>

      {clips && <ClipList clips={clips} />}

      {adding && (
        <Modal title="Add practice clip" onClose={() => setAdding(false)}>
          <ClipRecorder onCapture={handleCapture} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
