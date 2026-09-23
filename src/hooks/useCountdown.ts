import { useEffect, useRef, useState } from 'react';

type Ctor = typeof AudioContext;
const AudioCtx: Ctor | undefined =
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;

/** Three short beeps, synthesized so the chime works offline with no bundled asset. */
function chimeAt(ctx: AudioContext, startTime: number): OscillatorNode[] {
  return [0, 0.22, 0.44].map((offset, i) => {
    const at = startTime + offset;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = i === 2 ? 1320 : 880;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.35, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.2);
    return osc;
  });
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export interface Countdown {
  /** Milliseconds left; equals `durationMs` when idle. */
  remaining: number;
  running: boolean;
  /** True once a run has finished, until the next `start` or `cancel`. */
  done: boolean;
  /** Must be called straight from a tap handler — that gesture is what unlocks audio. */
  start: () => void;
  cancel: () => void;
}

/**
 * A countdown that chimes when it lands, and keeps the screen awake while it runs.
 * Shared by the per-move practice timer and the battle round timer.
 */
export function useCountdown(durationMs: number): Countdown {
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(durationMs);
  const [done, setDone] = useState(false);

  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<OscillatorNode[]>([]);
  /** Audio-clock time the chime was scheduled for, so a tick can tell whether it played. */
  const chimeAudioTime = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  function stopScheduled() {
    for (const osc of nodesRef.current) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped; nothing to unwind.
      }
    }
    nodesRef.current = [];
    chimeAudioTime.current = null;
  }

  function releaseWakeLock() {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }

  function start() {
    // The tap that starts the timer is the only gesture allowed to unlock audio,
    // so the context has to be created/resumed here rather than in an effect.
    // A context that has been closed (the component was unmounted) can't be revived.
    if ((!ctxRef.current || ctxRef.current.state === 'closed') && AudioCtx) {
      ctxRef.current = new AudioCtx();
    }
    const ctx = ctxRef.current;
    void ctx?.resume().catch(() => {});

    stopScheduled();
    if (ctx) {
      const at = ctx.currentTime + durationMs / 1000;
      nodesRef.current = chimeAt(ctx, at);
      chimeAudioTime.current = at;
    }

    // Keeping the screen on is what makes the chime land on time — a hidden page
    // gets its audio context suspended on mobile. Best-effort; ignore refusals.
    void navigator.wakeLock
      ?.request('screen')
      .then((lock) => {
        wakeLock.current = lock;
      })
      .catch(() => {});

    setDone(false);
    setRemaining(durationMs);
    setEndsAt(Date.now() + durationMs);
  }

  function cancel() {
    stopScheduled();
    releaseWakeLock();
    setEndsAt(null);
    setDone(false);
    setRemaining(durationMs);
  }

  useEffect(() => {
    if (endsAt === null) return;

    function check() {
      const left = endsAt! - Date.now();
      setRemaining(left);
      if (left > 0) return;

      const ctx = ctxRef.current;
      const scheduled = chimeAudioTime.current;
      // The scheduled chime only actually sounded if the context kept running
      // past its start time; otherwise (backgrounded, suspended) play it now.
      const alreadyPlayed =
        ctx !== null && scheduled !== null && ctx.state === 'running' && ctx.currentTime >= scheduled;
      if (!alreadyPlayed && ctx && ctx.state !== 'closed') {
        stopScheduled();
        void ctx.resume().then(() => chimeAt(ctx, ctx.currentTime)).catch(() => {});
      }
      chimeAudioTime.current = null;
      releaseWakeLock();
      setEndsAt(null);
      setDone(true);
    }

    // Recompute from the end timestamp rather than counting down, so the display
    // is right even when background throttling has skipped ticks.
    const id = window.setInterval(check, 250);
    document.addEventListener('visibilitychange', check);
    check();
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [endsAt]);

  useEffect(() => {
    return () => {
      stopScheduled();
      releaseWakeLock();
      void ctxRef.current?.close().catch(() => {});
    };
  }, []);

  return { remaining, running: endsAt !== null, done, start, cancel };
}
