import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { seedIfNeeded } from './seed';
import Gallery from './components/Gallery';
import MoveDetail from './components/MoveDetail';

export const BASE_URL = import.meta.env.BASE_URL;

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    seedIfNeeded(BASE_URL).finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="loading">Loading…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Gallery />} />
      <Route path="/move/:id" element={<MoveDetail />} />
    </Routes>
  );
}
