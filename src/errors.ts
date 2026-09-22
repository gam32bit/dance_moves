// Central place for surfacing failures. Every database write in this app used to
// be fire-and-forget, so a rejected promise vanished silently and the feature just
// appeared to "stop working". Everything routes through here instead.

export interface AppError {
  id: number;
  /** What the app was trying to do, e.g. "Save notes". */
  context: string;
  message: string;
  at: number;
}

type Listener = (err: AppError) => void;

const listeners = new Set<Listener>();
let nextId = 1;

export function onAppError(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Turn an unknown thrown value into something worth showing a human. */
export function describeError(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case 'QuotaExceededError':
        return 'Device storage is full. Delete some practice clips to free space.';
      case 'NotFoundError':
        return 'A stored video could not be read — it may have been evicted by the browser.';
      case 'InvalidStateError':
        return 'The database connection was closed. Reload the app.';
      default:
        return `${err.name}: ${err.message}`;
    }
  }
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}

export function reportError(context: string, err: unknown): void {
  const message = describeError(err);
  // Keep the raw error in the console for debugging; show the friendly one in the UI.
  console.error(`[dance-moves] ${context}:`, err);
  const appError: AppError = { id: nextId++, context, message, at: Date.now() };
  for (const fn of listeners) fn(appError);
}

/**
 * Run a write and surface any failure instead of dropping it.
 * Returns undefined when the operation failed.
 */
export async function guard<T>(
  context: string,
  op: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await op();
  } catch (err) {
    reportError(context, err);
    return undefined;
  }
}

/** Catch anything that escaped a guard, so it still reaches the user. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (e) => {
    reportError('Unexpected error', e.reason);
  });
  window.addEventListener('error', (e) => {
    if (e.error) reportError('Unexpected error', e.error);
  });
}

/**
 * Reject if `op` has not settled within `ms`.
 *
 * IndexedDB work can stay pending forever when the connection is closed or
 * blocked — it neither resolves nor rejects — which leaves the UI stuck on a
 * disabled "Saving…" button with no way out. A timeout turns that into an
 * ordinary error that `guard` can surface.
 */
export function withTimeout<T>(ms: number, op: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            'The database did not respond. It may be blocked by another tab — reload the app and try again.',
          ),
        ),
      ms,
    );
    op().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
