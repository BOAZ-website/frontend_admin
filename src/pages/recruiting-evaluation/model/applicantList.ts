/**
 * 전체 지원 현황(EVL-APP) 목록의 필터·검색·정렬·통계 계산. 서버는 목록 전체를 주고 화면이 거른다(REC-ADMIN-13).
 */
import type { ApplicantEvaluationDto, ApplicationStatus, TrackType } from './types';

export type ApplicantSort = 'SUBMITTED_DESC' | 'SUBMITTED_ASC' | 'NAME';

/** 전체 지원 현황 목록의 조회 조건. */
export interface ApplicantListQuery {
  status: 'ALL' | ApplicationStatus;
  track: 'ALL' | TrackType;
  search: string;
  sort: ApplicantSort;
}

export const DEFAULT_APPLICANT_QUERY: ApplicantListQuery = {
  status: 'ALL',
  track: 'ALL',
  search: '',
  sort: 'SUBMITTED_DESC',
};

export const APPLICANT_SORT_LABELS: Record<ApplicantSort, string> = {
  SUBMITTED_DESC: '제출일 최신순',
  SUBMITTED_ASC: '제출일 오래된순',
  NAME: '이름순',
};

/** 필터·검색 조건이 기본값과 다른지. 필터 결과가 0건일 때 "필터 초기화"를 보여 줄지 정한다. */
export const isFilteredQuery = (query: ApplicantListQuery): boolean =>
  query.status !== 'ALL' || query.track !== 'ALL' || query.search.trim() !== '';

// order 1은 오래된순, -1은 최신순. 제출일이 없는 DRAFT는 순서와 관계없이 뒤에 둔다(REC-ADMIN-13 정렬 규칙).
const compareSubmittedAt = (a: string | null, b: string | null, order: 1 | -1): number => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -order : order;
};

/** 조건에 맞는 지원자만 남기고 정렬한다. 비어 있는(null) 필드는 검색에서 빠진다. */
export function filterApplicants(
  applicants: readonly ApplicantEvaluationDto[],
  query: ApplicantListQuery,
): ApplicantEvaluationDto[] {
  const keyword = query.search.trim().toLowerCase();
  return applicants
    .filter((applicant) => query.status === 'ALL' || applicant.status === query.status)
    .filter((applicant) => query.track === 'ALL' || applicant.track === query.track)
    .filter(
      (applicant) =>
        !keyword ||
        [applicant.name, applicant.email, applicant.university, applicant.major].some((value) =>
          (value ?? '').toLowerCase().includes(keyword),
        ),
    )
    .sort((a, b) =>
      query.sort === 'NAME'
        ? (a.name ?? '').localeCompare(b.name ?? '', 'ko')
        : compareSubmittedAt(
            a.submitted_at,
            b.submitted_at,
            query.sort === 'SUBMITTED_DESC' ? -1 : 1,
          ),
    );
}

/** 지원 현황(APP-07)과 평가 현황(APP-08) 통계. 평가 현황은 제출 완료 지원서만 센다. */
export interface ApplicantSummary {
  total: number;
  submitted: number;
  draft: number;
  myEvaluated: number;
  finalPass: number;
  finalHold: number;
  finalFail: number;
  finalPending: number;
}

/** 받은 목록으로 통계를 센다. 권한에 따라 일부 부문만 받을 수 있어 "전체 모집 인원"과 같지 않을 수 있다. */
export function summarizeApplicants(
  applicants: readonly ApplicantEvaluationDto[],
): ApplicantSummary {
  const submitted = applicants.filter((applicant) => applicant.status === 'SUBMITTED');
  const countFinal = (decision: ApplicantEvaluationDto['final_decision']) =>
    submitted.filter((applicant) => applicant.final_decision === decision).length;
  return {
    total: applicants.length,
    submitted: submitted.length,
    draft: applicants.length - submitted.length,
    myEvaluated: submitted.filter((applicant) => applicant.my_decision !== null).length,
    finalPass: countFinal('PASS'),
    finalHold: countFinal('HOLD'),
    finalFail: countFinal('FAIL'),
    finalPending: countFinal('PENDING'),
  };
}

/** 비어 있는 값(null·빈 문자열·빈 목록)은 '-'로 보여 준다. DRAFT는 입력하지 않은 개인정보가 null이다. */
export function displayValue(
  value: string | number | boolean | readonly string[] | null | undefined,
): string {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '-';
  if (typeof value === 'boolean') return value ? '있음' : '없음';
  return String(value);
}

/** 개인 평가 목록의 평가 상태 필터(MY-02). PENDING을 저장한 것도 저장됨이다(명세 §2.2). */
export type MyEvaluationFilter = 'ALL' | 'UNEVALUATED' | 'SAVED';

export const MY_EVALUATION_FILTER_LABELS: Record<MyEvaluationFilter, string> = {
  ALL: '전체',
  UNEVALUATED: '미평가',
  SAVED: '저장됨',
};

/** 내 평가 저장 여부로 거른다. my_decision이 null이면 미평가다. */
export function filterByMyEvaluation(
  applicants: readonly ApplicantEvaluationDto[],
  filter: MyEvaluationFilter,
): ApplicantEvaluationDto[] {
  if (filter === 'ALL') return [...applicants];
  const isSaved = filter === 'SAVED';
  return applicants.filter((applicant) => (applicant.my_decision !== null) === isSaved);
}
