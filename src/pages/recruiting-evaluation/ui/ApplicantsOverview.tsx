import { useState } from 'react';

import { dateTimeTextOf } from '@/shared/lib/date';
import { useLoaded } from '@/shared/lib/useLoaded';
import { FilterDropdown, type FilterDropdownOption } from '@/shared/ui/FilterDropdown';
import { SearchInput } from '@/shared/ui/SearchInput';

import {
  type ApplicantListQuery,
  DEFAULT_APPLICANT_QUERY,
  displayValue,
  filterApplicants,
  isFilteredQuery,
} from '../model/applicantList';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  APPLICATION_STATUS_LABELS,
  TRACK_LABELS,
} from '../model/types';
import { ApplicantDetailModal } from './ApplicantDetailModal';
import { ListLoadError } from './ListLoadError';

interface ApplicantsOverviewProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** 제출 완료 지원자를 개인 평가 화면에서 연다. */
  onEvaluate: (applicantId: number) => void;
}

const STATUS_FILTER_OPTIONS: readonly FilterDropdownOption<ApplicantListQuery['status']>[] = [
  { value: 'ALL', label: '전체' },
  { value: 'SUBMITTED', label: APPLICATION_STATUS_LABELS.SUBMITTED },
  { value: 'DRAFT', label: APPLICATION_STATUS_LABELS.DRAFT },
];

// 명세의 트랙 필터 순서(전체 / 분석 / 시각화 / 엔지니어링).
const TRACK_FILTER_OPTIONS: readonly FilterDropdownOption<ApplicantListQuery['track']>[] = [
  { value: 'ALL', label: '전체' },
  ...(['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'] as const).map((track) => ({
    value: track,
    label: TRACK_LABELS[track],
  })),
];

const COLUMNS = ['지원자', '트랙', '학교', '전공', '학기', '졸업 예정', '제출일', '상태'];

/** 전체 지원 현황(EVL-APP). DRAFT를 포함한 지원서 목록과 지원서 상세를 보여 준다. */
export function ApplicantsOverview({
  fetchApplicants,
  fetchAnswers,
  onEvaluate,
}: ApplicantsOverviewProps) {
  const list = useLoaded('applicants', fetchApplicants);
  const [query, setQuery] = useState<ApplicantListQuery>(DEFAULT_APPLICANT_QUERY);
  const [detail, setDetail] = useState<ApplicantEvaluationDto | null>(null);

  const applicants = list.data ?? [];
  const rows = filterApplicants(applicants, query);
  const isFirstLoad = list.isLoading && !list.data;

  const updateQuery = (patch: Partial<ApplicantListQuery>) =>
    setQuery((current) => ({ ...current, ...patch }));

  const handleMissing = () => {
    setDetail(null);
    list.reload();
  };

  if (list.error) {
    return <ListLoadError isRetrying={list.isLoading} onRetry={list.reload} />;
  }

  return (
    <div className="space-y-4">
      {isFirstLoad && (
        <p role="status" className="rounded-md border border-slate-200 bg-white p-6 text-sm">
          지원자 목록을 불러오는 중입니다.
        </p>
      )}

      <div>
        <div className="flex flex-wrap items-center justify-end gap-3 pb-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <FilterDropdown
              ariaLabel="제출 상태 필터"
              title="전체"
              value={query.status}
              options={STATUS_FILTER_OPTIONS}
              onChange={(status) => updateQuery({ status })}
            />
            <FilterDropdown
              ariaLabel="부문 필터"
              title="부문"
              value={query.track}
              options={TRACK_FILTER_OPTIONS}
              onChange={(track) => updateQuery({ track })}
            />
            <SearchInput
              ariaLabel="지원자 검색"
              value={query.search}
              onChange={(search) => updateQuery({ search })}
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[880px] text-xs">
            <thead>
              <tr>
                {COLUMNS.map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 text-left">
                    {label}
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right">
                  <span className="sr-only">상세</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((applicant) => (
                <tr
                  key={applicant.id}
                  onClick={() => setDetail(applicant)}
                  className="cursor-pointer"
                >
                  <td className="px-4 font-semibold">{displayValue(applicant.name)}</td>
                  <td className="px-4">{applicant.track ? TRACK_LABELS[applicant.track] : '-'}</td>
                  <td className="px-4">{displayValue(applicant.university)}</td>
                  <td className="px-4">{displayValue(applicant.major)}</td>
                  <td className="px-4 text-right">{displayValue(applicant.last_semester)}</td>
                  <td className="px-4">{displayValue(applicant.graduation_date)}</td>
                  <td className="px-4 whitespace-nowrap">
                    {applicant.submitted_at ? dateTimeTextOf(applicant.submitted_at) : '-'}
                  </td>
                  <td className="px-4">{APPLICATION_STATUS_LABELS[applicant.status]}</td>
                  <td className="px-4 text-right">
                    <button
                      type="button"
                      aria-label={`${displayValue(applicant.name)} 지원서 상세`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail(applicant);
                      }}
                      className="px-3 whitespace-nowrap"
                    >
                      상세
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isFirstLoad && rows.length === 0 && (
          <div role="status" className="flex flex-col items-center gap-3 p-8 text-sm">
            {applicants.length === 0 ? (
              <p>등록된 지원자가 없습니다.</p>
            ) : (
              <>
                <p>조건에 맞는 지원자가 없습니다.</p>
                {isFilteredQuery(query) && (
                  <button
                    type="button"
                    onClick={() => setQuery({ ...DEFAULT_APPLICANT_QUERY, sort: query.sort })}
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

      {detail && (
        <ApplicantDetailModal
          applicant={detail}
          fetchAnswers={fetchAnswers}
          onClose={() => setDetail(null)}
          onMissing={handleMissing}
          onEvaluate={onEvaluate}
        />
      )}
    </div>
  );
}
