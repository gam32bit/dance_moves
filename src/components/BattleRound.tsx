import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BASE_URL } from '../App';
import { useMoves } from '../hooks/useMoves';
import { useStalled } from '../hooks/useStalled';
import { formatCountdown, useCountdown } from '../hooks/useCountdown';
import type { Move } from '../types';

const ROUND_MS = 3 * 60 * 1000;

function posterUrl(move: Move): string | undefined {
  // Every /clips/... URL needs the base prefix so subpath deploys work.
  return move.poster ? `${BASE_URL}clips/${move.poster}` : undefined;
}

function MoveTile({
  move,
  className,
  onClick,
}: {
  move: Move;
  className: string;
  onClick: () => void;
}) {
  const poster = posterUrl(move);
  return (
    <button type="button" className={className} onClick={onClick}>
      <div
        className="card-thumb"
        style={poster ? { backgroundImage: `url(${poster})` } : undefined}
      >
        {!poster && <span className="card-thumb-empty">♪</span>}
      </div>
      <div className="card-body">
        <span className="card-name">{move.name}</span>
      </div>
    </button>
  );
}

export default function BattleRound() {
  const moves = useMoves();
  const stalled = useStalled(moves === undefined);
  const { remaining, running, done, start, cancel } = useCountdown(ROUND_MS);

  // Session state only — a reload, or a trip back to the gallery, starts fresh.
  const [hitIds, setHitIds] = useState<string[]>([]);

  const ready = moves?.filter((m) => m.status === 'ready') ?? [];
  const remainingMoves = ready.filter((m) => !hitIds.includes(m.id));
  // Ordered by when they were tapped, so the most recent mis-tap is easiest to find.
  const hitMoves = hitIds
    .map((id) => ready.find((m) => m.id === id))
    .filter((m): m is Move => m !== undefined);

  function newSession() {
    cancel();
    setHitIds([]);
  }

  return (
    <div className="page">
      <header className="topbar">
        <Link to="/" className="btn btn-ghost">‹ Gallery</Link>
        {hitIds.length > 0 && (
          <button className="btn btn-ghost" onClick={newSession}>
            New session
          </button>
        )}
      </header>

      <div className="battle-timer">
        <span className={running ? 'round-readout timer-running' : 'round-readout'}>
          {done ? 'Time!' : formatCountdown(remaining)}
        </span>
        {running ? (
          <button className="btn" onClick={cancel}>
            Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={start}>
            {done ? 'Next round' : 'Start round'}
          </button>
        )}
      </div>

      {!moves && !stalled && <p className="muted">Loading…</p>}
      {!moves && stalled && (
        <div className="stalled">
          <p className="error">
            Your moves are taking too long to load. The database may be blocked
            by another copy of the app in a different tab.
          </p>
          <button className="btn btn-primary" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      )}

      {moves && ready.length === 0 && (
        <p className="muted">
          No moves are marked Ready yet. Mark a few in the <Link to="/">gallery</Link> and
          they'll show up here to work into your rounds.
        </p>
      )}

      {moves && ready.length > 0 && remainingMoves.length === 0 && (
        <p className="muted">You hit everything. Start a new session to go again.</p>
      )}

      <div className="grid">
        {remainingMoves.map((move) => (
          <MoveTile
            key={move.id}
            move={move}
            className="card battle-tile"
            onClick={() => setHitIds((ids) => [...ids, move.id])}
          />
        ))}
      </div>

      {hitMoves.length > 0 && (
        <>
          <div className="section-head">
            <h2>Done ({hitMoves.length})</h2>
            <span className="muted">Tap to put one back</span>
          </div>
          <div className="grid grid-done">
            {hitMoves.map((move) => (
              <MoveTile
                key={move.id}
                move={move}
                className="card battle-tile battle-tile-done"
                onClick={() => setHitIds((ids) => ids.filter((id) => id !== move.id))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
