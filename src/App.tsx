import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { seedIfNeeded } from './seed';
import { guard } from './errors';
import Gallery from './components/Gallery';
import MoveDetail from './components/MoveDetail';
import BattleRound from './components/BattleRound';
import ErrorToasts from './components/ErrorToasts';
import type { Move } from './types';

export const BASE_URL = import.meta.env.BASE_URL;

export function clipUrl(baseUrl: string, seedClip: string): string {
  return `${baseUrl}clips/${seedClip}`;
}

/** Thumbnail for a move: a still captured in-app wins over the bundled poster. */
export function posterUrl(move: Move): string | undefined {
  if (move.still) return move.still;
  return move.poster ? `${BASE_URL}clips/${move.poster}` : undefined;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Ask the browser not to evict practice clips under storage pressure.
    // Best-effort: it may be granted silently, prompted, or refused.
    void navigator.storage?.persist?.().catch(() => {});
    void guard('Set up library', () => seedIfNeeded(BASE_URL)).finally(() =>
      setReady(true),
    );
  }, []);

  if (!ready) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <>
      <Routes>
        <Route path="/" element={<Gallery />} />
        <Route path="/move/:id" element={<MoveDetail />} />
        <Route path="/battle" element={<BattleRound />} />
      </Routes>
      <ErrorToasts />
    </>
  );
}
