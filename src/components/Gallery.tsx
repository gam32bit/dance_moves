import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useMoves } from '../hooks/useMoves';
import { useStalled } from '../hooks/useStalled';
import MoveCard from './MoveCard';
import NewMoveDialog from './NewMoveDialog';
import Settings from './Settings';

export default function Gallery() {
  const moves = useMoves();
  const stalled = useStalled(moves === undefined);
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Walk the moveId index only. Loading full rows here pulled every practice
  // video into memory on the gallery, on every write to the clips table.
  const counts = useLiveQuery(
    async () => {
      const m = new Map<string, number>();
      await db.clips.orderBy('moveId').eachKey((key) => {
        const moveId = String(key);
        m.set(moveId, (m.get(moveId) ?? 0) + 1);
      });
      return m;
    },
    [],
    new Map<string, number>(),
  );

  return (
    <div className="page">
      <header className="topbar">
        <h1>Dance Moves</h1>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setShowNew(true)}>+ New move</button>
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)} aria-label="Settings">⚙</button>
        </div>
      </header>

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
      {moves && moves.length === 0 && <p className="muted">No moves yet. Add one to get started.</p>}

      <div className="grid">
        {moves?.map((move) => (
          <MoveCard key={move.id} move={move} clipCount={counts.get(move.id) ?? 0} />
        ))}
      </div>

      {showNew && <NewMoveDialog onClose={() => setShowNew(false)} />}
      {showSettings && <Settings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
