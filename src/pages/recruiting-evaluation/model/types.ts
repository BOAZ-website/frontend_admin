/**
 * 서류 평가 화면의 타입과 표시 이름. 필드 이름은 백엔드 응답(REC-ADMIN-13~20)의 snake_case를 따른다.
 * PoC 화면만 쓰는 필드(status·my_score 등)는 실제 응답에 없을 수 있어 주석으로 구분한다.
 */

/** 화면 상단 탭. 사이드바 메뉴 3개와 1:1로 대응한다. */
export type EvaluationTab = 'applicants' | 'my' | 'promotions';

export type ApplicationStatus = 'DRAFT' | 'SUBMITTED';
export type EvaluationDecision = 'PASS' | 'HOLD' | 'FAIL' | 'PENDING';
export type TrackType = 'ANALYSIS' | 'ENGINEERING' | 'VISUALIZATION';
/** PoC 목 데이터 값. 백엔드 응답은 `COMPLETED_OR_EXEMPT`·`NOT_COMPLETED` 두 값이라 API 연동 때 맞춘다. */
export type MilitaryStatus = 'COMPLETED' | 'EXEMPTED' | 'UNFULFILLED' | 'NOT_APPLICABLE';

/** 지원자 요약(REC-ADMIN-13 ApplicantSummaryResponse). */
export interface ApplicantSummaryDto {
  id: number;
  user_id: number;
  status: ApplicationStatus;
  track: TrackType;
  name: string;
  email: string;
  phone: string;
  university: string;
  major: string;
  minor_double_major: string[];
  last_semester: number;
  military_status: MilitaryStatus;
  birth_date: string;
  graduation_date: string;
  grad_school_plan: boolean;
  submitted_at: string | null;
}

/**
 * 지원자별 평가 집계(REC-ADMIN-14 ApplicantEvaluationResponse).
 * my_score·my_memo·my_interview_question·is_promoted_to_member는 PoC 화면 필드다.
 * 실제 REC-ADMIN-14 응답에는 없고(내 평가는 REC-ADMIN-16), status도 REC-ADMIN-14에는 없다.
 */
export interface ApplicantEvaluationDto extends ApplicantSummaryDto {
  pass_count: number;
  hold_count: number;
  fail_count: number;
  total_score: number;
  final_decision: EvaluationDecision;
  my_decision: EvaluationDecision | null;
  my_score: number | null;
  my_memo: string | null;
  my_interview_question: string | null;
  is_promoted_to_member?: boolean;
}

/** 평가자별 평가 한 줄(REC-ADMIN-15 evaluations[]). */
export interface EvaluatorDetailItem {
  admin_id: number;
  name: string;
  track: TrackType | 'COMMON';
  decision: EvaluationDecision | null;
  score: number | null;
  memo: string | null;
}

/** 평가자별 면접 질문 한 줄(REC-ADMIN-19 interview_questions[]). */
export interface InterviewQuestionItem {
  admin_id: number;
  name: string;
  track: TrackType | 'COMMON';
  interview_question: string | null;
}

/** 지원서 답변 한 줄(REC-ADMIN-20 answers[]). TEXT는 문자열, TABLE은 항목별 문자열 객체다. */
export interface ApplicantAnswerDto {
  question_id: number;
  label: string;
  category: string;
  type: 'TEXT' | 'TABLE';
  content: string;
  order_num: number;
  answer: string | Record<string, string> | null;
}

/** 개인 평가 저장 요청(REC-ADMIN-17 body). */
export interface MyEvaluationInput {
  decision: EvaluationDecision;
  /** 1~10 정수. 비워 두면 null. */
  score: number | null;
  memo: string;
  interview_question: string;
}

/** 내 평가(REC-ADMIN-16 data). 아직 평가하지 않았으면 응답 data가 null이다(오류 아님). */
export interface MyEvaluationDto {
  evaluation_id: number;
  applicant_id: number;
  decision: EvaluationDecision;
  score: number | null;
  memo: string | null;
  interview_question: string | null;
}

/** 승격 실행 결과. 실패 목록 모양은 백엔드 PromoteUsersResponse와 맞춰야 한다(연동 때 확인). */
export interface PromotionResult {
  successUserIds: number[];
  failedList: { user_id: number; error_code: string }[];
}

export const DECISION_LABELS: Record<EvaluationDecision, string> = {
  PASS: '합격',
  HOLD: '보류',
  FAIL: '불합격',
  PENDING: '미결',
};

export const TRACK_LABELS: Record<TrackType, string> = {
  ENGINEERING: '엔지니어링',
  ANALYSIS: '분석',
  VISUALIZATION: '시각화',
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: '제출 완료',
  DRAFT: '임시저장',
};

export const MILITARY_STATUS_LABELS: Record<MilitaryStatus, string> = {
  COMPLETED: '군필',
  EXEMPTED: '면제',
  UNFULFILLED: '미필',
  NOT_APPLICABLE: '해당 없음',
};
