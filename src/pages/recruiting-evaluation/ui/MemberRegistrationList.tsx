import { useRef, useState } from 'react';

import { useLoaded } from '@/shared/lib/useLoaded';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import { RefreshButton } from '@/shared/ui/RefreshButton';
import { SearchInput } from '@/shared/ui/SearchInput';

import {
  displayValue,
  REVIEW_SORT_LABELS,
  REVIEW_SORT_OPTIONS,
  type ReviewSort,
  TRACK_FILTER_OPTIONS,
} from '../model/applicantList';
import {
  type RegistrationResult,
  registrationRequestFailureOf,
  registrationResultsOf,
  registrationRows,
  registrationSummaryOf,
} from '../model/memberRegistration';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
  type PromoteUsersRequest,
  type PromoteUsersResponse,
  TRACK_LABELS,
  type TrackType,
} from '../model/types';
import { ApplicantDetailModal } from './ApplicantDetailModal';
import { ListLoadError } from './ListLoadError';

interface MemberRegistrationListProps {
  fetchApplicants: () => Promise<ApplicantEvaluationDto[]>;
  fetchAnswers: (applicantIdKey: string) => Promise<ApplicantAnswerDto[]>;
  /** 부원 등록 요청. 200이면 실패 목록을 돌려주고, 요청 자체가 실패하면 던진다. */
  promoteUsers: (request: PromoteUsersRequest) => Promise<PromoteUsersResponse>;
  /** 부원 등록 권한(MEMBER_PROMOTION_WRITE)이 있는지. 없으면 등록 버튼을 막고 이유를 보여 준다(R11-2). */
  canRegister: boolean;
}

// 서류 평가 목록 표(MyEvaluationList)와 같은 방식: 짧은 열은 고정 너비, 이메일·대학교·전공은 남는 너비를 나눠 쓴다.
// 긴 글자는 '…'로 줄이고 마우스를 올리면 전체가 보인다.
const COLUMNS: {
  label: string;
  width?: string;
  value: (row: ApplicantEvaluationDto) => string;
}[] = [
  { label: '이름', width: '96px', value: (row) => displayValue(row.name) },
  { label: '부문', width: '96px', value: (row) => TRACK_LABELS[row.track] },
  { label: '이메일', value: (row) => displayValue(row.email) },
  { label: '연락처', width: '128px', value: (row) => displayValue(row.phone) },
  { label: '생년월일', width: '104px', value: (row) => displayValue(row.birth_date) },
  { label: '대학교', value: (row) => displayValue(row.university) },
  { label: '전공', value: (row) => displayValue(row.major) },
];

const WAITING: RegistrationResult = { status: 'WAITING' };

/** 이 화면에서 등록을 마친 결과. 다음 등록 대상에서 뺀다. */
const isDone = (result?: RegistrationResult) =>
  result?.status === 'REGISTERED' || result?.status === 'ALREADY_MEMBER';

/**
 * 합격자 부원 등록. 등록하기 버튼은 아직 등록하지 않은 최종 합격자 전체를 한 번에 등록한다(행별·선택 등록 없음).
 * 부문 필터·검색은 표 보기에만 쓰고 등록 대상은 바꾸지 않는다. 등록 결과는 누른 뒤 뜨는 알림으로 알린다.
 */
export function MemberRegistrationList({
  fetchApplicants,
  fetchAnswers,
  promoteUsers,
  canRegister,
}: MemberRegistrationListProps) {
  const list = useLoaded('applicants', fetchApplicants);
  const [track, setTrack] = useState<'ALL' | TrackType>('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<ReviewSort>('SUBMITTED_DESC');
  const [results, setResults] = useState<Record<number, RegistrationResult>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  // 상태 반영 전에 버튼을 두 번 눌러도 요청이 한 번만 가게 한다.
  const registeringRef = useRef(false);
  const [detail, setDetail] = useState<ApplicantEvaluationDto | null>(null);

  const candidates = registrationRows(list.data ?? [], { track: 'ALL', search: '', sort });
  const rows = registrationRows(list.data ?? [], { track, search, sort });
  const isFirstLoad = list.isLoading && !list.data;
  // 등록 대상: 아직 부원이 아니고 이 화면에서도 등록을 마치지 않은 최종 합격자 전체.
  const targetIds = [
    ...new Set(
      candidates
        .filter((row) => !row.is_promoted_to_member && !isDone(results[row.user_id]))
        .map((row) => row.user_id),
    ),
  ];

  const handleRegister = async () => {
    const targets = targetIds;
    if (registeringRef.current || targets.length === 0) return;
    const names = targets
      .map((id) => displayValue(candidates.find((row) => row.user_id === id)?.name))
      .join(', ');
    if (
      !window.confirm(
        `아직 등록하지 않은 최종 합격자 ${targets.length}명을 부원으로 등록합니다.\n${names}\n\n등록하면 되돌릴 수 없습니다. 진행할까요?`,
      )
    ) {
      return;
    }
    registeringRef.current = true;
    setIsRegistering(true);
    const previous = results;
    const withStatus = (pick: (userId: number) => RegistrationResult) =>
      Object.fromEntries(targets.map((id) => [id, pick(id)]));
    setResults((current) => ({ ...current, ...withStatus(() => ({ status: 'REGISTERING' })) }));
    try {
      const next = registrationResultsOf(targets, await promoteUsers({ user_ids: targets }));
      setResults((current) => ({ ...current, ...next }));
      window.alert(registrationSummaryOf(next));
      list.reload();
    } catch (error) {
      const failure = registrationRequestFailureOf(error);
      setResults((current) => ({
        ...current,
        ...withStatus((id) =>
          failure.isUnknown ? { status: 'UNKNOWN' } : (previous[id] ?? WAITING),
        ),
      }));
      window.alert(failure.message);
    } finally {
      registeringRef.current = false;
      setIsRegistering(false);
    }
  };

  const handleMissing = () => {
    setDetail(null);
    list.reload();
  };

  if (list.error) {
    return <ListLoadError isRetrying={list.isLoading} onRetry={list.reload} />;
  }

  return (
    <section aria-label="합격자 목록">
      {/* 툴바: 오른쪽에 부문 필터·정렬·검색·새로고침 */}
      <div className="review-list-toolbar flex flex-wrap items-center justify-end gap-3 pb-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterDropdown
            ariaLabel="부문 필터"
            title="부문"
            value={track}
            options={TRACK_FILTER_OPTIONS}
            onChange={setTrack}
          />
          <FilterDropdown
            ariaLabel="정렬"
            title={REVIEW_SORT_LABELS.SUBMITTED_DESC}
            value={sort}
            options={REVIEW_SORT_OPTIONS}
            onChange={setSort}
          />
          <div className="review-search-group">
            <SearchInput
              ariaLabel="합격자 검색"
              placeholder="이름·이메일·학교·전공"
              value={search}
              onChange={setSearch}
            />
            <RefreshButton isLoading={list.isLoading} onClick={list.reload} />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-slate-200 bg-white">
        {isFirstLoad ? (
          <p role="status" className="p-6 text-sm">
            합격자 목록을 불러오는 중입니다.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="review-list-table review-register-table w-full min-w-[900px] table-fixed text-xs">
                <colgroup>
                  {COLUMNS.map((column) => (
                    <col key={column.label} style={{ width: column.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {COLUMNS.map((column) => (
                      <th key={column.label} scope="col" className="px-4 py-3 text-left">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    return (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        onClick={() => setDetail(row)}
                        onKeyDown={(event) => event.key === 'Enter' && setDetail(row)}
                        className="cursor-pointer"
                      >
                        {COLUMNS.map((column, index) => (
                          <td
                            key={column.label}
                            title={column.value(row)}
                            className={`px-4 truncate ${index === 0 ? 'font-semibold' : ''}`}
                          >
                            {column.value(row)}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {rows.length === 0 && (
              <p role="status" className="border-t border-slate-200 p-8 text-center text-sm">
                {candidates.length === 0
                  ? '등록할 최종 합격자가 없습니다.'
                  : '조건에 맞는 합격자가 없습니다.'}
              </p>
            )}
          </>
        )}

        {detail && (
          <ApplicantDetailModal
            applicant={detail}
            fetchAnswers={fetchAnswers}
            onClose={() => setDetail(null)}
            onMissing={handleMissing}
          />
        )}
      </div>

      {/* 등록 버튼은 표 상자 밖 오른쪽 아래에 늘 보인다. 권한이 없거나 등록할 사람이 없으면 누를 수 없다. */}
      {!isFirstLoad && (
        <div className="review-list-actions flex items-center justify-end gap-3 pt-3 text-xs">
          {!canRegister && (
            <span id="member-register-denied" className="text-slate-500">
              부원 등록 권한이 없습니다.
            </span>
          )}
          <button
            type="button"
            disabled={!canRegister || isRegistering || targetIds.length === 0}
            aria-describedby={canRegister ? undefined : 'member-register-denied'}
            onClick={() => void handleRegister()}
            className="px-4"
          >
            {isRegistering ? '등록 중…' : '등록하기'}
          </button>
        </div>
      )}
    </section>
  );
}
