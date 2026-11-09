import { useEffect, useRef, useState } from 'react';

/** Practice clips are short by design; this stops a forgotten recording. */
const DEFAULT_MAX_SECONDS = 90;

function formatElapsed(secs: number): string {
  return secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/**
 * Capture a video clip either by recording with the camera or picking a file.
 * Calls onCapture with the resulting Blob and how it was obtained.
 */
export default function ClipRecorder({
  onCapture,
  saving = false,
  maxSeconds = DEFAULT_MAX_SECONDS,
  uploadOpensCamera = true,
}: {
  onCapture: (blob: Blob, source: 'recorded' | 'uploaded') => void;
  saving?: boolean;
  maxSeconds?: number;
  /** Whether Upload jumps straight to the phone camera instead of the file picker. */
  uploadOpensCamera?: boolean;
}) {
  const [tab, setTab] = useState<'record' | 'upload'>('record');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const discardRef = useRef(false);

  useEffect(() => {
    if (tab !== 'record') return;
    let active = true;
    let acquired: MediaStream | null = null;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((s) => {
        acquired = s;
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => setError(e?.message ?? 'Camera unavailable'));
    return () => {
      active = false;
      acquired?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [tab]);

  // Tick the elapsed counter and stop automatically at the cap.
  useEffect(() => {
    if (!recording) return;
    const started = Date.now();
    const t = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000);
      setElapsed(secs);
      if (secs >= maxSeconds) stop();
    }, 250);
    return () => clearInterval(t);
  }, [recording, maxSeconds]);

  // The screen going to sleep stops the camera mid-recording. Best-effort.
  useEffect(() => {
    if (!recording) return;
    let lock: WakeLockSentinel | null = null;
    let released = false;
    function acquire() {
      void navigator.wakeLock
        ?.request('screen')
        .then((l) => {
          if (released) void l.release().catch(() => {});
          else lock = l;
        })
        .catch(() => {});
    }
    // The browser drops the lock whenever the page is hidden.
    function onVisible() {
      if (document.visibilityState === 'visible') acquire();
    }
    acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release().catch(() => {});
    };
  }, [recording]);

  function start() {
    if (!stream) return;
    chunksRef.current = [];
    discardRef.current = false;
    setElapsed(0);
    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onerror = () => setError('Recording failed. Try again.');
    rec.onstop = () => {
      if (discardRef.current) return;
      const blob = new Blob(chunksRef.current, { type: mime });
      if (blob.size === 0) {
        setError('Nothing was recorded. Try again.');
        return;
      }
      onCapture(blob, 'recorded');
    };
    // Flush every second so a crash or early stop still leaves usable data.
    rec.start(1000);
    recorderRef.current = rec;
    setRecording(true);
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    setRecording(false);
  }

  function discard() {
    discardRef.current = true;
    stop();
  }

  const remaining = maxSeconds - elapsed;

  return (
    <div className="recorder">
      <div className="segmented">
        <button className={tab === 'record' ? 'seg seg-active' : 'seg'} onClick={() => setTab('record')} disabled={recording || saving}>
          Record
        </button>
        <button className={tab === 'upload' ? 'seg seg-active' : 'seg'} onClick={() => setTab('upload')} disabled={recording || saving}>
          Upload
        </button>
      </div>

      {tab === 'record' && (
        <div className="recorder-record">
          {error && <p className="error">{error}</p>}
          <video ref={videoRef} autoPlay muted playsInline className="recorder-preview" />
          {recording && (
            <p className="muted recorder-timer">
              {formatElapsed(elapsed)} {remaining <= 15 && `· stops in ${remaining}s`}
            </p>
          )}
          {!recording ? (
            <button className="btn btn-primary" onClick={start} disabled={!stream || saving}>
              {saving ? 'Saving…' : '● Start recording'}
            </button>
          ) : (
            <div className="recorder-actions">
              <button className="btn btn-danger" onClick={stop}>
                ■ Stop &amp; save
              </button>
              <button className="btn btn-ghost" onClick={discard}>
                Discard
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <label className="btn btn-primary file-btn">
          {saving ? 'Saving…' : 'Choose a video'}
          <input
            type="file"
            accept="video/*"
            capture={uploadOpensCamera ? 'environment' : undefined}
            hidden
            disabled={saving}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onCapture(f, 'uploaded');
            }}
          />
        </label>
      )}
    </div>
  );
}
