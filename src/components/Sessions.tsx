import { useState } from 'react';
import { Link } from 'react-router-dom';
import { storageDiagnostics } from '../db';
import { describeError, guard, reportError, withTimeout } from '../errors';
import { addSession, daysLeft, deleteSession, useSessionList } from '../hooks/useSessions';
import ClipRecorder from './ClipRecorder';
import Modal from './Modal';

/** A long freestyle can run a while; this stops one left recording in a bag. */
const SESSION_MAX_SECONDS = 30 * 60;

/** Writing a several-hundred-MB recording to disk takes longer than a short clip. */
const SAVE_TIMEOUT_MS = 120_000;

export default function Sessions() {
  const sessions = useSessionList();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCapture(blob: Blob, source: 'recorded' | 'uploaded') {
    if (blob.size === 0) return;
    setSaving(true);
    try {
      await withTimeout(SAVE_TIMEOUT_MS, () => addSession(blob, source));
      setAdding(false);
    } catch (err) {
      const why = await storageDiagnostics();
      reportError('Save session', new Error(`${describeError(err)} (${why})`));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="btn btn-ghost">‹ Gallery</Link>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ New session</button>
      </header>

      <h1 className="page-title">Sessions</h1>
      <p className="muted">
        Record a long freestyle, then cut the moves you like out of it into the gallery.
        Sessions delete themselves after 7 days.
      </p>

      {sessions === undefined && <p className="muted">Loading…</p>}
      {sessions?.length === 0 && <p className="muted">No sessions yet.</p>}

      <ul className="session-list">
        {sessions?.map((s) => {
          const left = daysLeft(s.recordedAt);
          return (
            <li key={s.id} className="session-row">
              <Link to={`/session/${s.id}`} className="session-link">
                <span>
                  {new Date(s.recordedAt).toLocaleString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span className="muted">
                  {left <= 1 ? 'deletes within a day' : `deletes in ${left} days`}
                </span>
              </Link>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  if (confirm('Delete this session? Moves already cut from it stay.')) {
                    void guard('Delete session', () => deleteSession(s.id));
                  }
                }}
              >
                Delete
              </button>
            </li>
          );
        })}
      </ul>

      {adding && (
        <Modal title="New session" onClose={() => !saving && setAdding(false)}>
          <ClipRecorder
            onCapture={handleCapture}
            saving={saving}
            maxSeconds={SESSION_MAX_SECONDS}
            uploadOpensCamera={false}
            audio={false}
          />
        </Modal>
      )}
    </div>
  );
}
