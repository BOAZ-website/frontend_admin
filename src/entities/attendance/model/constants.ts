import type { AttendanceStatus } from './types';

export const WEEKS = [
  { id: 'w1', label: '1주차', date: '03.04' },
  { id: 'w2', label: '2주차', date: '03.11' },
  { id: 'w3', label: '3주차', date: '03.18' },
  { id: 'w4', label: '4주차', date: '03.25' },
];

// 샘플 인증 사진 이미지
export const SAMPLE_PROOF_IMAGES = [
  '/sample-study-photo.jpg?v=2',
  '/sample-study-photo.jpg?v=2',
  '/sample-study-photo.jpg?v=2',
  '/sample-study-photo.jpg?v=2',
];

export const STATUS_CFG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  present: { label: '출석', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  late: { label: '지각', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  earlyLeave: { label: '조퇴', color: '#d97706', bg: '#fef3c7', border: '#fde68a' },
  absent: { label: '결석', color: '#e11d48', bg: '#fff1f2', border: '#fecdd3' },
  excusedAbsent: { label: '인정결석', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  remote: { label: '비대면', color: '#4f46e5', bg: '#eef2ff', border: '#c7d2fe' },
  unexcusedLate: { label: '무단지각', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  unexcusedAbsent: { label: '무단결석', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' },
  unmarked: { label: '미정', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1' },
};

export const STATUS_BUTTON_STYLES: Record<AttendanceStatus, { active: string; inactive: string }> =
  {
    present: {
      active:
        'bg-emerald-600 text-white font-bold shadow-xs border border-emerald-600 ring-2 ring-emerald-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 border border-slate-200 shadow-2xs',
    },
    late: {
      active:
        'bg-amber-500 text-white font-bold shadow-xs border border-amber-500 ring-2 ring-amber-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50/60 border border-slate-200 shadow-2xs',
    },
    earlyLeave: {
      active:
        'bg-amber-500 text-white font-bold shadow-xs border border-amber-500 ring-2 ring-amber-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50/60 border border-slate-200 shadow-2xs',
    },
    absent: {
      active:
        'bg-rose-500 text-white font-bold shadow-xs border border-rose-500 ring-2 ring-rose-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-rose-700 hover:bg-rose-50/60 border border-slate-200 shadow-2xs',
    },
    excusedAbsent: {
      active:
        'bg-blue-600 text-white font-bold shadow-xs border border-blue-600 ring-2 ring-blue-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50/60 border border-slate-200 shadow-2xs',
    },
    remote: {
      active:
        'bg-indigo-600 text-white font-bold shadow-xs border border-indigo-600 ring-2 ring-indigo-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-indigo-700 hover:bg-indigo-50/60 border border-slate-200 shadow-2xs',
    },
    unexcusedLate: {
      active:
        'bg-orange-600 text-white font-bold shadow-xs border border-orange-600 ring-2 ring-orange-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-orange-700 hover:bg-orange-50/60 border border-slate-200 shadow-2xs',
    },
    unexcusedAbsent: {
      active:
        'bg-red-700 text-white font-bold shadow-xs border border-red-700 ring-2 ring-red-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-red-700 hover:bg-red-50/60 border border-slate-200 shadow-2xs',
    },
    unmarked: {
      active:
        'bg-slate-600 text-white font-bold shadow-xs border border-slate-600 ring-2 ring-slate-500/20',
      inactive:
        'bg-white text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 shadow-2xs',
    },
  };
