import type { LeaveType } from '../types'

const badgeClass: Record<LeaveType, string> = {
  'Cuti Tahunan': 'annual',
  'Cuti Sakit': 'sick',
  'Cuti Izin': 'permission',
  'Cuti Khusus': 'special',
  Lainnya: 'other',
}

export function LeaveBadge({ type }: { type: LeaveType }) {
  return <span className={`leave-badge leave-badge--${badgeClass[type]}`}>{type}</span>
}
