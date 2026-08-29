import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createMove } from '../hooks/useMoves';
import { addClip } from '../hooks/useClips';
import ClipRecorder from './ClipRecorder';
import Modal from './Modal';

export default function NewMoveDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  async function handleCapture(blob: Blob, source: 'recorded' | 'uploaded') {
    setSaving(true);
    const id = await createMove(name);
    await addClip(id, blob, source, 'First idea');
    onClose();
    navigate(`/move/${id}`);
  }

  async function createWithoutClip() {
    setSaving(true);
    const id = await createMove(name);
    onClose();
    navigate(`/move/${id}`);
  }

  return (
    <Modal title="New move" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reverse turn"
        />
      </label>
      <p className="muted">Add a first clip of the idea, or skip and add one later.</p>
      <ClipRecorder onCapture={handleCapture} />
      <button className="btn btn-ghost" onClick={createWithoutClip} disabled={saving}>
        Create without a clip
      </button>
    </Modal>
  );
}
