import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BASE_URL } from '../App';
import { deleteMove, updateMove, useMove } from '../hooks/useMoves';
import { addClip, useClips } from '../hooks/useClips';
import { cacheClip, clipUrl, isClipCached, uncacheClip } from '../offline';
import type { MoveStatus } from '../types';
import StatusPicker from './StatusPicker';
import ClipList from './ClipList';
import ClipRecorder from './ClipRecorder';
import Modal from './Modal';

export default function MoveDetail() {
  const { id } = useParams();
  const move = useMove(id);
  const clips = useClips(id);
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [cached, setCached] = useState(false);
  const [busy, setBusy] = useState(false);

  const seedSrc = move?.seedClip ? clipUrl(BASE_URL, move.seedClip) : undefined;

  useEffect(() => {
    if (seedSrc) isClipCached(seedSrc).then(setCached);
  }, [seedSrc]);

  if (move === undefined) return <div className="page"><p className="muted">Loading…</p></div>;
  if (move === null) return <div className="page"><p className="muted">Move not found. <Link to="/">Back</Link></p></div>;

  async function toggleOffline() {
    if (!seedSrc) return;
    setBusy(true);
    try {
      if (cached) {
        await uncacheClip(seedSrc);
        setCached(false);
      } else {
        await cacheClip(seedSrc);
        setCached(true);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCapture(blob: Blob, source: 'recorded' | 'uploaded') {
    await addClip(move!.id, blob, source);
    setAdding(false);
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="btn btn-ghost">‹ Gallery</Link>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (confirm(`Delete "${move.name}" and its clips?`)) {
              await deleteMove(move.id);
              navigate('/');
            }
          }}
        >
          Delete move
        </button>
      </header>

      <input
        className="title-input"
        value={move.name}
        onChange={(e) => updateMove(move.id, { name: e.target.value })}
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
        onChange={(s: MoveStatus) => updateMove(move.id, { status: s })}
      />

      {seedSrc && (
        <label className="offline-toggle">
          <input type="checkbox" checked={cached} disabled={busy} onChange={toggleOffline} />
          Available offline
        </label>
      )}

      <label className="field">
        <span>Notes</span>
        <textarea
          value={move.notes}
          rows={3}
          placeholder="Cues, counts, things to fix…"
          onChange={(e) => updateMove(move.id, { notes: e.target.value })}
        />
      </label>

      <div className="section-head">
        <h2>Practice clips</h2>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add clip</button>
      </div>

      {clips && <ClipList clips={clips} />}

      {adding && (
        <Modal title="Add practice clip" onClose={() => setAdding(false)}>
          <ClipRecorder onCapture={handleCapture} />
        </Modal>
      )}
    </div>
  );
}
