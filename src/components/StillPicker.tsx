import { useEffect, useRef, useState } from 'react';
import { captureFrame, ensureDuration, formatTime } from '../media';
import { describeError } from '../errors';

/** One frame at 30fps — the nudge buttons step by this much. */
const FRAME = 1 / 30;

/**
 * Scrub a video with a slider and grab the frame you stop on as a thumbnail.
 * Scrubbing a native player to an exact frame is fiddly on a phone; a full-width
 * slider plus frame-step buttons is not.
 */
export default function StillPicker({
  src,
  initialTime = 0,
  onPick,
  pickLabel = 'Use this frame',
  busy = false,
}: {
  src: string;
  initialTime?: number;
  onPick: (dataUrl: string) => void | Promise<void>;
  pickLabel?: string;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(initialTime);
  const [seeking, setSeeking] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    async function init() {
      await ensureDuration(v!);
      if (cancelled) return;
      setDuration(v!.duration);
      const t = Math.min(initialTime, v!.duration || 0);
      v!.currentTime = t;
      setTime(t);
    }
    if (v.readyState >= 1) void init();
    else v.addEventListener('loadedmetadata', () => void init(), { once: true });
    return () => {
      cancelled = true;
    };
    // Only on load: initialTime is where the picker opens, not a controlled value.
  }, [src]);

  function seek(t: number) {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.min(Math.max(0, t), duration || v.duration || 0);
    setTime(clamped);
    v.currentTime = clamped;
  }

  async function pick() {
    try {
      setError(undefined);
      await onPick(captureFrame(videoRef.current!));
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <div className="still-picker">
      <video
        ref={videoRef}
        src={src}
        muted
        playsInline
        preload="auto"
        className="still-video"
        onSeeking={() => setSeeking(true)}
        onSeeked={() => setSeeking(false)}
        onLoadedData={() => setSeeking(false)}
      />
      <input
        type="range"
        className="still-slider"
        min={0}
        max={duration || 0}
        step={0.01}
        value={time}
        disabled={!duration}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Frame"
      />
      <div className="still-nudge">
        <button className="btn btn-sm" onClick={() => seek(time - 10 * FRAME)}>«</button>
        <button className="btn btn-sm" onClick={() => seek(time - FRAME)}>‹</button>
        <span className="muted still-time">{formatTime(time)}</span>
        <button className="btn btn-sm" onClick={() => seek(time + FRAME)}>›</button>
        <button className="btn btn-sm" onClick={() => seek(time + 10 * FRAME)}>»</button>
      </div>
      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" onClick={() => void pick()} disabled={seeking || busy}>
        {pickLabel}
      </button>
    </div>
  );
}
