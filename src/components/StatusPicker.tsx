import { STATUS_LABELS, STATUS_ORDER, type MoveStatus } from '../types';

export default function StatusPicker({
  value,
  onChange,
}: {
  value: MoveStatus;
  onChange: (s: MoveStatus) => void;
}) {
  return (
    <div className="segmented" role="group" aria-label="Move status">
      {STATUS_ORDER.map((s) => (
        <button
          key={s}
          type="button"
          className={s === value ? 'seg seg-active' : 'seg'}
          onClick={() => onChange(s)}
        >
          {STATUS_LABELS[s]}
        </button>
      ))}
    </div>
  );
}
