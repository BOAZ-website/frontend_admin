import type { AttendanceStatus } from "./types";

export const WEEKS = [
  { id: "w1", label: "1주차", date: "03.04" },
  { id: "w2", label: "2주차", date: "03.11" },
  { id: "w3", label: "3주차", date: "03.18" },
  { id: "w4", label: "4주차", date: "03.25" },
];

// 샘플 인증 사진 이미지
export const SAMPLE_PROOF_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80",
];

export const STATUS_CFG: Record<
  AttendanceStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  present: { label: "출석", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  late: { label: "지각", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  absent: { label: "결석", color: "#e11d48", bg: "#fff1f2", border: "#fecdd3" },
};

export const STATUS_BUTTON_STYLES: Record<AttendanceStatus, { active: string; inactive: string }> =
  {
    present: {
      active:
        "bg-emerald-600 text-white font-bold shadow-xs border border-emerald-600 ring-2 ring-emerald-500/20",
      inactive:
        "bg-white text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 border border-slate-200 shadow-2xs",
    },
    late: {
      active:
        "bg-amber-500 text-white font-bold shadow-xs border border-amber-500 ring-2 ring-amber-500/20",
      inactive:
        "bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50/60 border border-slate-200 shadow-2xs",
    },
    absent: {
      active:
        "bg-rose-500 text-white font-bold shadow-xs border border-rose-500 ring-2 ring-rose-500/20",
      inactive:
        "bg-white text-slate-600 hover:text-rose-700 hover:bg-rose-50/60 border border-slate-200 shadow-2xs",
    },
  };
