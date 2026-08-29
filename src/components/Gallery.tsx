import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { useMoves } from '../hooks/useMoves';
import MoveCard from './MoveCard';
import NewMoveDialog from './NewMoveDialog';
import Settings from './Settings';

export default function Gallery() {
  const moves = useMoves();
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const allClips = useLiveQuery(() => db.clips.toArray(), []);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of allClips ?? []) m.set(c.moveId, (m.get(c.moveId) ?? 0) + 1);
    return m;
  }, [allClips]);

  return (
    <div className="page">
      <header className="topbar">
        <h1>Dance Moves</h1>
        <div className="topbar-actions">
          <button className="btn" onClick={() => setShowNew(true)}>+ New move</button>
          <button className="btn btn-ghost" onClick={() => setShowSettings(true)} aria-label="Settings">⚙</button>
        </div>
      </header>

      {!moves && <p className="muted">Loading…</p>}
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
