/**
 * 출결 API의 요청·응답 형태. 백엔드와 맞출 계약의 초안이며, 화면 상태 타입(AttendanceState 등)과는 별개다.
 */
import type { SemesterDto, SemesterWeekDto } from '@/entities/cohort/model/dto';
import type { StudyKind, StudyPeriod, TeamGroup } from '@/entities/study-team/model/dto';
import type { UserTrack } from '@/entities/user/model/types';

import type { AttendanceStatus } from './types';
import type { WeekInfo } from './week';

/** 멘멘 스터디만 '멘멘' | '친바'. 그 외에는 ''. */
export type SubType = '' | '멘멘' | '친바';
export type StatusCounts = Record<AttendanceStatus, number>;

// ───────────────────────────── 기준 데이터 ─────────────────────────────

export interface AttendanceMetaResponse {
  /** 현재 반기와 지난 반기(큰 기수부터). 다음 반기는 넣지 않는다. */
  semesters: SemesterDto[];
  currentSemester: SemesterDto;
  /** 다음 반기. 아직 등록되지 않았으면 출결 생성(BASE·ADV) 때 등록될 반기의 값이다. */
  nextSemester: SemesterDto;
  /** 다음 반기가 아직 DB에 등록되지 않아 생성할 수 있는지 여부. */
  canCreateNextSemester: boolean;
  /** 요청한 반기(생략하면 현재 반기). 아래 weeks·defaultWeekNum이 이 반기 기준이다. */
  semester: SemesterDto;
  tracks: UserTrack[];
  periods: ('방학' | '학기')[];
  weeks: SemesterWeekDto[];
  /** 화면이 처음 보여줄 주차(진행 중 → 마지막 종료 주차). */
  defaultWeekNum: number;
}

// ───────────────────────────── 팀 주차 출결 ─────────────────────────────

export interface AttendanceRecordDto {
  memberId: string;
  subType: SubType;
  status: AttendanceStatus;
  memo: string | null;
}

export interface AttachedFileDto {
  url: string;
  name: string | null;
  size: string | null;
}

export interface SessionDto {
  weekNum: number;
  weekLabel: string;
  period: '방학' | '학기';
  weekStatus: WeekInfo['status'];
  submitted: boolean;
  submittedAt: string | null;
  photo: AttachedFileDto | null;
  pdf: AttachedFileDto | null;
  records: AttendanceRecordDto[];
}

export interface SessionSummaryDto {
  weekNum: number;
  weekStatus: WeekInfo['status'];
  submitted: boolean;
  submittedAt: string | null;
  hasPhoto: boolean;
  hasPdf: boolean;
  counts: StatusCounts;
}

export interface AttendanceRecordInput {
  memberId: string;
  subType?: SubType;
  status: AttendanceStatus;
  /** 보내지 않으면 기존 비고를 유지하고, 빈 문자열이나 null이면 지운다. */
  memo?: string | null;
}

/** 첨부 파일. 백엔드 연동 시 multipart로 바꾼다. */
export interface FileUpload {
  /** data URL 또는 이미 올라가 있는 파일 경로·URL. */
  dataUrl: string;
  name: string;
  size?: string;
}

export interface SaveWeekAttendanceRequest {
  records: AttendanceRecordInput[];
}

export interface SubmitWeekRequest {
  records?: AttendanceRecordInput[];
  /** 생략하면 기존 사진 유지, null이면 삭제. */
  photo?: FileUpload | null;
  /** 멘멘 스터디만. 생략하면 기존 PDF 유지, null이면 삭제. */
  pdf?: FileUpload | null;
}

export interface SubmitWeekResponse {
  submittedAt: string;
  /** 이미 제출한 주차를 다시 제출했는지(운영진 수정 후 재제출). */
  resubmitted: boolean;
  session: SessionDto;
}

// ───────────────────────────── 점수 ─────────────────────────────

export interface MemberScoreDto {
  memberId: string;
  userId: string;
  name: string;
  term: number;
  track: string;
  subType: SubType;
  isLeader: boolean;
  weeks: { weekNum: number; status: AttendanceStatus; points: number }[];
  attendedCount: number;
  totalScore: number;
}

export interface TeamScoreDto {
  teamId: string;
  teamName: string;
  group: TeamGroup;
  track: string;
  kind: StudyKind;
  members: MemberScoreDto[];
}

export interface AttendanceScoresResponse {
  semester: SemesterDto;
  rule: { id: string | null; name: string; term: number; version: number };
  teams: TeamScoreDto[];
}

export interface AttendanceScoresQuery {
  /** 생략하면 현재 반기. */
  semester?: string;
  group?: TeamGroup;
  teamId?: string;
  weekNum?: number;
  /** 방학 또는 학기 주차만 계산한다. 생략하면 반기 전체 주차다. */
  period?: StudyPeriod;
}

// ───────────────────────────── 점수표(엑셀 양식) ─────────────────────────────

/** 점수표 기준 팀 구분. BASE 중간·최종은 BASE 트랙 출결, ADV 중간·최종은 ADV 팀 출결로 계산한다. */
export type ScoreSheetGroup = 'BASE' | 'ADV';

/** 회원 한 명의 점수표 행. 아직 데이터가 없는 활동 점수(친바·홍보·과제 등)는 0으로 내려온다. */
export interface ScoreSheetMemberDto {
  /** users.id */
  id: string;
  name: string;
  term: number;
  track: string;
  /** 응답의 weeks와 같은 순서의 주차별 출결 상태. 기록이 없으면 null. */
  statuses: (AttendanceStatus | null)[];
  baseDefaultScore: number;
  lateCount: number;
  lateDeduction: number;
  earlyLeaveCount: number;
  earlyLeaveDeduction: number;
  absentCount: number;
  absentDeduction: number;
  attendanceScore: number;
  baseStudyScore: number;
  chinbaScore: number;
  promoScore: number;
  baseTaskScore: number;
  mtScore: number;
  etcScore: number;
  baseMidScore: number;
  baseFinalRefScore: number;
  advStudyScore: number;
  confScore: number;
  advMidScore: number;
  termSessionScore: number;
  finalTaskScore: number;
  termStudyScore: number;
  officerScore: number;
  jointSessionScore: number;
  finalEtcScore: number;
  newRecruitPromoScore: number;
  parallelMidScore: number;
  parallelScore: number;
  parallelAttendance: number;
  /** 병행 포기 여부 표시값. 병행 회원이면 '미연동', 아니면 '-'. */
  parallelGiveup: string;
  baseFinalScore: number;
  advFinalScore: number;
  isTop5: boolean;
}

export interface ScoreSheetResponse {
  semester: SemesterDto;
  group: ScoreSheetGroup;
  /** 점수표의 주차 열. 이 구분의 팀에 출결 세션이 있는 주차만 담는다. */
  weeks: SemesterWeekDto[];
  members: ScoreSheetMemberDto[];
}
