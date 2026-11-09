import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { describeError, guard, reportError } from '../errors';
import { useBlobUrl } from '../hooks/useClips';
import { useMoves } from '../hooks/useMoves';
import {
  addMoveFromCut,
  daysLeft,
  deleteSession,
  useSession,
} from '../hooks/useSessions';
import { canCut, cutSegment, ensureDuration, formatTime } from '../media';
import Modal from './Modal';
import StillPicker from './StillPicker';

/** One past the highest "Move NN", so a deleted move's number isn't reused. */
function nextMoveName(moves: { name: string }[]): string {
  const top = moves.reduce((max, m) => {
    const n = /^Move (\d+)$/.exec(m.name);
    return n ? Math.max(max, Number(n[1])) : max;
  }, 0);
  return `Move ${top + 1}`;
}

interface Cut {
  blob: Blob;
  name: string;
}

export default function SessionEditor() {
  const { id } = useParams();
  const session = useSession(id);
  const moves = useMoves();
  const navigate = useNavigate();
  const src = useBlobUrl(session?.blob ?? undefined);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [cut, setCut] = useState<Cut | null>(null);
  const [added, setAdded] = useState<{ id: string; name: string }[]>([]);

  if (session === undefined) {
    return <div className="page"><p className="muted">Loading…</p></div>;
  }
  if (session === null) {
    return (
      <div className="page">
        <p className="muted">
          This session is gone — they delete themselves after 7 days.{' '}
          <Link to="/sessions">Back to sessions</Link>
        </p>
      </div>
    );
  }

  const cutting = progress !== null;
  const length = start !== null && end !== null ? end - start : null;
  const valid = length !== null && length > 0.2;

  function here(): number {
    return videoRef.current?.currentTime ?? 0;
  }

  async function startCut() {
    const v = videoRef.current;
    if (!v || start === null || end === null) return;
    setProgress(0);
    try {
      const blob = await cutSegment(v, start, end, setProgress);
      setCut({ blob, name: nextMoveName(moves ?? []) });
    } catch (err) {
      reportError('Cut move', new Error(describeError(err)));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/sessions" className="btn btn-ghost">‹ Sessions</Link>
        <span className="muted">
          {daysLeft(session.recordedAt) <= 1
            ? 'deletes within a day'
            : `deletes in ${daysLeft(session.recordedAt)} days`}
        </span>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            if (confirm('Delete this session? Moves already cut from it stay.')) {
              const ok = await guard('Delete session', () =>
                deleteSession(session.id).then(() => true),
              );
              if (ok !== undefined) navigate('/sessions');
            }
          }}
        >
          Delete
        </button>
      </header>

      {src && (
        <video
          ref={videoRef}
          src={src}
          controls={!cutting}
          playsInline
          preload="auto"
          className="hero-video"
          onLoadedMetadata={(e) => void ensureDuration(e.currentTarget)}
        />
      )}

      {!canCut() && (
        <p className="error">This browser can’t cut clips out of a video. Open the app in Chrome.</p>
      )}

      <p className="muted">
        Pause where a move starts and tap <b>Mark start</b>, then where it ends and tap <b>Mark end</b>.
      </p>
      <div className="cut-marks">
        <button className="btn" disabled={cutting} onClick={() => setStart(here())}>
          Mark start
        </button>
        <span className="cut-time">{start === null ? '–' : formatTime(start)}</span>
        <button className="btn" disabled={cutting} onClick={() => setEnd(here())}>
          Mark end
        </button>
        <span className="cut-time">{end === null ? '–' : formatTime(end)}</span>
      </div>
      {length !== null && length <= 0.2 && (
        <p className="error">The end needs to be after the start.</p>
      )}

      <button
        className="btn btn-primary cut-go"
        disabled={!valid || cutting || !canCut()}
        onClick={() => void startCut()}
      >
        {cutting
          ? `Cutting… ${progress!.toFixed(1)} / ${length!.toFixed(1)}s`
          : valid
            ? `Cut move (${length!.toFixed(1)}s)`
            : 'Cut move'}
      </button>

      {added.length > 0 && (
        <div className="cut-added">
          <h2>Added to the gallery</h2>
          <ul>
            {added.map((m) => (
              <li key={m.id}>
                <Link to={`/move/${m.id}`}>{m.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cut && (
        <CutDialog
          cut={cut}
          onClose={() => setCut(null)}
          onAdded={(moveId, name) => {
            setAdded((a) => [...a, { id: moveId, name }]);
            setCut(null);
            setStart(null);
            setEnd(null);
          }}
        />
      )}
    </div>
  );
}

function CutDialog({
  cut,
  onClose,
  onAdded,
}: {
  cut: Cut;
  onClose: () => void;
  onAdded: (moveId: string, name: string) => void;
}) {
  const url = useBlobUrl(cut.blob);
  const [name, setName] = useState(cut.name);
  const [saving, setSaving] = useState(false);

  async function save(still: string) {
    setSaving(true);
    try {
      const finalName = name.trim() || cut.name;
      const moveId = await addMoveFromCut(finalName, cut.blob, still);
      onAdded(moveId, finalName);
    } catch (err) {
      reportError('Add move', err);
      setSaving(false);
    }
  }

  return (
    <Modal title="New move" onClose={() => !saving && onClose()}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p className="muted">Pick the frame you’ll recognise it by in the gallery.</p>
      {url && (
        <StillPicker
          src={url}
          onPick={save}
          busy={saving}
          pickLabel={saving ? 'Adding…' : 'Add to gallery with this thumbnail'}
        />
      )}
    </Modal>
  );
}
