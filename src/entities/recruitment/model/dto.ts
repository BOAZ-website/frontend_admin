/**
 * 리크루팅 관리 API의 요청·응답 본문. 백엔드 `domain/recruitment/dto/request`가 기준이다.
 */
import type { QuestionCategory, QuestionMetadata, QuestionType } from './types';

export interface RecruitmentCreateRequest {
  term: number;
  start_date: string;
  end_date: string;
  schedule: unknown[];
  brochure_url?: string;
}

/** 보낸 값만 바뀐다. brochure_url은 null을 보내면 지운다. */
export interface RecruitmentUpdateRequest {
  term?: number;
  start_date?: string;
  end_date?: string;
  schedule?: unknown[];
  brochure_url?: string | null;
}

export interface RecruitmentIdResponse {
  recruitment_id: number;
}

/** TEXT는 limit_length, TABLE은 metadata가 있어야 한다(없으면 400 MISSING_PARAMETER). */
export interface QuestionCreateItem {
  label: string;
  category: QuestionCategory;
  type: QuestionType;
  content: string;
  description?: string;
  limit_length?: number;
  metadata?: QuestionMetadata;
  order_num: number;
  is_required: boolean;
}

/**
 * 보낸 값만 바뀐다. description·limit_length·metadata는 null을 보내면 지운다.
 * type을 바꿀 때는 새 유형에 맞는 limit_length(TEXT)나 metadata(TABLE)를 함께 보내야 한다.
 */
export interface QuestionUpdateRequest {
  label?: string;
  category?: QuestionCategory;
  type?: QuestionType;
  content?: string;
  description?: string | null;
  limit_length?: number | null;
  metadata?: QuestionMetadata | null;
  order_num?: number;
  is_required?: boolean;
}

export interface QuestionIdsResponse {
  ids: number[];
}

export interface QuestionIdResponse {
  question_id: number;
}
