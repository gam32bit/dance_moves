import { useRef, useState } from 'react';
import { exportBackup, importBackup } from '../backup';
import Modal from './Modal';

export default function Settings({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>();

  return (
    <Modal title="Settings" onClose={onClose}>
      <p className="muted">
        All data lives only on this device. Export a backup regularly, and import it on a
        new device or after clearing your browser.
      </p>
      <button className="btn btn-primary" onClick={() => exportBackup()}>
        Export backup
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()}>
        Import backup (replaces all data)
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await importBackup(f);
            setMsg('Imported. Reloading…');
            setTimeout(() => location.reload(), 800);
          } catch (err) {
            setMsg(err instanceof Error ? err.message : 'Import failed');
          }
        }}
      />
      {msg && <p className="muted">{msg}</p>}
    </Modal>
  );
}
