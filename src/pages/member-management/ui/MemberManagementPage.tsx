import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Settings, Trash2, X } from 'lucide-react';

import {
  FilterDropdown,
  type FilterDropdownOption,
} from '@/pages/attendance-events/ui/FilterDropdown';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import { LIST_SECTION_TITLE } from '@/pages/system-accounts/ui/systemStyles';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { Tooltip } from '@/shared/ui/Tooltip';

import {
  assignOperator,
  setOperatorTeamMembers,
} from '@/entities/admin-account/api/adminAccountApi';
import {
  createClubMember,
  deleteClubMember,
  updateClubMember,
} from '@/entities/club-member/api/clubMemberApi';
import type { ClubMemberForm } from '@/entities/club-member/model/dto';
import {
  CLUB_MEMBER_TRACKS,
  STATUS_LABELS,
  type ClubMember,
  type ClubMemberStatus,
  type ClubMemberTrack,
} from '@/entities/club-member/model/types';
import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
import { alertApiError } from '@/shared/lib/alertApiError';

import {
  type ClubMemberFilter,
  filterClubMembers,
  isMemberSheet,
  MEMBER_SHEETS,
  type MemberSheet,
  NOT_OPERATOR,
} from '../model/memberManagement';
import { useOperatorTeams } from '../model/useOperatorTeams';
import { TeamDesignationDialog } from './TeamDesignationDialog';

/** 수정 팝업의 입력값. 동아리원 행에서 id만 뺀 값이다. */
const toForm = (member: ClubMember): ClubMemberForm => ({
  name: member.name,
  email: member.email,
  phone: member.phone,
  university: member.university,
  major: member.major,
  term: member.term,
  track: member.track,
  status: member.status,
  role: member.role,
});

const EMPTY_FILTER: ClubMemberFilter = {
  query: '',
  term: 'ALL',
  track: 'ALL',
  status: 'ALL',
};
/** 방금 운영진 팀이 바뀐 줄을 표시해 두는 시간. */
const FRESH_BADGE_MS = 2500;
/** 관리 칸의 수정·삭제 버튼. 삭제는 마우스를 올리면 빨갛게 바뀐다. 쓸 수 없으면 흐리게 둔다. */
const ICON_BTN_BASE =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const ICON_BTN = `${ICON_BTN_BASE} hover:bg-slate-100 hover:text-slate-800`;
const DELETE_ICON_BTN = `${ICON_BTN_BASE} enabled:hover:bg-red-50 enabled:hover:text-red-600`;
/** 기록이 없는 값(대학교·전공 등)을 표에 보여줄 때 쓰는 표시. */
const EMPTY_CELL = '-';
/** 제목 옆 아이콘 버튼(운영진 권한 부여·동아리원 추가). 테두리 없이 아이콘만 둔다. */
const HEADER_ICON_BTN =
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-40';

// ─── 출결 화면(행사 출결·그룹 계정 관리)과 같은 입력칸·표·팝업 스타일 ───
/** 도구 줄의 검색칸. */
const TOOLBAR_FIELD =
  'h-9 rounded-sm border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400';
const TH_CLASS = 'px-4 py-2 text-center font-bold text-slate-700 whitespace-nowrap';
const TD_CLASS = 'px-4 py-2 text-center whitespace-nowrap';
/** 팝업 제목 옆 닫기 버튼. */
const MODAL_CLOSE_BTN =
  'p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer';
/** 팝업 아래쪽 취소·확인 버튼. */
const MODAL_CANCEL_BTN =
  'h-9 rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer';
const MODAL_CONFIRM_BTN =
  'h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
/** 팝업 입력 항목의 이름과 입력칸. */
const FIELD_LABEL = 'mb-1.5 block text-[11px] font-semibold text-slate-500';
const FIELD_INPUT =
  'h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400';

/** 활동 상태 글자색. 색으로 꾸미지 않고 회색 진하기로만 구분한다(활동기수가 더 진하다). */
const STATUS_TEXT: Record<ClubMemberStatus, string> = {
  ACTIVE: 'text-slate-900 font-semibold',
  ALUMNI: 'text-slate-500',
  WITHDRAWN: 'text-slate-500',
};

const labelOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

const TRACK_OPTIONS = CLUB_MEMBER_TRACKS.map((track) => ({ value: track, label: track }));
const STATUS_OPTIONS = labelOptions(STATUS_LABELS);
/** 부문 명단의 활동 상태 필터 선택지(활동기수·수료). 탈퇴한 사람은 탈퇴 명단에만 있으므로 뺀다. */
const TRACK_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) => option.value !== 'WITHDRAWN');
/** 왼쪽 "전체 동아리원" 묶음: 분석·시각화·엔지니어링을 모두 담은 활동기수·수료기수 목록. */
const ALL_TRACK_SHEETS = MEMBER_SHEETS.filter(
  (item) => item.id === 'active' || item.id === 'alumni',
);
const TRACK_SHEETS = MEMBER_SHEETS.filter((item) => item.kind === 'track');
const BASE_COLUMN_COUNT = 8;

const MEMBERS_HASH = 'system-members';

/** 주소 '#system-members/<명단>'에서 명단을 읽는다. 없거나 모르는 값이면 활동기수 목록이다. */
function sheetOfHash(): MemberSheet {
  const [page, sheet] = window.location.hash.replace(/^#/, '').split('/');
  return page === MEMBERS_HASH && sheet && isMemberSheet(sheet) ? sheet : 'active';
}

export function MemberManagementPage() {
  // 동아리원 목록은 API(임시 DB users 테이블)에서 읽고, 수정도 API로 한 뒤 다시 읽는다.
  // 동아리원 등록은 이 화면이 아니라 서류 평가의 합격자 승격으로 한다.
  // 기수 필터 선택지도 화면에서 계산하지 않고 users 테이블의 기수 목록 API로 받는다.
  const { members: loadedMembers, terms, error: loadError, reload } = useClubMembers();
  const members = useMemo(() => loadedMembers ?? [], [loadedMembers]);
  const [filter, setFilter] = useState<ClubMemberFilter>(EMPTY_FILTER);
  /** 오른쪽에 연 명단(null이면 패널을 닫았다). 주소에 남겨 새로고침해도 같은 명단이 열린다. */
  const [sheet, setSheet] = useState<MemberSheet | null>(sheetOfHash);
  const sheetItem = MEMBER_SHEETS.find((item) => item.id === sheet) ?? null;
  // 부문 명단에서는 부문이 모두 같아 부문 열을, 활동기수·수료기수·탈퇴 명단에서는 상태가 모두 같아
  // 활동 상태 열(과 필터)을 뺀다.
  const hasTrackColumn = sheetItem?.kind !== 'track';
  const hasStatusColumn = sheetItem?.kind !== 'status';
  const isWithdrawnSheet = sheet === 'withdrawn';
  useEffect(() => {
    const hash = sheet ? `#${MEMBERS_HASH}/${sheet}` : `#${MEMBERS_HASH}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [sheet]);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [form, setForm] = useState<ClubMemberForm | null>(null);
  /** 수정 팝업에서 고른 운영진 팀. NOT_OPERATOR면 운영진이 아니다. */
  const [formTeam, setFormTeam] = useState(NOT_OPERATOR);
  const [isSaving, setIsSaving] = useState(false);
  /** "운영진 권한 부여"(팀별 일괄 지정) 창을 열었는지. */
  const [isTeamDesignationOpen, setIsTeamDesignationOpen] = useState(false);
  /** 방금 운영진 팀이 바뀐 동아리원. 잠깐 줄 바탕을 칠한다. */
  const [freshBadgeIds, setFreshBadgeIds] = useState<ReadonlySet<string>>(() => new Set());
  const { teams: operatorTeams, error: teamsError } = useOperatorTeams();

  useEffect(() => {
    if (freshBadgeIds.size === 0) return undefined;
    const timer = window.setTimeout(() => setFreshBadgeIds(new Set()), FRESH_BADGE_MS);
    return () => window.clearTimeout(timer);
  }, [freshBadgeIds]);

  /** 수정 팝업의 운영진 팀 선택지. 지금 팀이 팀 목록에 없어도(새로 생긴 팀) 고를 수 있게 넣는다. */
  const teamOptions = useMemo(() => {
    const current = editingMember?.operatorTeam;
    const teams =
      current && !operatorTeams.includes(current) ? [...operatorTeams, current] : operatorTeams;
    return [
      { value: NOT_OPERATOR, label: '운영진 아님' },
      ...teams.map((team) => ({ value: team, label: team })),
    ];
  }, [editingMember, operatorTeams]);

  const filteredMembers = useMemo(
    () => filterClubMembers(members, { ...filter, sheet: sheet ?? undefined }),
    [filter, members, sheet],
  );

  /** 명단을 바꾼다. 활동 상태로 나눈 명단에는 상태 필터가 없으므로 상태 필터를 푼다. */
  const changeSheet = (next: MemberSheet) => {
    setSheet(next);
    // 명단마다 쓰는 필터가 달라서, 다른 명단으로 옮기면 필터를 처음 상태로 돌린다.
    if (next !== sheet) setFilter(EMPTY_FILTER);
  };
  const termOptions = useMemo<readonly FilterDropdownOption<string>[]>(
    () => [
      { value: 'ALL', label: '전체' },
      ...terms.map((term) => ({ value: String(term), label: `${term}기` })),
    ],
    [terms],
  );

  const canSave =
    !isSaving &&
    form !== null &&
    Boolean(form.name.trim() && form.email.trim() && form.phone.trim() && form.term > 0);

  /** 추가 팝업인지(수정할 사람이 없는 채로 열렸다). */
  const isCreating = form !== null && editingMember === null;

  /**
   * 동아리원 추가 팝업을 연다. 지금 보고 있는 명단에 맞춰 처음 값을 채운다
   * (수료기수 목록이면 수료, 부문 명단이면 그 부문). 기수는 가장 최근 기수로 시작한다.
   */
  const openCreate = () => {
    setEditingMember(null);
    setFormTeam(NOT_OPERATOR);
    setForm({
      name: '',
      email: '',
      phone: '',
      university: '',
      major: '',
      term: terms[0] ?? 1,
      track: sheetItem?.track ?? CLUB_MEMBER_TRACKS[0],
      status: sheet === 'alumni' ? 'ALUMNI' : 'ACTIVE',
      role: 'MEMBER',
    });
  };

  const openEdit = (member: ClubMember) => {
    setEditingMember(member);
    setForm(toForm(member));
    setFormTeam(member.operatorTeam ?? NOT_OPERATOR);
  };

  const closeModal = () => {
    setEditingMember(null);
    setForm(null);
  };

  /** 팝업 입력값 한 항목을 바꾼다. 팝업이 닫혀 있으면 아무것도 하지 않는다. */
  const updateForm = (patch: Partial<ClubMemberForm>) =>
    setForm((current) => (current ? { ...current, ...patch } : current));

  const saveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || !form) return;
    const request: ClubMemberForm = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      university: form.university.trim(),
      major: form.major.trim(),
    };
    // 운영진 팀이 바뀌면 운영진 명단(운영진 계정 관리와 같은 데이터)도 바꾼다. 역할은 서버가 맞춘다.
    const teamName = formTeam === NOT_OPERATOR ? null : formTeam;
    const isTeamChanged = teamName !== (editingMember?.operatorTeam ?? null);
    if (
      editingMember &&
      isTeamChanged &&
      teamName === null &&
      !window.confirm(
        `${editingMember.name}님을 운영진에서 뺄까요? 운영진 로그인 계정이 있으면 함께 삭제됩니다.`,
      )
    ) {
      return;
    }
    setIsSaving(true);
    try {
      // 추가는 역할을 보내지 않는다(일반 회원으로 시작하고, 운영진 팀을 고르면 아래에서 정한다).
      const { name, email, phone, university, major, term, track, status } = request;
      const saved = editingMember
        ? await updateClubMember(editingMember.id, request)
        : await createClubMember({ name, email, phone, university, major, term, track, status });
      if (isTeamChanged) await assignOperator(saved.id, { teamName });
      // 새로 넣은 사람이나 운영진 팀이 바뀐 사람의 줄을 잠깐 표시한다.
      if (!editingMember || isTeamChanged) setFreshBadgeIds(new Set([saved.id]));
      closeModal();
      reload();
    } catch (error) {
      alertApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  /** 동아리원을 지운다. 반기 명단·팀 소속·출결 기록도 함께 지워지므로 한 번 더 묻는다. */
  const removeMember = async (member: ClubMember) => {
    if (
      !window.confirm(
        `${member.name}님(${member.term}기 ${member.track})을 삭제할까요? 출결 반기 명단, 팀 소속, 출결 기록도 함께 삭제되며 되돌릴 수 없습니다. 기록을 남기려면 활동 상태를 탈퇴로 바꿔 주세요.`,
      )
    ) {
      return;
    }
    try {
      await deleteClubMember(member.id);
      reload();
    } catch (error) {
      alertApiError(error);
    }
  };

  /**
   * 팀 운영진을 체크한 사람들로 맞추고 목록을 다시 읽는다. 운영진 명단(운영진 계정 관리와 같은 데이터)이 바뀐다.
   * 이 팀에 새로 들어오거나 빠진 사람의 줄을 잠깐 표시한다.
   */
  const saveTeam = async (teamName: string, userIds: string[]): Promise<boolean> => {
    try {
      await setOperatorTeamMembers(teamName, { userIds });
    } catch (error) {
      alertApiError(error);
      return false;
    }
    const next = new Set(userIds);
    setFreshBadgeIds(
      new Set(
        members
          .filter((member) => next.has(member.id) !== (member.operatorTeam === teamName))
          .map((member) => member.id),
      ),
    );
    reload();
    return true;
  };

  const loadStatus = loadError ? 'error' : loadedMembers ? 'ready' : 'loading';

  return (
    <div className="space-y-6">
      {loadStatus !== 'ready' && (
        <p
          role="status"
          className={`rounded-md border px-4 py-3 text-xs ${
            loadStatus === 'error'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {loadStatus === 'error'
            ? `동아리원 정보를 불러오지 못했습니다. (${loadError?.message ?? '알 수 없는 오류'})`
            : '동아리원 정보를 불러오는 중입니다.'}
        </p>
      )}
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">동아리원 관리</h1>
        <div className="flex items-center gap-2">
          <Tooltip label="운영진 권한 부여" align="end">
            <button
              type="button"
              onClick={() => setIsTeamDesignationOpen(true)}
              disabled={loadStatus !== 'ready' || operatorTeams.length === 0}
              aria-label="운영진 권한 부여"
              className={HEADER_ICON_BTN}
            >
              <Settings size={16} aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip label="동아리원 추가" align="end">
            <button
              type="button"
              onClick={openCreate}
              disabled={loadStatus !== 'ready'}
              aria-label="동아리원 추가"
              className={HEADER_ICON_BTN}
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>
      {teamsError && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600"
        >
          운영진 팀 목록을 불러오지 못해 운영진 권한 부여를 할 수 없습니다. ({teamsError.message})
        </p>
      )}

      {/* 2. 명단 목록(왼쪽)과 고른 명단의 표(오른쪽). 운영진 계정 관리와 같은 분할 화면이다. */}
      <SplitView
        listLabel="동아리원 명단 목록"
        list={
          <div className="space-y-4">
            <section className="space-y-2" aria-labelledby="members-all-heading">
              <h2 id="members-all-heading" className={LIST_SECTION_TITLE}>
                전체 동아리원
              </h2>
              <ul className="space-y-2.5">
                {ALL_TRACK_SHEETS.map((item) => (
                  <li key={item.id}>
                    <SplitListItem
                      label={item.label}
                      isSelected={sheet === item.id}
                      onSelect={() => changeSheet(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2" aria-labelledby="members-track-heading">
              <h2 id="members-track-heading" className={LIST_SECTION_TITLE}>
                부문별
              </h2>
              <ul className="space-y-2.5">
                {TRACK_SHEETS.map((item) => (
                  <li key={item.id}>
                    <SplitListItem
                      label={item.label}
                      isSelected={sheet === item.id}
                      onSelect={() => changeSheet(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-2" aria-labelledby="members-withdrawn-heading">
              <h2 id="members-withdrawn-heading" className={LIST_SECTION_TITLE}>
                탈퇴
              </h2>
              <SplitListItem
                label="탈퇴"
                isSelected={sheet === 'withdrawn'}
                onSelect={() => changeSheet('withdrawn')}
              />
            </section>
          </div>
        }
        isOpen={sheetItem !== null}
        panelTitle={sheetItem?.label ?? ''}
        onClose={() => setSheet(null)}
      >
        {/* 검색·필터. 탈퇴 명단에는 두지 않는다. 활동기수·수료기수 목록은 부문, 부문 명단은 활동 상태로 거른다. */}
        {!isWithdrawnSheet && (
          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterDropdown
                ariaLabel="기수 필터"
                title="기수"
                value={filter.term === 'ALL' ? 'ALL' : String(filter.term)}
                options={termOptions}
                onChange={(value) =>
                  setFilter((current) => ({
                    ...current,
                    term: value === 'ALL' ? 'ALL' : Number(value),
                  }))
                }
              />
              {hasTrackColumn && (
                <FilterDropdown<ClubMemberTrack | 'ALL'>
                  ariaLabel="부문 필터"
                  title="부문"
                  value={filter.track}
                  options={[{ value: 'ALL', label: '전체' }, ...TRACK_OPTIONS]}
                  onChange={(track) => setFilter((current) => ({ ...current, track }))}
                />
              )}
              {hasStatusColumn && (
                <FilterDropdown<ClubMemberStatus | 'ALL'>
                  ariaLabel="활동 상태 필터"
                  title="활동 상태"
                  value={filter.status}
                  options={[{ value: 'ALL', label: '전체' }, ...TRACK_STATUS_OPTIONS]}
                  onChange={(status) => setFilter((current) => ({ ...current, status }))}
                />
              )}
              <div className="relative">
                <Search
                  size={13}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={filter.query}
                  onChange={(event) =>
                    setFilter((current) => ({ ...current, query: event.target.value }))
                  }
                  placeholder="검색"
                  aria-label="이름, 이메일, 연락처 검색"
                  className={`w-44 pl-8 pr-3 font-medium placeholder:font-normal placeholder:text-slate-400 ${TOOLBAR_FIELD}`}
                />
              </div>
            </div>
          </div>
        )}

        {/* 동아리원 표 */}
        <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1070px] border-collapse text-xs">
              <thead className="bg-slate-50/80">
                <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                  <th className={`${TH_CLASS} w-[120px] text-slate-900`}>이름</th>
                  <th className={`${TH_CLASS} w-[80px]`}>기수</th>
                  {hasTrackColumn && <th className={`${TH_CLASS} w-[100px]`}>부문</th>}
                  <th className={`${TH_CLASS} w-[120px]`}>운영진</th>
                  {hasStatusColumn && <th className={`${TH_CLASS} w-[90px]`}>활동 상태</th>}
                  <th className={TH_CLASS}>이메일</th>
                  <th className={`${TH_CLASS} w-[130px]`}>연락처</th>
                  <th className={`${TH_CLASS} w-[130px]`}>대학교</th>
                  <th className={`${TH_CLASS} w-[130px]`}>전공</th>
                  <th className={`${TH_CLASS} w-[88px]`}>관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadStatus !== 'ready' ? null : filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={BASE_COLUMN_COUNT + Number(hasTrackColumn) + Number(hasStatusColumn)}
                      className="py-10 text-center text-slate-400"
                    >
                      <p>검색 조건에 일치하는 동아리원이 없습니다.</p>
                      <button
                        type="button"
                        onClick={() => setFilter(EMPTY_FILTER)}
                        className="mt-2 cursor-pointer text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                      >
                        필터 초기화
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className={`h-[46px] divide-x divide-slate-200 transition-colors ${
                        freshBadgeIds.has(member.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className={`${TD_CLASS} font-bold text-slate-900`}>{member.name}</td>
                      <td className={`${TD_CLASS} tabular-nums text-slate-700`}>{member.term}기</td>
                      {hasTrackColumn && (
                        <td className={`${TD_CLASS} text-slate-700`}>{member.track}</td>
                      )}
                      <td
                        className={`${TD_CLASS} text-slate-700`}
                        aria-label={member.operatorTeam ?? '운영진 아님'}
                      >
                        {member.operatorTeam}
                      </td>
                      {hasStatusColumn && (
                        <td className={`${TD_CLASS} ${STATUS_TEXT[member.status]}`}>
                          {STATUS_LABELS[member.status]}
                        </td>
                      )}
                      <td className={`${TD_CLASS} text-slate-600`}>{member.email || EMPTY_CELL}</td>
                      <td className={`${TD_CLASS} tabular-nums text-slate-600`}>
                        {member.phone || EMPTY_CELL}
                      </td>
                      <td className={`${TD_CLASS} text-slate-600`}>
                        {member.university || EMPTY_CELL}
                      </td>
                      <td className={`${TD_CLASS} text-slate-600`}>{member.major || EMPTY_CELL}</td>
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip label="정보 수정">
                            <button
                              type="button"
                              onClick={() => openEdit(member)}
                              aria-label={`${member.name} 정보 수정`}
                              className={ICON_BTN}
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                          </Tooltip>
                          {/* 운영진은 운영진에서 먼저 빼야 지울 수 있다(서버도 409로 막는다). */}
                          <Tooltip
                            label={
                              member.operatorTeam
                                ? '운영진은 운영진에서 먼저 빼야 삭제할 수 있습니다'
                                : '삭제'
                            }
                            align="end"
                          >
                            <button
                              type="button"
                              onClick={() => removeMember(member)}
                              disabled={member.operatorTeam !== null}
                              aria-label={`${member.name} 삭제`}
                              className={DELETE_ICON_BTN}
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </SplitView>

      {/* 팀별 운영진 일괄 지정 창 */}
      {isTeamDesignationOpen && (
        <TeamDesignationDialog
          members={members}
          teams={operatorTeams}
          onClose={() => setIsTeamDesignationOpen(false)}
          onSubmit={saveTeam}
        />
      )}

      {/* 동아리원 추가·정보 수정 팝업 */}
      {form && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={saveMember}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            className={`w-full max-w-xl space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between">
              <h3 id="member-modal-title" className="text-base font-bold text-slate-900">
                {isCreating ? '동아리원 추가' : '동아리원 정보 수정'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className={MODAL_CLOSE_BTN}
                aria-label="창 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-x-4 gap-y-5 text-xs sm:grid-cols-2">
              <div>
                <label htmlFor="member-name" className={FIELD_LABEL}>
                  이름 *
                </label>
                <input
                  id="member-name"
                  required
                  className={FIELD_INPUT}
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-term" className={FIELD_LABEL}>
                  기수 *
                </label>
                <input
                  id="member-term"
                  required
                  min={1}
                  type="number"
                  className={FIELD_INPUT}
                  value={form.term}
                  onChange={(event) => updateForm({ term: Number(event.target.value) })}
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>부문</span>
                <SelectDropdown<ClubMemberTrack>
                  ariaLabel="부문"
                  value={form.track}
                  options={TRACK_OPTIONS}
                  onChange={(track) => updateForm({ track })}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>운영진 팀</span>
                <SelectDropdown
                  ariaLabel="운영진 팀"
                  value={formTeam}
                  options={teamOptions}
                  onChange={setFormTeam}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>활동 상태</span>
                <SelectDropdown<ClubMemberStatus>
                  ariaLabel="활동 상태"
                  value={form.status}
                  options={STATUS_OPTIONS}
                  onChange={(status) => updateForm({ status })}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <label htmlFor="member-email" className={FIELD_LABEL}>
                  이메일 *
                </label>
                <input
                  id="member-email"
                  required
                  type="email"
                  className={FIELD_INPUT}
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-phone" className={FIELD_LABEL}>
                  연락처 *
                </label>
                <input
                  id="member-phone"
                  required
                  className={FIELD_INPUT}
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-university" className={FIELD_LABEL}>
                  대학교
                </label>
                <input
                  id="member-university"
                  className={FIELD_INPUT}
                  value={form.university}
                  onChange={(event) => updateForm({ university: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-major" className={FIELD_LABEL}>
                  전공
                </label>
                <input
                  id="member-major"
                  className={FIELD_INPUT}
                  value={form.major}
                  onChange={(event) => updateForm({ major: event.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5">
              <button type="button" onClick={closeModal} className={MODAL_CANCEL_BTN}>
                취소
              </button>
              <button type="submit" disabled={!canSave} className={MODAL_CONFIRM_BTN}>
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
