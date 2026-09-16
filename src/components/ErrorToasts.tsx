import { useEffect, useState } from 'react';
import { onAppError, type AppError } from '../errors';

/** Shows failed writes, which previously failed silently. */
export default function ErrorToasts() {
  const [errors, setErrors] = useState<AppError[]>([]);

  useEffect(
    () =>
      onAppError((err) =>
        // Keep the few most recent; identical repeats would otherwise pile up
        // fast when a per-keystroke write starts failing.
        setErrors((prev) =>
          [...prev.filter((e) => e.message !== err.message), err].slice(-3),
        ),
      ),
    [],
  );

  if (errors.length === 0) return null;

  return (
    <div className="toasts" role="alert" aria-live="assertive">
      {errors.map((e) => (
        <div key={e.id} className="toast">
          <div className="toast-body">
            <strong>{e.context}</strong>
            <span className="muted">{e.message}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            aria-label="Dismiss"
            onClick={() => setErrors((prev) => prev.filter((x) => x.id !== e.id))}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
