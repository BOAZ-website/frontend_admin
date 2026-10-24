import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { FilterDropdown } from '@/pages/attendance-events/ui/FilterDropdown';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import { LIST_SECTION_TITLE } from '@/pages/system-accounts/ui/systemStyles';
import { AccountDeliveryDialog } from '@/shared/ui/AccountDeliveryDialog';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { Tooltip } from '@/shared/ui/Tooltip';

import { assignOperator } from '@/entities/admin-account/api/adminAccountApi';
import {
  createClubMember,
  updateClubMember,
  withdrawClubMember,
} from '@/entities/club-member/api/clubMemberApi';
import type { ClubMemberForm } from '@/entities/club-member/model/dto';
import {
  CLUB_MEMBER_TRACKS,
  STATUS_LABELS,
  type ClubMember,
  type ClubMemberStatus,
  type ClubMemberTermPage,
  type ClubMemberTrack,
} from '@/entities/club-member/model/types';
import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
import { useClubMemberTermPage } from '@/entities/club-member/model/useClubMemberTermPage';
import { buildAccountDelivery } from '@/shared/config/accountDeliveryMessages';
import { alertApiError } from '@/shared/lib/alertApiError';

import {
  type ClubMemberFilter,
  filterClubMembers,
  isMemberSheet,
  MEMBER_SHEETS,
  type MemberSheet,
  NOT_OPERATOR,
  termScopeOfSheet,
} from '../model/memberManagement';
import { useOperatorTeams } from '../model/useOperatorTeams';

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
/** 탈퇴 명단 한 쪽에 보이는 사람 수. 탈퇴 명단은 기수 페이지가 없어 전체 목록을 화면에서 쪽으로 나눈다. */
const WITHDRAWN_PAGE_SIZE = 7;
/**
 * 탈퇴 명단의 쪽 넘김 줄. 표가 길어도 패널 아래쪽에 붙어 보이게 한다.
 * 패널(SplitView)의 안쪽 여백(p-6, lg:p-7)만큼 바깥으로 넓혀 패널 아래 끝과 양옆에 딱 맞춘다.
 */
const PAGER_BAR =
  'sticky bottom-0 z-10 -mx-6 -mb-6 flex items-center justify-center gap-1 border-t border-slate-100 bg-white px-6 py-3 lg:-mx-7 lg:-mb-7 lg:px-7';
/** 관리 칸의 수정·탈퇴 처리 버튼. 탈퇴 처리는 마우스를 올리면 빨갛게 바뀐다. 쓸 수 없으면 흐리게 둔다. */
const ICON_BTN_BASE =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40';
const ICON_BTN = `${ICON_BTN_BASE} hover:bg-slate-100 hover:text-slate-800`;
const WITHDRAW_ICON_BTN = `${ICON_BTN_BASE} enabled:hover:bg-red-50 enabled:hover:text-red-600`;
/** 기록이 없는 값(대학교·전공 등)을 표에 보여줄 때 쓰는 표시. */
const EMPTY_CELL = '-';
/** 제목 옆 아이콘 버튼(동아리원 추가). 테두리 없이 아이콘만 둔다. */
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
/** 팝업 안 드롭다운 버튼. 옆 입력칸(FIELD_INPUT)과 글자 크기·정렬·안쪽 여백을 맞추고 그림자를 뺀다. */
const FIELD_SELECT =
  'h-10 w-full text-left pl-3! text-sm! font-normal! text-slate-900! shadow-none!';

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
/** 늘 있는 열 수(이름·기수·이메일·연락처·대학교·전공·관리). 부문·운영진·활동 상태 열은 명단에 따라 더한다. */
const BASE_COLUMN_COUNT = 7;

const MEMBERS_HASH = 'system-members';

/** 주소 '#system-members/<명단>'에서 명단을 읽는다. 없거나 모르는 값이면 활동기수 목록이다. */
function sheetOfHash(): MemberSheet {
  const [page, sheet] = window.location.hash.replace(/^#/, '').split('/');
  return page === MEMBERS_HASH && sheet && isMemberSheet(sheet) ? sheet : 'active';
}

/**
 * 주소 '#system-members/member/<회원 id>'로 들어오면 그 사람의 행을 찾아 보여 준다(보안 감사 로그의 이름 클릭).
 * 회원 id가 없으면 null.
 */
function focusIdOfHash(): string | null {
  const [page, sheet, memberId] = window.location.hash.replace(/^#/, '').split('/');
  if (page !== MEMBERS_HASH || sheet !== 'member' || !memberId) return null;
  try {
    return decodeURIComponent(memberId);
  } catch {
    return null;
  }
}

/** 사람이 들어 있는 상태 명단(활동기수·수료기수·탈퇴). */
const STATUS_SHEET: Readonly<Record<ClubMember['status'], MemberSheet>> = {
  ACTIVE: 'active',
  ALUMNI: 'alumni',
  WITHDRAWN: 'withdrawn',
};

export function MemberManagementPage() {
  // 동아리원 목록은 API(임시 DB users 테이블)에서 읽고, 수정도 API로 한 뒤 다시 읽는다.
  // 동아리원 등록은 이 화면이 아니라 서류 평가의 합격자 승격으로 한다.
  // terms(users 테이블의 기수 목록)는 기수 페이지가 없을 때 추가 팝업의 처음 기수로 쓴다.
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
  // 탈퇴하면 운영진에서도 빠지므로(운영진은 탈퇴 처리할 수 없다) 탈퇴 명단에는 운영진 열을 두지 않는다.
  const hasOperatorColumn = !isWithdrawnSheet;
  // 활동기수·수료기수 목록({ status })과 부문 명단({ track })은 한 페이지에 한 기수씩 서버에서 읽는다.
  // 탈퇴 명단은 기수 페이지가 없다(null). 기수를 안 고르면(null) 서버가 최신 기수를 고른다.
  const termScope = termScopeOfSheet(sheet);
  const isPagedSheet = termScope !== null;
  const [pageTerm, setPageTerm] = useState<number | null>(null);
  /** 탈퇴 명단에서 보고 있는 쪽(1부터). */
  const [withdrawnPage, setWithdrawnPage] = useState(1);
  const {
    page: termPage,
    error: pageError,
    reload: reloadPage,
  } = useClubMemberTermPage(termScope, pageTerm);
  /**
   * 화면에 보일 기수 페이지. 같은 명단 안에서 다른 기수를 읽는 동안에는 이전 기수 페이지를 그대로 두어
   * 표가 비거나 위에 안내가 끼어들어 화면이 튀지 않게 한다. 명단을 바꾼 직후의 이전 페이지는
   * (읽기 조건의 status·track이 하나라도 다르면) 쓰지 않는다.
   */
  const currentPage =
    termPage &&
    termScope !== null &&
    termPage.status === (termScope.status ?? null) &&
    termPage.track === (termScope.track ?? null)
      ? termPage
      : null;
  /** 고른 기수를 아직 읽는 중인지(이전 기수 페이지를 보여 주는 중). */
  const isTermSwitching =
    currentPage !== null && pageTerm !== null && currentPage.term !== pageTerm;
  useEffect(() => {
    const hash = sheet ? `#${MEMBERS_HASH}/${sheet}` : `#${MEMBERS_HASH}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [sheet]);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [form, setForm] = useState<ClubMemberForm | null>(null);
  /** 수정 팝업에서 고른 운영진 팀. NOT_OPERATOR면 운영진이 아니다. */
  const [formTeam, setFormTeam] = useState(NOT_OPERATOR);
  /** 새 운영진의 로그인 아이디·초기 비밀번호. 운영진이 아닌 사람에게 팀을 고를 때만 쓴다. */
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  /** 새 운영진 계정을 만든 뒤 띄우는 전달문. */
  const [delivery, setDelivery] = useState<{ title: string; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  /**
   * 이 화면에서 저장(추가·수정·탈퇴 처리)을 한 번이라도 했는지. 저장 뒤 목록을 다시 읽다가 실패하면
   * "저장은 됐지만 목록이 최신이 아니다"를 따로 알린다.
   */
  const [hasSaved, setHasSaved] = useState(false);
  /** 탈퇴 처리를 보내는 중인 동아리원 id. 버튼을 연달아 눌러 같은 요청이 두 번 가지 않게 한다. */
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  /** 방금 운영진 팀이 바뀐 동아리원. 잠깐 줄 바탕을 칠한다. */
  const [freshBadgeIds, setFreshBadgeIds] = useState<ReadonlySet<string>>(() => new Set());
  const { teams: operatorTeams, error: teamsError } = useOperatorTeams();

  // 다른 화면에서 사람을 지정해 들어왔으면, 목록을 읽은 뒤 그 사람이 든 명단을 열고 필터를 풀어 행을 보여 준다.
  const [pendingFocusId, setPendingFocusId] = useState(focusIdOfHash);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  if (pendingFocusId !== null && loadedMembers) {
    const target = loadedMembers.find((member) => member.id === pendingFocusId);
    setPendingFocusId(null);
    if (target) {
      setSheet(STATUS_SHEET[target.status]);
      // 활동기수·수료기수면 그 사람의 기수 페이지를 연다(탈퇴 명단은 기수 페이지가 없어 이 값을 쓰지 않는다).
      setPageTerm(target.term);
      // 탈퇴한 사람이면 탈퇴 명단에서 그 사람이 있는 쪽을 연다(표와 같은 순서로 거른 목록에서 찾는다).
      if (target.status === 'WITHDRAWN') {
        const index = filterClubMembers(loadedMembers, {
          ...EMPTY_FILTER,
          sheet: 'withdrawn',
        }).findIndex((member) => member.id === target.id);
        setWithdrawnPage(Math.floor(Math.max(index, 0) / WITHDRAWN_PAGE_SIZE) + 1);
      }
      setFilter(EMPTY_FILTER);
      setScrollTargetId(target.id);
    }
  }

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
      { value: NOT_OPERATOR, label: '없음' },
      ...teams.map((team) => ({ value: team, label: team })),
    ];
  }, [editingMember, operatorTeams]);

  // 기수 페이지가 있는 명단은 받은 기수 페이지 안에서, 탈퇴 명단은 전체 목록에서 화면이 거른다.
  const pageMembers = currentPage?.members;
  const filteredMembers = useMemo(
    () =>
      isPagedSheet
        ? filterClubMembers(pageMembers ?? [], {
            ...filter,
            term: 'ALL',
            sheet: sheet ?? undefined,
          })
        : filterClubMembers(members, { ...filter, sheet: sheet ?? undefined }),
    [filter, isPagedSheet, members, pageMembers, sheet],
  );

  // 다른 화면에서 지정해 들어온 사람의 행이 그려지면(기수 페이지를 읽은 뒤) 그 행으로 옮겨 잠깐 표시한다.
  useEffect(() => {
    if (scrollTargetId === null) return;
    const row = document.getElementById(`member-row-${scrollTargetId}`);
    if (!row) return;
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFreshBadgeIds(new Set([scrollTargetId]));
    setScrollTargetId(null);
  }, [scrollTargetId, filteredMembers]);

  /** 명단을 바꾼다. 활동 상태로 나눈 명단에는 상태 필터가 없으므로 상태 필터를 푼다. */
  const changeSheet = (next: MemberSheet) => {
    setSheet(next);
    // 명단마다 쓰는 필터가 달라서, 다른 명단으로 옮기면 필터·기수 페이지·탈퇴 명단 쪽을 처음 상태로 돌린다.
    if (next !== sheet) {
      setFilter(EMPTY_FILTER);
      setPageTerm(null);
      setWithdrawnPage(1);
    }
  };

  /**
   * 새 운영진 계정을 만드는지. 운영진이 아닌 사람(추가 팝업 포함)에게 팀을 고르면 아이디·초기 비밀번호가 필요하다.
   * 이미 운영진인 사람은 팀만 옮기므로 필요 없다.
   */
  const needsCredentials = !editingMember?.operatorTeam && formTeam !== NOT_OPERATOR;
  const hasCredentials = !needsCredentials || Boolean(formUsername.trim() && formPassword);
  const canSave =
    !isSaving &&
    form !== null &&
    hasCredentials &&
    Boolean(form.name.trim() && form.email.trim() && form.phone.trim() && form.term > 0);

  /** 입력한 아이디·초기 비밀번호를 비운다. */
  const resetCredentials = () => {
    setFormUsername('');
    setFormPassword('');
  };

  /** 운영진 팀을 바꾼다. '없음'으로 돌리면 입력한 아이디·비밀번호를 지운다. */
  const changeFormTeam = (next: string) => {
    setFormTeam(next);
    if (next === NOT_OPERATOR) resetCredentials();
  };

  /** 추가 팝업인지(수정할 사람이 없는 채로 열렸다). */
  const isCreating = form !== null && editingMember === null;

  /**
   * 동아리원 추가 팝업을 연다. 지금 보고 있는 명단에 맞춰 처음 값을 채운다
   * (수료기수 목록이면 수료, 부문 명단이면 그 부문). 기수는 보고 있는 기수 페이지가 있으면 그 기수,
   * 없으면 가장 최근 기수로 시작한다.
   */
  const openCreate = () => {
    setEditingMember(null);
    setFormTeam(NOT_OPERATOR);
    resetCredentials();
    setForm({
      name: '',
      email: '',
      phone: '',
      university: '',
      major: '',
      term: (isPagedSheet ? currentPage?.term : null) ?? terms[0] ?? 1,
      track: sheetItem?.track ?? CLUB_MEMBER_TRACKS[0],
      status: sheet === 'alumni' ? 'ALUMNI' : 'ACTIVE',
      role: 'MEMBER',
    });
  };

  const openEdit = (member: ClubMember) => {
    setEditingMember(member);
    setForm(toForm(member));
    setFormTeam(member.operatorTeam ?? NOT_OPERATOR);
    resetCredentials();
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
    // 운영진 팀이 바뀌면 운영진 명단(권한 관리 화면과 같은 데이터)도 바꾼다. 역할은 서버가 맞춘다.
    const teamName = formTeam === NOT_OPERATOR ? null : formTeam;
    const isTeamChanged = teamName !== (editingMember?.operatorTeam ?? null);
    if (
      editingMember &&
      isTeamChanged &&
      teamName === null &&
      !window.confirm(`${editingMember.name}님을 운영진에서 뺄까요? 운영진 계정도 함께 삭제됩니다.`)
    ) {
      return;
    }
    setIsSaving(true);
    /**
     * 이번 저장에서 동아리원 정보(첫 단계)를 저장한 결과. 운영진 지정(둘째 단계)만 실패하면
     * 목록을 다시 읽고, 팝업을 이 사람의 정보 수정으로 바꿔 다시 저장할 때 운영진 지정만 다시 하게 한다.
     */
    let savedMember: ClubMember | null = null;
    try {
      // 추가는 역할을 보내지 않는다(일반 회원으로 시작하고, 운영진 팀을 고르면 아래에서 정한다).
      const { name, email, phone, university, major, term, track, status } = request;
      const saved = editingMember
        ? await updateClubMember(editingMember.id, request)
        : await createClubMember({
            name,
            email,
            phone,
            university,
            major,
            term,
            track,
            status,
          });
      savedMember = saved;
      setHasSaved(true);
      // 새 운영진이면 입력한 아이디·초기 비밀번호로 계정을 함께 만든다. 아이디 중복·비밀번호 규칙 검사는 서버가 한다.
      const username = formUsername.trim();
      const isIssuing = needsCredentials && teamName !== null;
      if (isTeamChanged) {
        await assignOperator(
          saved.id,
          isIssuing ? { teamName, username, password: formPassword } : { teamName },
        );
      }
      if (isIssuing) {
        setDelivery(
          buildAccountDelivery('issue', {
            name: saved.name,
            username,
            password: formPassword,
          }),
        );
      }
      // 새로 넣은 사람이나 운영진 팀이 바뀐 사람의 줄을 잠깐 표시한다.
      if (!editingMember || isTeamChanged) setFreshBadgeIds(new Set([saved.id]));
      closeModal();
      reload();
      reloadPage();
    } catch (error) {
      if (savedMember) {
        // 동아리원 정보는 저장됐고 운영진 지정만 실패했다. 목록을 다시 읽어 저장된 값을 보이고,
        // 팝업은 그 사람의 정보 수정으로 바꿔 다시 저장하면 운영진 지정만 다시 하게 한다(추가였다면 또 만들지 않는다).
        // 입력값·운영진 팀·아이디·비밀번호는 그대로 둔다.
        setEditingMember(savedMember);
        reload();
        reloadPage();
        const reason = error instanceof Error ? error.message : '알 수 없는 오류';
        window.alert(`동아리원 정보는 저장했지만 운영진 지정은 하지 못했습니다. (${reason})`);
      } else {
        alertApiError(error);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 동아리원을 탈퇴 처리한다(활동 상태를 탈퇴로 바꾼다). 출결 기록과 팀 소속은 그대로 남고,
   * 지금 보는 명단에서 빠져 탈퇴 명단으로 옮겨진다.
   */
  const withdrawMember = async (member: ClubMember) => {
    if (
      !window.confirm(
        `${member.name}님(${member.term}기 ${member.track})을 탈퇴 처리할까요? 출결 기록과 팀 소속은 그대로 남고 탈퇴 명단으로 옮겨집니다.`,
      )
    ) {
      return;
    }
    if (withdrawingId !== null) return;
    setWithdrawingId(member.id);
    try {
      await withdrawClubMember(member.id);
      setHasSaved(true);
      reload();
      reloadPage();
    } catch (error) {
      alertApiError(error);
    } finally {
      setWithdrawingId(null);
    }
  };

  const loadStatus = loadError ? 'error' : loadedMembers ? 'ready' : 'loading';
  /** 표의 상태. 기수 페이지가 있는 명단은 기수 페이지까지 읽어야 준비된다. */
  const tableError = loadError ?? (isPagedSheet ? pageError : null);
  const tableStatus = tableError
    ? 'error'
    : loadStatus === 'ready' && (!isPagedSheet || currentPage)
      ? 'ready'
      : 'loading';
  /** 탈퇴 명단의 쪽 수(사람이 없어도 1쪽). 다른 명단은 쪽으로 나누지 않는다. */
  const withdrawnPageCount = Math.max(1, Math.ceil(filteredMembers.length / WITHDRAWN_PAGE_SIZE));
  // 수정으로 보고 있던 마지막 쪽이 비면 남아 있는 마지막 쪽으로 맞춘다.
  if (isWithdrawnSheet && tableStatus === 'ready' && withdrawnPage > withdrawnPageCount) {
    setWithdrawnPage(withdrawnPageCount);
  }
  /** 표에 그릴 행. 탈퇴 명단은 보고 있는 쪽의 사람만이다. */
  const visibleMembers = useMemo(
    () =>
      isWithdrawnSheet
        ? filteredMembers.slice(
            (withdrawnPage - 1) * WITHDRAWN_PAGE_SIZE,
            withdrawnPage * WITHDRAWN_PAGE_SIZE,
          )
        : filteredMembers,
    [filteredMembers, isWithdrawnSheet, withdrawnPage],
  );
  /**
   * 마지막으로 표에 그린 행. 명단을 바꿔 새 기수 페이지를 읽는 동안 표 높이가 줄었다 늘며 화면이 튀지 않게,
   * 이 행을 흐리게 하고 누를 수 없게(inert) 한 채 잠깐 둔다. 새 페이지가 오면 바로 바꾼다.
   */
  const [heldRows, setHeldRows] = useState<readonly ClubMember[]>([]);
  if (tableStatus === 'ready' && heldRows !== visibleMembers) setHeldRows(visibleMembers);
  /** 다른 명단의 기수 페이지를 읽는 중이라 이전 행을 흐리게 보여 주는 중인지. */
  const isSheetSwitching = tableStatus === 'loading' && heldRows.length > 0;
  const shownRows = tableStatus === 'ready' ? visibleMembers : heldRows;
  /** 이전 행 없이 읽는 중이면 표 안에 읽는 중 안내 한 줄을 둔다(처음 읽을 때는 위 안내만 쓴다). */
  const isLoadingRowShown = tableStatus === 'loading' && !isSheetSwitching;
  const columnCount =
    BASE_COLUMN_COUNT +
    Number(hasTrackColumn) +
    Number(hasOperatorColumn) +
    Number(hasStatusColumn);
  /** 다 읽었을 때의 패널 제목. 기수 페이지가 있는 명단은 읽어 온 기수를 앞에 붙인다(예: '25기 수료기수 목록'). */
  const settledTitle =
    sheetItem && isPagedSheet && currentPage && currentPage.term !== null
      ? `${currentPage.term}기 ${sheetItem.label}`
      : (sheetItem?.label ?? '');
  /**
   * 마지막으로 다 읽었을 때의 제목과 기수 페이지. 명단을 바꿔 읽는 동안 제목이 '수료기수 목록' →
   * '25기 수료기수 목록'처럼 두 번 바뀌고 기수 번호가 비었다 차며 튀지 않게, 흐리게 둔 표(heldRows)처럼
   * 이전 것을 그대로 두었다가 새 페이지가 오면 한 번에 바꾼다.
   */
  const [heldView, setHeldView] = useState<{
    title: string;
    page: ClubMemberTermPage | null;
  }>({ title: '', page: null });
  if (
    tableStatus === 'ready' &&
    (heldView.title !== settledTitle || heldView.page !== currentPage)
  ) {
    setHeldView({ title: settledTitle, page: currentPage });
  }
  const isViewHeld = tableStatus === 'loading';
  /** 오른쪽 패널 제목. 같은 명단에서 다른 기수를 고르면 그 기수의 행이 올 때 함께 바뀐다. */
  const panelTitle = (isViewHeld && heldView.title) || settledTitle;
  /** 기수 필터가 기준으로 삼는 기수 페이지. 다른 명단을 읽는 동안에는 이전 명단의 것을 그대로 둔다. */
  const pagerPage = currentPage ?? (isViewHeld ? heldView.page : null);
  /** 기수 필터의 선택지. terms는 큰 기수(최근)부터다. */
  const pageTerms = pagerPage?.terms ?? [];
  /** 기수 필터에서 고른 것으로 보일 기수. 다른 기수를 읽는 중에는 고른 기수를 먼저 보여 준다. */
  const displayedTerm = pageTerm ?? pagerPage?.term ?? null;
  /** 빈 기수 페이지 안내에 쓰는 명단 이름('활동기수', '수료기수', '분석' 등 부문 이름). */
  const pagedSheetName = sheetItem?.label.replace(' 목록', '') ?? '';

  return (
    <div className="space-y-6">
      {/* 처음 읽을 때와 오류만 위에 알린다. 명단을 바꿔 읽는 중에는 이 줄이 끼어들어 아래가 밀리지 않게
          표 안에서 알린다. */}
      {(tableStatus === 'error' || loadStatus === 'loading') && (
        <p
          role="status"
          className={`rounded-md border px-4 py-3 text-xs ${
            tableStatus === 'error'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {tableStatus === 'error'
            ? hasSaved
              ? `저장은 됐지만 동아리원 목록을 다시 불러오지 못해 화면이 최신이 아닐 수 있습니다. 새로고침해 주세요. (${tableError?.message ?? '알 수 없는 오류'})`
              : `동아리원 정보를 불러오지 못했습니다. (${tableError?.message ?? '알 수 없는 오류'})`
            : '동아리원 정보를 불러오는 중입니다.'}
        </p>
      )}
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">동아리원 명단</h1>
        <div className="flex items-center gap-2">
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
          운영진 팀 목록을 불러오지 못해 수정 팝업에서 운영진 팀을 고를 수 없습니다. (
          {teamsError.message})
        </p>
      )}

      {/* 2. 명단 목록(왼쪽)과 고른 명단의 표(오른쪽). 권한 관리 화면과 같은 분할 화면이다. */}
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
        panelTitle={panelTitle}
        onClose={() => {
          setSheet(null);
          setPageTerm(null);
          setWithdrawnPage(1);
        }}
      >
        {/* 검색·필터. 탈퇴 명단에는 두지 않는다. 활동기수·수료기수 목록은 부문, 부문 명단은 활동 상태로
            받은 기수 페이지 안에서 거른다. 기수는 표 아래 기수 번호로 고르므로 기수 필터가 없다. */}
        {!isWithdrawnSheet && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {/* 기수 필터. 한 번에 한 기수씩 서버에서 읽으므로 '전체'가 없고, 첫 선택지가 가장 최근 기수다.
                  그 명단에 사람이 아예 없으면(기수가 없으면) 뺀다. */}
              {isPagedSheet && pageTerms.length > 0 && (
                <FilterDropdown<string>
                  ariaLabel="기수 필터"
                  title={`${pageTerms[0]}기`}
                  value={displayedTerm === null ? '' : String(displayedTerm)}
                  options={pageTerms.map((term) => ({ value: String(term), label: `${term}기` }))}
                  onChange={(term) => setPageTerm(Number(term))}
                />
              )}
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
        <div
          aria-busy={isTermSwitching || isSheetSwitching}
          className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1070px] border-collapse text-xs">
              <thead className="bg-slate-50/80">
                <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                  <th className={`${TH_CLASS} w-[120px] text-slate-900`}>이름</th>
                  <th className={`${TH_CLASS} w-[80px]`}>기수</th>
                  {hasTrackColumn && <th className={`${TH_CLASS} w-[100px]`}>부문</th>}
                  {hasOperatorColumn && <th className={`${TH_CLASS} w-[120px]`}>운영진</th>}
                  {hasStatusColumn && <th className={`${TH_CLASS} w-[90px]`}>활동 상태</th>}
                  <th className={TH_CLASS}>이메일</th>
                  <th className={`${TH_CLASS} w-[130px]`}>연락처</th>
                  <th className={`${TH_CLASS} w-[130px]`}>대학교</th>
                  <th className={`${TH_CLASS} w-[130px]`}>전공</th>
                  <th className={`${TH_CLASS} w-[88px]`}>관리</th>
                </tr>
              </thead>
              <tbody
                inert={isSheetSwitching}
                className={`divide-y divide-slate-100 ${isSheetSwitching ? 'opacity-50' : ''}`}
              >
                {tableStatus === 'error' || loadStatus !== 'ready' ? null : isLoadingRowShown ? (
                  <tr>
                    <td colSpan={columnCount} className="py-10 text-center text-slate-500">
                      동아리원 정보를 불러오는 중입니다.
                    </td>
                  </tr>
                ) : tableStatus === 'ready' && isPagedSheet && pageMembers?.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="py-10 text-center text-slate-500">
                      {currentPage?.term == null
                        ? `${pagedSheetName} 동아리원이 없습니다.`
                        : `${currentPage.term}기 ${pagedSheetName} 동아리원이 없습니다.`}
                    </td>
                  </tr>
                ) : tableStatus === 'ready' && filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="py-10 text-center text-slate-400">
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
                  shownRows.map((member) => (
                    <tr
                      key={member.id}
                      id={`member-row-${member.id}`}
                      className={`h-[46px] divide-x divide-slate-200 transition-colors ${
                        freshBadgeIds.has(member.id) ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className={`${TD_CLASS} font-bold text-slate-900`}>{member.name}</td>
                      <td className={`${TD_CLASS} tabular-nums text-slate-700`}>{member.term}기</td>
                      {hasTrackColumn && (
                        <td className={`${TD_CLASS} text-slate-700`}>{member.track}</td>
                      )}
                      {hasOperatorColumn && (
                        <td
                          className={`${TD_CLASS} text-slate-700`}
                          aria-label={member.operatorTeam ?? '운영진 팀 없음'}
                        >
                          {member.operatorTeam}
                        </td>
                      )}
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
                          {/* 운영진은 운영진에서 먼저 빼야 탈퇴 처리할 수 있다(서버도 409로 막는다).
                              이미 탈퇴한 사람은 탈퇴 처리할 것이 없다. */}
                          <Tooltip
                            label={
                              member.status === 'WITHDRAWN'
                                ? '이미 탈퇴한 동아리원입니다'
                                : member.operatorTeam
                                  ? '운영진은 명단에서 삭제할 수 없습니다'
                                  : '탈퇴 처리'
                            }
                            align="end"
                          >
                            <button
                              type="button"
                              onClick={() => withdrawMember(member)}
                              disabled={
                                member.status === 'WITHDRAWN' ||
                                member.operatorTeam !== null ||
                                withdrawingId !== null
                              }
                              aria-label={`${member.name} 탈퇴 처리`}
                              className={WITHDRAW_ICON_BTN}
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

        {/* 탈퇴 명단의 쪽 넘김. 한 쪽뿐이어도 자리를 남겨, 쪽 수가 바뀔 때 화면이 튀지 않게 한다. */}
        {isWithdrawnSheet && tableStatus === 'ready' && (
          <div role="group" aria-label="쪽 넘김" className={PAGER_BAR}>
            <button
              type="button"
              onClick={() => setWithdrawnPage((page) => Math.max(1, page - 1))}
              disabled={withdrawnPage <= 1}
              aria-label="이전 쪽"
              className={ICON_BTN}
            >
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              className="min-w-16 text-center text-xs font-semibold tabular-nums text-slate-600"
            >
              {withdrawnPage} / {withdrawnPageCount}
            </span>
            <button
              type="button"
              onClick={() => setWithdrawnPage((page) => Math.min(withdrawnPageCount, page + 1))}
              disabled={withdrawnPage >= withdrawnPageCount}
              aria-label="다음 쪽"
              className={ICON_BTN}
            >
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </SplitView>

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
                  buttonClassName={FIELD_SELECT}
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>운영진</span>
                <SelectDropdown
                  ariaLabel="운영진"
                  value={formTeam}
                  options={teamOptions}
                  onChange={changeFormTeam}
                  buttonClassName={FIELD_SELECT}
                />
              </div>
              {needsCredentials && (
                <div className="grid gap-x-4 gap-y-5 sm:col-span-2 sm:grid-cols-2">
                  <div>
                    <label htmlFor="member-username" className={FIELD_LABEL}>
                      아이디 *
                    </label>
                    <input
                      id="member-username"
                      required
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="입력"
                      className={`${FIELD_INPUT} font-mono`}
                      value={formUsername}
                      onChange={(event) => setFormUsername(event.target.value)}
                    />
                  </div>
                  <div>
                    <label htmlFor="member-password" className={FIELD_LABEL}>
                      초기 비밀번호 *
                    </label>
                    <input
                      id="member-password"
                      required
                      type="text"
                      autoComplete="off"
                      spellCheck={false}
                      className={`${FIELD_INPUT} font-mono`}
                      placeholder="입력"
                      value={formPassword}
                      onChange={(event) => setFormPassword(event.target.value)}
                    />
                  </div>
                </div>
              )}
              <div>
                <span className={FIELD_LABEL}>활동 상태</span>
                <SelectDropdown<ClubMemberStatus>
                  ariaLabel="활동 상태"
                  value={form.status}
                  options={STATUS_OPTIONS}
                  onChange={(status) => updateForm({ status })}
                  buttonClassName={FIELD_SELECT}
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

      {delivery && (
        <AccountDeliveryDialog
          title={delivery.title}
          text={delivery.text}
          onTextChange={(text) => setDelivery({ ...delivery, text })}
          onClose={() => setDelivery(null)}
        />
      )}
    </div>
  );
}
