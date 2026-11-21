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
  major: string | null;
  minor_double_major: string[];
  last_semester: number | null;
  military_status: MilitaryStatus;
  birth_date: string;
  graduation_date: string | null;
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
  /** 합격자 부원 등록 상단 지표만 쓴다. 표의 행 상태는 이 값이 아니라 화면에서 보낸 요청 결과로 정한다. */
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

/** 지원서 문항 카테고리(백엔드 ApplicationQuestion.Category). */
export type QuestionCategory = 'COMMON' | 'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING';

/**
 * 지원서 답변 한 줄(REC-ADMIN-20 answers[]). TEXT는 문자열, TABLE은 항목별 문자열 객체다.
 * 저장된 TABLE 답을 서버가 읽지 못하면 answer가 null이다.
 */
export interface ApplicantAnswerDto {
  question_id: number;
  /** 파일 내보내기용 열 이름. 없을 수 있다. */
  label: string | null;
  category: QuestionCategory;
  type: 'TEXT' | 'TABLE';
  /** 질문 내용. 서버가 {Track}을 지원서 부문 이름으로 바꿔 준다. */
  content: string;
  order_num: number;
  answer: string | Record<string, string> | null;
}

/** REC-ADMIN-20 응답의 data. 답변은 order_num 오름차순이고, 답하지 않은 문항은 없다. */
export interface ApplicantAnswersResponse {
  applicant_id: number;
  answers: ApplicantAnswerDto[];
}

/** 백엔드 성공 응답 형식({ status, data }). */
export interface ApiResponse<T> {
  status: number;
  data: T;
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

/** 부원 등록(PATCH /api/v1/admin/users/promote) 요청 body. 키는 로컬 백엔드(SNAKE_CASE)와 같다. */
export interface PromoteUsersRequest {
  user_ids: number[];
}

/**
 * 부원 등록(PATCH /api/v1/admin/users/promote) 200 응답의 data. 성공 목록은 없고 실패한 사람만 온다.
 * 요청한 사람 중 이 목록에 없는 사람이 등록에 성공한 사람이다.
 */
export interface PromoteUsersResponse {
  failed_user_ids: { user_id: number; error_code: string }[];
}

/** 고를 수 있는 판정(개인 평가 버튼, 최종 평가 드롭다운). PENDING(미정)은 처음 값이거나 저장된 기록을 보여 줄 때만 쓴다. */
export const SELECTABLE_DECISIONS: readonly EvaluationDecision[] = ['PASS', 'HOLD', 'FAIL'];

export const DECISION_LABELS: Record<EvaluationDecision, string> = {
  PASS: '합격',
  HOLD: '보류',
  FAIL: '불합격',
  PENDING: '미정',
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
