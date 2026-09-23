import { formatCountdown, useCountdown } from '../hooks/useCountdown';

const PRACTICE_MS = 5 * 60 * 1000;

export default function PracticeTimer() {
  const { remaining, running, done, start, cancel } = useCountdown(PRACTICE_MS);

  return (
    <div className="practice-timer">
      <span className={running ? 'timer-readout timer-running' : 'timer-readout'}>
        {done ? 'Time!' : formatCountdown(remaining)}
      </span>
      {running ? (
        <button className="btn btn-sm" onClick={cancel}>
          Stop
        </button>
      ) : (
        <button className="btn btn-primary btn-sm" onClick={start}>
          {done ? 'Practice 5 more' : 'Practice 5 min'}
        </button>
      )}
    </div>
  );
}
