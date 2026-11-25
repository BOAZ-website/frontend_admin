/**
 * 전체 지원 현황(EVL-APP) 목록의 필터·검색·정렬·통계 계산. 서버는 목록 전체를 주고 화면이 거른다(REC-ADMIN-13).
 */
import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { dateTimeTextOf } from '@/shared/lib/date';

import {
  APPLICATION_STATUS_LABELS,
  type ApplicantSummaryDto,
  type ApplicantEvaluationDto,
  type ApplicationStatus,
  type EvaluationDecision,
  MILITARY_STATUS_LABELS,
  TRACK_LABELS,
  type TrackType,
} from './types';

/** 부문 표시·필터 순서(분석 → 시각화 → 엔지니어링). */
export const TRACK_ORDER: readonly TrackType[] = ['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'];

/** 부문 필터 선택지(전체 / 분석 / 시각화 / 엔지니어링). 전체 지원 현황과 합격자 부원 등록이 쓴다. */
export const TRACK_FILTER_OPTIONS: readonly { value: 'ALL' | TrackType; label: string }[] = [
  { value: 'ALL', label: '전체' },
  ...TRACK_ORDER.map((track) => ({ value: track, label: TRACK_LABELS[track] })),
];

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

/**
 * 전체 지원 현황 지표에서 부문별 인원을 보여 줄 부문. 다른 부문 평가 권한(EVALUATION_ALL_TRACK_WRITE)이 있으면 세 부문 모두,
 * 없으면 팀과 관계없이 회원 부문(users.track)과 같은 부문 하나만 본다. 서버 목록 API와 같은 기준이다. 계정을 못 읽었으면 보여 주지 않는다.
 */
export function visibleTracksOf(
  account: Pick<AdminAccount, 'track' | 'effectivePermissions'> | null,
): TrackType[] {
  if (!account) return [];
  if (can(account, 'EVALUATION_ALL_TRACK_WRITE')) return [...TRACK_ORDER];
  // 백엔드는 영어 코드(ANALYSIS 등), 임시 API는 한글 이름('분석')을 보내므로 둘 다 받는다.
  return TRACK_ORDER.filter(
    (track) => track === account.track || TRACK_LABELS[track] === account.track,
  );
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

/**
 * 지원자 인적사항 항목(이름 제외). 전체 지원 현황 상세와 서류 평가 상세가 같은 항목을 같은 순서로 보여 준다.
 * 순서는 API 명세(REC-ADMIN-13 ApplicantSummaryResponse)의 필드 순서이고, 내부 식별자(id·user_id)는 뺀다.
 */
export function applicantInfoFields(applicant: ApplicantSummaryDto): [string, string][] {
  return [
    ['상태', APPLICATION_STATUS_LABELS[applicant.status]],
    ['부문', applicant.track ? TRACK_LABELS[applicant.track] : '-'],
    ['이메일', displayValue(applicant.email)],
    ['전화번호', displayValue(applicant.phone)],
    ['학교', displayValue(applicant.university)],
    ['전공', displayValue(applicant.major)],
    ['부·복수전공', displayValue(applicant.minor_double_major)],
    ['마지막 학기', displayValue(applicant.last_semester)],
    ['병역', applicant.military_status ? MILITARY_STATUS_LABELS[applicant.military_status] : '-'],
    ['생년월일', displayValue(applicant.birth_date)],
    ['졸업 예정', displayValue(applicant.graduation_date)],
    ['대학원 진학 계획', displayValue(applicant.grad_school_plan)],
    ['제출일', applicant.submitted_at ? dateTimeTextOf(applicant.submitted_at) : '-'],
  ];
}

/**
 * 평가자별 기록이 하나도 없어 집계가 모두 0인지. 목록에서 "미평가"로 구분한다.
 * shortcut: 목록 응답(REC-ADMIN-14)에 미결(PENDING) 수가 없어 미결만 남긴 지원자도 미평가로 보인다, 응답에 평가 수가 생기면 그 값으로 바꾼다
 */
export const hasNoEvaluations = (applicant: ApplicantEvaluationDto): boolean =>
  applicant.pass_count + applicant.hold_count + applicant.fail_count === 0 &&
  applicant.total_score === 0;

/**
 * 서류 평가 목록의 개인 평가 필터(MY-02). 화면에서 아직 평가하지 않은 것(null)과 미정(PENDING)으로 저장한 것을
 * 모두 '미정'으로 보여 주므로, 미정은 둘을 함께 거른다. 명세 §2.2의 미평가/저장됨 구분과 다르다.
 */
export type MyEvaluationFilter = 'ALL' | EvaluationDecision;

export const MY_EVALUATION_FILTER_LABELS: Record<MyEvaluationFilter, string> = {
  ALL: '전체',
  PENDING: '미정',
  PASS: '합격',
  HOLD: '보류',
  FAIL: '불합격',
};

/** 내 평가 판정으로 거른다. my_decision이 null이면 미정으로 본다. */
export function filterByMyEvaluation(
  applicants: readonly ApplicantEvaluationDto[],
  filter: MyEvaluationFilter,
): ApplicantEvaluationDto[] {
  if (filter === 'ALL') return [...applicants];
  return applicants.filter((applicant) => (applicant.my_decision ?? 'PENDING') === filter);
}

/** 서류 평가 목록의 정렬. 전체 지원 현황 정렬에 전체 평가의 집계 정렬(GROUP-04)을 더했다. */
export type ReviewSort = ApplicantSort | 'PASS_COUNT_DESC' | 'TOTAL_SCORE_DESC';

export const REVIEW_SORT_LABELS: Record<ReviewSort, string> = {
  ...APPLICANT_SORT_LABELS,
  PASS_COUNT_DESC: '합격 평가 많은순',
  TOTAL_SCORE_DESC: '총점수 높은순',
};

/** 정렬 드롭다운 선택지. 서류 평가와 합격자 부원 등록이 쓴다. */
export const REVIEW_SORT_OPTIONS: readonly { value: ReviewSort; label: string }[] = (
  Object.keys(REVIEW_SORT_LABELS) as ReviewSort[]
).map((sort) => ({ value: sort, label: REVIEW_SORT_LABELS[sort] }));

/** 서류 평가 목록(개인 평가 + 전체 평가)의 조회 조건. 상세에서 목록으로 돌아와도 유지한다. */
export interface ReviewListQuery {
  track: 'ALL' | TrackType;
  search: string;
  sort: ReviewSort;
  myFilter: MyEvaluationFilter;
  finalDecision: 'ALL' | EvaluationDecision;
}

export const DEFAULT_REVIEW_QUERY: ReviewListQuery = {
  track: 'ALL',
  search: '',
  sort: 'SUBMITTED_DESC',
  myFilter: 'ALL',
  finalDecision: 'ALL',
};

/** 정렬을 뺀 필터·검색 조건이 기본값과 다른지. */
export const isFilteredReviewQuery = (query: ReviewListQuery): boolean =>
  query.track !== 'ALL' ||
  query.search.trim() !== '' ||
  query.myFilter !== 'ALL' ||
  query.finalDecision !== 'ALL';

/**
 * 제출 완료 지원자만 남겨 거르고 정렬한다. 집계 정렬은 같은 값끼리 제출일 최신순을 유지한다.
 * 이전·다음 이동 순서도 이 결과를 따른다.
 */
export function filterReviewList(
  applicants: readonly ApplicantEvaluationDto[],
  query: ReviewListQuery,
): ApplicantEvaluationDto[] {
  const isCountSort = query.sort === 'PASS_COUNT_DESC' || query.sort === 'TOTAL_SCORE_DESC';
  const rows = filterByMyEvaluation(
    filterApplicants(applicants, {
      status: 'SUBMITTED',
      track: query.track,
      search: query.search,
      sort: isCountSort ? 'SUBMITTED_DESC' : (query.sort as ApplicantSort),
    }),
    query.myFilter,
  ).filter(
    (applicant) =>
      query.finalDecision === 'ALL' || applicant.final_decision === query.finalDecision,
  );
  if (query.sort === 'PASS_COUNT_DESC') {
    return rows.sort((a, b) => b.pass_count - a.pass_count || b.total_score - a.total_score);
  }
  if (query.sort === 'TOTAL_SCORE_DESC') {
    return rows.sort((a, b) => b.total_score - a.total_score || b.pass_count - a.pass_count);
  }
  return rows;
}
