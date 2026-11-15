import { Search } from 'lucide-react';

import { useLoaded } from '@/shared/lib/useLoaded';

import {
  DEFAULT_REVIEW_QUERY,
  displayValue,
  filterReviewList,
  hasNoEvaluations,
  isFilteredReviewQuery,
  MY_EVALUATION_FILTER_LABELS,
  type MyEvaluationFilter,
  REVIEW_SORT_LABELS,
  type ReviewListQuery,
  type ReviewSort,
} from '../model/applicantList';
import {
  type ApplicantEvaluationDto,
  DECISION_LABELS,
  type EvaluationDecision,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { ListLoadError } from './ListLoadError';

interface MyEvaluationListProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  /** 조회 조건. 상세에서 목록으로 돌아와도 남도록 페이지가 가진다. */
  query: ReviewListQuery;
  onQueryChange: (query: ReviewListQuery) => void;
  /** 지원자의 상세 화면을 연다. 이전·다음 이동은 지금 목록 순서(orderedIds)를 따른다. */
  onOpen: (applicantId: number, orderedIds: number[]) => void;
}

// 명세의 트랙 필터 순서(전체 / 분석 / 시각화 / 엔지니어링).
const TRACK_FILTER_ORDER: readonly TrackType[] = ['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'];
// 최종 판정 필터 순서. 미결을 먼저 둬 남은 판정을 찾기 쉽게 한다.
const FINAL_DECISION_FILTER_ORDER: readonly EvaluationDecision[] = [
  'PENDING',
  'PASS',
  'HOLD',
  'FAIL',
];

// 앞 세 열은 전체 지원 현황 목록과 같은 이름·표기다. 평가자별 상세는 상세 화면의 평가 현황 탭에서 본다.
const COLUMNS = ['지원자', '트랙', '학교 / 전공', '평가 집계', '총점', '내 평가', '최종 판정'];

/**
 * 서류 평가 목록. 개인 평가 목록(EVL-MY)과 전체 평가 목록(EVL-GROUP)을 합쳤다.
 * 제출 완료 지원자만 보여 주고, 개인 평가 집계와 최종 판정을 나눠 표시한다. 최종 판정은 여기서 조회만 한다.
 */
export function MyEvaluationList({
  fetchApplicants,
  query,
  onQueryChange,
  onOpen,
}: MyEvaluationListProps) {
  const list = useLoaded('applicants', fetchApplicants);

  const applicants = list.data ?? [];
  const submitted = applicants.filter((applicant) => applicant.status === 'SUBMITTED');
  const rows = filterReviewList(applicants, query);
  const isFirstLoad = list.isLoading && !list.data;

  const updateQuery = (patch: Partial<ReviewListQuery>) => onQueryChange({ ...query, ...patch });

  const handleOpen = (applicantId: number) =>
    onOpen(
      applicantId,
      rows.map((row) => row.id),
    );

  if (list.error) {
    return <ListLoadError isRetrying={list.isLoading} onRetry={list.reload} />;
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <span className="text-xs font-bold">
          평가 대상 <span className="font-mono">총 {rows.length}명</span>
        </span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            aria-label="평가 상태"
            value={query.myFilter}
            onChange={(e) => updateQuery({ myFilter: e.target.value as MyEvaluationFilter })}
            className="px-2 py-1"
          >
            {(Object.keys(MY_EVALUATION_FILTER_LABELS) as MyEvaluationFilter[]).map((filter) => (
              <option key={filter} value={filter}>
                {filter === 'ALL' ? '전체 평가 상태' : MY_EVALUATION_FILTER_LABELS[filter]}
              </option>
            ))}
          </select>
          <select
            aria-label="최종 판정"
            value={query.finalDecision}
            onChange={(e) =>
              updateQuery({ finalDecision: e.target.value as ReviewListQuery['finalDecision'] })
            }
            className="px-2 py-1"
          >
            <option value="ALL">전체 최종 판정</option>
            {FINAL_DECISION_FILTER_ORDER.map((decision) => (
              <option key={decision} value={decision}>
                최종 {DECISION_LABELS[decision]}
              </option>
            ))}
          </select>
          <select
            aria-label="트랙"
            value={query.track}
            onChange={(e) => updateQuery({ track: e.target.value as ReviewListQuery['track'] })}
            className="px-2 py-1"
          >
            <option value="ALL">전체 트랙</option>
            {TRACK_FILTER_ORDER.map((track) => (
              <option key={track} value={track}>
                {TRACK_LABELS[track]}
              </option>
            ))}
          </select>
          <select
            aria-label="정렬"
            value={query.sort}
            onChange={(e) => updateQuery({ sort: e.target.value as ReviewSort })}
            className="px-2 py-1"
          >
            {(Object.keys(REVIEW_SORT_LABELS) as ReviewSort[]).map((sort) => (
              <option key={sort} value={sort}>
                {REVIEW_SORT_LABELS[sort]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <Search size={13} aria-hidden="true" />
            <input
              type="search"
              aria-label="지원자 검색"
              placeholder="이름·이메일·학교·전공"
              value={query.search}
              onChange={(e) => updateQuery({ search: e.target.value })}
              className="w-48 px-2 py-1"
            />
          </label>
          <button
            type="button"
            disabled={list.isLoading}
            onClick={list.reload}
            className="px-2 py-1"
          >
            {list.isLoading && !isFirstLoad ? '불러오는 중…' : '↻ 새로고침'}
          </button>
        </div>
      </div>

      {isFirstLoad ? (
        <p role="status" className="p-6 text-sm">
          지원자 목록을 불러오는 중입니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-xs">
            <thead>
              <tr>
                {COLUMNS.map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 text-left">
                    {label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">평가</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((applicant) => {
                const isSaved = applicant.my_decision !== null;
                return (
                  <tr
                    key={applicant.id}
                    onClick={() => handleOpen(applicant.id)}
                    className="cursor-pointer"
                  >
                    <td className="px-4 font-semibold">{displayValue(applicant.name)}</td>
                    <td className="px-4">{TRACK_LABELS[applicant.track]}</td>
                    <td className="px-4">
                      <p>{displayValue(applicant.university)}</p>
                      <p className="text-muted-foreground">{displayValue(applicant.major)}</p>
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      {hasNoEvaluations(applicant)
                        ? MY_EVALUATION_FILTER_LABELS.UNEVALUATED
                        : `합격 ${applicant.pass_count} · 보류 ${applicant.hold_count} · 불합격 ${applicant.fail_count}`}
                    </td>
                    <td className="px-4 whitespace-nowrap">{applicant.total_score}점</td>
                    <td className="px-4 whitespace-nowrap">
                      {applicant.my_decision === null
                        ? MY_EVALUATION_FILTER_LABELS.UNEVALUATED
                        : DECISION_LABELS[applicant.my_decision]}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      <span className="review-tag">
                        {DECISION_LABELS[applicant.final_decision]}
                      </span>
                    </td>
                    <td className="px-4 text-right">
                      <button
                        type="button"
                        aria-label={`${displayValue(applicant.name)} ${isSaved ? '평가 수정' : '평가하기'}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleOpen(applicant.id);
                        }}
                        className="px-3 whitespace-nowrap"
                      >
                        {isSaved ? '수정' : '평가하기'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isFirstLoad && rows.length === 0 && (
        <div role="status" className="flex flex-col items-center gap-3 p-8 text-sm">
          {submitted.length === 0 ? (
            <p>평가할 제출 완료 지원서가 없습니다.</p>
          ) : (
            <>
              <p>조건에 맞는 지원자가 없습니다.</p>
              {isFilteredReviewQuery(query) && (
                <button
                  type="button"
                  onClick={() => onQueryChange({ ...DEFAULT_REVIEW_QUERY, sort: query.sort })}
                  className="px-4"
                >
                  필터 초기화
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
