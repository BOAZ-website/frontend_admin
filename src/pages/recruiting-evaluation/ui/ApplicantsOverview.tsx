import { useState } from 'react';
import { Search } from 'lucide-react';

import { dateTimeTextOf } from '@/shared/lib/date';
import { useLoaded } from '@/shared/lib/useLoaded';

import {
  APPLICANT_SORT_LABELS,
  type ApplicantListQuery,
  type ApplicantSort,
  DEFAULT_APPLICANT_QUERY,
  displayValue,
  filterApplicants,
  isFilteredQuery,
  summarizeApplicants,
} from '../model/applicantList';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  APPLICATION_STATUS_LABELS,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { ApplicantDetailModal } from './ApplicantDetailModal';

interface ApplicantsOverviewProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** 제출 완료 지원자를 개인 평가 화면에서 연다. */
  onEvaluate: (applicantId: number) => void;
}

// 명세의 트랙 필터 순서(전체 / 분석 / 시각화 / 엔지니어링).
const TRACK_FILTER_ORDER: readonly TrackType[] = ['ANALYSIS', 'VISUALIZATION', 'ENGINEERING'];

const COLUMNS = ['지원자', '트랙', '학교 / 전공', '학기', '졸업 예정', '제출일', '상태'];

/** 전체 지원 현황(EVL-APP). DRAFT를 포함한 지원서 목록, 지원·평가 현황 통계, 지원서 상세를 보여 준다. */
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
  const summary = summarizeApplicants(applicants);
  const isFirstLoad = list.isLoading && !list.data;

  const updateQuery = (patch: Partial<ApplicantListQuery>) =>
    setQuery((current) => ({ ...current, ...patch }));

  const handleMissing = () => {
    setDetail(null);
    list.reload();
  };

  if (list.error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-md border border-slate-200 bg-white p-6"
      >
        <p className="text-sm font-semibold">지원자 목록을 불러오지 못했습니다.</p>
        <p className="text-xs">잠시 후 다시 시도해 주세요.</p>
        <button type="button" onClick={list.reload} disabled={list.isLoading} className="px-4">
          {list.isLoading ? '불러오는 중…' : '다시 시도'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isFirstLoad ? (
        <p role="status" className="rounded-md border border-slate-200 bg-white p-6 text-sm">
          지원자 목록을 불러오는 중입니다.
        </p>
      ) : (
        <>
          <section aria-label="지원 현황">
            <h2 className="text-xs font-semibold">지원 현황</h2>
            <div className="evaluation-stats grid grid-cols-3 gap-3">
              <StatCard label="지원자" value={`${summary.total}명`} />
              <StatCard label="제출 완료" value={`${summary.submitted}명`} />
              <StatCard label="임시저장" value={`${summary.draft}명`} />
            </div>
          </section>
          <section aria-label="평가 현황">
            <h2 className="text-xs font-semibold">평가 현황</h2>
            <div className="evaluation-stats grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <StatCard label="제출 지원서" value={`${summary.submitted}건`} />
              <StatCard
                label="내 평가 완료"
                value={`${summary.myEvaluated} / ${summary.submitted}`}
              />
              <StatCard label="최종 합격" value={`${summary.finalPass}명`} />
              <StatCard label="최종 보류" value={`${summary.finalHold}명`} />
              <StatCard label="최종 불합격" value={`${summary.finalFail}명`} />
              <StatCard label="최종 미결" value={`${summary.finalPending}명`} />
            </div>
          </section>
        </>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <span className="text-xs font-bold">
            전체 지원서 목록 <span className="font-mono">총 {rows.length}명</span>
          </span>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <select
              aria-label="제출 상태"
              value={query.status}
              onChange={(e) =>
                updateQuery({ status: e.target.value as ApplicantListQuery['status'] })
              }
              className="px-2 py-1"
            >
              <option value="ALL">전체 상태</option>
              <option value="SUBMITTED">{APPLICATION_STATUS_LABELS.SUBMITTED}</option>
              <option value="DRAFT">{APPLICATION_STATUS_LABELS.DRAFT}</option>
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
            <select
              aria-label="정렬"
              value={query.sort}
              onChange={(e) => updateQuery({ sort: e.target.value as ApplicantSort })}
              className="px-2 py-1"
            >
              {(Object.keys(APPLICANT_SORT_LABELS) as ApplicantSort[]).map((sort) => (
                <option key={sort} value={sort}>
                  {APPLICANT_SORT_LABELS[sort]}
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
                  <td className="px-4">
                    <p>{displayValue(applicant.university)}</p>
                    <p className="text-muted-foreground">{displayValue(applicant.major)}</p>
                  </td>
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

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="space-y-1 rounded-md border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
