import type { ScoreRuleStatus } from './types';

/**
 * 점수 규칙 생성(POST)·수정(PATCH) 요청. 응답은 화면이 쓰는 ScoreRule 형태 그대로 내려온다.
 * 수정은 보낸 값만 바뀐다. 점수 항목을 생략하면 생성 시 기본값을 쓴다.
 */
export interface ScoreRuleUpsertRequest {
  /** 기존 API 호환용 활동 기수. 규칙 버전은 이 값과 무관하게 여러 개 만들 수 있다. */
  term?: number;
  name?: string;
  startDate?: string;
  /** null이면 진행 중. 다음 버전을 만들 때 종료일이 정해진다. */
  endDate?: string | null;
  /** ACTIVE는 생성·수정으로 정하지 않고 활성화 API(POST /:ruleId/activate)로 정한다. */
  status?: Exclude<ScoreRuleStatus, 'ACTIVE'>;
  createdBy?: string;
  description?: string;
  presentScore?: number;
  absentPenalty?: number;
  unexcusedAbsentPenalty?: number;
  latePenalty?: number;
  earlyLeavePenalty?: number;
  unexcusedLatePenalty?: number;
  studyFailPenalty?: number;
  studyPerfectBonus?: number;
  studyPassBonus?: number;
  studyLeaderBonus?: number;
  studyPassMaxAbsences?: number;
  studyNoneCompletedPenalty?: number;
  baseScore?: number;
  newcomerExcusedAbsentPenalty?: number;
  newcomerLatePenalty?: number;
  newcomerExcusedLatePenalty?: number;
  conferenceFirstBonus?: number;
  conferenceSecondBonus?: number;
  excusedAbsentScore?: number;
  unexcusedLatesPerAbsence?: number;
  expelUnexcusedAbsences?: number;
}
