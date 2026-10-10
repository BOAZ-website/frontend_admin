export type ScoreRuleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'SCHEDULED';

export interface ScoreRule {
  id?: string;
  version: number;
  term: number; // 기존 API 호환용 활동 기수. 버전 생성 기준으로 사용하지 않는다.
  name: string; // 규칙명 (예: '27기 정규 출결 점수 규칙')
  startDate: string; // 적용 시작일 (YYYY-MM-DD)
  endDate: string | null; // 적용 종료일 (YYYY-MM-DD | null)
  status: ScoreRuleStatus;
  activatedAt: string | null;
  createdBy: string;
  description?: string;

  // 정규 세션 및 활동 감점/가점 항목
  present: number;
  late: number;
  absent: number;
  absentPenalty?: number; // 사유결석 감점 (기본: -3)
  unexcusedAbsentPenalty?: number; // 무단결석 감점 (기본: -4)
  latePenalty?: number; // 지각 감점 (기본: -1)
  earlyLeavePenalty?: number; // 조퇴 감점 (기본: -1)
  unexcusedLatePenalty?: number; // 무단지각 3회 감점 (기본: -4)
  presentScore?: number; // 출석 점수 (기본: 0 또는 1)

  // 스터디 배점 항목(스터디마다 매긴다. 계산은 studyScore.ts)
  studyPerfectBonus?: number; // 진행한 회차 모두 출석 (기본: +3)
  studyPassBonus?: number; // 결석이 studyPassMaxAbsences회 이하 (기본: +1)
  studyPassMaxAbsences?: number; // 수료로 보는 최대 결석 횟수 (기본: 2)
  studyFailPenalty?: number; // 결석이 studyPassMaxAbsences회보다 많음 (기본: -5)
  studyNoneCompletedPenalty?: number; // 스터디를 하나도 이수(참여)하지 않음 (기본: -5)
  studyLeaderBonus?: number; // 스터디 팀장, 이수와 상관없이 (기본: +1)

  // 기본점수·신입 특칙형 행사·컨퍼런스 가점 항목(「관리자 시스템 관련 현행 운영 방식」 문서 기준)
  baseScore?: number; // 기본 활동점수(최초 가입 시 1회, 기본: +10)
  newcomerExcusedAbsentPenalty?: number; // 신입 특칙: 운영진이 인정한 사유의 결석(기본: -10)
  newcomerLatePenalty?: number; // 신입 특칙: 지각 또는 조퇴(기본: -15)
  newcomerExcusedLatePenalty?: number; // 신입 특칙: 인정 사유가 있는 지각 또는 조퇴(기본: -5)
  conferenceFirstBonus?: number; // 컨퍼런스 1차 출석 가점(기본: +1)
  conferenceSecondBonus?: number; // 컨퍼런스 2차 출석 가점(기본: +1)
  excusedAbsentScore?: number; // 인정결석 점수(기본: 0)
  unexcusedLatesPerAbsence?: number; // 무단결석 1회로 환산하는 무단지각 횟수(기본: 3)
  expelUnexcusedAbsences?: number; // 제명되는 무단결석 누적 횟수(기본: 3)
}
