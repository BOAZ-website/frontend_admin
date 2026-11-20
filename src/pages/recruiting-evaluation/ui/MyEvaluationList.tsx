import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { useLoaded } from '@/shared/lib/useLoaded';
import { FilterDropdown, type FilterDropdownOption } from '@/shared/ui/FilterDropdown';
import { SearchInput } from '@/shared/ui/SearchInput';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { ICON_BTN } from '@/shared/ui/systemStyles';

import {
  DEFAULT_REVIEW_QUERY,
  displayValue,
  filterReviewList,
  isFilteredReviewQuery,
  MY_EVALUATION_FILTER_LABELS,
  type MyEvaluationFilter,
  REVIEW_SORT_LABELS,
  type ReviewListQuery,
  type ReviewSort,
} from '../model/applicantList';
import { FINAL_DECISION_OPTIONS } from '../model/finalDecision';
import {
  type ApplicantEvaluationDto,
  DECISION_LABELS,
  type EvaluationDecision,
  type TrackType,
} from '../model/types';
import { ListLoadError } from './ListLoadError';

interface MyEvaluationListProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  /** 사이드바 부문 메뉴가 정한 부문. 이 부문 지원자만 보여 준다. */
  track: TrackType;
  /** 조회 조건. 상세에서 목록으로 돌아와도 남도록 페이지가 가진다. */
  query: ReviewListQuery;
  onQueryChange: (query: ReviewListQuery) => void;
  /** 지원자의 상세 화면을 연다. 이전·다음 이동은 지금 목록 순서(orderedIds)를 따른다. */
  onOpen: (applicantId: number, orderedIds: number[]) => void;
  /** FINAL_DECISION_WRITE가 있으면 최종 판정을 고르고 저장할 수 있다. 없으면 조회만 한다. */
  canWriteFinalDecision: boolean;
  /** 최종 판정 저장(REC-ADMIN-18). 결과 안내는 페이지가 하고, 성공 여부만 돌려준다. */
  onSaveFinalDecision: (
    applicant: ApplicantEvaluationDto,
    decision: EvaluationDecision,
  ) => Promise<boolean>;
}

// 부문은 메뉴가 정하므로 트랙 열이 없다. 평가자별 상세는 상세 화면의 운영진 평가 현황에서 본다.
const COLUMNS = [
  '지원자',
  '학교',
  '전공',
  '합격',
  '보류',
  '불합',
  '총점',
  '개인 평가',
  '최종 평가',
];

const MY_FILTER_OPTIONS: readonly FilterDropdownOption<MyEvaluationFilter>[] = (
  Object.keys(MY_EVALUATION_FILTER_LABELS) as MyEvaluationFilter[]
).map((filter) => ({ value: filter, label: MY_EVALUATION_FILTER_LABELS[filter] }));

const FINAL_FILTER_OPTIONS: readonly FilterDropdownOption<ReviewListQuery['finalDecision']>[] = [
  { value: 'ALL', label: '전체' },
  ...FINAL_DECISION_OPTIONS.map((decision) => ({
    value: decision,
    label: DECISION_LABELS[decision],
  })),
];

const SORT_OPTIONS: readonly FilterDropdownOption<ReviewSort>[] = (
  Object.keys(REVIEW_SORT_LABELS) as ReviewSort[]
).map((sort) => ({ value: sort, label: REVIEW_SORT_LABELS[sort] }));

const FINAL_DECISION_SELECT_OPTIONS = FINAL_DECISION_OPTIONS.map((decision) => ({
  value: decision,
  label: DECISION_LABELS[decision],
}));

/**
 * 서류 평가 목록. 개인 평가 목록(EVL-MY)과 전체 평가 목록(EVL-GROUP)을 합쳤다.
 * 제출 완료 지원자만 보여 주고, 개인 평가 집계와 최종 판정을 나눠 표시한다.
 * 최종 판정은 권한이 있으면 행에서 골라 저장 버튼으로 바꾼다(명세 §5.6). 기수 전체 확정은 없다.
 */
export function MyEvaluationList({
  fetchApplicants,
  track,
  query,
  onQueryChange,
  onOpen,
  canWriteFinalDecision,
  onSaveFinalDecision,
}: MyEvaluationListProps) {
  const list = useLoaded('applicants', fetchApplicants);
  // 행마다 고른 최종 판정(아직 저장 전). 없으면 서버 값을 보여 준다.
  const [finalDrafts, setFinalDrafts] = useState<Record<number, EvaluationDecision>>({});
  // 저장 중인 지원서 id. 저장이 끝날 때까지 모든 행의 저장을 막아 요청이 겹치지 않게 한다.
  const [savingFinalId, setSavingFinalId] = useState<number | null>(null);

  const applicants = list.data ?? [];
  const submitted = applicants.filter(
    (applicant) => applicant.status === 'SUBMITTED' && applicant.track === track,
  );
  // 부문은 메뉴가 정하므로 목록 조건의 부문 값 대신 메뉴의 부문으로 거른다.
  const rows = filterReviewList(applicants, { ...query, track });
  const isFirstLoad = list.isLoading && !list.data;

  const updateQuery = (patch: Partial<ReviewListQuery>) => onQueryChange({ ...query, ...patch });

  const handleOpen = (applicantId: number) =>
    onOpen(
      applicantId,
      rows.map((row) => row.id),
    );

  const finalDraftOf = (applicant: ApplicantEvaluationDto) =>
    finalDrafts[applicant.id] ?? applicant.final_decision;

  const handleSaveFinal = async (applicant: ApplicantEvaluationDto) => {
    if (savingFinalId !== null) return;
    setSavingFinalId(applicant.id);
    const saved = await onSaveFinalDecision(applicant, finalDraftOf(applicant));
    // 실패하면 고른 값을 버려 서버 값으로 되돌린다. 성공하면 고른 값이 곧 서버 값이라 다시 읽는 동안 깜빡이지 않게 둔다.
    if (!saved) {
      setFinalDrafts((current) => {
        const next = { ...current };
        delete next[applicant.id];
        return next;
      });
    }
    setSavingFinalId(null);
    list.reload();
  };

  if (list.error) {
    return <ListLoadError isRetrying={list.isLoading} onRetry={list.reload} />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <span className="text-xs font-bold">평가 대상 총 {rows.length}명</span>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterDropdown
            ariaLabel="평가 상태 필터"
            title="평가 상태"
            value={query.myFilter}
            options={MY_FILTER_OPTIONS}
            onChange={(myFilter) => updateQuery({ myFilter })}
          />
          <FilterDropdown
            ariaLabel="최종 평가 필터"
            title="최종 평가"
            value={query.finalDecision}
            options={FINAL_FILTER_OPTIONS}
            onChange={(finalDecision) => updateQuery({ finalDecision })}
          />
          <FilterDropdown
            ariaLabel="정렬"
            title={REVIEW_SORT_LABELS.SUBMITTED_DESC}
            value={query.sort}
            options={SORT_OPTIONS}
            onChange={(sort) => updateQuery({ sort })}
          />
          <SearchInput
            ariaLabel="지원자 검색"
            placeholder="이름·이메일·학교·전공"
            value={query.search}
            onChange={(search) => updateQuery({ search })}
          />
          <button
            type="button"
            aria-label="목록 새로고침"
            title="새로고침"
            disabled={list.isLoading}
            onClick={list.reload}
            className={ICON_BTN}
          >
            <RefreshCw
              size={14}
              aria-hidden="true"
              className={list.isLoading ? 'animate-spin' : ''}
            />
          </button>
        </div>
      </div>

      {isFirstLoad ? (
        <p role="status" className="p-6 text-sm">
          지원자 목록을 불러오는 중입니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[900px] text-xs">
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
                    <td className="px-4">{displayValue(applicant.university)}</td>
                    <td className="px-4">{displayValue(applicant.major)}</td>
                    <td className="px-4">{applicant.pass_count}</td>
                    <td className="px-4">{applicant.hold_count}</td>
                    <td className="px-4">{applicant.fail_count}</td>
                    <td className="px-4">{applicant.total_score}</td>
                    <td className="px-4 whitespace-nowrap">
                      {applicant.my_decision === null
                        ? MY_EVALUATION_FILTER_LABELS.UNEVALUATED
                        : DECISION_LABELS[applicant.my_decision]}
                    </td>
                    <td className="px-4 whitespace-nowrap">
                      {canWriteFinalDecision ? (
                        // 행을 누르면 상세가 열리므로 판정 고르기·저장 클릭은 행으로 올려 보내지 않는다.
                        <div
                          className="flex items-center gap-2"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <SelectDropdown
                            ariaLabel={`${displayValue(applicant.name)} 최종 평가`}
                            value={finalDraftOf(applicant)}
                            options={FINAL_DECISION_SELECT_OPTIONS}
                            onChange={(decision) =>
                              setFinalDrafts((current) => ({
                                ...current,
                                [applicant.id]: decision,
                              }))
                            }
                            buttonClassName="h-[30px] w-20"
                          />
                          <button
                            type="button"
                            aria-label={`${displayValue(applicant.name)} 최종 판정 저장`}
                            disabled={
                              savingFinalId !== null ||
                              finalDraftOf(applicant) === applicant.final_decision
                            }
                            onClick={() => void handleSaveFinal(applicant)}
                            className="px-3"
                          >
                            {savingFinalId === applicant.id ? '저장 중…' : '저장'}
                          </button>
                        </div>
                      ) : (
                        <span className="review-tag">
                          {DECISION_LABELS[applicant.final_decision]}
                        </span>
                      )}
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
