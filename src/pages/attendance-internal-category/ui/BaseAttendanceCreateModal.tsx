import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { formatCohortLabel } from '@/entities/cohort/model/lib';

import { fetchUsers } from '@/entities/user/api/usersApi';
import { filterUsers } from '@/entities/user/model/lib';
import type { UserProfile, UserTrack } from '@/entities/user/model/types';
import { DateTextInput } from '@/shared/ui/DateTextInput';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';

import { BASE_CREATE_TRACKS } from '../model/baseAttendanceCreate';
import { TermSelect } from './TermSelect';

interface BaseAttendanceCreateModalProps {
  onClose: () => void;
  /** 창 제목에서 기수 뒤에 붙는 이름. 예: '출결 생성', 'ADV 팀 개설'. */
  titleLabel: string;
  /** 아래쪽 확인 버튼 이름. */
  submitLabel: string;
  /** 현재(만들어져 있는 가장 큰) 기수. 출결은 그 다음 기수로 만들어진다. */
  currentCohort: number;
  /**
   * 지금 탭(방학/학기)에 보이는 주차 번호. 서버가 내려준 주차 목록 그대로라서 건너뛴 주차는 들어 있지 않고,
   * 주차별 날짜 입력도 이 주차들만 나온다.
   */
  weekNums: readonly number[];
  /** true면 출결 대상 목록에서 팀장을 지정할 수 있다(ADV 팀 개설에서 사용, BASE 출결 생성에는 없다). */
  withLeader?: boolean;
  /** 고른 기수·트랙과 그 트랙에서 선택한 회원들로 출결을 만든다. leaderId는 withLeader일 때만 의미가 있다. */
  onCreate: (
    cohort: number,
    track: UserTrack,
    users: UserProfile[],
    weekDates: Record<number, string>,
    leaderId: string | null,
  ) => void;
}

const TAG_BASE =
  'cursor-pointer rounded-sm border px-2 py-1 text-[11px] font-semibold transition-colors';
const TAG_ON = 'border-[#1E6F94] bg-[#1E6F94] text-white';
const TAG_OFF = 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50';
const ROW_GRID = 'grid grid-cols-[0.875rem_minmax(0,1fr)_2.75rem_5rem] items-center gap-x-3 px-3';
const ROW_GRID_WITH_LEADER =
  'grid grid-cols-[0.875rem_minmax(0,1fr)_2.75rem_5rem_3.5rem] items-center gap-x-3 px-3';

/**
 * BASE 출결 생성 / ADV 팀 개설 공용 창(스터디 생성 창과 같은 모양).
 * 위의 부문은 출결을 어느 트랙에 만들지 정하고, 아래의 기수·부문 필터는 DB 회원을 고를 때만 쓴다.
 * 다른 트랙 회원도 골라 넣을 수 있다(병행). 기수를 고르면 목록이 그 기수로 좁혀지고 그 회원이 모두 선택된다.
 */
export function BaseAttendanceCreateModal({
  onClose,
  titleLabel,
  submitLabel,
  currentCohort,
  weekNums,
  withLeader = false,
  onCreate,
}: BaseAttendanceCreateModalProps) {
  // 출결은 항상 만들어져 있는 기수의 다음 기수로 만든다(예: 27기까지 있으면 28기).
  const cohort = currentCohort + 1;
  const [track, setTrack] = useState<UserTrack>(BASE_CREATE_TRACKS[0]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [term, setTerm] = useState<number | null>(null);
  // 주차별 날짜 매핑(방학 1~8주차). 입력한 주차만 저장한다.
  const [weekDates, setWeekDates] = useState<Record<number, string>>({});
  const [filterTracks, setFilterTracks] = useState<UserTrack[]>([]);
  const rowGrid = withLeader ? ROW_GRID_WITH_LEADER : ROW_GRID;

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // 팀장으로 지정된 사람이 출결 대상에서 빠지면 팀장 지정도 함께 풀린다.
  useEffect(() => {
    if (leaderId && !selectedIds.has(leaderId)) setLeaderId(null);
  }, [selectedIds, leaderId]);

  // 후보는 출결을 만들 트랙과 상관없이 전체 회원이고, 기수·부문 필터로 좁힌다.
  const allUsers = useMemo(
    () => filterUsers(users, { terms: [], tracks: [], keyword: '' }),
    [users],
  );
  const visibleUsers = useMemo(
    () =>
      filterUsers(users, {
        terms: term === null ? [] : [term],
        tracks: filterTracks,
        keyword,
      }),
    [users, term, filterTracks, keyword],
  );
  const terms = useMemo(
    () => [...new Set(allUsers.map((user) => user.term))].sort((a, b) => b - a),
    [allUsers],
  );
  const selectedUsers = allUsers.filter((user) => selectedIds.has(user.id));
  const allVisibleSelected =
    visibleUsers.length > 0 && visibleUsers.every((user) => selectedIds.has(user.id));

  // 부문 필터는 하나만 켤 수 있다. 다른 부문을 누르면 그쪽으로 바뀌고, 켜진 부문을 다시 누르면 해제(전체)된다.
  function toggleFilterTrack(name: UserTrack) {
    setFilterTracks((prev) => (prev.includes(name) ? [] : [name]));
  }

  // 기수를 고르면 목록을 그 기수로 좁히고, (부문 필터 안에서) 그 기수 회원을 모두 선택에 더한다.
  // '전체'는 기수 필터만 푼다.
  function handleChooseTerm(next: number | null) {
    setTerm(next);
    if (next === null) return;
    const ids = filterUsers(users, { terms: [next], tracks: filterTracks, keyword: '' }).map(
      (user) => user.id,
    );
    setSelectedIds((prev) => new Set([...prev, ...ids]));
  }

  function toggleUser(userId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // 팀장 지정. 아직 출결 대상이 아니면 함께 추가하고, 이미 팀장이면 지정을 해제한다.
  function toggleLeader(userId: string) {
    setLeaderId((prev) => (prev === userId ? null : userId));
    setSelectedIds((prev) => (prev.has(userId) ? prev : new Set([...prev, userId])));
  }

  function toggleAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleUsers.forEach((user) =>
        allVisibleSelected ? next.delete(user.id) : next.add(user.id),
      );
      return next;
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${formatCohortLabel(cohort)} 반기 ${titleLabel}`}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 px-4 pb-4 pt-[8vh] backdrop-blur-xs"
      // 창 바깥(어두운 배경)을 누르면 닫힌다. 창 안에서 시작한 클릭·드래그는 닫지 않는다.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-5xl space-y-4 overflow-hidden rounded-2xl p-6 animate-in fade-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-slate-800" />
            <h3 className="text-base font-bold text-slate-900">
              {formatCohortLabel(cohort)} 반기 {titleLabel}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={`${titleLabel} 창 닫기`}
          >
            <X size={18} />
          </button>
        </div>

        {/* 왼쪽: 어느 부문에, 누구의 출결을 만들지 / 오른쪽: 주차별 날짜(선택) */}
        <div className="grid gap-5 text-xs lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3">
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">부문</span>
              <div
                role="radiogroup"
                aria-label="출결 생성 부문"
                className="grid grid-cols-3 overflow-hidden rounded-sm bg-slate-100"
              >
                {BASE_CREATE_TRACKS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={track === name}
                    onClick={() => setTrack(name)}
                    className={`cursor-pointer px-2 py-2.5 text-xs font-semibold transition-colors ${
                      track === name
                        ? 'bg-[#1E6F94] text-white'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="block text-sm font-semibold text-slate-700">출결 대상</span>
                {withLeader && (
                  <span className="text-xs text-slate-500">
                    팀장:{' '}
                    {leaderId ? (
                      <b className="text-slate-800">
                        {selectedUsers.find((user) => user.id === leaderId)?.name}
                      </b>
                    ) : (
                      '미지정'
                    )}
                  </span>
                )}
              </div>

              <div className="space-y-2 rounded-sm border border-slate-200 bg-slate-50 p-2.5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">기수</span>
                    <TermSelect value={term} terms={terms} onChange={handleChooseTerm} />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-500">부문</span>
                    {BASE_CREATE_TRACKS.map((name) => (
                      <button
                        key={name}
                        type="button"
                        aria-pressed={filterTracks.includes(name)}
                        onClick={() => toggleFilterTrack(name)}
                        className={`${TAG_BASE} ${filterTracks.includes(name) ? TAG_ON : TAG_OFF}`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    placeholder="이름 검색"
                    className="min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-400"
                  />
                  <button
                    type="button"
                    disabled={visibleUsers.length === 0}
                    onClick={toggleAllVisible}
                    className="shrink-0 cursor-pointer rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
                  >
                    {allVisibleSelected ? '전체 해제' : '전체 선택'}
                  </button>
                </div>

                <div
                  role="table"
                  aria-label="출결 대상 후보"
                  className="max-h-52 overflow-y-auto rounded-sm border border-slate-200 bg-white"
                >
                  <div
                    role="row"
                    className={`${rowGrid} sticky top-0 z-[1] border-b border-slate-200 bg-slate-100 py-1.5 text-[11px] font-semibold text-slate-500`}
                  >
                    <span role="columnheader" aria-label="선택" />
                    <span role="columnheader">이름</span>
                    <span role="columnheader">기수</span>
                    <span role="columnheader">부문</span>
                    {withLeader && (
                      <span role="columnheader" className="text-center">
                        팀장
                      </span>
                    )}
                  </div>

                  {status === 'loading' && (
                    <p className="px-3 py-3 text-center text-slate-400">
                      회원 목록을 불러오는 중...
                    </p>
                  )}
                  {status === 'error' && (
                    <p className="px-3 py-3 text-center text-rose-600">
                      회원 목록을 불러오지 못했습니다.
                    </p>
                  )}
                  {status === 'ready' && visibleUsers.length === 0 && (
                    <p className="px-3 py-3 text-center text-slate-400">
                      조건에 맞는 회원이 없습니다.
                    </p>
                  )}
                  {visibleUsers.map((user) => {
                    const isSelected = selectedIds.has(user.id);
                    const isLeader = leaderId === user.id;
                    return (
                      <div
                        key={user.id}
                        role="row"
                        onClick={() => toggleUser(user.id)}
                        className={`${rowGrid} cursor-pointer border-b border-slate-100 py-1.5 transition-colors last:border-b-0 ${
                          isSelected ? 'bg-slate-100' : 'hover:bg-slate-50'
                        }`}
                      >
                        <span role="cell">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={isSelected}
                            aria-label={`${user.name} 선택`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleUser(user.id);
                            }}
                            className={`flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-sm border text-[9px] ${
                              isSelected
                                ? 'border-slate-400 bg-slate-300 text-slate-800'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </button>
                        </span>
                        <span
                          role="cell"
                          className={`truncate ${isSelected ? 'font-bold text-slate-900' : 'text-slate-700'}`}
                        >
                          {user.name}
                        </span>
                        <span role="cell" className="text-slate-500">
                          {user.term}기
                        </span>
                        <span role="cell" className="text-slate-500">
                          {user.track}
                        </span>
                        {withLeader && (
                          <span role="cell" className="flex justify-center">
                            <button
                              type="button"
                              aria-pressed={isLeader}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleLeader(user.id);
                              }}
                              className={`cursor-pointer rounded-sm border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                                isLeader
                                  ? TAG_ON
                                  : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                              }`}
                            >
                              지정
                            </button>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 태그 영역은 선택 여부와 상관없이 항상 같은 높이로 두어, 사람을 고르거나 빼도 오른쪽 주차별 날짜 크기가 바뀌지 않는다 */}
                <div className="flex h-[3.25rem] flex-wrap content-start gap-1.5 overflow-y-auto">
                  {selectedUsers.length > 0 && (
                    <>
                      {selectedUsers.map((user) => (
                        <span
                          key={user.id}
                          className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-white py-0.5 pl-2 pr-1 text-[11px] font-semibold text-slate-700"
                        >
                          {withLeader && user.id === leaderId && (
                            <span aria-label="팀장" className="text-black">
                              ★
                            </span>
                          )}
                          {user.name}
                          <button
                            type="button"
                            onClick={() => toggleUser(user.id)}
                            className="cursor-pointer rounded-sm p-0.5 opacity-70 hover:opacity-100"
                            aria-label={`${user.name} 제외`}
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* "주차별 날짜" 제목은 왼쪽 "부문" 제목과 같은 줄에 놓이고, 패널은 부문 버튼 줄에서 출결 대상 패널 끝까지 이어진다 */}
          <div className="flex min-w-0 flex-col">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">주차별 날짜</span>
            {/* 패널이 왼쪽 "출결 대상" 패널의 끝까지 늘어나고, 그만큼 각 주차 카드도 함께 커진다 */}
            <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 rounded-sm border border-slate-200 bg-slate-50 p-2.5">
              {weekNums.map((weekNum) => (
                <div
                  key={weekNum}
                  className="flex flex-col gap-1 rounded-lg border border-slate-200/90 bg-white px-2 pb-2 pt-3"
                >
                  <span className="px-0.5 text-[11px] font-bold text-slate-700">{weekNum}주차</span>
                  {/* 제목은 카드 위쪽에 붙이고, 남는 높이는 입력칸 주변에 나눠서 위아래 공백이 한쪽으로 몰리지 않게 한다 */}
                  <div className="flex flex-1 items-center">
                    <div className="w-full">
                      <DateTextInput
                        value={weekDates[weekNum] ?? ''}
                        onChange={(date) => setWeekDates((prev) => ({ ...prev, [weekNum]: date }))}
                        ariaLabel={`${weekNum}주차 날짜`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-sm px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
          >
            취소
          </button>
          <button
            type="button"
            disabled={selectedUsers.length === 0}
            onClick={() =>
              onCreate(
                cohort,
                track,
                selectedUsers,
                Object.fromEntries(Object.entries(weekDates).filter(([, date]) => date)),
                withLeader ? leaderId : null,
              )
            }
            className="cursor-pointer rounded-sm border border-slate-300 bg-transparent px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
