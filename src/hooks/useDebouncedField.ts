import { useEffect, useRef, useState } from 'react';

/**
 * Text field backed by a live query.
 *
 * Writing on every keystroke while `value` comes straight back from a
 * `useLiveQuery` loses almost everything typed: the query round-trip lags the
 * keyboard, so each re-render overwrites the characters entered since the last
 * completed read (measured: 62 characters in, 1 saved).
 *
 * Local state stays authoritative while the user is typing, and the write is
 * debounced. Remote updates are only adopted when no edit is pending, so a
 * change from another tab still shows up.
 */
export function useDebouncedField(
  remote: string | undefined,
  commit: (value: string) => void,
  delay = 400,
) {
  const [value, setValue] = useState(remote ?? '');
  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // Latest commit without making it a dependency of the flush-on-unmount effect.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!pending.current && remote !== undefined) setValue(remote);
  }, [remote]);

  function flush() {
    clearTimeout(timer.current);
    if (!pending.current) return;
    pending.current = false;
    commitRef.current(valueRef.current);
  }

  // Don't lose an in-flight edit when navigating away.
  useEffect(() => () => flush(), []);

  function onChange(next: string) {
    pending.current = true;
    setValue(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      pending.current = false;
      commitRef.current(next);
    }, delay);
  }

  return { value, onChange, onBlur: flush };
}
