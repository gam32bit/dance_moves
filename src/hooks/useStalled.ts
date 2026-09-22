import { useEffect, useState } from 'react';

/**
 * True once `ms` has elapsed while `pending` is still true.
 *
 * Dexie's live queries report "loading" and "the connection is wedged" the same
 * way — by staying `undefined` forever. This puts a clock on that, so a dead
 * connection shows an error instead of an eternal "Loading…".
 */
export function useStalled(pending: boolean, ms = 5000): boolean {
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (!pending) {
      setStalled(false);
      return;
    }
    const t = setTimeout(() => setStalled(true), ms);
    return () => clearTimeout(t);
  }, [pending, ms]);

  return stalled;
}
