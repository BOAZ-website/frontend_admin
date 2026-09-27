export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'earlyLeave'
  | 'absent'
  | 'excusedAbsent'
  | 'remote'
  | 'unexcusedLate'
  | 'unexcusedAbsent'
  | 'unmarked';

export interface SessionRecord {
  statuses: Record<string, AttendanceStatus>;
  memos?: Record<string, string>;
  photo: string | null;
  photoUrl?: string | null;
  photoName?: string | null;
  photoSize?: string | null;
  /** 멘멘 스터디가 주차별로 첨부하는 PDF 자료. */
  pdfUrl?: string | null;
  pdfName?: string | null;
  pdfSize?: string | null;
  submitted: boolean;
  submittedAt: string | null;
  confirmedByAdmin?: boolean;
}

export type AttendanceState = Record<string, SessionRecord>;
