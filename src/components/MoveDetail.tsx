import { useEffect, useRef, useState, type TouchEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BASE_URL, clipUrl, posterUrl } from '../App';
import { storageDiagnostics } from '../db';
import { deleteMove, updateMove, useMove, useMoves } from '../hooks/useMoves';
import { addClip, useBlobUrl, useClips } from '../hooks/useClips';
import { useDebouncedField } from '../hooks/useDebouncedField';
import { useStalled } from '../hooks/useStalled';
import { describeError, guard, reportError, withTimeout } from '../errors';
import type { Move, MoveStatus } from '../types';
import StatusPicker from './StatusPicker';
import ClipList from './ClipList';
import ClipRecorder from './ClipRecorder';
import Modal from './Modal';
import PracticeTimer from './PracticeTimer';

/** Long enough for a big clip on a slow phone, short enough to not feel hung. */
const SAVE_TIMEOUT_MS = 30_000;

/** Horizontal travel, in px, before a touch counts as a swipe to the next move. */
const SWIPE_MIN_PX = 60;

/** Height of the native video controls strip, where a drag means scrubbing. */
const VIDEO_CONTROLS_PX = 56;

/** Captured stills are gallery thumbnails; this keeps each one to tens of KB. */
const STILL_MAX_WIDTH = 480;

/**
 * Swiping swaps the `:id` param under the same route element. Keying the page
 * by id gives each move a fresh component, so a debounced name/notes edit
 * flushes to the move it was typed on instead of the one swiped to.
 */
export default function MoveDetailRoute() {
  const { id } = useParams();
  const moves = useMoves();
  return <MoveDetail key={id} id={id} moves={moves} />;
}

/** Grab the video's current frame as a downscaled JPEG data URL. */
function captureFrame(video: HTMLVideoElement): string {
  if (video.readyState < 2 || !video.videoWidth) {
    throw new Error('The video has no frame loaded yet. Play it, then pause on the frame you want.');
  }
  const width = Math.min(STILL_MAX_WIDTH, video.videoWidth);
  const height = Math.round((video.videoHeight * width) / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function MoveDetail({ id, moves }: { id: string | undefined; moves: Move[] | undefined }) {
  const live = useMove(id);
  // The gallery list is already loaded, so a swiped-to move renders at once
  // instead of flashing "Loading…" while its own query starts.
  const move = live === undefined ? moves?.find((m) => m.id === id) : live;
  const clips = useClips(id);
  const navigate = useNavigate();

  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stillSaved, setStillSaved] = useState(false);
  const stalled = useStalled(move === undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!stillSaved) return;
    const t = setTimeout(() => setStillSaved(false), 2000);
    return () => clearTimeout(t);
  }, [stillSaved]);

  const seedSrc = move?.seedClip ? clipUrl(BASE_URL, move.seedClip) : undefined;
  // A deleted main clip simply stops matching, falling back to the seed clip.
  const mainClip = move?.mainClipId ? clips?.find((c) => c.id === move.mainClipId) : undefined;
  const mainSrc = useBlobUrl(mainClip?.blob);
  // Hold off on the seed clip while the chosen practice clip is still loading.
  const mainPending = !!move?.mainClipId && (clips === undefined || (!!mainClip && !mainSrc));
  const heroSrc = mainClip ? mainSrc : mainPending ? undefined : seedSrc;
  const heroPoster = !move ? undefined : mainClip ? move.still ?? undefined : posterUrl(move);

  const index = moves && id ? moves.findIndex((m) => m.id === id) : -1;

  function onTouchStart(e: TouchEvent) {
    const t = e.target as Element;
    const { clientX: x, clientY: y } = e.touches[0];
    // Videos fill most of a phone screen, so only their controls strip (the
    // scrub bar) is off-limits. Selecting text or using the recorder isn't a swipe either.
    const video = t.closest('video');
    const onScrubBar = !!video && y > video.getBoundingClientRect().bottom - VIDEO_CONTROLS_PX;
    if (e.touches.length !== 1 || onScrubBar || t.closest('input, textarea, .modal-backdrop')) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x, y };
  }

  function onTouchEnd(e: TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || !moves || index < 0) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < 2 * Math.abs(dy)) return;
    const target = moves[index + (dx < 0 ? 1 : -1)];
    // Replace, so Back returns to the gallery rather than every move swiped past.
    if (target) navigate(`/move/${target.id}`, { replace: true });
  }

  const name = useDebouncedField(move?.name, (value) => {
    if (move) void guard('Save name', () => updateMove(move.id, { name: value }));
  });
  const notes = useDebouncedField(move?.notes, (value) => {
    if (move) void guard('Save notes', () => updateMove(move.id, { notes: value }));
  });

  // useMove distinguishes these: undefined while loading, null when missing.
  if (move === undefined) {
    return (
      <div className="page">
        {stalled ? (
          <>
            <p className="error">
              This move is taking too long to load. The database may be blocked
              by another copy of the app.
            </p>
            <button className="btn btn-primary" onClick={() => location.reload()}>
              Reload
            </button>
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
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
    try {
      // Bounded, so a wedged IndexedDB connection cannot leave this on
      // "Saving…" forever with the button disabled and no error.
      await withTimeout(SAVE_TIMEOUT_MS, () => addClip(move!.id, blob, source));
      // Only dismiss the recorder if the clip actually made it to disk.
      setAdding(false);
    } catch (err) {
      const why = await storageDiagnostics();
      reportError(
        'Save practice clip',
        new Error(`${describeError(err)} (${why})`),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSetStill() {
    const ok = await guard('Set thumbnail', () =>
      updateMove(move!.id, { still: captureFrame(videoRef.current!) }),
    );
    if (ok !== undefined) setStillSaved(true);
  }

  return (
    <div className="page page-swipe" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <header className="topbar">
        <Link to="/" className="btn btn-ghost">‹ Gallery</Link>
        {index >= 0 && moves && (
          <span className="muted">{index + 1} / {moves.length}</span>
        )}
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

      {heroSrc ? (
        <>
          <video
            ref={videoRef}
            key={heroSrc}
            src={heroSrc}
            controls
            loop
            playsInline
            poster={heroPoster}
            className="hero-video"
          />
          <div className="hero-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => void handleSetStill()}>
              {stillSaved ? 'Thumbnail saved ✓' : 'Set as thumbnail'}
            </button>
            {move.still && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  void guard('Remove thumbnail', () => updateMove(move.id, { still: null }))
                }
              >
                Remove thumbnail
              </button>
            )}
            {mainClip && seedSrc && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  void guard('Restore original clip', () =>
                    updateMove(move.id, { mainClipId: null }),
                  )
                }
              >
                Restore original
              </button>
            )}
          </div>
        </>
      ) : mainPending ? (
        <p className="muted">Loading…</p>
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

      {clips && (
        <ClipList
          clips={clips}
          mainClipId={mainClip?.id}
          onUseAsMain={(clipId) =>
            void guard('Use as main clip', () => updateMove(move.id, { mainClipId: clipId }))
          }
        />
      )}

      {adding && (
        <Modal title="Add practice clip" onClose={() => setAdding(false)}>
          <ClipRecorder onCapture={handleCapture} saving={saving} />
        </Modal>
      )}
    </div>
  );
}
