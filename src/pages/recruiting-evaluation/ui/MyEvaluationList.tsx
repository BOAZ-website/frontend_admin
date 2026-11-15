import { useState } from 'react';
import { Search } from 'lucide-react';

import { dateTimeTextOf } from '@/shared/lib/date';
import { useLoaded } from '@/shared/lib/useLoaded';

import {
  type ApplicantListQuery,
  DEFAULT_APPLICANT_QUERY,
  displayValue,
  filterApplicants,
  filterByMyEvaluation,
  MY_EVALUATION_FILTER_LABELS,
  type MyEvaluationFilter,
  summarizeApplicants,
} from '../model/applicantList';
import {
  type ApplicantEvaluationDto,
  DECISION_LABELS,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { ListLoadError } from './ListLoadError';
import { StatCard } from './StatCard';

interface MyEvaluationListProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  /** 지원자의 평가 화면을 연다. 이전·다음 이동은 지금 목록 순서(orderedIds)를 따른다. */
  onOpen: (applicantId: number, orderedIds: number[]) => void;
}

// 명세의 트랙 필터 순서(전체 / 분석 / 시각화 / 엔지니어링).
const TRACK_FILTER_ORDER: readonly TrackType[] = ['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'];

const COLUMNS = ['지원자', '트랙', '학교 / 전공', '제출일', '내 평가'];

/** 개인 평가 목록(EVL-MY, MY-01~03). 제출 완료 지원자만 보여 주고, 내 평가 저장 여부로 거른다. */
export function MyEvaluationList({ fetchApplicants, onOpen }: MyEvaluationListProps) {
  const list = useLoaded('applicants', fetchApplicants);
  const [query, setQuery] = useState<ApplicantListQuery>({
    ...DEFAULT_APPLICANT_QUERY,
    status: 'SUBMITTED',
  });
  const [myFilter, setMyFilter] = useState<MyEvaluationFilter>('ALL');

  const applicants = list.data ?? [];
  const submitted = applicants.filter((applicant) => applicant.status === 'SUBMITTED');
  const rows = filterByMyEvaluation(filterApplicants(applicants, query), myFilter);
  const summary = summarizeApplicants(applicants);
  const isFirstLoad = list.isLoading && !list.data;
  const isFiltered = myFilter !== 'ALL' || query.track !== 'ALL' || query.search.trim() !== '';

  const updateQuery = (patch: Partial<ApplicantListQuery>) =>
    setQuery((current) => ({ ...current, ...patch }));

  const handleOpen = (applicantId: number) =>
    onOpen(
      applicantId,
      rows.map((row) => row.id),
    );

  const handleResetFilters = () => {
    setMyFilter('ALL');
    setQuery((current) => ({ ...current, track: 'ALL', search: '' }));
  };

  if (list.error) {
    return <ListLoadError isRetrying={list.isLoading} onRetry={list.reload} />;
  }

  return (
    <div className="space-y-4">
      {isFirstLoad ? (
        <p role="status" className="rounded-md border border-slate-200 bg-white p-6 text-sm">
          지원자 목록을 불러오는 중입니다.
        </p>
      ) : (
        <section aria-label="지원 현황">
          <h2 className="text-xs font-semibold">지원 현황</h2>
          <div className="evaluation-stats grid grid-cols-3 gap-3">
            <StatCard label="지원자" value={`${summary.total}명`} />
            <StatCard label="제출 완료" value={`${summary.submitted}명`} />
            <StatCard label="임시저장" value={`${summary.draft}명`} />
          </div>
        </section>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <span className="text-xs font-bold">
            평가 대상 <span className="font-mono">총 {rows.length}명</span>
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="평가 상태"
              value={myFilter}
              onChange={(e) => setMyFilter(e.target.value as MyEvaluationFilter)}
              className="px-2 py-1"
            >
              {(Object.keys(MY_EVALUATION_FILTER_LABELS) as MyEvaluationFilter[]).map((filter) => (
                <option key={filter} value={filter}>
                  {filter === 'ALL' ? '전체 평가 상태' : MY_EVALUATION_FILTER_LABELS[filter]}
                </option>
              ))}
            </select>
            <select
              aria-label="트랙"
              value={query.track}
              onChange={(e) =>
                updateQuery({ track: e.target.value as ApplicantListQuery['track'] })
              }
              className="px-2 py-1"
            >
              <option value="ALL">전체 트랙</option>
              {TRACK_FILTER_ORDER.map((track) => (
                <option key={track} value={track}>
                  {TRACK_LABELS[track]}
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
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
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
                      {applicant.submitted_at ? dateTimeTextOf(applicant.submitted_at) : '-'}
                    </td>
                    <td className="px-4">
                      {applicant.my_decision === null
                        ? MY_EVALUATION_FILTER_LABELS.UNEVALUATED
                        : `${MY_EVALUATION_FILTER_LABELS.SAVED} · ${DECISION_LABELS[applicant.my_decision]}`}
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

        {!isFirstLoad && rows.length === 0 && (
          <div role="status" className="flex flex-col items-center gap-3 p-8 text-sm">
            {submitted.length === 0 ? (
              <p>평가할 제출 완료 지원서가 없습니다.</p>
            ) : (
              <>
                <p>조건에 맞는 지원자가 없습니다.</p>
                {isFiltered && (
                  <button type="button" onClick={handleResetFilters} className="px-4">
                    필터 초기화
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
