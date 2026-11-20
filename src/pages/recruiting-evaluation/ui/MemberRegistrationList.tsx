import { useRef, useState } from 'react';

import { useLoaded } from '@/shared/lib/useLoaded';
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
import { SearchInput } from '@/shared/ui/SearchInput';

import { displayValue, TRACK_FILTER_OPTIONS } from '../model/applicantList';
import {
  isRetryable,
  REGISTRATION_STATUS_LABELS,
  type RegistrationResult,
  registrationRequestFailureOf,
  registrationResultsOf,
  registrationRows,
  registrationSummaryOf,
} from '../model/memberRegistration';
import {
  type ApplicantAnswerDto,
  type ApplicantEvaluationDto,
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
  promoteUsers: (userIds: readonly number[]) => Promise<PromoteUsersResponse>;
}

const COLUMNS = ['이름', '부문', '학교', '전공', '이메일', '연락처', '총점수', '상태'];

const WAITING: RegistrationResult = { status: 'WAITING' };

/**
 * 합격자 부원 등록. 최종 합격자를 골라 한 번에 부원으로 등록한다(행별 등록 없음).
 * 상태는 이 화면에서 보낸 요청의 결과다. 회원 상태 조회 API가 없어 처음에는 모두 '등록 대기'로 보인다.
 */
export function MemberRegistrationList({
  fetchApplicants,
  fetchAnswers,
  promoteUsers,
}: MemberRegistrationListProps) {
  const list = useLoaded('applicants', fetchApplicants);
  const [track, setTrack] = useState<'ALL' | TrackType>('ALL');
  const [search, setSearch] = useState('');
  // 선택은 user_id로 가진다. 필터를 바꿔도 남고, 등록 요청은 선택한 사람 전체에 보낸다.
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [results, setResults] = useState<Record<number, RegistrationResult>>({});
  const [isRegistering, setIsRegistering] = useState(false);
  // 상태 반영 전에 버튼을 두 번 눌러도 요청이 한 번만 가게 한다.
  const registeringRef = useRef(false);
  const [detail, setDetail] = useState<ApplicantEvaluationDto | null>(null);

  const candidates = registrationRows(list.data ?? [], { track: 'ALL', search: '' });
  const rows = registrationRows(list.data ?? [], { track, search });
  const visibleSelectedCount = rows.filter((row) => selectedIds.includes(row.user_id)).length;
  const isAllVisibleSelected = rows.length > 0 && visibleSelectedCount === rows.length;
  const isFirstLoad = list.isLoading && !list.data;

  const toggle = (userId: number) =>
    setSelectedIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );

  // 헤더 체크박스는 지금 보이는 행만 고르거나 푼다. 숨은 행의 선택은 그대로 둔다.
  const toggleAllVisible = () => {
    const visibleIds = rows.map((row) => row.user_id);
    setSelectedIds((current) =>
      isAllVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : [...new Set([...current, ...visibleIds])],
    );
  };

  const handleRegister = async () => {
    const targets = [...new Set(selectedIds)];
    if (registeringRef.current || targets.length === 0) return;
    const names = targets
      .map((id) => displayValue(candidates.find((row) => row.user_id === id)?.name))
      .join(', ');
    if (
      !window.confirm(
        `선택한 ${targets.length}명을 부원으로 등록합니다.\n${names}\n\n등록하면 되돌릴 수 없습니다. 진행할까요?`,
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
      const next = registrationResultsOf(targets, await promoteUsers(targets));
      setResults((current) => ({ ...current, ...next }));
      // 다시 시도할 수 있는 행(등록 실패·확인 필요)만 선택을 남긴다.
      setSelectedIds((current) =>
        current.filter((id) => !next[id] || isRetryable(next[id].status)),
      );
      window.alert(registrationSummaryOf(next));
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-3 text-xs">
          {selectedIds.length > 0 && (
            <>
              <span className="font-bold" role="status">
                {selectedIds.length}명 선택됨
              </span>
              <button
                type="button"
                disabled={isRegistering}
                onClick={() => void handleRegister()}
                className="px-4"
              >
                {isRegistering ? '등록 중…' : '선택한 인원 등록'}
              </button>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <FilterDropdown
            ariaLabel="부문 필터"
            title="부문"
            value={track}
            options={TRACK_FILTER_OPTIONS}
            onChange={setTrack}
          />
          <SearchInput
            ariaLabel="합격자 검색"
            placeholder="이름·이메일·학교·전공"
            value={search}
            onChange={setSearch}
          />
        </div>
      </div>

      {isFirstLoad ? (
        <p role="status" className="p-6 text-sm">
          합격자 목록을 불러오는 중입니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-slate-200 bg-white shadow-2xs">
          <table className="w-full min-w-[900px] text-xs">
            <thead>
              <tr>
                <th scope="col" className="w-10 px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    aria-label="보이는 합격자 모두 선택"
                    checked={isAllVisibleSelected}
                    disabled={rows.length === 0}
                    ref={(element) => {
                      if (element) {
                        element.indeterminate = visibleSelectedCount > 0 && !isAllVisibleSelected;
                      }
                    }}
                    onChange={toggleAllVisible}
                    className="size-4 cursor-pointer"
                  />
                </th>
                {COLUMNS.map((label) => (
                  <th key={label} scope="col" className="px-4 py-3 text-left">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const result = results[row.user_id] ?? WAITING;
                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => setDetail(row)}
                    onKeyDown={(event) => event.key === 'Enter' && setDetail(row)}
                    className="cursor-pointer"
                  >
                    {/* 체크박스 클릭·키 입력은 행으로 올려 보내지 않는다(상세가 열리지 않게). */}
                    <td
                      className="px-4"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`${displayValue(row.name)} 선택`}
                        checked={selectedIds.includes(row.user_id)}
                        onChange={() => toggle(row.user_id)}
                        className="size-4 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 font-semibold">{displayValue(row.name)}</td>
                    <td className="px-4">{TRACK_LABELS[row.track]}</td>
                    <td className="px-4">{displayValue(row.university)}</td>
                    <td className="px-4">{displayValue(row.major)}</td>
                    <td className="px-4">{displayValue(row.email)}</td>
                    <td className="px-4 whitespace-nowrap">{displayValue(row.phone)}</td>
                    <td className="px-4">{row.total_score}</td>
                    <td className="px-4 whitespace-nowrap">
                      {REGISTRATION_STATUS_LABELS[result.status]}
                      {result.reason && <p className="text-[11px]">{result.reason}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!isFirstLoad && rows.length === 0 && (
        <p role="status" className="p-8 text-center text-sm">
          {candidates.length === 0
            ? '등록할 최종 합격자가 없습니다.'
            : '조건에 맞는 합격자가 없습니다.'}
        </p>
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
  );
}
