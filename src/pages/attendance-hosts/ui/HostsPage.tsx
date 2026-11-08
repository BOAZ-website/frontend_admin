import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Copy, KeyRound, X } from 'lucide-react';

import type { LeaderAccount } from '@/entities/host-account/model/types';
import { studyDisplayName } from '@/entities/study-team/model/db';
import type { StudyTeamInfo } from '@/entities/study-team/model/types';
import { useHostsPageData } from '@/pages/attendance-hosts/model/useHostsPageData';
import { buildAccountDelivery } from '@/features/account-delivery/model/accountDeliveryMessages';
import { alertApiError } from '@/shared/lib/alertApiError';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { Tooltip } from '@/shared/ui/Tooltip';
import { CreateButton } from '@/shared/ui/CreateButton';
import { PageLoadingBody } from '@/widgets/page-loading/ui/PageLoadingState';

export type HostCategory = 'ADV' | 'STUDY';

type TrackFilter = 'ALL' | '분석' | '시각화' | '엔지니어링';
const TRACK_FILTERS: readonly { value: TrackFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: '분석', label: '분석' },
  { value: '시각화', label: '시각화' },
  { value: '엔지니어링', label: '엔지니어링' },
];

/** 아이디 형식: 4~20자, 영문 소문자·숫자·밑줄(서버의 발급 검증과 같은 규칙). */
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;
const COPIED_NOTICE_MS = 2000;

/** 표의 한 행: 진행 중인 그룹 하나와 그 현재 팀장, 팀장의 계정. */
interface LeaderRow {
  teamId: string;
  teamTitle: string;
  track: string;
  studyKind: StudyTeamInfo['studyKind'];
  name: string;
  generation: string;
  memberTrack: string;
  /** 없으면 "발급 필요". 운영진이 팀장이면 운영진 계정이다. */
  account: LeaderAccount | null;
}

/** 스터디 유형 표시: 멘멘 스터디인지 일반 스터디인지. */
const studyKindLabel = (kind: StudyTeamInfo['studyKind']): string =>
  kind === 'MENTORING' ? '멘멘 스터디' : '일반 스터디';

/**
 * 그룹 계정 관리. 진행 중인 그룹마다 현재 팀장과 그 계정을 보여 주고, 계정이 없는 팀장에게 HOST 계정을 발급한다.
 * 계정은 사람(회원)에 묶여 있어 계정이 있는 팀장은 지정되는 순간 권한이 생긴다. 그래서 권한 추가 단계가 없고,
 * 계정 삭제도 없다(팀장 변경·팀 삭제·반기 전환 때 서버가 정리한다). 백엔드 HOST 계정·그룹 리더 설계문서 2026-11-06판 9.1·9.2.
 */
export function HostsPage({
  onDataChanged,
}: {
  /** 계정을 발급하거나 비밀번호를 바꾼 뒤 다른 화면(팀 데이터)도 다시 읽게 한다. */
  onDataChanged?: () => void;
}) {
  const {
    status: dataStatus,
    error: dataError,
    leaders,
    advTeams,
    studyTeams,
    users,
    issueAccount,
    resetPassword,
  } = useHostsPageData(onDataChanged);
  const [activeCategory, setActiveCategory] = useState<HostCategory>('ADV');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('ALL');

  const [copiedNotice, setCopiedNotice] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<LeaderRow | null>(null);
  const [newPassword, setNewPassword] = useState('');

  // 계정 발급 창
  const [showIssueCard, setShowIssueCard] = useState(false);
  const [formTeamId, setFormTeamId] = useState('');
  const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showRequiredErrors, setShowRequiredErrors] = useState(false);
  const issueTeamRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (showIssueCard) issueTeamRef.current?.focus();
  }, [showIssueCard]);

  const [deliveryModal, setDeliveryModal] = useState<{ title: string; text: string } | null>(null);
  const deliveryTextRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (deliveryModal) deliveryTextRef.current?.focus();
  }, [deliveryModal]);

  // 계정 API가 준 행(진행 중인 그룹의 현재 팀장)에 팀 이름·유형과 팀장의 기수·부문을 붙인다.
  const rowsByCategory = useMemo(() => {
    const teams = new Map([...advTeams, ...studyTeams].map((team) => [team.id, team]));
    const people = new Map(users.map((user) => [user.id, user]));
    const toRow = (leader: (typeof leaders)[number]): LeaderRow => {
      const team = teams.get(leader.teamId);
      const person = people.get(leader.leaderUserId);
      return {
        teamId: leader.teamId,
        teamTitle: team ? studyDisplayName(team) : leader.teamId,
        track: team?.track || team?.category || '-',
        studyKind: team?.studyKind,
        name: person?.name ?? team?.leaderName ?? '-',
        generation: person ? `${person.term}기` : '-',
        memberTrack: person?.track ?? '-',
        account: leader.account,
      };
    };
    return {
      ADV: leaders.filter((leader) => leader.groupType === 'ADV').map(toRow),
      STUDY: leaders.filter((leader) => leader.groupType === 'STUDY').map(toRow),
    };
  }, [leaders, advTeams, studyTeams, users]);

  const visibleRows = rowsByCategory[activeCategory].filter(
    (row) => activeCategory !== 'ADV' || trackFilter === 'ALL' || row.track === trackFilter,
  );
  // 발급 창의 팀 목록: 표에서 "발급 필요"인 팀만(설계 9.2).
  const issuableRows = rowsByCategory[activeCategory].filter((row) => row.account === null);
  const selectedIssueRow = issuableRows.find((row) => row.teamId === formTeamId) ?? null;
  const categoryLabel = activeCategory === 'ADV' ? 'ADV' : '스터디';
  const isUsernameValid = USERNAME_PATTERN.test(formUsername.trim());

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), COPIED_NOTICE_MS);
    } catch {
      window.alert('클립보드에 복사하지 못했습니다. 직접 선택해 복사해 주세요.');
    }
  };

  const openNewIssueForm = () => {
    setFormTeamId('');
    setFormUsername('');
    setFormPassword('');
    setShowRequiredErrors(false);
    setIsTeamMenuOpen(false);
    setShowIssueCard(true);
  };

  const handleIssueAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const username = formUsername.trim();
    const password = formPassword.trim();
    if (!selectedIssueRow || !isUsernameValid || !password) {
      setShowRequiredErrors(true);
      return;
    }
    try {
      await issueAccount({ teamId: selectedIssueRow.teamId, username, password });
    } catch (error) {
      alertApiError(error);
      return;
    }
    // 비밀번호는 서버 응답에 없으므로 운영지원팀이 입력한 값으로 전달문을 만든다(설계 3.5).
    setDeliveryModal(
      buildAccountDelivery('hostIssue', {
        name: selectedIssueRow.name,
        generation: selectedIssueRow.generation,
        track: selectedIssueRow.memberTrack,
        groupType: categoryLabel,
        teamName: selectedIssueRow.teamTitle,
        username,
        password,
      }),
    );
    setShowIssueCard(false);
  };

  const openPasswordReset = (row: LeaderRow) => {
    setPasswordResetTarget(row);
    setNewPassword('');
  };

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    const account = passwordResetTarget?.account;
    if (!passwordResetTarget || !account || !newPassword.trim()) return;
    if (!window.confirm(`${passwordResetTarget.name}님 계정의 비밀번호를 정말 재설정할까요?`)) {
      return;
    }
    try {
      // 운영진 계정이면 "타 계정 정보 수정" 권한이 없는 한 서버가 403으로 거절하고, 그 사유를 알린다(설계 9.1).
      await resetPassword(account.id, newPassword);
    } catch (error) {
      alertApiError(error);
      return;
    }
    setDeliveryModal(
      buildAccountDelivery('hostPasswordReset', {
        name: passwordResetTarget.name,
        username: account.username,
        password: newPassword,
      }),
    );
    setPasswordResetTarget(null);
    setNewPassword('');
  };

  const columnCount = activeCategory === 'STUDY' ? 7 : 6;

  return (
    <div className="space-y-6">
      {/* 1. 상단 타이틀 영역 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            그룹 계정 관리
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <CreateButton label="계정" aria-label="계정 발급" onClick={openNewIssueForm} />
        </div>
      </div>

      {/* 읽는 동안에는 제목 줄은 두고 본문 자리에 화면 높이의 빈 틀과 안내만 둔다(읽은 뒤 화면이 튀지 않게). */}
      {dataStatus !== 'ready' && (
        <PageLoadingBody
          error={dataStatus === 'error' ? dataError : null}
          loadingMessage="그룹 계정 정보를 불러오는 중입니다."
          errorMessage="그룹 계정 정보를 불러오지 못했습니다."
        />
      )}
      <div
        className={`flex flex-col lg:flex-row gap-5 items-start ${dataStatus === 'ready' ? '' : 'hidden'}`}
      >
        {/* 좌측: 그룹 유형 탭 */}
        <aside className="w-full lg:w-48 shrink-0 space-y-2">
          <div className="px-1 pb-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              그룹 유형
            </span>
          </div>
          {(['ADV', 'STUDY'] as const).map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setActiveCategory(category);
                setShowIssueCard(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-3 rounded-sm border transition-all cursor-pointer ${
                activeCategory === category
                  ? 'border-slate-300 bg-slate-100/80 shadow-2xs text-slate-950 font-bold'
                  : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70 text-slate-700 font-semibold'
              }`}
            >
              <div className="text-left">
                <span className="text-xs font-bold block">
                  {category === 'ADV' ? 'ADV' : '스터디'}
                </span>
              </div>
              <ChevronRight
                size={15}
                className={activeCategory === category ? 'text-slate-500' : 'text-slate-400'}
              />
            </button>
          ))}
        </aside>

        {/* 우측: 계정 현황 표 */}
        <main className="flex-1 min-w-0 w-full space-y-4">
          <div className="rounded-md border border-slate-200/90 bg-white shadow-2xs p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {categoryLabel} 그룹리더 계정 현황
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  진행 중인 그룹의 현재 팀장입니다. 계정이 있는 팀장은 지정되는 순간 출결 입력
                  권한이 생기고, 계정이 없으면 &quot;발급 필요&quot;로 보입니다.
                </p>
              </div>

              {activeCategory === 'ADV' && (
                <div className="flex items-center gap-1.5 p-1 rounded-md bg-slate-100 border border-slate-200/80">
                  {TRACK_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => setTrackFilter(filter.value)}
                      className={`px-3 py-1 rounded-sm text-xs font-semibold transition-all cursor-pointer ${
                        trackFilter === filter.value
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 계정 발급 창 */}
            {showIssueCard && (
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="host-issue-title"
                onKeyDown={(event) => {
                  if (event.key === 'Escape') setShowIssueCard(false);
                }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
                onClick={() => setShowIssueCard(false)}
              >
                <div
                  className={`host-issue-modal w-full max-w-lg max-h-[92vh] flex flex-col rounded-lg overflow-hidden animate-in fade-in duration-150 ${MODAL_SURFACE}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-6 pt-5 pb-1 shrink-0">
                    <h3 id="host-issue-title" className="text-base font-bold text-slate-900">
                      {categoryLabel} 계정 발급
                    </h3>
                    <button
                      type="button"
                      onClick={() => setShowIssueCard(false)}
                      aria-label="계정 발급 창 닫기"
                      className="p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <form
                    noValidate
                    onSubmit={handleIssueAccount}
                    className="flex min-h-0 flex-1 flex-col"
                  >
                    <div className="space-y-5 px-6 pt-4 pb-6 overflow-y-auto [scrollbar-gutter:stable] flex-1 min-h-0">
                      {/* 1. 팀: 계정이 없는 팀장의 팀만 */}
                      <div>
                        <label
                          htmlFor="host-account-team"
                          className="mb-1.5 block text-[11px] font-semibold text-slate-500"
                        >
                          팀
                        </label>
                        <div
                          className="relative"
                          onBlur={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget)) {
                              setIsTeamMenuOpen(false);
                            }
                          }}
                        >
                          <button
                            ref={issueTeamRef}
                            id="host-account-team"
                            type="button"
                            disabled={issuableRows.length === 0}
                            aria-haspopup="listbox"
                            aria-expanded={isTeamMenuOpen}
                            onClick={() => setIsTeamMenuOpen((open) => !open)}
                            onKeyDown={(event) => {
                              if (event.key === 'Escape') setIsTeamMenuOpen(false);
                            }}
                            className="h-10 w-full rounded-sm border border-slate-200 bg-white px-3 pr-9 text-left text-sm text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                          >
                            {issuableRows.length === 0
                              ? `계정 발급이 필요한 ${categoryLabel} 팀이 없습니다`
                              : (selectedIssueRow?.teamTitle ?? '팀을 선택해 주세요')}
                          </button>
                          <ChevronDown
                            size={14}
                            aria-hidden="true"
                            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-transform duration-200 ${isTeamMenuOpen ? 'rotate-180' : ''}`}
                          />
                          {isTeamMenuOpen && (
                            <div
                              role="listbox"
                              aria-label="팀 이름"
                              className="absolute inset-x-0 top-full z-20 mt-1.5 max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_12px_32px_-14px_rgba(15,23,42,0.28)] animate-in fade-in slide-in-from-top-1 duration-150"
                            >
                              {issuableRows.map((row) => (
                                <button
                                  key={row.teamId}
                                  type="button"
                                  role="option"
                                  aria-selected={row.teamId === formTeamId}
                                  onClick={() => {
                                    setFormTeamId(row.teamId);
                                    setIsTeamMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5 text-left text-xs transition-colors duration-150 last:border-b-0 hover:bg-slate-50 focus:bg-slate-50 focus:outline-none ${
                                    row.teamId === formTeamId
                                      ? 'bg-slate-100 font-semibold text-slate-950'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  <span className="truncate">{row.teamTitle}</span>
                                  <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                    {activeCategory === 'STUDY'
                                      ? studyKindLabel(row.studyKind)
                                      : row.track}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {showRequiredErrors && !selectedIssueRow && (
                          <span className="mt-1 block text-[10px] text-rose-600">
                            팀을 선택해 주세요.
                          </span>
                        )}
                      </div>

                      {/* 2. 팀장과 그 기수·부문: 고른 팀의 현재 팀장(바꾸려면 출결 관리에서 팀장을 바꾼다) */}
                      <div className="grid grid-cols-3 gap-3">
                        {(
                          [
                            ['팀장', selectedIssueRow?.name],
                            ['기수', selectedIssueRow?.generation],
                            ['부문', selectedIssueRow?.memberTrack],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label}>
                            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">
                              {label}
                            </span>
                            <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900">
                              {value ?? <span className="text-slate-400">-</span>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* 3. 아이디·초기 비밀번호 */}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                            아이디
                          </span>
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="예: host_study_c"
                            value={formUsername}
                            onChange={(e) => setFormUsername(e.target.value)}
                            aria-describedby="host-username-rule"
                            className="h-9 w-full rounded-sm border border-slate-200 bg-white px-3 font-code text-xs text-slate-900 outline-none transition-colors focus:border-slate-400"
                          />
                          <span
                            id="host-username-rule"
                            className={`mt-1 block text-[10px] ${
                              showRequiredErrors && !isUsernameValid
                                ? 'text-rose-600'
                                : 'text-slate-400'
                            }`}
                          >
                            4~20자, 영문 소문자·숫자·밑줄(_)
                          </span>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold text-slate-500">
                            초기 비밀번호
                          </span>
                          <input
                            type="text"
                            required
                            autoComplete="off"
                            spellCheck={false}
                            placeholder="비밀번호 입력"
                            value={formPassword}
                            onChange={(e) => setFormPassword(e.target.value)}
                            className="h-9 w-full rounded-sm border border-slate-200 bg-white px-3 font-code text-xs text-slate-900 outline-none transition-colors focus:border-slate-400"
                          />
                          {showRequiredErrors && !formPassword.trim() && (
                            <span className="mt-1 block text-[10px] text-rose-600">
                              비밀번호를 입력해 주세요.
                            </span>
                          )}
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-3.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowIssueCard(false)}
                        className="h-9 rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                      >
                        닫기
                      </button>
                      <button
                        type="submit"
                        disabled={issuableRows.length === 0}
                        className="h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        계정 발급
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 표: 팀 이름, (스터디 유형), 이름, 기수, 부문, 아이디, 비밀번호 재설정 */}
            <div className="w-full rounded-md border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div className="overflow-x-auto select-none relative">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-50/80 select-none">
                    <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 min-w-[150px]">
                        팀 이름
                      </th>
                      {activeCategory === 'STUDY' && (
                        <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 min-w-[110px]">
                          스터디 유형
                        </th>
                      )}
                      <th className="text-center px-4 py-2 text-slate-900 font-bold bg-slate-100/90 w-[140px]">
                        이름
                      </th>
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 w-[100px]">
                        기수
                      </th>
                      <th className="text-center px-4 py-2 text-slate-700 font-bold bg-slate-100/90 w-[110px]">
                        부문
                      </th>
                      <th className="text-center px-4 py-2 text-slate-900 font-bold bg-slate-50/80 min-w-[170px]">
                        아이디
                      </th>
                      <th className="text-center px-2 py-2 min-w-[96px]">비밀번호 재설정</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-sans">
                    {visibleRows.length === 0 ? (
                      <tr>
                        <td colSpan={columnCount} className="py-8 text-center text-slate-400">
                          진행 중인 {categoryLabel} 그룹이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      visibleRows.map((row) => (
                        <tr
                          key={row.teamId}
                          className="transition-colors divide-x divide-slate-200 h-[46px] hover:bg-slate-50/70"
                        >
                          <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                            {row.teamTitle}
                          </td>
                          {activeCategory === 'STUDY' && (
                            <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                              {studyKindLabel(row.studyKind)}
                            </td>
                          )}
                          <td className="px-4 py-2 text-center whitespace-nowrap font-bold text-slate-900 text-xs">
                            {row.name}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                            {row.generation}
                          </td>
                          <td className="px-4 py-2 text-center text-slate-700 font-medium text-xs whitespace-nowrap">
                            {row.memberTrack}
                          </td>
                          {row.account ? (
                            <>
                              <td className="px-4 py-2 text-center font-mono">
                                <div className="flex items-center justify-center gap-1.5">
                                  <code className="px-2 py-0.5 rounded-sm bg-slate-100 text-slate-800 text-[11px] border border-slate-200/80">
                                    {row.account.username}
                                  </code>
                                  {row.account.role !== 'HOST' && (
                                    <span className="font-sans text-[10px] text-slate-400">
                                      운영진 계정
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(row.account?.username ?? '')}
                                    aria-label={`${row.name} 아이디 복사`}
                                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                  >
                                    <Copy size={12} aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                              <td className="px-2 py-2 text-center whitespace-nowrap">
                                <Tooltip label="비밀번호 재설정">
                                  <button
                                    type="button"
                                    onClick={() => openPasswordReset(row)}
                                    aria-label={`${row.name} 비밀번호 재설정`}
                                    className="inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                                  >
                                    <KeyRound size={14} aria-hidden="true" />
                                  </button>
                                </Tooltip>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-center">
                                <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                  발급 필요
                                </span>
                              </td>
                              <td className="px-2 py-2" />
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      {passwordResetTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-reset-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setPasswordResetTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <form
            onSubmit={handleResetPassword}
            className="w-full max-w-sm overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.38)]"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 id="password-reset-title" className="text-sm font-bold text-slate-900">
                비밀번호 재생성
              </h3>
              <button
                type="button"
                onClick={() => setPasswordResetTarget(null)}
                aria-label="비밀번호 재생성 창 닫기"
                className="flex size-9 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div>
                <label
                  htmlFor="new-host-password"
                  className="mb-1.5 block text-xs font-semibold text-slate-700"
                >
                  새 비밀번호
                </label>
                <input
                  id="new-host-password"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="새 비밀번호 직접 입력"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="w-full rounded-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-800 outline-none transition-all focus:border-slate-400 focus:bg-white focus:ring-4 focus:ring-slate-100"
                />
              </div>
              <button
                type="submit"
                disabled={!newPassword.trim()}
                className="w-full rounded-sm border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              >
                비밀번호 재생성
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 안내문 복사 창(카카오톡·슬랙 전달용) */}
      {deliveryModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="host-delivery-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') setDeliveryModal(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_24px_60px_-18px_rgba(15,23,42,0.38)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3
                id="host-delivery-title"
                className="min-w-0 text-sm font-bold text-slate-900 text-wrap-balance"
              >
                {deliveryModal.title} 계정 전달문
              </h3>
              <button
                type="button"
                onClick={() => setDeliveryModal(null)}
                aria-label="전달문 닫기"
                className="flex size-10 shrink-0 items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 px-6 py-5">
              <textarea
                ref={deliveryTextRef}
                rows={11}
                aria-label="계정 전달문 내용"
                value={deliveryModal.text}
                onChange={(e) => setDeliveryModal({ ...deliveryModal, text: e.target.value })}
                className="w-full resize-none rounded-sm border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-700 outline-none transition-[background-color,border-color,box-shadow] focus:border-slate-400 focus:bg-white focus:ring-3 focus:ring-slate-100"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => copyToClipboard(deliveryModal.text)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-all hover:border-slate-400 hover:bg-slate-50 active:scale-[0.97] cursor-pointer"
                >
                  {copiedNotice ? <Check size={13} /> : <Copy size={13} />}
                  <span>{copiedNotice ? '복사 완료' : '전달문 복사'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
