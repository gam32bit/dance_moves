import { STATUS_LABELS, type MoveStatus } from '../types';

export default function StatusBadge({ status }: { status: MoveStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status]}</span>;
}
