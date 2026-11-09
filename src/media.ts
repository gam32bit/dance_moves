/** Captured stills are gallery thumbnails; this keeps each one to tens of KB. */
const STILL_MAX_WIDTH = 480;

/** Grab the video's current frame as a downscaled JPEG data URL. */
export function captureFrame(video: HTMLVideoElement): string {
  if (video.readyState < 2 || !video.videoWidth) {
    throw new Error('The video has no frame loaded yet. Wait a moment and try again.');
  }
  const width = Math.min(STILL_MAX_WIDTH, video.videoWidth);
  const height = Math.round((video.videoHeight * width) / video.videoWidth);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(video, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

function once(target: EventTarget, type: string, timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      target.removeEventListener(type, done);
      reject(new Error(`Timed out waiting for the video (${type}).`));
    }, timeoutMs);
    function done() {
      clearTimeout(t);
      resolve();
    }
    target.addEventListener(type, done, { once: true });
  });
}

/**
 * Recordings made with MediaRecorder carry no duration, so the browser reports
 * Infinity and the scrub bar is useless. Seeking far past the end makes it
 * scan the file and settle on the real duration; then go back to the start.
 */
export async function ensureDuration(video: HTMLVideoElement): Promise<void> {
  if (Number.isFinite(video.duration)) return;
  video.currentTime = 1e9;
  await once(video, 'seeked', 30_000).catch(() => {});
  video.currentTime = 0;
}

export function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  if (Math.abs(video.currentTime - time) < 0.001 && !video.seeking) return Promise.resolve();
  const p = once(video, 'seeked');
  video.currentTime = time;
  return p;
}

type CapturableVideo = HTMLVideoElement & { captureStream?: () => MediaStream };

export function canCut(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof (HTMLMediaElement.prototype as Partial<CapturableVideo>).captureStream === 'function'
  );
}

function recorderMime(): string | undefined {
  return ['video/mp4', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) =>
    MediaRecorder.isTypeSupported(m),
  );
}

/**
 * Cut [start, end] out of a playing video by re-recording it in real time.
 * There is no way to slice an MP4/WebM file in the browser without shipping a
 * whole video toolkit, but a move is only a few seconds long, so playing it
 * once through a MediaRecorder costs about that many seconds.
 */
export async function cutSegment(
  video: HTMLVideoElement,
  start: number,
  end: number,
  onProgress?: (seconds: number) => void,
): Promise<Blob> {
  const v = video as CapturableVideo;
  if (!v.captureStream || typeof MediaRecorder === 'undefined') {
    throw new Error('This browser can’t cut clips. Use Chrome.');
  }
  if (v.readyState < 1) await once(v, 'loadedmetadata');
  v.pause();
  await seekTo(v, start);

  const stream = v.captureStream();
  await v.play();
  // The captured tracks only exist once playback is producing frames.
  if (stream.getVideoTracks().length === 0) await once(stream, 'addtrack', 5_000);

  const mime = recorderMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((resolve, reject) => {
    rec.onstop = () => resolve();
    rec.onerror = () => reject(new Error('Recording the cut failed.'));
  });
  rec.start(500);

  await new Promise<void>((resolve) => {
    const t = setInterval(() => {
      onProgress?.(Math.max(0, v.currentTime - start));
      if (v.currentTime >= end || v.ended || v.paused) {
        clearInterval(t);
        resolve();
      }
    }, 30);
  });
  v.pause();
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());

  const blob = new Blob(chunks, { type: mime ?? chunks[0]?.type ?? 'video/webm' });
  if (blob.size === 0) throw new Error('The cut came out empty. Try again.');
  return blob;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
