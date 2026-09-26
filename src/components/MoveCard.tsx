import { Link } from 'react-router-dom';
import { posterUrl } from '../App';
import type { Move } from '../types';
import StatusBadge from './StatusBadge';

export default function MoveCard({ move, clipCount }: { move: Move; clipCount: number }) {
  const poster = posterUrl(move);
  return (
    <Link to={`/move/${move.id}`} className={`card ${move.status === 'ready' ? 'card-ready' : ''}`}>
      <div className="card-thumb" style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
        {!poster && <span className="card-thumb-empty">♪</span>}
        {clipCount > 0 && <span className="card-clipcount">{clipCount} clip{clipCount > 1 ? 's' : ''}</span>}
      </div>
      <div className="card-body">
        <span className="card-name">{move.name}</span>
        <StatusBadge status={move.status} />
      </div>
    </Link>
  );
}
