export type AttendanceStatus = 'present' | 'late' | 'absent';

export interface SessionRecord {
  statuses: Record<string, AttendanceStatus>;
  memos?: Record<string, string>;
  photo: string | null;
  photoUrl?: string | null;
  photoName?: string | null;
  photoSize?: string | null;
  submitted: boolean;
  submittedAt: string | null;
  confirmedByAdmin?: boolean;
}

export type AttendanceState = Record<string, SessionRecord>;
