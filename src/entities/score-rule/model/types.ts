export type ScoreRuleStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT' | 'SCHEDULED';

export interface ScoreRule {
  id?: string;
  version: number;
  term: number; // 기수 (예: 27)
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

  // 스터디 배점 항목
  studyFailPenalty?: number; // 미이수 또는 70% 미만 출석 감점 (기본: -5)
  studyPerfectBonus?: number; // 100% 개근 가산점 (기본: +3)
  studyPassBonus?: number; // 70%~100% 미만 정규 수료 가산점 (기본: +1)
  studyLeaderBonus?: number; // 스터디 팀장 가산점 (기본: +1)
}
