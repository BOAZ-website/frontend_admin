/**
 * 리크루팅(모집 공고·지원서 문항·사전 알림 신청) 타입.
 * 키 이름과 값은 백엔드 응답(snake_case) 그대로다. 백엔드 `domain/recruitment/dto/response`가 기준이다.
 */

export const QUESTION_CATEGORIES = ['COMMON', 'ANALYSIS', 'VISUALIZATION', 'ENGINEERING'] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const QUESTION_TYPES = ['TEXT', 'TABLE'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export interface Recruitment {
  recruitment_id: number;
  term: number;
  /** 접수 시작·마감 일시. 'YYYY-MM-DDTHH:mm:ss'(한국 시각, 시간대 표기 없음). */
  start_date: string;
  end_date: string;
  /** 전형 일정. 서버는 항목 모양을 검사하지 않고 보낸 JSON 배열을 그대로 저장한다. */
  schedule: unknown[];
  /** 홍보 책자 PDF 주소. 없으면 키가 빠진다. */
  brochure_url?: string;
  /** 지금이 접수 기간 안인지. 서버가 요청 시각으로 계산한다(저장하는 값이 아니다). */
  is_active: boolean;
}

/** 표 형식 문항의 정의. 서버는 multiple이 boolean인지만 검사하고 나머지는 그대로 저장한다. */
export interface QuestionMetadata {
  multiple?: boolean;
  columns?: string[];
  rows?: string[];
}

interface QuestionBase {
  question_id: number;
  /** 문항 표기명(예: '공통1'). 같은 공고 안에서 겹칠 수 없고 20자까지다. */
  label: string;
  category: QuestionCategory;
  content: string;
  description?: string;
  /** 같은 공고·같은 분류 안에서 겹칠 수 없다. */
  order_num: number;
  is_required: boolean;
}

/** TEXT 문항은 글자 수 제한만, TABLE 문항은 표 정의만 있다. */
export type Question = QuestionBase &
  ({ type: 'TEXT'; limit_length: number } | { type: 'TABLE'; metadata: QuestionMetadata });

/** 사전 알림 신청. 서버가 보관하는 값은 이메일과 신청 시각뿐이다. */
export interface Subscription {
  id: number;
  email: string;
  /** 'YYYY-MM-DDTHH:mm:ss' */
  created_at: string;
}
