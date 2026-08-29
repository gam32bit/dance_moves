import { useEffect, useRef, useState } from 'react';

/**
 * Capture a video clip either by recording with the camera or picking a file.
 * Calls onCapture with the resulting Blob and how it was obtained.
 */
export default function ClipRecorder({
  onCapture,
}: {
  onCapture: (blob: Blob, source: 'recorded' | 'uploaded') => void;
}) {
  const [tab, setTab] = useState<'record' | 'upload'>('record');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (tab !== 'record') return;
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: true })
      .then((s) => {
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
      setStream((s) => {
        s?.getTracks().forEach((t) => t.stop());
        return null;
      });
    };
  }, [tab]);

  function start() {
    if (!stream) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm';
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mime });
      onCapture(blob, 'recorded');
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="recorder">
      <div className="segmented">
        <button className={tab === 'record' ? 'seg seg-active' : 'seg'} onClick={() => setTab('record')}>
          Record
        </button>
        <button className={tab === 'upload' ? 'seg seg-active' : 'seg'} onClick={() => setTab('upload')}>
          Upload
        </button>
      </div>

      {tab === 'record' && (
        <div className="recorder-record">
          {error && <p className="error">{error}</p>}
          <video ref={videoRef} autoPlay muted playsInline className="recorder-preview" />
          {!recording ? (
            <button className="btn btn-primary" onClick={start} disabled={!stream}>
              ● Start recording
            </button>
          ) : (
            <button className="btn btn-danger" onClick={stop}>
              ■ Stop &amp; save
            </button>
          )}
        </div>
      )}

      {tab === 'upload' && (
        <label className="btn btn-primary file-btn">
          Choose a video
          <input
            type="file"
            accept="video/*"
            capture="environment"
            hidden
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
