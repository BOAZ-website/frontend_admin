import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  Plus,
  Download,
  Edit3,
  GripVertical,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AttendanceEvent,
  AttendeeRecord,
  AttendStatus,
  CustomFormField,
} from '@/entities/event/model/types';
import { cohortLabelOf } from '@/entities/cohort/model/lib';
import {
  isLinkedMember,
  MEMBER_IDENTITY_LABELS,
  withMemberIdentity,
} from '@/entities/event/model/memberIdentity';
import { CohortSelect } from '@/pages/attendance-internal-category/ui/CohortSelect';
import { alertApiError } from '@/shared/lib/alertApiError';
import { registerLeaveGuard } from '@/shared/lib/leaveGuard';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { CreateButton } from '@/shared/ui/CreateButton';
import { Tooltip } from '@/shared/ui/Tooltip';

import {
  CONFERENCE_SHEETS,
  conferenceSheetOf,
  DEFAULT_EVENT_FORMAT,
  eventFormatOptionOf,
  importedStatusesOf,
  MEMO_LABELS,
  OX_COLUMN_LABELS,
  sessionLabelsFromHeader,
  STATUS_HEADERS_BY_FORMAT,
  OX_OPTIONS,
  usesFreeformColumns,
  type ConferenceSheet,
  statusCodeOf,
  statusLabelOf,
  statusOfKey,
  statusOptionsOf,
  type EventAttendanceFormat,
  type RosterSlot,
  type RosterSlotId,
} from '../model/eventFormat';
import {
  customStatusIn,
  statusColumnsOf,
  statusesOfAttendee,
  statusIn,
  withCustomStatus,
  withStatusIn,
  type StatusColumn,
} from '../model/statusColumns';
import {
  lookupMembers,
  memberCheckOf,
  type MemberCheck,
  type MemberMatch,
} from '../model/memberLookup';
import { useSemesterMemberTerms } from '../model/termFilter';
import {
  baseColumnOfName,
  isBaseColumnHidden,
  isReservedColumnName,
  NAME_COLUMN_NAME,
  statusColumnRemovalNote,
  withBaseColumnHidden,
  withRemovedColumnValuesCleared,
  withStatusColumnRemoved,
} from '../model/baseColumns';
import {
  extraFieldsOf,
  movedTableColumn,
  statusColumnAtOf,
  tableColumnsOf,
  type TableColumn,
} from '../model/tableColumns';
import { NAME_REQUIRED_ERROR, quickAddFieldErrorOf } from '../model/quickAddValidation';
import { AutoWidthInput } from './AutoWidthInput';
import { ComboInput, type ComboInputOption } from './ComboInput';
import { FilterDropdown, type FilterDropdownOption } from './FilterDropdown';
import { InlineEditableCell } from './InlineEditableCell';
import { NewEventRosterSection } from './NewEventRosterSection';
import { withoutKeys } from '@/shared/lib/object';

// ─── 그룹 계정 관리 화면(HostsPage)과 같은 버튼·입력칸·표 스타일 ───
/** 도구 줄의 선택 상자·검색칸. */
const TOOLBAR_FIELD =
  'h-9 rounded-sm border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400';
/** 부문 필터처럼 여러 값 중 하나를 고르는 묶음 버튼. */
const SEGMENT_WRAP =
  'flex items-center gap-1.5 p-1 rounded-sm bg-slate-100 border border-slate-200/80';
const segmentItemClass = (isActive: boolean) =>
  `px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
    isActive ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
  }`;
/** 팝업 제목 옆 닫기 버튼. */
const MODAL_CLOSE_BTN =
  'p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer';
/** 팝업 아래쪽 취소·확인 버튼. */
const MODAL_CANCEL_BTN =
  'h-9 rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer';
const MODAL_CONFIRM_BTN =
  'h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer';
/** 팝업 입력 항목의 이름과 입력칸. */
const FIELD_LABEL = 'mb-1.5 block text-[11px] font-semibold text-slate-500';
const FIELD_INPUT =
  'h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400';
/** 형식이 틀린 입력칸(빨간 테두리)과 그 아래 고치는 방법 안내. */
const FIELD_INPUT_ERROR =
  'h-10 w-full rounded-sm border border-red-400 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-red-500';
const FIELD_ERROR = 'mt-1 text-[11px] font-medium text-red-500';

/** 출결 버튼 하나의 너비(px). 모든 출결 버튼은 값과 상관없이 같은 크기다. */
const STATUS_BTN_WIDTH = 64;
/** 출결 버튼 묶음과 버튼. 출석 표와 빠른 추가 창이 같은 모양을 쓴다. */
const STATUS_BTN_GROUP =
  'inline-flex shrink-0 gap-0.5 p-0.5 rounded-md bg-slate-100/90 border border-slate-200/60 shadow-2xs select-none';
const STATUS_BTN =
  'inline-flex h-[28px] w-[64px] shrink-0 items-center justify-center gap-1 rounded-md px-1 text-[11px] leading-none whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300';

/**
 * 회원 정보(이름·기수·부문)처럼 고칠 수 없는 칸. 수정 중에 누르면 안내를 띄운다.
 * 잠기지 않았으면 그냥 글자로 보인다.
 */
function LockedOrPlainCell({
  isLocked,
  onLockedClick,
  className,
  children,
}: {
  isLocked: boolean;
  onLockedClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  const base = `w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs truncate ${className}`;
  if (!isLocked) {
    return <div className={base}>{children}</div>;
  }
  return (
    <button
      type="button"
      onClick={onLockedClick}
      title={MEMBER_LOCK_HINT}
      className={`${base} cursor-not-allowed rounded-md focus-visible:outline-none focus-visible:border-slate-300`}
    >
      {children}
    </button>
  );
}

/** 수정본의 글자 항목(이름·비고·추가 컬럼·소속·연락처·이메일·구분)만 참가자에 얹는다. 출결은 건드리지 않는다. */
function withDraftText(attendee: AttendeeRecord, draft: AttendeeRecord): AttendeeRecord {
  return {
    ...attendee,
    name: draft.name,
    memo: draft.memo,
    affiliation: draft.affiliation,
    phone: draft.phone,
    email: draft.email,
    isExternal: draft.isExternal,
    customAnswers: draft.customAnswers,
  };
}

/** 행사 정렬 기준 시각. 일자를 넣지 않은 행사는 만든 날로 정렬한다. */
function eventSortTime(event: AttendanceEvent): number {
  return new Date(event.date || event.createdAt || 0).getTime();
}

/** 화면에 보이는 일자 형식(2026-10-03 → 2026.10.03). */
function formatEventDate(date: string): string {
  return date.replaceAll('-', '.');
}

/**
 * 행사 목록에 작게 보이는 일자·장소. 입력한 것만 보이고, 둘 다 있으면 얇은 세로선으로 나눈다.
 * 둘 다 없으면 '-'를 보여, 모든 카드의 높이와 제목 위치를 같게 한다.
 */
function EventMeta({ event }: { event: AttendanceEvent }) {
  const parts = [event.date ? formatEventDate(event.date) : '', event.location].filter(Boolean);
  if (parts.length === 0) {
    return <p className="flex h-4 items-center text-xs text-slate-300">-</p>;
  }
  return (
    <p className="flex h-4 min-w-0 items-center gap-2.5 text-xs text-slate-500">
      {parts.map((part, idx) => (
        <span key={part} className="flex min-w-0 items-center gap-2.5">
          {idx > 0 && <span className="h-3 w-px shrink-0 bg-slate-300" aria-hidden="true" />}
          <span className={idx === 0 && event.date ? 'shrink-0 tabular-nums' : 'truncate'}>
            {part}
          </span>
        </span>
      ))}
    </p>
  );
}

/** 닫힌 출결 열의 글자 색. 참석(출석)은 초록, 불참(결석)은 빨강, 미정은 연한 회색, 나머지는 진한 회색이다. */
function collapsedStatusTextClass(status: AttendStatus): string {
  if (status === 'present') return 'text-emerald-600';
  if (status === 'absent') return 'text-rose-600';
  if (status === 'unmarked') return 'text-slate-400 font-medium';
  return 'text-slate-800';
}

/** 버튼으로 고르는 선택 컬럼인지(뒤풀이 비용 O/X 등). */
function isSelectColumn(cf: CustomFormField): boolean {
  return cf.type === 'SELECT' && Boolean(cf.options?.length);
}

/** 활동 TERM 열인지(BASE·ADV). 참가자 추가 창에서 활동 TERM은 드롭다운으로 고른다. */
function isActivityTermLabel(label: string): boolean {
  return /term/i.test(label);
}

/** 참가자 추가 창의 활동 TERM 선택지. 첫 칸(빈 값)은 고르지 않은 상태다. */
const ACTIVITY_TERM_DROPDOWN_OPTIONS: readonly FilterDropdownOption<string>[] = [
  { value: '', label: '선택 안 함' },
  { value: 'BASE', label: 'BASE' },
  { value: 'ADV', label: 'ADV' },
];

/** 기수 열인지. 참가자 추가 창에서 기수는 숫자로 입력하거나 목록에서 고른다. */
function isTermLabel(label: string): boolean {
  return label.includes('기수');
}

/** 부문 열인지(부문·트랙·분야). 참가자 추가 창에서 부문은 드롭다운으로 고른다. */
function isTrackLabel(label: string): boolean {
  return ['부문', '트랙', '분야'].some((word) => label.includes(word));
}

/** 참가자 추가 창의 부문 선택지. 첫 칸(빈 값)은 고르지 않은 상태다. */
const TRACK_DROPDOWN_OPTIONS: readonly FilterDropdownOption<string>[] = [
  { value: '', label: '선택 안 함' },
  ...['분석', '시각화', '엔지니어링'].map((track) => ({ value: track, label: track })),
];

/** 닫아 둔 열(출결 열·선택 컬럼)의 너비(px). 고른 값을 글자로만 보여 준다. */
const COLLAPSED_STATUS_WIDTH = 110;

interface ColumnToggleButtonProps {
  label: string;
  isCollapsed: boolean;
  onToggle: () => void;
}

/** 열 머리글의 열고 닫기 버튼. 닫힌 열은 버튼 대신 고른 값을 글자로 보여 준다. */
function ColumnToggleButton({ label, isCollapsed, onToggle }: ColumnToggleButtonProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!isCollapsed}
      title={isCollapsed ? `${label} 입력 열기` : `${label} 입력 닫기`}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold transition-colors cursor-pointer hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
    >
      {isCollapsed ? (
        <ChevronRight size={13} aria-hidden="true" />
      ) : (
        <ChevronDown size={13} aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

/** 수정 모드에서 동아리 회원의 이름·기수·부문 칸에 보여 주는 안내. */
const MEMBER_LOCK_HINT = '회원 정보는 수정할 수 없습니다.';

/** 출결이 아닌 선택 컬럼(뒤풀이 비용 O/X 등)의 버튼 상태. 출결 버튼과 크기는 같고 색만 중립이다. */
const OPTION_BTN_ACTIVE = 'bg-white text-slate-900 font-bold border border-slate-300 shadow-2xs';
const OPTION_BTN_INACTIVE =
  'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium';

const ATTEND_STATUS_STYLES: Record<AttendStatus, { active: string; inactive: string }> = {
  present: {
    active: 'bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#0f5132] hover:bg-white/60 border border-transparent font-medium',
  },
  late: {
    active: 'bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium',
  },
  earlyLeave: {
    active: 'bg-[#fef3c7] text-[#7c4a03] font-bold border border-[#fde68a] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium',
  },
  absent: {
    active: 'bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#8a1c32] hover:bg-white/60 border border-transparent font-medium',
  },
  excusedAbsent: {
    active: 'bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#1e40af] hover:bg-white/60 border border-transparent font-medium',
  },
  unexcusedLate: {
    active: 'bg-[#fff7ed] text-[#c2410c] font-bold border border-[#fed7aa] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#c2410c] hover:bg-white/60 border border-transparent font-medium',
  },
  unexcusedAbsent: {
    active: 'bg-[#fee2e2] text-[#991b1b] font-bold border border-[#fca5a5] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#991b1b] hover:bg-white/60 border border-transparent font-medium',
  },
  unmarked: {
    active: 'bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs',
    inactive:
      'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium',
  },
};

/**
 * 추가 컬럼 칸에 보여 줄 값. 명단에 적힌 값(customAnswers)을 먼저 쓰고,
 * 없으면 참가자 정보(소속·기수·부문·연락처·이메일·구분)에서 찾는다. 모르는 값은 지어내지 않고 빈칸으로 둔다.
 */
function getAttendeeFieldValue(att: AttendeeRecord, label: string, id: string): string {
  if (att.customAnswers?.[label] !== undefined && att.customAnswers[label] !== '') {
    return att.customAnswers[label];
  }
  if (att.customAnswers?.[id] !== undefined && att.customAnswers[id] !== '') {
    return att.customAnswers[id];
  }

  const clean = label.trim().toLowerCase();

  // 소속 / 회사 / 직장 / 기업 / 학교
  if (['소속', '회사', '직장', '기업', '학교', '대학'].some((word) => clean.includes(word))) {
    return att.affiliation;
  }

  // 기수
  if (clean.includes('기수')) {
    return att.term ? `${att.term}기` : '';
  }

  // 부문 / 트랙 / 분야: 소속에 적힌 부문만 쓴다
  if (clean.includes('부문') || clean.includes('트랙') || clean.includes('분야')) {
    return ['분석', '엔지니어링', '시각화'].find((track) => att.affiliation.includes(track)) ?? '';
  }

  // 전화번호 / 연락처 / 핸드폰 / 휴대폰
  if (['전화', '연락', '핸드폰', '휴대폰', 'phone'].some((word) => clean.includes(word))) {
    return att.phone;
  }

  // 이메일 / 메일 / email
  if (clean.includes('메일') || clean.includes('email')) {
    return att.email;
  }

  // 구분 / 참가구분 / 신분
  if (clean.includes('구분') || clean.includes('신분')) {
    return att.isExternal ? '외부인' : '정회원';
  }

  return '';
}

interface ParsedRosterItem {
  isExternal: boolean;
  name: string;
  affiliation: string;
  email: string;
  phone: string;
  term?: number;
  memo?: string;
  /** 일반 행사형 파일의 행사 열에서 읽은 출결. */
  sessionStatuses?: Record<string, AttendStatus>;
  /** 신입 특칙형·컨퍼런스 파일의 출결 열에서 읽은 출결(컨퍼런스는 1차). */
  status?: AttendStatus;
  /** 컨퍼런스 파일의 2차 출석 확인에서 읽은 출결. */
  secondStatus?: AttendStatus;
  /** 올릴 때 회원 DB에서 찾은 회원(이름·기수가 같은 사람). 있으면 이름·기수·부문을 고칠 수 없다. */
  member?: MemberMatch;
  /** 올릴 때 회원 DB 확인 결과(현재 기수인데 없는 사람을 알리는 데 쓴다). */
  memberCheck?: MemberCheck;
  customAnswers: Record<string, string>;
}

export interface EventAttendanceManagePageProps {
  cohorts: readonly number[];
  currentCohort: number;
  /** 기수 → 반기 표기(반기 API 응답). */
  cohortLabels: Readonly<Record<number, string>>;
  canCreateNextSemester: boolean;
  onAdvanceSemester: () => Promise<void>;
  events: AttendanceEvent[];
  setEvents: Dispatch<SetStateAction<AttendanceEvent[]>>;
  attendees: AttendeeRecord[];
  setAttendees: Dispatch<SetStateAction<AttendeeRecord[]>>;
  /** 행사 참가자의 기수 목록(백엔드, 행사 DB 기준). 기수 필터 선택지다. */
  loadEventTerms: (eventId: string) => Promise<number[]>;
  /** 사이드바의 행사 출결 메뉴를 다시 누른 횟수. 바뀌면 행사 목록으로 돌아간다. */
  listRequest?: number;
  /** 행사 한 건을 서버에서 다시 읽는다. 출석 명단 표 컬럼 설정 창을 열 때 쓴다. */
  loadEvent: (eventId: string) => Promise<AttendanceEvent>;
  /** 참가자 한 명을 바꾸고 바뀐 칸만 부분 저장한다(출결 버튼·뒤풀이 비용 등). */
  patchAttendee: (attendeeId: string, update: (attendee: AttendeeRecord) => AttendeeRecord) => void;
  /** 참가자 한 명을 명단 맨 앞에 추가하고 한 명 추가 API(POST)로 저장한다(참가자 추가 창). */
  createAttendee: (attendee: AttendeeRecord) => void;
}

/** 행사 출결 화면. 행사·참가자는 EventAttendanceContainer가 API로 읽어 넘겨 주고, 바꾸면 API로 저장한다. */
export function EventAttendanceManagePage({
  cohorts,
  currentCohort,
  cohortLabels,
  canCreateNextSemester,
  onAdvanceSemester,
  events,
  setEvents,
  attendees,
  setAttendees,
  loadEventTerms,
  listRequest = 0,
  loadEvent,
  patchAttendee,
  createAttendee,
}: EventAttendanceManagePageProps) {
  const [selectedCohort, setSelectedCohort] = useState(currentCohort);
  // 탭에 들어올 때마다 행사 목록부터 보여 준다.
  const [subTab, setSubTab] = useState<'events' | 'live'>('events');

  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('boaz_event_selected_id');
      if (saved) return saved;
    } catch {}
    return 'evt_ex_conference';
  });

  useEffect(() => {
    try {
      localStorage.setItem('boaz_event_selected_id', selectedEventId);
    } catch {}
  }, [selectedEventId]);

  // ─── Browser History: 뒤로가기 시 행사 세부 탭 -> 행사 전체 목록 이동 연동 ───
  useEffect(() => {
    // 마운트 시 초기 history state 동기화 (항상 목록에서 시작)
    if (!window.history.state || window.history.state.subTab !== 'events') {
      window.history.replaceState(
        { page: 'att-events', subTab: 'events' },
        '',
        window.location.href,
      );
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      const isLeavingDetail = !(state && state.subTab === 'detail');
      if (isLeavingDetail && !leaveGuardRef.current()) {
        // 머물기로 했으면 방금 뒤로 간 기록을 다시 쌓아 행사 화면에 남는다.
        window.history.pushState(
          { page: 'att-events', subTab: 'detail', eventId: latestEventIdRef.current, tab: 'live' },
          '',
          window.location.href,
        );
        return;
      }
      if (state && state.subTab === 'detail') {
        setSubTab('live');
        if (state.eventId) {
          setSelectedEventId(state.eventId);
        }
      } else {
        // 브라우저 뒤로가기 누를 시 행사 세부 탭에서 행사 전체 목록으로 이동
        setSubTab('events');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function handleSelectEvent(eventId: string) {
    if (eventId !== selectedEventId && !leaveGuardRef.current()) {
      return;
    }
    setSelectedEventId(eventId);
    setSubTab('live');
    setConferenceSheet('CURRENT');
    window.history.pushState(
      { page: 'att-events', subTab: 'detail', eventId, tab: 'live' },
      '',
      window.location.href,
    );
  }

  // 사이드바의 행사 출결 메뉴를 다시 누르면 행사 목록으로 돌아간다(처음 열 때는 이미 목록이다).
  const handledListRequestRef = useRef(listRequest);
  useEffect(() => {
    if (listRequest === handledListRequestRef.current) return;
    handledListRequestRef.current = listRequest;
    if (subTab !== 'events') handleGoBackToList();
  });

  function handleGoBackToList() {
    if (!leaveGuardRef.current()) {
      return;
    }
    if (window.history.state && window.history.state.subTab === 'detail') {
      window.history.back();
    } else {
      setSubTab('events');
      window.history.replaceState(
        { page: 'att-events', subTab: 'events' },
        '',
        window.location.href,
      );
    }
  }

  // Dropdown selector state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBreadcrumbMenuOpen, setIsBreadcrumbMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const breadcrumbDropdownRef = useRef<HTMLDivElement>(null);

  // Filter & Search
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [termFilter, setTermFilter] = useState<string>('ALL'); // "ALL" | "28" | "27" | "26"
  const [attendeeCategoryFilter, setAttendeeCategoryFilter] = useState<
    'ALL' | 'ANALYSIS' | 'VISUALIZATION' | 'ENGINEERING' | 'EXTERNAL'
  >('ALL');
  const [attendStatusFilter, setAttendStatusFilter] = useState<'ALL' | AttendStatus>('ALL');
  // 컨퍼런스 행사에서 보고 있는 명단 시트
  const [conferenceSheet, setConferenceSheet] = useState<ConferenceSheet>('CURRENT');
  // 화면 아래에 잠깐 보이는 안내(예: 회원 정보는 고칠 수 없음)
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 2500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  // 반기별 활동 회원 기수(반기 API). 명단을 올릴 때 '현재 기수인데 회원 DB에 없는 사람'을 가리는 데 쓴다.
  const semesterMemberTerms = useSemesterMemberTerms();
  // 보고 있는 행사 참가자의 기수 목록(백엔드, 행사 DB 기준). 기수 필터 선택지다.
  const [eventTerms, setEventTerms] = useState<number[] | null>(null);
  // 처음 상태에서 열고 닫기를 바꾼 열(행사 id → 열 key). 출결 열과 선택 컬럼(뒤풀이 비용 O/X 등)이 대상이다.
  // 닫힌 열은 고른 값만 글자로 보여 준다.
  const [toggledColumnsByEvent, setToggledColumnsByEvent] = useState<Record<string, string[]>>({});

  // Fast Keyboard Check-in Mode State
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [isKeyboardModeActive] = useState(true);

  // Quick Add Drawer
  const [showQuickAddDrawer, setShowQuickAddDrawer] = useState(false);
  // 추가를 한 번 눌렀는지. 이름을 비워 둔 안내는 그 뒤부터 보여 준다(형식 오류는 입력하는 대로 보여 준다).
  const [hasTriedQuickAdd, setHasTriedQuickAdd] = useState(false);
  const [quickAdd, setQuickAdd] = useState({
    isExternal: false,
    name: '',
    affiliation: '',
    email: '',
    phone: '',
    memo: '',
    status: 'unmarked' as AttendStatus,
    customAnswers: {} as Record<string, string>,
  });

  // 새 행사 등록 창에서 올린 CSV 명단(행사를 만들 때 함께 등록)
  // 출결 방식에 따라 명단 파일을 받는 칸이 다르다(컨퍼런스는 참석자 구분별 3칸).
  const [newEventFormat, setNewEventFormat] = useState<EventAttendanceFormat>(DEFAULT_EVENT_FORMAT);
  const [newEventUploads, setNewEventUploads] = useState<
    Partial<Record<RosterSlotId, { fileName: string; roster: ParsedRosterItem[] }>>
  >({});

  // Modal: Event Form Create / Edit (BASIC_INFO: 기본정보, COLUMNS_ONLY: 출석컬럼, CREATE_FULL: 새 행사 전체)
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [eventModalType, setEventModalType] = useState<
    'BASIC_INFO' | 'COLUMNS_ONLY' | 'CREATE_FULL'
  >('CREATE_FULL');
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [newColInputText, setNewColInputText] = useState('');
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dropIndicatorIdx, setDropIndicatorIdx] = useState<number | null>(null);

  // Table Edit Mode State (switch between clean text view & inline input edit mode)
  // 일괄 수정 중인 탭(행사 id:시트). 컨퍼런스는 시트마다, 다른 방식은 행사마다 따로 켜고 끈다.
  const [editModeKeys, setEditModeKeys] = useState<readonly string[]>([]);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  // 수정 중에 고친 참가자(아직 저장 전). 그 탭의 일괄 저장이나 행의 수정 완료를 누르면 저장한다.
  const [drafts, setDrafts] = useState<Readonly<Record<string, AttendeeRecord>>>({});
  const hasUnsavedEdits = Object.keys(drafts).length > 0;

  /**
   * 행사 화면을 떠나도 되는지(목록으로·다른 행사로·다른 메뉴로·뒤로 가기).
   * 저장하지 않은 수정 내용이 있으면 브라우저 확인 창으로 묻는다. 확인: 모두 저장하고 나간다. 취소: 머문다.
   */
  function confirmLeaveEvent(): boolean {
    if (Object.keys(drafts).length === 0) {
      return true;
    }
    const shouldSave = window.confirm('저장하지 않은 수정 내용이 있습니다.\n저장하고 나갈까요?');
    if (!shouldSave) {
      return false;
    }
    commitDrafts(Object.keys(drafts));
    setEditModeKeys([]);
    setEditingRowId(null);
    return true;
  }
  // 이벤트 처리기(뒤로 가기)와 다른 화면(사이드바)이 늘 최신 확인 함수를 부르도록 ref에 둔다.
  const leaveGuardRef = useRef(confirmLeaveEvent);
  leaveGuardRef.current = confirmLeaveEvent;
  const latestEventIdRef = useRef(selectedEventId);
  latestEventIdRef.current = selectedEventId;

  useEffect(() => registerLeaveGuard(() => leaveGuardRef.current()), []);

  // 새로고침·탭 닫기: 브라우저가 직접 '사이트에서 나가시겠습니까?'를 묻는다(문구는 바꿀 수 없고 저장되지 않는다).
  useEffect(() => {
    if (!hasUnsavedEdits) {
      return;
    }
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedEdits]);

  // Table Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    index: 50,
    name: 120,
    memo: 200,
  });

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const resizingCol = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [activeHoverCol, setActiveHoverCol] = useState<string | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);
  const [guidelineX, setGuidelineX] = useState<number | null>(null);
  const activeThRef = useRef<HTMLElement | null>(null);

  const updateGuidelinePos = (targetEl?: HTMLElement | null) => {
    const cell = targetEl
      ? ((targetEl.closest('th') || targetEl.closest('td')) as HTMLElement | null)
      : activeThRef.current;
    if (!cell || !tableContainerRef.current) {
      return;
    }
    activeThRef.current = cell;
    const containerRect = tableContainerRef.current.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const scrollLeft = tableContainerRef.current.scrollLeft;
    const x = cellRect.right - containerRect.left + scrollLeft;
    setGuidelineX(x);
  };

  /**
   * 스크롤하는 동안에는 열 너비 안내선을 숨긴다. 안내선은 마우스를 올린 순간의 자리에 그려지므로,
   * 스크롤로 열 경계가 커서 아래를 지나가면 엉뚱한 자리에 선이 깜빡여 표가 흔들려 보인다.
   */
  const handleTableScroll = () => {
    if (resizingCol.current || (activeHoverCol === null && guidelineX === null)) {
      return;
    }
    setActiveHoverCol(null);
    setGuidelineX(null);
  };

  const handleResizeStart = (e: React.MouseEvent<HTMLElement>, key: string, minWidth = 50) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget.closest('th') ||
      e.currentTarget.closest('td')) as HTMLElement | null;
    activeThRef.current = cell;
    const startX = e.clientX;
    const startWidth = cell ? cell.offsetWidth : colWidths[key] || minWidth;
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);
    updateGuidelinePos(e.currentTarget);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingCol.current) {
        return;
      }
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - resizingCol.current.startX;
      const targetWidth = Math.max(minWidth, resizingCol.current.startWidth + deltaX);
      const activeKey = resizingCol.current.key;
      setColWidths((prev) => ({ ...prev, [activeKey]: targetWidth }));
      if (activeThRef.current) {
        updateGuidelinePos(activeThRef.current);
      }
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      setResizingColKey(null);
      setGuidelineX(null);
      activeThRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 최신 활동일자순 (날짜 내림차순 -> 생성일 내림차순) 정렬. 일자를 넣지 않은 행사는 만든 날 기준이다.
  const cohortEvents = events.filter((event) => event.targetTerms.includes(selectedCohort));
  const sortedEvents = [...cohortEvents].sort((a, b) => {
    const diff = eventSortTime(b) - eventSortTime(a);
    if (diff !== 0) {
      return diff;
    }
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const fallbackEvent: AttendanceEvent = {
    id: 'evt_fallback',
    title: '행사',
    status: 'IN_PROGRESS',
    date: '2026-08-20',
    startTime: '14:00',
    endTime: '18:00',
    location: '-',
    description: '',
    allowExternal: false,
    checkinMethod: 'CODE',
    checkinCode: '1234',
    customFields: [],
    targetTerms: [selectedCohort],
    targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
    totalTargetCount: 0,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: '2026-08-20',
  };

  const selectedEvent =
    cohortEvents.find((e) => e.id === selectedEventId) || sortedEvents[0] || fallbackEvent;
  const currentEventAttendees = attendees.filter((a) => a.eventId === (selectedEvent?.id || ''));

  // 기수 필터 선택지: 행사를 바꾸거나 참가자 구성·기수가 바뀌면 백엔드에서 다시 읽는다(저장이 끝난 뒤 읽는다).
  // 출결만 바뀐 경우에는 다시 읽지 않는다.
  const viewedEventId = selectedEvent?.id;
  const rosterTermsKey = currentEventAttendees.map((a) => `${a.id}:${a.term ?? ''}`).join('|');
  useEffect(() => {
    if (!viewedEventId) {
      setEventTerms(null);
      return;
    }
    let isCancelled = false;
    loadEventTerms(viewedEventId)
      .then((terms) => {
        if (!isCancelled) setEventTerms(terms);
      })
      .catch(() => {
        if (!isCancelled) setEventTerms(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [viewedEventId, rosterTermsKey, loadEventTerms]);

  // 행사 출결 방식. 출결 값과 코드, 컨퍼런스의 1차·2차 구분이 방식에 따라 다르다.
  const eventFormat = selectedEvent.attendanceFormat;
  const isConferenceEvent = eventFormat === 'CONFERENCE';
  // 컨퍼런스는 명단을 시트(현재 활동기수 · 활동기수 외 회원 · 외부 참석자)로 나눠 관리한다.
  const sheetOf = (a: AttendeeRecord) => conferenceSheetOf(a, selectedEvent.targetTerms);
  const isExternalSheet = isConferenceEvent && conferenceSheet === 'EXTERNAL';
  // 지금 보고 있는 탭(컨퍼런스는 시트)의 일괄 수정 여부
  const editModeKey = `${selectedEvent.id}:${isConferenceEvent ? conferenceSheet : 'ALL'}`;
  const isTableEditMode = editModeKeys.includes(editModeKey);

  // 출석 탭의 컨퍼런스 행사는 엑셀처럼 화면 맨 아래에 시트 탭을 둔다.
  const hasSheetTabs = subTab === 'live' && isConferenceEvent;

  /**
   * 다른 시트로 넘어간다. 지금 시트에 저장하지 않은 수정 내용이 있으면 브라우저 확인 창으로 묻는다.
   * 확인: 저장하고 넘어간다. 취소: 넘어가지 않고 이 시트에 머문다(입력한 내용은 그대로).
   */
  function handleChangeConferenceSheet(sheet: ConferenceSheet) {
    if (sheet === conferenceSheet) {
      return;
    }
    if (currentTabAttendeeIds().some((id) => drafts[id])) {
      const tabLabel =
        CONFERENCE_SHEETS.find((item) => item.value === conferenceSheet)?.label ?? '';
      const shouldSave = window.confirm(
        `${tabLabel} 시트에 저장하지 않은 수정 내용이 있습니다.\n저장하고 넘어갈까요?`,
      );
      if (!shouldSave) {
        return;
      }
      finishTabEditing();
    }
    switchConferenceSheet(sheet);
  }

  function switchConferenceSheet(sheet: ConferenceSheet) {
    setConferenceSheet(sheet);
    setFocusedIndex(0);
  }

  /** 지금 탭의 수정을 끝낸다: 수정본을 저장하고 수정 모드를 끈다. */
  function finishTabEditing() {
    commitDrafts(currentTabAttendeeIds());
    setEditingRowId(null);
    setEditModeKeys((prev) => prev.filter((key) => key !== editModeKey));
  }

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (
        breadcrumbDropdownRef.current &&
        !breadcrumbDropdownRef.current.contains(e.target as Node)
      ) {
        setIsBreadcrumbMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /**
   * 표 위 기수 필터. 첫 값은 거르지 않는 '전체'이고, 나머지는 백엔드가 행사 DB에서 내려 준 이 행사 참가자의 기수다.
   * 불러오지 못하면 '전체'만 둔다(프론트에서 기수를 계산하지 않는다).
   */
  const termFilterOptions: readonly FilterDropdownOption<string>[] = [
    { value: 'ALL', label: '전체' },
    ...(eventTerms ?? []).map((term) => ({ value: String(term), label: `${term}기` })),
  ];

  // 화면에서 숨긴 필터는 적용하지 않는다(외부 참석자 시트의 기수·부문, 컨퍼런스의 '외부').
  // 선택지에 없는 기수(다른 반기에서 고른 값)도 거르지 않는다.
  const activeTermFilter =
    isExternalSheet || !termFilterOptions.some((option) => option.value === termFilter)
      ? 'ALL'
      : termFilter;
  const activeCategoryFilter =
    isExternalSheet || (isConferenceEvent && attendeeCategoryFilter === 'EXTERNAL')
      ? 'ALL'
      : attendeeCategoryFilter;
  // 이 행사(시트)에 없는 출결 값이 골라져 있으면(다른 행사에서 고른 값) 거르지 않는다.
  const availableStatuses = statusOptionsOf(eventFormat)
    .map((option) => option.value)
    .filter((status) => !isExternalSheet || status === 'present' || status === 'unmarked');
  const activeStatusFilter =
    attendStatusFilter !== 'ALL' && availableStatuses.includes(attendStatusFilter)
      ? attendStatusFilter
      : 'ALL';

  const filteredAttendees = currentEventAttendees.filter((a) => {
    if (isConferenceEvent && sheetOf(a) !== conferenceSheet) {
      return false;
    }
    const rawText = [
      a.affiliation || '',
      a.isExternal ? '외부인 외부' : '부원 기수',
      ...Object.values(a.customAnswers || {}),
    ]
      .join(' ')
      .toLowerCase();

    // 1. 기수 필터 (Term filter)
    if (activeTermFilter !== 'ALL') {
      const termMatch =
        (a.term && String(a.term) === activeTermFilter) ||
        (a.affiliation && a.affiliation.includes(`${activeTermFilter}기`)) ||
        rawText.includes(`${activeTermFilter}기`);
      if (!termMatch) {
        return false;
      }
    }

    // 2. 트랙 및 구분 필터
    if (activeCategoryFilter === 'ANALYSIS') {
      if (!rawText.includes('분석')) {
        return false;
      }
    } else if (activeCategoryFilter === 'VISUALIZATION') {
      if (!rawText.includes('시각화') && !rawText.includes('시각')) {
        return false;
      }
    } else if (activeCategoryFilter === 'ENGINEERING') {
      if (!rawText.includes('엔지') && !rawText.includes('개발')) {
        return false;
      }
    } else if (activeCategoryFilter === 'EXTERNAL') {
      if (
        !a.isExternal &&
        !rawText.includes('외') &&
        !rawText.includes('게스트') &&
        !rawText.includes('기업')
      ) {
        return false;
      }
    }

    // 출결 열이 여러 개면(1차·2차, 행사별) 어느 열이든 그 값이면 보여 준다.
    if (
      activeStatusFilter !== 'ALL' &&
      !statusesOfAttendee(selectedEvent, a).includes(activeStatusFilter)
    ) {
      return false;
    }
    if (attendeeSearch) {
      const q = attendeeSearch.toLowerCase();
      return (
        a.name.toLowerCase().includes(q) ||
        (a.affiliation && a.affiliation.toLowerCase().includes(q)) ||
        (a.email && a.email.toLowerCase().includes(q)) ||
        (a.phone && a.phone.includes(q)) ||
        rawText.includes(q)
      );
    }
    return true;
  });

  // Stats calculation
  // 출결 열이 여러 개면(1차·2차, 행사별) 열마다 한 건으로 센다.
  const totalRosterCount = currentEventAttendees.length;
  const statusCells = currentEventAttendees.flatMap((a) => statusesOfAttendee(selectedEvent, a));
  const countStatus = (status: AttendStatus) => statusCells.filter((s) => s === status).length;
  const countUnit = statusColumnsOf(selectedEvent, false).length > 1 ? '건' : '명';
  const presentCount = countStatus('present');
  const lateCount = countStatus('late');
  const earlyLeaveCount = countStatus('earlyLeave');
  const absentCount = countStatus('absent');
  const excusedAbsentCount = countStatus('excusedAbsent');
  const unexcusedLateCount = countStatus('unexcusedLate');
  const unexcusedAbsentCount = countStatus('unexcusedAbsent');

  // 출석 표의 추가 컬럼과, 출결 컬럼이 놓일 자리(CSV로 만든 행사는 CSV의 출결 열 자리).
  // 컬럼 설정 창과 같은 함수(tableColumns)로 정해 두 화면의 컬럼 구성이 항상 같다.
  // 외부 참석자 시트는 이름·출석·비고만 관리한다(기수·부문을 받지 않는다).
  const eventExtraCols = extraFieldsOf(selectedEvent, isExternalSheet);
  const statusColumnAt = statusColumnAtOf(selectedEvent, eventExtraCols.length);

  const attendanceRate =
    statusCells.length > 0
      ? Math.round(((presentCount + lateCount + earlyLeaveCount) / statusCells.length) * 100)
      : 0;

  /** 컨퍼런스 외부 참석자는 참석 여부만 기록한다(1 또는 공란). */
  function statusOptionsFor(att: AttendeeRecord) {
    const options = statusOptionsOf(eventFormat);
    return isConferenceEvent && att.isExternal
      ? options.filter((option) => option.value === 'present' || option.value === 'unmarked')
      : options;
  }

  /** 참가자 추가 창에서 외부 참석자로 추가하는지. 외부 참석자는 컨퍼런스만 받는다. */
  const isQuickAddExternal = isConferenceEvent && quickAdd.isExternal;
  /** 참가자 추가 창의 출석 상태 선택지. 외부 참석자 양식은 참석 여부만 고른다. */
  const quickAddStatusOptions = statusOptionsOf(eventFormat).filter(
    (option) => !isQuickAddExternal || option.value === 'present' || option.value === 'unmarked',
  );

  /**
   * 참가자 추가 창의 추가 컬럼 입력 칸(외부 참석자 양식에는 없다).
   * 기수와 부문이 둘 다 있으면 부문을 기수 바로 뒤로 옮겨 한 줄에 나란히 놓는다(halfWidthIds).
   */
  const { quickAddFields, halfWidthIds } = (() => {
    const fields = isQuickAddExternal
      ? []
      : (selectedEvent.customFields || []).filter(
          (f) =>
            f.label !== '이름' &&
            f.label !== '비고' &&
            f.label !== '출석 상태' &&
            f.label !== '출석상태',
        );
    const termField = fields.find((f) => isTermLabel(f.label));
    const trackField = fields.find((f) => isTrackLabel(f.label));
    if (!termField || !trackField) {
      return { quickAddFields: fields, halfWidthIds: [] as string[] };
    }
    return {
      quickAddFields: fields
        .filter((f) => f !== trackField)
        .flatMap((f) => (f === termField ? [termField, trackField] : [f])),
      halfWidthIds: [termField.id, trackField.id],
    };
  })();

  /**
   * 참가자 추가 창의 기수 선택지. 표 위 기수 필터와 같이 백엔드가 행사 DB에서 내려 준 이 행사 참가자의 기수다.
   * 칸에는 숫자만 들어가고(목록에 없는 기수는 숫자로 직접 입력한다), 목록에는 'N기'로 보인다.
   */
  const quickAddTermOptions: readonly ComboInputOption[] = (eventTerms ?? []).map((term) => ({
    value: String(term),
    label: `${term}기`,
  }));

  /** 참가자 추가 창에서 글자로 입력하는 칸과, 출석 상태 줄에 버튼으로 두는 선택 컬럼. */
  const quickAddTextFields = quickAddFields.filter((cf) => !isSelectColumn(cf));
  /** 활동 TERM은 이름 옆에 두고, 나머지 글자 칸은 이름 아래 묶음(quickAddGridFields)에 둔다. */
  const quickAddActivityTermField = quickAddTextFields.find((cf) => isActivityTermLabel(cf.label));
  const quickAddGridFields = quickAddTextFields.filter((cf) => cf !== quickAddActivityTermField);
  const quickAddSelectFields = quickAddFields.filter(isSelectColumn);

  /** 참가자 추가 창의 추가 컬럼 칸에 지금 들어 있는 값. */
  function quickAddValueOf(cf: CustomFormField): string {
    return (
      quickAdd.customAnswers[cf.label] ??
      quickAdd.customAnswers[cf.id] ??
      (cf.label.includes('소속')
        ? quickAdd.affiliation
        : cf.label.includes('전화') || cf.label.includes('연락처')
          ? quickAdd.phone
          : cf.label.includes('메일')
            ? quickAdd.email
            : '')
    );
  }

  /** 참가자 추가 창의 추가 컬럼 칸 값을 바꾼다. 소속·연락처·이메일 칸은 참가자 정보에도 함께 적는다. */
  function changeQuickAddValue(cf: CustomFormField, val: string) {
    setQuickAdd((prev) => ({
      ...prev,
      affiliation: cf.label.includes('소속') ? val : prev.affiliation,
      phone: cf.label.includes('전화') || cf.label.includes('연락처') ? val : prev.phone,
      email: cf.label.includes('메일') ? val : prev.email,
      customAnswers: { ...prev.customAnswers, [cf.label]: val, [cf.id]: val },
    }));
  }

  /** 참가자 추가 창에서 형식이 틀린 칸(열 id → 고치는 방법). 입력하는 대로 보여 준다. */
  const quickAddFieldErrors: Record<string, string> = Object.fromEntries(
    quickAddFields.flatMap((cf) => {
      const error = quickAddFieldErrorOf(cf.label, quickAddValueOf(cf));
      return error ? [[cf.id, error]] : [];
    }),
  );
  /** 이름을 비워 둔 안내. 추가를 한 번 누른 뒤부터 보여 준다. */
  const quickAddNameError =
    hasTriedQuickAdd && !quickAdd.name.trim() ? NAME_REQUIRED_ERROR : undefined;

  /** 외부인 체크를 바꾼다. 외부 참석자 양식에 없는 출석 상태를 골라 두었으면 미정으로 되돌린다. */
  function changeQuickAddExternal(isExternal: boolean) {
    setQuickAdd((prev) => ({
      ...prev,
      isExternal,
      status:
        isExternal && prev.status !== 'present' && prev.status !== 'unmarked'
          ? 'unmarked'
          : prev.status,
    }));
  }

  /** 컬럼 설정에서 비고 열을 지웠는지. 지웠으면 표와 참가자 추가 창에 비고가 없다. */
  const isMemoHidden = isBaseColumnHidden(selectedEvent, 'MEMO');

  /** 출석 표의 출결 열(컨퍼런스 1차·2차, 일반 행사형의 행사별 열). */
  const statusColumns = statusColumnsOf(selectedEvent, isExternalSheet);
  /**
   * 정해진 출결 값(출석·지각 …)을 쓰는 출결 열이 있는지. 출결 통계·출결 필터·빠른 추가의 출석 상태가 이 값을 쓴다.
   * 기타 방식은 백엔드가 보낸 출결 값(custom 열)만 있거나 출결 열이 아예 없다.
   */
  const hasStatusColumns = statusColumns.some((column) => column.kind !== 'custom');
  /** 출결 컬럼 기본 너비: 버튼 수 × (버튼 너비 + 간격) + 묶음 테두리·칸 여백. */
  const customColumn = statusColumns.find((column) => column.kind === 'custom');
  // 기타 방식 출결은 출결 코드 뒤에 미정 버튼이 하나 더 있다.
  const statusButtonCount = customColumn
    ? customColumn.options.length + 1
    : isExternalSheet
      ? 2
      : statusOptionsOf(eventFormat).length;
  const defaultStatusWidth = statusButtonCount * (STATUS_BTN_WIDTH + 2) + 24;

  const toggledColumnKeys = toggledColumnsByEvent[selectedEvent.id] ?? [];
  /** 출결 열의 열고 닫기 key. 컨퍼런스 외부 참석자 시트는 처음 상태가 달라 따로 둔다. */
  const statusToggleKey = (column: StatusColumn) =>
    isExternalSheet ? `external_${column.key}` : column.key;
  /**
   * 처음에 닫혀 있는 출결 열: 일반 행사형의 행사 열, 컨퍼런스 내부 시트의 1차·2차 출결.
   * 나머지 출결 열은 처음에 열려 있다. 모든 출결 열은 머리글을 눌러 열고 닫는다.
   */
  const isCollapsedByDefault = (column: StatusColumn) =>
    column.kind === 'session' ||
    (isConferenceEvent && !isExternalSheet && (column.kind === 'main' || column.kind === 'second'));
  const isColumnCollapsed = (column: StatusColumn) =>
    isCollapsedByDefault(column) !== toggledColumnKeys.includes(statusToggleKey(column));
  /** 선택 컬럼(뒤풀이 비용 O/X 등)은 처음에 열려 있고, 닫으면 고른 값만 글자로 보여 준다. */
  const isExtraColumnCollapsed = (cf: CustomFormField) =>
    isSelectColumn(cf) && toggledColumnKeys.includes(`custom_${cf.id}`);
  /** 출결 코드를 입력할 수 있는(열려 있는) 출결 열. 단축키는 이 중 첫 열에 들어간다(기타 방식 열은 제외). */
  const editableStatusColumns = statusColumns.filter(
    (column) => column.kind !== 'custom' && !isColumnCollapsed(column),
  );

  /**
   * 참가자 글자 칸을 고친다. 일괄 수정·행 수정 중이면 저장 전 수정본에 담고(그 탭의 일괄 저장 때 저장),
   * 아니면(기타 방식의 바로 입력) 곧바로 저장한다.
   */
  function applyAttendeeEdit(attendeeId: string, update: (a: AttendeeRecord) => AttendeeRecord) {
    if (isTableEditMode || editingRowId === attendeeId) {
      setDrafts((prev) => {
        const base = prev[attendeeId] ?? attendees.find((a) => a.id === attendeeId);
        return base ? { ...prev, [attendeeId]: update(base) } : prev;
      });
      return;
    }
    setAttendees((prev) => prev.map((a) => (a.id === attendeeId ? update(a) : a)));
  }

  /** 추가 컬럼 값을 바꾼다. 소속·연락처·이메일·구분 컬럼은 참가자 정보에도 함께 적는다. */
  function updateExtraField(attendeeId: string, cf: CustomFormField, newVal: string) {
    applyAttendeeEdit(attendeeId, (a) => ({
      ...a,
      affiliation: cf.label.includes('소속') ? newVal : a.affiliation,
      phone: cf.label.includes('전화') || cf.label.includes('연락처') ? newVal : a.phone,
      email: cf.label.includes('메일') ? newVal : a.email,
      isExternal: cf.label.includes('구분') ? newVal.includes('외') : a.isExternal,
      customAnswers: { ...(a.customAnswers || {}), [cf.id]: newVal, [cf.label]: newVal },
    }));
  }

  /** 참가자의 한 칸(이름·비고)을 바꾼다. */
  function updateAttendeeText(attendeeId: string, field: 'name' | 'memo', value: string) {
    applyAttendeeEdit(attendeeId, (a) => ({ ...a, [field]: value }));
  }

  /** 저장 전 수정본을 저장한다(그 사람들만). 출결은 수정본이 아니라 지금 값을 그대로 둔다. */
  function commitDrafts(attendeeIds: readonly string[]) {
    const ids = attendeeIds.filter((id) => drafts[id]);
    if (ids.length > 0) {
      setAttendees((prev) =>
        prev.map((a) => (ids.includes(a.id) ? withDraftText(a, drafts[a.id]) : a)),
      );
    }
    setDrafts((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => !attendeeIds.includes(id))),
    );
  }

  /** 지금 탭(컨퍼런스는 보고 있는 시트)의 참가자 id. */
  function currentTabAttendeeIds(): string[] {
    return currentEventAttendees
      .filter((a) => !isConferenceEvent || sheetOf(a) === conferenceSheet)
      .map((a) => a.id);
  }

  /** 지금 탭의 일괄 수정을 켜고 끈다. 끌 때(일괄 저장) 이 탭 사람들의 수정본만 저장한다. */
  function toggleTableEditMode() {
    if (!isTableEditMode) {
      setEditingRowId(null);
      setEditModeKeys((prev) => [...prev, editModeKey]);
      return;
    }
    finishTabEditing();
  }

  /** 기타 방식 출결을 미정(고르지 않음)으로 되돌린다. */
  function clearCustomStatus(attendeeId: string) {
    patchAttendee(attendeeId, (a) => {
      if (a.customStatus === undefined) return a;
      return withoutKeys(a, 'customStatus');
    });
  }

  /** 기타 방식 출결을 바꾼다. 이미 고른 값을 다시 누르면 비운다(미정). */
  function changeCustomStatus(attendeeId: string, code: string) {
    patchAttendee(attendeeId, (a) => withCustomStatus(a, code));
  }
  const statusColumnWidth = (column: StatusColumn) =>
    isColumnCollapsed(column)
      ? COLLAPSED_STATUS_WIDTH
      : colWidths[column.key] || defaultStatusWidth;

  /** 열(출결 열은 statusToggleKey, 선택 컬럼은 custom_ id)을 열고 닫는다. */
  function toggleColumnCollapsed(toggleKey: string) {
    setToggledColumnsByEvent((prev) => {
      const current = prev[selectedEvent.id] ?? [];
      const next = current.includes(toggleKey)
        ? current.filter((key) => key !== toggleKey)
        : [...current, toggleKey];
      return { ...prev, [selectedEvent.id]: next };
    });
  }

  /** 추가 컬럼 기본 너비. 선택 컬럼(O/X 등)은 버튼이 들어가는 너비다. */
  function defaultExtraColWidth(cf: CustomFormField) {
    return isSelectColumn(cf)
      ? Math.max(140, (cf.options?.length ?? 0) * (STATUS_BTN_WIDTH + 2) + 24)
      : 140;
  }

  /** 추가 컬럼 너비. 닫힌 선택 컬럼은 고른 값만 보이므로 좁다. */
  function extraColWidth(cf: CustomFormField) {
    return isExtraColumnCollapsed(cf)
      ? COLLAPSED_STATUS_WIDTH
      : colWidths[`custom_${cf.id}`] || defaultExtraColWidth(cf);
  }

  /** 출결 필터: 이 행사(외부 참석자 시트는 그 시트)에서 고를 수 있는 출결 값만 보여 준다. */
  const attendStatusFilterOptions: readonly FilterDropdownOption<'ALL' | AttendStatus>[] = [
    { value: 'ALL', label: '전체' },
    ...statusOptionsOf(eventFormat)
      .filter((option) => availableStatuses.includes(option.value))
      .map((option) => ({ value: option.value, label: option.label })),
  ];

  function isStatusAllowed(att: AttendeeRecord, status: AttendStatus) {
    return statusOptionsFor(att).some((option) => option.value === status);
  }

  /** 한 출결 열의 값을 바꾼다. 체크인 시각은 첫 출결(status)에만 남긴다. */
  function changeColumnStatus(attendeeId: string, column: StatusColumn, status: AttendStatus) {
    const timeNow = new Date().toTimeString().slice(0, 5);
    // 한 사람의 출결만 바꾸므로 바뀐 칸만 부분 저장(PATCH)한다.
    patchAttendee(attendeeId, (a) => {
      const updated = withStatusIn(a, column, status);
      if (column.kind !== 'main') {
        return updated;
      }
      const isCheckedIn = status === 'present' || status === 'late' || status === 'unexcusedLate';
      return {
        ...updated,
        checkedInAt: isCheckedIn ? (a.checkedInAt === '-' ? timeNow : a.checkedInAt) : '-',
      };
    });
  }

  // ─── 단축키: 방식별 출결 코드 키(첫 번째 출결 열), ↑/↓ 이동 ───
  useEffect(() => {
    if (
      subTab !== 'live' ||
      !isKeyboardModeActive ||
      editingEvent ||
      showQuickAddDrawer ||
      isDropdownOpen
    ) {
      return;
    }

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') {
        return;
      }

      if (filteredAttendees.length === 0) {
        return;
      }

      const currentTarget = filteredAttendees[focusedIndex];
      if (!currentTarget) {
        return;
      }

      // 출결 코드 키(방식별 코드, 컨퍼런스는 1차 출결)를 누르면 그 값으로 바꾸고 다음 사람으로 넘어간다.
      const keyStatus =
        e.ctrlKey || e.metaKey || e.altKey ? undefined : statusOfKey(eventFormat, e.key);
      if (keyStatus && isStatusAllowed(currentTarget, keyStatus)) {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, keyStatus);
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredAttendees.length - 1));
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // changeStatusAndMoveNext only reads filteredAttendees.length, which is already tracked above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    eventFormat,
    subTab,
    isKeyboardModeActive,
    focusedIndex,
    filteredAttendees,
    editingEvent,
    showQuickAddDrawer,
    isDropdownOpen,
  ]);

  /** 열려 있는 첫 출결 열을 바꾸고 다음 사람으로 넘어간다(단축키·그 열 클릭). 모두 닫혀 있으면 하지 않는다. */
  function changeStatusAndMoveNext(attendeeId: string, status: AttendStatus) {
    const column = editableStatusColumns[0];
    if (!column) {
      return;
    }
    changeColumnStatus(attendeeId, column, status);
    setFocusedIndex((prev) => Math.min(prev + 1, filteredAttendees.length - 1));
  }

  /** 텍스트의 줄과 첫 줄(머리글 후보), 그리고 첫 줄이 머리글인지를 읽는다. */
  function readRosterHeader(text: string) {
    const lines = text.trim().split(/\r?\n/);
    const rawHeaderTokens = (
      lines[0].includes('\t') ? lines[0].split('\t') : lines[0].split(',')
    ).map((t) => t.trim().replace(/^"|"$/g, ''));

    const hasHeader = rawHeaderTokens.some(
      (t) =>
        t.includes('이름') ||
        t.includes('성명') ||
        t.toLowerCase().includes('name') ||
        t.includes('소속') ||
        t.includes('전화') ||
        t.includes('팀') ||
        t.includes('구분') ||
        t.includes('메일'),
    );
    return { lines, rawHeaderTokens, hasHeader };
  }

  /**
   * 올린 CSV의 머리글을 표 컬럼으로 바꾼다. 이름·번호·출결·비고처럼 표에 이미 있는 열은 뺀다.
   * 머리글이 없는 파일이면 추가 컬럼이 없다.
   */
  function rosterColumnsFromText(
    text: string,
    statusHeaders: readonly string[] = [],
  ): {
    fields: CustomFormField[];
    statusColumnIndex?: number;
  } {
    if (!text.trim()) {
      return { fields: [] };
    }
    const { rawHeaderTokens, hasHeader } = readRosterHeader(text);
    if (!hasHeader) {
      return { fields: [] };
    }
    // 출결 열은 표의 글자 컬럼으로 만들지 않는다. 방식별 양식의 출결 열(예: 신입 OT의 출석)도 포함한다.
    const statusLabels = ['출결', '출석상태', '출석 상태', ...statusHeaders];
    const nameLabels = ['이름', '성명'];
    // 출결 특이사항은 별도 컬럼으로 만들지 않고 비고에 담는다.
    const fixedLabels = ['번호', ...nameLabels, ...MEMO_LABELS, ...statusLabels];
    const labels: string[] = [];
    let statusColumnIndex: number | undefined;
    rawHeaderTokens.forEach((label) => {
      // 출결 열이 오는 자리 = 그 앞에 나온 추가 컬럼 수.
      if (statusLabels.includes(label) && statusColumnIndex === undefined) {
        statusColumnIndex = labels.length;
      }
      const isFixed =
        !label ||
        fixedLabels.includes(label) ||
        label.startsWith('출석코드') ||
        label.toLowerCase() === 'name';
      if (!isFixed && !labels.includes(label)) {
        labels.push(label);
      }
    });
    const fields = labels.map((label, idx): CustomFormField => ({
      id: `cf_${Date.now()}_${idx}`,
      label,
      ...(OX_COLUMN_LABELS.includes(label)
        ? { type: 'SELECT' as const, options: [...OX_OPTIONS] }
        : { type: 'TEXT' as const }),
      isRequired: false,
      target: 'ALL',
    }));
    return { fields, statusColumnIndex };
  }

  /** CSV/붙여넣기 텍스트를 그 행사 기준의 참가자 목록으로 바꾼다. */
  function parseRosterText(text: string, event: AttendanceEvent): ParsedRosterItem[] {
    if (!text.trim()) {
      return [];
    }

    const { lines, rawHeaderTokens, hasHeader } = readRosterHeader(text);
    if (lines.length === 0) {
      return [];
    }

    const headerMap: Record<number, string> = {};
    if (hasHeader) {
      rawHeaderTokens.forEach((t, i) => {
        headerMap[i] = t;
      });
    }

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const parsed: ParsedRosterItem[] = [];

    for (const rawLine of dataLines) {
      if (!rawLine.trim()) {
        continue;
      }
      const tokens = (rawLine.includes('\t') ? rawLine.split('\t') : rawLine.split(',')).map((t) =>
        t.trim().replace(/^"|"$/g, ''),
      );

      if (tokens.length === 0 || !tokens[0]) {
        continue;
      }

      let name = '';
      // 소속을 모르면 비워 둔다(지어낸 값을 넣지 않는다).
      let affiliation = '';
      let email = '';
      let phone = '';
      let isExt = false;
      let term: number | undefined;
      const memoParts: string[] = [];
      const customAnswers: Record<string, string> = {};

      const eventCols = event.customFields || [];

      tokens.forEach((val, idx) => {
        if (!val) {
          return;
        }
        const colHeader = headerMap[idx] || (eventCols[idx] ? eventCols[idx].label : `col_${idx}`);

        if (MEMO_LABELS.includes(colHeader)) {
          memoParts.push(val);
          return;
        }
        customAnswers[colHeader] = val;

        const matchedField = eventCols.find(
          (f) =>
            f.label.toLowerCase() === colHeader.toLowerCase() ||
            colHeader.includes(f.label) ||
            f.label.includes(colHeader),
        );
        if (matchedField) {
          customAnswers[matchedField.id] = val;
          customAnswers[matchedField.label] = val;
        }

        if (
          colHeader === '이름' ||
          colHeader.includes('이름') ||
          colHeader.includes('성명') ||
          colHeader.toLowerCase().includes('name')
        ) {
          name = val;
        } else if (colHeader === '기수' || colHeader.includes('기수')) {
          // '27기', '27' 모두 받는다.
          const parsedTerm = Number.parseInt(val.replace(/[^0-9]/g, ''), 10);
          term = Number.isNaN(parsedTerm) ? undefined : parsedTerm;
        } else if (
          colHeader.includes('소속') ||
          colHeader.includes('대학') ||
          colHeader.includes('회사') ||
          colHeader.includes('트랙')
        ) {
          affiliation = val;
        } else if (colHeader.includes('메일') || colHeader.toLowerCase().includes('email')) {
          email = val;
        } else if (
          colHeader.includes('전화') ||
          colHeader.includes('연락처') ||
          colHeader.toLowerCase().includes('phone')
        ) {
          phone = val;
        } else if (colHeader.includes('구분') || colHeader.includes('타입')) {
          isExt = val.includes('외') || val.toLowerCase().includes('ext');
        }
      });

      if (!name && tokens[0]) {
        name = tokens[0];
      }

      if (name) {
        if (!isExt && event.allowExternal) {
          isExt =
            affiliation.includes('외') ||
            affiliation.includes('카카오') ||
            affiliation.includes('네이버') ||
            affiliation.includes('기업') ||
            !affiliation.includes('기');
        }
        parsed.push({
          name,
          affiliation,
          email,
          phone,
          isExternal: isExt,
          term,
          ...(memoParts.length > 0 ? { memo: memoParts.join(' / ') } : {}),
          customAnswers,
        });
      }
    }

    return parsed;
  }

  function toAttendeeRecords(
    items: ParsedRosterItem[],
    eventId: string,
    idPrefix: string,
  ): AttendeeRecord[] {
    return items.map((item, idx) => {
      const record: AttendeeRecord = {
        id: `${idPrefix}_${Date.now()}_${idx}`,
        eventId,
        isExternal: item.isExternal,
        name: item.name,
        affiliation: item.affiliation,
        term: item.term,
        email: item.email,
        phone: item.phone,
        status: item.status ?? ('unmarked' as AttendStatus),
        ...(item.secondStatus ? { secondStatus: item.secondStatus } : {}),
        checkedInAt: '-',
        ...(item.memo ? { memo: item.memo } : {}),
        ...(item.sessionStatuses ? { sessionStatuses: item.sessionStatuses } : {}),
        customAnswers: item.customAnswers || {},
      };
      // 회원 DB에서 찾은 사람은 그 회원으로 연결하고 이름·기수·부문을 회원 DB 값으로 맞춘다.
      return item.member
        ? withMemberIdentity({ ...record, userId: item.member.userId }, item.member)
        : record;
    });
  }

  /**
   * 올린 명단의 사람들을 백엔드 API로 회원 DB에서 찾아 연결한다.
   * 확인하지 못하면 연결 없이 그대로 두고 알린다(이때는 모두 고칠 수 있는 상태다).
   */
  async function linkRosterMembers(roster: ParsedRosterItem[]): Promise<ParsedRosterItem[]> {
    try {
      const matches = await lookupMembers(roster);
      // 이전 기수는 회원 DB에 없을 수 있다. 현재 활동 기수인데 없으면 오타일 수 있어 따로 표시한다.
      const activeTerms = semesterMemberTerms?.get(selectedCohort);
      return roster.map((item, idx) => {
        const member = matches[idx];
        const memberCheck = memberCheckOf(item, member, activeTerms);
        return member
          ? { ...item, member, memberCheck, name: member.name, term: member.term }
          : { ...item, memberCheck };
      });
    } catch {
      alert(
        '회원 DB를 확인하지 못해 회원 연결 없이 명단을 올렸습니다. 이름·기수·부문을 직접 확인해 주세요.',
      );
      return roster;
    }
  }

  /** 신입 특칙형·컨퍼런스 파일의 출결 열 값을 출결로 읽고, 그 열은 추가 컬럼 값에서 뺀다. */
  function withImportedStatuses(
    item: ParsedRosterItem,
    statusHeaders: readonly string[],
  ): ParsedRosterItem {
    if (statusHeaders.length === 0) {
      return item;
    }
    const { status, secondStatus } = importedStatusesOf(newEventFormat, item.customAnswers);
    const customAnswers = Object.fromEntries(
      Object.entries(item.customAnswers).filter(([key]) => !statusHeaders.includes(key)),
    );
    return {
      ...item,
      customAnswers,
      ...(status ? { status } : {}),
      ...(secondStatus ? { secondStatus } : {}),
    };
  }

  /**
   * 일반 행사형 파일은 이름 뒤의 열(MT, 해커톤 …)을 행사별 출결 열로 쓴다.
   * 그 열의 출결 코드를 출결 값으로 바꾸고, 추가 컬럼에서는 뺀다. 빈칸이나 알 수 없는 코드는 기록하지 않는다.
   */
  function splitGeneralSessions(
    text: string,
    roster: ParsedRosterItem[],
    fields: CustomFormField[],
  ) {
    const sessions = sessionLabelsFromHeader(readRosterHeader(text).rawHeaderTokens);
    if (sessions.length === 0) {
      return { sessions, roster, fields };
    }
    const sessionRoster = roster.map((item) => {
      const sessionStatuses: Record<string, AttendStatus> = {};
      const customAnswers = { ...item.customAnswers };
      sessions.forEach((session) => {
        const status = statusOfKey('GENERAL', (customAnswers[session] ?? '').trim());
        if (status) {
          sessionStatuses[session] = status;
        }
        delete customAnswers[session];
      });
      return { ...item, sessionStatuses, customAnswers };
    });
    return {
      sessions,
      roster: sessionRoster,
      fields: fields.filter((field) => !sessions.includes(field.label)),
    };
  }

  /** 출석 표 컬럼은 그 방식의 첫 칸(컨퍼런스는 현재 활동기수) 파일 머리글로 만든다. */
  function isColumnSourceSlot(slot: RosterSlot) {
    return eventFormatOptionOf(newEventFormat).slots[0].id === slot.id;
  }

  /** 새 행사 등록 창에서 고른 CSV를 읽어, 행사를 만들 때 함께 등록할 명단으로 담아 둔다. */
  function handleNewEventCsvUpload(slot: RosterSlot, file: File) {
    if (!editingEvent) {
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = String(evt.target?.result ?? '');
      const parsedRoster = parseRosterText(text, editingEvent).map((item) => ({
        ...item,
        isExternal: slot.isExternal,
      }));
      if (parsedRoster.length === 0) {
        alert('CSV에서 읽을 수 있는 명단이 없습니다. 이름 열이 있는지 확인해 주세요.');
        clearNewEventCsv(slot);
        return;
      }
      // 올린 파일의 머리글대로 이 행사의 출석 표 컬럼을 구성한다.
      const statusHeaders = STATUS_HEADERS_BY_FORMAT[newEventFormat];
      const columns = rosterColumnsFromText(text, statusHeaders);
      const {
        sessions,
        roster: fileRoster,
        fields,
      } = newEventFormat === 'GENERAL'
        ? splitGeneralSessions(text, parsedRoster, columns.fields)
        : {
            sessions: [],
            roster: parsedRoster.map((item) => withImportedStatuses(item, statusHeaders)),
            fields: columns.fields,
          };
      // 회원 DB에 있는 사람(이름·기수가 같은 회원)은 올릴 때 연결해 둔다.
      const roster = await linkRosterMembers(fileRoster);
      setNewEventUploads((prev) => ({ ...prev, [slot.id]: { fileName: file.name, roster } }));
      if (isColumnSourceSlot(slot)) {
        // 행사 열이 있으면 출결 열은 맨 끝(이름 뒤)이다.
        const statusColumnIndex = sessions.length > 0 ? undefined : columns.statusColumnIndex;
        setEditingEvent((prev) =>
          prev
            ? {
                ...prev,
                customFields: fields,
                statusColumnIndex,
                sessionLabels: sessions.length > 0 ? sessions : undefined,
              }
            : prev,
        );
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function clearNewEventCsv(slot: RosterSlot) {
    setNewEventUploads((prev) => withoutKeys(prev, slot.id));
    if (isColumnSourceSlot(slot)) {
      clearNewEventColumns();
    }
  }

  /** 올린 파일을 모두 비운다(새 행사 등록에서는 컬럼을 직접 추가하지 않으므로 파일에서 만든 컬럼도 비운다). */
  function clearAllNewEventCsv() {
    setNewEventUploads({});
    clearNewEventColumns();
  }

  function clearNewEventColumns() {
    setEditingEvent((prev) =>
      prev && isNewEvent
        ? { ...prev, customFields: [], statusColumnIndex: undefined, sessionLabels: undefined }
        : prev,
    );
  }

  /** 방식마다 받는 파일 양식이 다르므로, 방식을 바꾸면 올린 파일을 비운다. */
  function handleChangeNewEventFormat(format: EventAttendanceFormat) {
    if (format === newEventFormat) {
      return;
    }
    setNewEventFormat(format);
    clearAllNewEventCsv();
    // 외부 참석자를 받는 방식은 컨퍼런스뿐이다.
    setEditingEvent((prev) =>
      prev ? { ...prev, attendanceFormat: format, allowExternal: format === 'CONFERENCE' } : prev,
    );
  }

  function handleQuickAddSubmit() {
    // 이름이 비었거나 형식이 틀린 칸이 있으면 추가하지 않는다(칸 아래에 빨갛게 고치는 방법을 보여 준다).
    if (!quickAdd.name.trim() || Object.keys(quickAddFieldErrors).length > 0) {
      setHasTriedQuickAdd(true);
      return;
    }

    // 외부 참석자 양식은 이름·출석·비고만 받으므로 추가 컬럼 값은 저장하지 않는다.
    const answers = isQuickAddExternal ? {} : { ...quickAdd.customAnswers };
    if (quickAdd.affiliation && !answers['소속']) {
      answers['소속'] = quickAdd.affiliation.trim();
    }
    if (quickAdd.phone && !answers['연락처']) {
      answers['연락처'] = quickAdd.phone.trim();
    }
    if (quickAdd.email && !answers['이메일']) {
      answers['이메일'] = quickAdd.email.trim();
    }

    // 기수 칸에 적은 숫자를 참가자 기수로도 적는다(기수 필터가 이 값을 쓴다). 표의 기수 칸에는 'N기'로 적는다.
    const termEntries = Object.entries(answers).filter(([key]) => isTermLabel(key));
    const termDigits = termEntries.map(([, value]) => value.trim()).find(Boolean);
    const term = termDigits ? Number.parseInt(termDigits, 10) : undefined;
    for (const [key] of termEntries) {
      answers[key] = term === undefined ? '' : `${term}기`;
    }

    const newRec: AttendeeRecord = {
      id: `att_quick_${Date.now()}`,
      eventId: selectedEvent.id,
      isExternal: isQuickAddExternal,
      name: quickAdd.name.trim(),
      ...(term === undefined ? {} : { term }),
      affiliation: isQuickAddExternal
        ? '외부 게스트'
        : answers['소속'] || quickAdd.affiliation.trim() || 'BOAZ 28기',
      email: isQuickAddExternal ? '' : answers['이메일'] || quickAdd.email.trim(),
      phone: isQuickAddExternal ? '' : answers['연락처'] || quickAdd.phone.trim(),
      status: quickAdd.status,
      // 컨퍼런스 내부 참가자는 2차 출결도 받는다(외부 참석자는 1차·2차를 나누지 않는다).
      ...(selectedEvent.attendanceFormat === 'CONFERENCE' && !isQuickAddExternal
        ? { secondStatus: 'unmarked' as AttendStatus }
        : {}),
      checkedInAt:
        quickAdd.status === 'present' || quickAdd.status === 'late'
          ? new Date().toTimeString().slice(0, 5)
          : '-',
      memo: quickAdd.memo?.trim() || '',
      customAnswers: answers,
    };

    // 명단 전체를 다시 보내지 않고 한 명 추가(POST)로 저장한다.
    createAttendee(newRec);
    setQuickAdd({
      isExternal: false,
      name: '',
      affiliation: '',
      email: '',
      phone: '',
      memo: '',
      status: 'unmarked',
      customAnswers: {},
    });
    setHasTriedQuickAdd(false);
    setShowQuickAddDrawer(false);
  }

  // Simple comma-separated column input state (for extra columns)
  function handleAddCustomColumn(name: string) {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    // 출결·비고 이름으로 추가하면 지운 기본 열을 되살린다(출결은 버튼 열로 다시 나온다).
    const baseColumn = baseColumnOfName(trimmed);
    if (baseColumn) {
      setEditingEvent((prev) => (prev ? withBaseColumnHidden(prev, baseColumn, false) : prev));
      setNewColInputText('');
      return;
    }
    if (trimmed === NAME_COLUMN_NAME) {
      return;
    }
    const newField: CustomFormField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: trimmed,
      type: 'TEXT',
      isRequired: false,
      target: 'ALL',
    };
    setEditingEvent((prev) => {
      if (!prev || (prev.customFields || []).some((field) => field.label === trimmed)) {
        return prev;
      }
      return { ...prev, customFields: [...(prev.customFields || []), newField] };
    });
    setNewColInputText('');
  }

  /** 컬럼 삭제 확인. 저장하면 그 열에 입력한 값도 함께 지워진다. */
  function confirmColumnRemoval(label: string, note = ''): boolean {
    return window.confirm(
      `'${label}' 컬럼을 정말 삭제할까요?${note}\n저장하면 이 컬럼에 입력한 값도 함께 지워지며, 더 이상 되돌릴 수 없습니다.`,
    );
  }

  /**
   * 컬럼 설정 창에서 출결 열(1차·2차·행사별 열)이나 비고를 지운다.
   * 같은 이름(출결·2차 출결·비고)으로 컬럼을 추가하면 빈 열로 되살아난다.
   */
  function handleRemoveTableColumn(column: TableColumn) {
    if (!editingEvent || column.kind === 'name' || column.kind === 'field') {
      return;
    }
    const note = column.kind === 'status' ? statusColumnRemovalNote(column.status) : '';
    if (!confirmColumnRemoval(column.label, note)) {
      return;
    }
    setEditingEvent(
      column.kind === 'memo'
        ? withBaseColumnHidden(editingEvent, 'MEMO', true)
        : withStatusColumnRemoved(editingEvent, column.status),
    );
  }

  function handleRemoveCustomColumn(label: string) {
    if (!editingEvent || !confirmColumnRemoval(label)) {
      return;
    }
    setEditingEvent({
      ...editingEvent,
      customFields: (editingEvent.customFields || []).filter((f) => f.label !== label),
    });
  }

  function handleRenameCustomColumn(id: string, name: string) {
    const trimmed = name.trim();
    if (!editingEvent || !trimmed || isReservedColumnName(trimmed)) {
      return;
    }
    setEditingEvent((prev) => {
      if (
        !prev ||
        (prev.customFields || []).some((field) => field.id !== id && field.label === trimmed)
      ) {
        return prev;
      }
      return {
        ...prev,
        customFields: (prev.customFields || []).map((field) =>
          field.id === id ? { ...field, label: trimmed } : field,
        ),
      };
    });
  }

  function handleColDragStart(e: React.DragEvent, index: number) {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${index}`);
  }

  function handleColDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isLeftHalf = e.clientX < rect.left + rect.width / 2;
    const targetSlot = isLeftHalf ? index : index + 1;
    if (dropIndicatorIdx !== targetSlot) {
      setDropIndicatorIdx(targetSlot);
    }
  }

  function handleColDrop(e: React.DragEvent, targetSlot: number) {
    e.preventDefault();
    e.stopPropagation();
    if (draggedColIdx === null || !editingEvent) {
      setDraggedColIdx(null);
      setDropIndicatorIdx(null);
      return;
    }

    // 비고를 뺀 표 컬럼 순서 기준으로 옮긴다. 이름·출결 앞뒤를 넘으면 출결 열 자리(statusColumnIndex)도 바뀐다.
    const moved = movedTableColumn(editingEvent, draggedColIdx, targetSlot);
    if (moved) {
      setEditingEvent({ ...editingEvent, ...moved });
    }
    setDraggedColIdx(null);
    setDropIndicatorIdx(null);
  }

  function handleColDragEnd() {
    setDraggedColIdx(null);
    setDropIndicatorIdx(null);
  }

  function handleOpenNewEvent() {
    setIsNewEvent(true);
    setEventModalType('CREATE_FULL');
    setNewColInputText('');
    setNewEventFormat(DEFAULT_EVENT_FORMAT);
    clearAllNewEventCsv();
    setEditingEvent({
      id: 'evt_' + Date.now(),
      title: '',
      status: 'UPCOMING',
      date: '', // 일자·장소는 선택 입력이다
      startTime: '14:00',
      endTime: '18:00',
      location: '',
      description: '',
      attendanceFormat: DEFAULT_EVENT_FORMAT,
      allowExternal: DEFAULT_EVENT_FORMAT === 'CONFERENCE',
      checkinMethod: 'QR_CODE',
      checkinCode: String(Math.floor(1000 + Math.random() * 9000)),
      targetTerms: [selectedCohort],
      targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
      totalTargetCount: 50,
      internalAttendedCount: 0,
      externalAttendedCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [],
    });
  }

  // 1. 출석 체크 화면 톱니바퀴 -> 출석 컬럼 설정만 오픈.
  // 화면에 들고 있는 값이 아니라 서버의 지금 컬럼 구성을 읽어서 연다(다른 사람이 바꾼 컬럼도 보이게).
  const columnSettingsBaseRef = useRef<AttendanceEvent | null>(null);
  async function handleOpenColumnSettings(eventId: string) {
    let e: AttendanceEvent;
    try {
      e = await loadEvent(eventId);
    } catch (error) {
      alertApiError(error);
      return;
    }
    columnSettingsBaseRef.current = e;
    setIsNewEvent(false);
    setEventModalType('COLUMNS_ONLY');
    setNewColInputText('');
    const extraCols = (e.customFields || []).filter(
      (f) =>
        f.label !== '이름' &&
        f.label !== '비고' &&
        f.label !== '출석 상태' &&
        f.label !== '출석상태',
    );
    setEditingEvent({ ...e, customFields: [...extraCols] });
  }

  // 2. 전체 행사 목록 화면 톱니바퀴 -> 행사 기본 정보 수정만 오픈
  function handleOpenBasicInfoSettings(e: AttendanceEvent) {
    setIsNewEvent(false);
    setEventModalType('BASIC_INFO');
    setEditingEvent({ ...e });
  }

  function handleSaveEvent() {
    if (!editingEvent) {
      return;
    }
    if (eventModalType !== 'COLUMNS_ONLY' && !editingEvent.title.trim()) {
      alert('행사명을 입력하세요.');
      return;
    }

    if (isNewEvent) {
      // 컨퍼런스: 현재 활동기수 파일에 나온 기수를 대상 기수로 삼는다(명단 시트를 나누는 기준).
      const currentCohortTerms =
        newEventFormat === 'CONFERENCE'
          ? (newEventUploads.CURRENT_COHORT?.roster ?? []).flatMap((item) =>
              item.term === undefined ? [] : [item.term],
            )
          : [];
      const createdEvent =
        currentCohortTerms.length > 0
          ? {
              ...editingEvent,
              targetTerms: [...new Set([...editingEvent.targetTerms, ...currentCohortTerms])].sort(
                (a, b) => a - b,
              ),
            }
          : editingEvent;
      // 지금 방식의 칸에 올린 명단만 칸 순서대로 합쳐 등록한다.
      const roster = eventFormatOptionOf(newEventFormat).slots.flatMap(
        (slot) => newEventUploads[slot.id]?.roster ?? [],
      );
      // 컨퍼런스 내부 참가자는 2차 출결도 받는다(외부 참석자는 1차·2차를 나누지 않는다).
      const records = toAttendeeRecords(roster, editingEvent.id, 'att_new').map((record) =>
        newEventFormat === 'CONFERENCE' && !record.isExternal
          ? { ...record, secondStatus: record.secondStatus ?? ('unmarked' as AttendStatus) }
          : record,
      );
      setEvents((prev) => [createdEvent, ...prev]);
      if (records.length > 0) {
        setAttendees((prev) => [...records, ...prev]);
      }
      clearAllNewEventCsv();
      setSelectedEventId(editingEvent.id);
    } else {
      // 컬럼 설정은 창을 열 때 서버에서 읽은 행사와 비교한다(지운 열의 값을 비우는 기준).
      const before =
        eventModalType === 'COLUMNS_ONLY' && columnSettingsBaseRef.current?.id === editingEvent.id
          ? columnSettingsBaseRef.current
          : events.find((e) => e.id === editingEvent.id);
      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? editingEvent : e)));
      // 컬럼 설정에서 지운 열(추가 컬럼·출결·비고)에 입력해 둔 값을 비운다.
      if (eventModalType === 'COLUMNS_ONLY' && before) {
        setAttendees((prev) => {
          const next = prev.map((a) =>
            a.eventId === editingEvent.id
              ? withRemovedColumnValuesCleared(before, editingEvent, a)
              : a,
          );
          return next.every((a, idx) => a === prev[idx]) ? prev : next;
        });
      }
    }
    setEditingEvent(null);
  }

  function handleDeleteEvent(evtId: string, title: string) {
    if (
      confirm(
        `'${title}' 행사를 삭제하시겠습니까?\n해당 행사의 출석 명단 데이터도 함께 삭제됩니다.`,
      )
    ) {
      setEvents((prev) => prev.filter((e) => e.id !== evtId));
      setAttendees((prev) => prev.filter((a) => a.eventId !== evtId));
      if (selectedEventId === evtId) {
        const remaining = cohortEvents.filter((e) => e.id !== evtId);
        if (remaining.length > 0) {
          setSelectedEventId(remaining[0].id);
        }
      }
    }
  }

  function handleExportEventCsv(evt: AttendanceEvent) {
    const evtAttendees = attendees.filter((a) => a.eventId === evt.id);
    const extraHeaders = (evt.customFields || [])
      .filter(
        (f) =>
          f.label !== '이름' &&
          f.label !== '비고' &&
          f.label !== '출석 상태' &&
          f.label !== '출석상태',
      )
      .map((f) => f.label);
    // 출결은 운영지원팀 명단 파일과 같은 코드로 적는다. 컨퍼런스는 1차·2차를 따로 적는다.
    const format = evt.attendanceFormat;
    const isConference = format === 'CONFERENCE';
    // 일반 행사형에서 여러 행사를 함께 관리하면 행사마다 출결 코드 열을 하나씩 적는다(기록 없음은 빈칸).
    const sessions = evt.sessionLabels ?? [];
    const isFreeform = usesFreeformColumns(format);
    // 기타 방식에서 백엔드가 출결 값을 보냈으면 출결 열 하나에 고른 값의 이름을 적는다.
    const customOptions = isFreeform ? (evt.statusOptions ?? []) : [];
    // 컬럼 설정에서 지운 출결·비고 열은 내보내지 않는다.
    const isStatusHidden = isBaseColumnHidden(evt, 'STATUS');
    const isMemoColumnHidden = isBaseColumnHidden(evt, 'MEMO');
    const statusHeaders = isStatusHidden
      ? []
      : isFreeform
        ? customOptions.length > 0
          ? ['출결']
          : []
        : isConference
          ? ['1차 출석 확인', '2차 출석 확인']
          : sessions.length > 0
            ? sessions
            : ['출석 코드', '출석 상태'];
    const statusValues = (a: AttendeeRecord): string[] =>
      isStatusHidden
        ? []
        : isFreeform
          ? customOptions.length > 0
            ? [customOptions.find((option) => option.code === a.customStatus)?.label ?? '미정']
            : []
          : isConference
            ? [
                statusCodeOf(format, a.status),
                a.secondStatus ? statusCodeOf(format, a.secondStatus) : '-',
              ]
            : sessions.length > 0
              ? sessions.map((session) => {
                  const status = a.sessionStatuses?.[session];
                  return status ? statusCodeOf(format, status) : '';
                })
              : [statusCodeOf(format, a.status), statusLabelOf(format, a.status)];
    const headers = [
      '번호',
      '이름',
      ...extraHeaders,
      ...statusHeaders,
      ...(isMemoColumnHidden ? [] : ['비고']),
    ];
    const rows = evtAttendees.map((a, idx) => {
      const extraVals = extraHeaders.map(
        (h) =>
          a.customAnswers?.[h] ||
          (h.includes('소속')
            ? a.affiliation
            : h.includes('구분')
              ? a.isExternal
                ? '외부인'
                : '부원'
              : h.includes('전화') || h.includes('연락처')
                ? a.phone
                : h.includes('메일')
                  ? a.email
                  : '') ||
          '-',
      );
      return [
        idx + 1,
        a.name,
        ...extraVals,
        ...statusValues(a),
        ...(isMemoColumnHidden ? [] : [a.memo || '-']),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `출석부_${evt.title}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function handleExportCsv() {
    handleExportEventCsv(selectedEvent);
  }

  return (
    <div
      // 시트 탭이 있으면 화면 높이를 채우고 아래 여백을 없애, 시트 탭 막대가 화면 맨 아래까지 닿게 한다
      // (헤더 3.5rem + 본문 위 여백 1.75rem을 뺀 높이).
      className={`space-y-6 w-full ${hasSheetTabs ? '-mb-7 flex min-h-[calc(100dvh-5.25rem)] flex-col' : ''}`}
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Breadcrumb & Navigation Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        {/* Breadcrumb Hierarchy - Standardized matching all pages */}
        <div className="flex items-center gap-2.5">
          {subTab === 'events' ? (
            <h1 className="text-xl font-bold tracking-tight text-slate-900">행사 전체 목록</h1>
          ) : (
            <>
              <Tooltip label="행사 전체 목록으로 돌아가기">
                <button
                  aria-label="행사 전체 목록으로 돌아가기"
                  type="button"
                  onClick={handleGoBackToList}
                  className="text-slate-500 hover:text-slate-900 font-bold transition-colors cursor-pointer text-xl tracking-tight flex items-center gap-1 group"
                >
                  <ChevronLeft
                    size={20}
                    className="text-slate-400 group-hover:text-slate-900 transition-colors stroke-[2.5]"
                  />
                  <span>행사 전체 목록</span>
                </button>
              </Tooltip>

              <span className="text-slate-300 font-bold text-base">/</span>

              {/* Click-Only Event Switcher Popover */}
              <div className="relative" ref={breadcrumbDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBreadcrumbMenuOpen((prev) => !prev)}
                  className="font-black text-slate-950 hover:text-slate-700 flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-lg sm:text-xl tracking-tight group"
                >
                  <span className="max-w-[320px] sm:max-w-[450px] truncate">
                    {selectedEvent.title}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
                      isBreadcrumbMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Popover Dropdown Menu */}
                {isBreadcrumbMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {sortedEvents.map((evt) => {
                        const isCur = evt.id === selectedEvent.id;

                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setSelectedEventId(evt.id);
                              setFocusedIndex(0);
                              setIsBreadcrumbMenuOpen(false);
                              window.history.replaceState(
                                {
                                  page: 'att-events',
                                  subTab: 'detail',
                                  eventId: evt.id,
                                  tab: subTab,
                                },
                                '',
                                window.location.href,
                              );
                            }}
                            className={`px-3.5 py-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                              isCur ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <p
                              className={`text-sm truncate min-w-0 ${isCur ? 'text-slate-950 font-bold' : 'text-slate-700 font-medium'}`}
                            >
                              {evt.title}
                            </p>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium">
                              {evt.date}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-3">
          {subTab === 'live' && (
            <>
              {/* CSV 저장 버튼: 아이콘만 있는 버튼(출결 관리의 CSV 추출 버튼과 같은 아이콘·모양) */}
              <Tooltip label="CSV 저장">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  aria-label="CSV 저장"
                  className="inline-flex size-9 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                >
                  <Download size={16} aria-hidden="true" />
                </button>
              </Tooltip>
            </>
          )}

          {/* 새 행사 생성은 행사 목록 화면에서만 한다 */}
          {subTab === 'events' && (
            <CreateButton label="행사" aria-label="새 행사" onClick={handleOpenNewEvent} />
          )}

          {/* 반기 선택은 맨 오른쪽에 둔다 */}
          <CohortSelect
            value={selectedCohort}
            cohorts={cohorts}
            labels={cohortLabels}
            canCreateNextSemester={canCreateNextSemester}
            onAdvanceSemester={onAdvanceSemester}
            onChange={(cohort) => {
              setSelectedCohort(cohort);
              const firstEvent = events
                .filter((event) => event.targetTerms.includes(cohort))
                .sort((a, b) => eventSortTime(b) - eventSortTime(a))[0];
              setSelectedEventId(firstEvent?.id ?? '');
              setSubTab('events');
              setIsBreadcrumbMenuOpen(false);
            }}
          />
        </div>
      </div>

      {/* ─── TAB 1: 현장 출석 체크 ─── */}
      {subTab === 'live' && (
        <div className={`space-y-4 ${hasSheetTabs ? 'flex flex-1 flex-col' : ''}`}>
          {/* Clean Inline Stats Text */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 py-1 px-1 text-xs text-slate-500 flex-wrap border-b border-slate-100 pb-3 font-medium">
            <div className="flex items-center gap-1">
              <span>총 등록</span>
              <span className="font-bold text-slate-900 text-sm">{totalRosterCount}명</span>
            </div>

            {/* 기타 방식은 출결 열이 없어 출결 통계를 보여 주지 않는다 */}
            {hasStatusColumns && (
              <>
                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>출석</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {presentCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>지각</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {lateCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>조퇴</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {earlyLeaveCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>결석</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {absentCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>인정결석</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {excusedAbsentCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>무단지각</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {unexcusedLateCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>무단결석</span>
                  <span className="font-bold text-slate-900 text-sm">
                    {unexcusedAbsentCount}
                    {countUnit}
                  </span>
                </div>

                <span className="text-slate-200 select-none">·</span>

                <div className="flex items-center gap-1">
                  <span>출석률</span>
                  <span className="font-bold text-slate-900 text-sm">{attendanceRate}%</span>
                </div>
              </>
            )}
          </div>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 기수 드롭다운 (API 연동 드롭다운). 외부 참석자 시트는 기수를 받지 않는다. */}
              {!isExternalSheet && (
                <FilterDropdown
                  ariaLabel="기수 필터"
                  title="기수"
                  value={activeTermFilter}
                  options={termFilterOptions}
                  onChange={(next) => {
                    setTermFilter(next);
                    setFocusedIndex(0);
                  }}
                />
              )}

              {/* 출결 상태 필터 드롭다운 (기수 바로 옆 배치). 출결 열이 없는 기타 방식에는 없다. */}
              {hasStatusColumns && (
                <FilterDropdown
                  ariaLabel="출결 필터"
                  title="출결"
                  value={activeStatusFilter}
                  options={attendStatusFilterOptions}
                  onChange={(next) => {
                    setAttendStatusFilter(next);
                    setFocusedIndex(0);
                  }}
                />
              )}

              {/* 트랙 및 구분 필터 캡슐. 컨퍼런스는 외부 참석자를 시트로 나누므로 '외부'가 없고, 외부 참석자 시트에는 부문이 없다. */}
              {!isExternalSheet && (
                <div className={SEGMENT_WRAP}>
                  {(isConferenceEvent
                    ? (['ALL', 'ANALYSIS', 'VISUALIZATION', 'ENGINEERING'] as const)
                    : (['ALL', 'ANALYSIS', 'VISUALIZATION', 'ENGINEERING', 'EXTERNAL'] as const)
                  ).map((cat) => {
                    const labelMap: Record<string, string> = {
                      ALL: '전체',
                      ANALYSIS: '분석',
                      VISUALIZATION: '시각화',
                      ENGINEERING: '엔지',
                      EXTERNAL: '외부',
                    };
                    return (
                      <button
                        key={cat}
                        onClick={() => {
                          setAttendeeCategoryFilter(cat);
                          setFocusedIndex(0);
                        }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                          attendeeCategoryFilter === cat
                            ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {labelMap[cat]}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* + 1명 현장 추가 버튼 */}
              <button
                type="button"
                onClick={() => setShowQuickAddDrawer(true)}
                className={`h-8 px-3 rounded-sm text-xs transition-colors hover:bg-[#dde5ee] active:bg-[#d1dae5] flex items-center justify-center gap-1.5 cursor-pointer ${ATTEND_STATUS_STYLES.unmarked.active}`}
              >
                <UserPlus size={13} />
                <span>+ 1명 현장 추가</span>
              </button>

              {/* 수정 모드 전환 버튼 (고정 너비/높이로 상태 전환 시 크기 완벽 일치) */}
              <button
                type="button"
                onClick={() => {
                  setIsTableEditMode((prev) => !prev);
                  setEditingRowId(null);
                }}
                className={`h-8 min-w-[124px] px-3 rounded-sm text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors hover:bg-[#dde5ee] active:bg-[#d1dae5] ${ATTEND_STATUS_STYLES.unmarked.active}`}
              >
                {isTableEditMode ? (
                  <>
                    <Check size={13} />
                    <span>수정 완료</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={13} />
                    <span>명단/비고 수정</span>
                  </>
                )}
              </button>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={attendeeSearch}
                  onChange={(e) => {
                    setAttendeeSearch(e.target.value);
                    setFocusedIndex(0);
                  }}
                  placeholder="참가자 검색..."
                  className="h-8 pl-7 pr-3 text-xs rounded-sm bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 outline-none w-40 font-mono shadow-2xs transition-colors hover:border-slate-400 focus:border-slate-500"
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div ref={tableContainerRef} className="overflow-x-auto select-none relative">
              <table className="text-xs min-w-full w-max table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: `${colWidths.index || 48}px` }} />
                  <col style={{ width: `${colWidths.name || 130}px` }} />
                  {(() => {
                    const renderCol = (cf: CustomFormField) => (
                      <col
                        key={cf.id}
                        style={{ width: `${colWidths[`custom_${cf.id}`] || 140}px` }}
                      />
                    );
                    return (
                      <>
                        {eventExtraCols.slice(0, statusColumnAt).map(renderCol)}
                        <col style={{ width: `${colWidths.status || 450}px` }} />
                        {eventExtraCols.slice(statusColumnAt).map(renderCol)}
                      </>
                    );
                  })()}
                  <col style={{ width: `${colWidths.memo || 240}px`, minWidth: '220px' }} />
                  <col style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }} />
                </colgroup>
                <thead className="bg-slate-50/80 select-none">
                  <tr className="border-b border-slate-200/70 divide-x divide-slate-200/70 text-slate-700 font-semibold text-[11px] whitespace-nowrap">
                    <th
                      style={{ width: `${colWidths.index || 48}px`, minWidth: '48px' }}
                      className="relative text-center px-2 py-2.5 text-slate-400 font-bold"
                    >
                      #
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'index', 40)}
                        onMouseEnter={(e) => {
                          if (!resizingColKey) {
                            setActiveHoverCol('index');
                            updateGuidelinePos(e.currentTarget);
                          }
                        }}
                        onMouseLeave={() => {
                          if (!resizingColKey) {
                            setActiveHoverCol(null);
                            setGuidelineX(null);
                          }
                        }}
                        className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                        title="열 너비 조절"
                      />
                    </th>
                    {(() => {
                      const renderExtraTh = (cf: CustomFormField) => {
                        const colKey = `custom_${cf.id}`;
                        const isCollapsed = isExtraColumnCollapsed(cf);
                        return (
                          <th
                            key={cf.id}
                            style={{
                              width: `${extraColWidth(cf)}px`,
                              minWidth: `${isCollapsed ? COLLAPSED_STATUS_WIDTH : 120}px`,
                            }}
                            className="relative text-center px-2 py-2.5 text-slate-800 font-bold"
                          >
                            {isSelectColumn(cf) ? (
                              // 선택 컬럼은 눌러서 열고 닫는다. 닫으면 고른 값만 글자로 보여 준다.
                              <ColumnToggleButton
                                label={cf.label}
                                isCollapsed={isCollapsed}
                                onToggle={() => toggleColumnCollapsed(colKey)}
                              />
                            ) : (
                              cf.label
                            )}
                            <div
                              onMouseDown={(e) => handleResizeStart(e, colKey, 70)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(colKey);
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className={`absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 ${isCollapsed ? 'hidden' : ''}`}
                              title="열 너비 조절"
                            />
                          </th>
                        );
                      };
                      const statusTh = statusColumns.map((column) => (
                        <th
                          key={column.key}
                          style={{
                            width: `${statusColumnWidth(column)}px`,
                            minWidth: `${isColumnCollapsed(column) ? COLLAPSED_STATUS_WIDTH : defaultStatusWidth}px`,
                          }}
                          className="relative text-center px-2 py-2.5 text-slate-900 font-bold"
                        >
                          {/* 출결 열은 눌러서 열고 닫는다. 닫으면 고른 출결만 글자로 보여 준다. */}
                          <ColumnToggleButton
                            label={column.label}
                            isCollapsed={isColumnCollapsed(column)}
                            onToggle={() => toggleColumnCollapsed(statusToggleKey(column))}
                          />
                          <div
                            onMouseDown={(e) =>
                              handleResizeStart(e, column.key, defaultStatusWidth)
                            }
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol(column.key);
                                updateGuidelinePos(e.currentTarget);
                              }
                            }}
                            onMouseLeave={() => {
                              if (!resizingColKey) {
                                setActiveHoverCol(null);
                                setGuidelineX(null);
                              }
                            }}
                            className={`absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 ${isColumnCollapsed(column) ? 'hidden' : ''}`}
                            title="열 너비 조절"
                          />
                        </th>
                      ));
                      return (
                        <>
                          {eventExtraCols.slice(0, statusColumnAt).map(renderExtraTh)}
                          <th
                            style={{ width: `${colWidths.name || 130}px`, minWidth: '110px' }}
                            className="relative text-center px-2 py-2.5 text-slate-900 font-bold"
                          >
                            이름
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'name', 70)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('name');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                          {statusTh}
                          {eventExtraCols.slice(statusColumnAt).map(renderExtraTh)}
                        </>
                      );
                    })()}
                    {!isMemoHidden && (
                      <th
                        style={{ width: `${colWidths.memo || 240}px`, minWidth: '220px' }}
                        className="relative text-center px-3 py-2.5 text-slate-700 font-bold"
                      >
                        비고
                      </th>
                    )}
                    {/* Fixed Sticky Right Action Column */}
                    <th
                      style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                      className="sticky right-0 top-0 bg-slate-200 z-20 px-2 py-3 w-20 min-w-[80px] max-w-[80px] text-center select-none border-l border-slate-300 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]"
                    >
                      <div className="flex items-center justify-center mx-auto">
                        <Tooltip label="컬럼 설정" align="end">
                          <button
                            aria-label="컬럼 설정"
                            type="button"
                            onClick={() => void handleOpenColumnSettings(selectedEvent.id)}
                            className="p-1 rounded-sm hover:bg-slate-200/70 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                          >
                            <Settings size={14} />
                          </button>
                        </Tooltip>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          (isMemoHidden ? 3 : 4) + statusColumns.length + eventExtraCols.length
                        }
                        className="py-16 text-center text-sm text-slate-400"
                      >
                        해당 조건의 참가자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((rowAttendee, idx) => {
                      // 저장 전 수정본이 있으면 글자 칸은 수정본으로 보여 준다(출결은 지금 값).
                      const att = drafts[rowAttendee.id]
                        ? withDraftText(rowAttendee, drafts[rowAttendee.id])
                        : rowAttendee;
                      const extraCols = eventExtraCols;
                      const isRowEditing = isTableEditMode || editingRowId === att.id;
                      // 기타 방식은 수정 모드 없이 엑셀처럼 칸을 눌러 바로 입력한다.
                      const isInlineEditing = usesFreeformColumns(eventFormat);
                      // 동아리 회원의 이름·기수·부문은 회원 DB 기준이라 수정 모드에서도 고칠 수 없다.
                      const isMember = isLinkedMember(att);

                      const renderExtraCell = (cf: CustomFormField) => {
                        const val = getAttendeeFieldValue(att, cf.label, cf.id);
                        const colKey = `custom_${cf.id}`;
                        const isLockedCell = isMember && MEMBER_IDENTITY_LABELS.includes(cf.label);

                        return (
                          <td
                            key={cf.id}
                            className="relative text-center px-2 py-1.5 h-[50px] text-slate-700"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isExtraColumnCollapsed(cf) ? (
                              // 닫힌 선택 컬럼: 고른 값만 글자로 보여 준다. 고르지 않았으면 -.
                              <div className="h-9 flex items-center justify-center">
                                {val ? (
                                  <span className="text-xs font-semibold text-slate-800">
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-300">-</span>
                                )}
                              </div>
                            ) : isSelectColumn(cf) ? (
                              // 선택 컬럼(예: 뒤풀이 비용 O/X)은 출결과 같은 버튼으로 고른다. 고른 값을 다시 누르면 비운다.
                              <div className="h-9 flex items-center justify-center">
                                <div
                                  role="radiogroup"
                                  aria-label={`${att.name} ${cf.label}`}
                                  className={STATUS_BTN_GROUP}
                                >
                                  {(cf.options ?? []).map((option) => {
                                    const isCurrent = val === option;
                                    return (
                                      <button
                                        key={option}
                                        type="button"
                                        role="radio"
                                        aria-checked={isCurrent}
                                        onClick={() => {
                                          const nextVal = isCurrent ? '' : option;
                                          // 한 사람의 한 칸만 바꾸므로 바뀐 값만 부분 저장(PATCH)한다.
                                          patchAttendee(att.id, (a) => ({
                                            ...a,
                                            customAnswers: {
                                              ...(a.customAnswers || {}),
                                              [cf.id]: nextVal,
                                              [cf.label]: nextVal,
                                            },
                                          }));
                                        }}
                                        className={`${STATUS_BTN} ${
                                          isCurrent ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                                        }`}
                                      >
                                        {option}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : isInlineEditing && !isLockedCell ? (
                              // 기타 방식: 칸을 누르면 바로 입력하고, 다른 곳을 누르면 저장한다.
                              <InlineEditableCell
                                value={val}
                                ariaLabel={`${att.name} ${cf.label}`}
                                onCommit={(next) => updateExtraField(att.id, cf, next)}
                              />
                            ) : isRowEditing && !isLockedCell ? (
                              <input
                                value={val}
                                onChange={(e) => updateExtraField(att.id, cf, e.target.value)}
                                placeholder={`${cf.label}`}
                                className="w-full text-center h-8 px-2.5 text-xs rounded-sm outline-none bg-white border border-slate-300 focus:border-slate-400 text-slate-800 placeholder:text-slate-400 shadow-2xs font-medium"
                              />
                            ) : (
                              <LockedOrPlainCell
                                isLocked={isLockedCell && (isRowEditing || isInlineEditing)}
                                onLockedClick={() => setNotice(MEMBER_LOCK_HINT)}
                                className="text-slate-700 font-medium"
                              >
                                {val || <span className="text-slate-300">-</span>}
                              </LockedOrPlainCell>
                            )}
                            <div
                              onMouseDown={(e) => handleResizeStart(e, colKey, 70)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(colKey);
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>
                        );
                      };
                      const statusCell = statusColumns.map((column) => {
                        // 컨퍼런스 외부 참석자는 1차·2차를 나누지 않으므로 2차 칸이 비어 있다.
                        const current = statusIn(att, column);
                        const hasValue = current !== undefined;
                        const options = statusOptionsFor(att);
                        const isCollapsed = isColumnCollapsed(column);
                        return (
                          <td
                            key={column.key}
                            className="relative text-center px-2 py-1.5 h-[50px]"
                          >
                            <div className="h-9 flex items-center justify-center">
                              {column.kind === 'custom' && isCollapsed ? (
                                // 닫힌 기타 방식 출결 열: 고른 출결 코드의 이름만 보여 준다. 고르지 않았으면 미정.
                                (() => {
                                  const picked = column.options.find(
                                    (option) => option.code === customStatusIn(att),
                                  );
                                  return picked ? (
                                    <span className="text-xs font-semibold text-slate-800">
                                      {picked.label}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-medium text-slate-400">미정</span>
                                  );
                                })()
                              ) : column.kind === 'custom' ? (
                                // 기타 방식: 행사에 저장된 출결 코드로 고른다(출결 버튼과 같은 크기, 중립 색).
                                // 맨 끝의 미정은 아무것도 고르지 않은 상태이며 기본값이다.
                                <div
                                  role="radiogroup"
                                  aria-label={`${att.name} ${column.label}`}
                                  className={STATUS_BTN_GROUP}
                                >
                                  {column.options.map((option) => {
                                    const isCurrent = customStatusIn(att) === option.code;
                                    return (
                                      <button
                                        key={option.code}
                                        type="button"
                                        role="radio"
                                        aria-checked={isCurrent}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          changeCustomStatus(att.id, option.code);
                                        }}
                                        className={`${STATUS_BTN} ${
                                          isCurrent ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={customStatusIn(att) === undefined}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      clearCustomStatus(att.id);
                                    }}
                                    className={`${STATUS_BTN} ${
                                      customStatusIn(att) === undefined
                                        ? OPTION_BTN_ACTIVE
                                        : OPTION_BTN_INACTIVE
                                    }`}
                                  >
                                    <span>미정</span>
                                  </button>
                                </div>
                              ) : isCollapsed ? (
                                // 닫힌 출결 열: 고른 출결만 글자로 보여 준다. 칸이 없으면(외부 참석자의 2차) -.
                                current === undefined ? (
                                  <span className="text-xs text-slate-300">-</span>
                                ) : (
                                  <span
                                    className={`text-xs font-semibold ${collapsedStatusTextClass(current)}`}
                                  >
                                    {statusLabelOf(eventFormat, current)}
                                  </span>
                                )
                              ) : hasValue ? (
                                <div
                                  role="radiogroup"
                                  aria-label={`${att.name} ${column.label}`}
                                  className={STATUS_BTN_GROUP}
                                >
                                  {options.map((option) => {
                                    const st = option.value;
                                    const isCurrent = current === st;
                                    const styleCfg = ATTEND_STATUS_STYLES[st];

                                    return (
                                      <button
                                        key={st}
                                        type="button"
                                        role="radio"
                                        aria-checked={isCurrent}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // 열려 있는 첫 출결 열은 단축키처럼 다음 사람으로 넘어간다.
                                          if (column.key === editableStatusColumns[0]?.key) {
                                            changeStatusAndMoveNext(att.id, st);
                                          } else {
                                            changeColumnStatus(att.id, column, st);
                                          }
                                        }}
                                        className={`${STATUS_BTN} ${
                                          isCurrent
                                            ? styleCfg?.active || ''
                                            : styleCfg?.inactive || ''
                                        }`}
                                      >
                                        <span>{option.label}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, column.key, defaultStatusWidth)
                              }
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(column.key);
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className={`absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 ${isCollapsed ? 'hidden' : ''}`}
                              title="열 너비 조절"
                            />
                          </td>
                        );
                      });

                      return (
                        <tr
                          key={att.id}
                          className={`transition-colors divide-x divide-slate-200 ${
                            isRowEditing ? 'bg-slate-50/90' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className="relative text-center px-3 py-2 h-[50px] text-slate-400 text-xs">
                            <div className="h-8 flex items-center justify-center">{idx + 1}</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'index', 40)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('index');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>

                          {/* 추가 컬럼과 출결 컬럼(CSV로 만든 행사는 CSV의 출결 열 자리) */}
                          {extraCols.slice(0, statusColumnAt).map(renderExtraCell)}
                          {/* 이름: 운영지원팀 명단처럼 출결 열 바로 앞에 둔다 */}
                          <td
                            className="relative text-center px-2 py-1.5 h-[50px] text-slate-900"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isInlineEditing && !isMember ? (
                              <InlineEditableCell
                                value={att.name}
                                isBold
                                ariaLabel={`${att.name || '참가자'} 이름`}
                                onCommit={(next) => updateAttendeeText(att.id, 'name', next)}
                              />
                            ) : isRowEditing && !isMember ? (
                              <input
                                value={att.name}
                                onChange={(e) => updateAttendeeText(att.id, 'name', e.target.value)}
                                placeholder="이름"
                                className="w-full text-center h-8 px-2.5 text-xs font-bold rounded-sm outline-none bg-white border border-slate-300 focus:border-slate-400 text-slate-900 placeholder:text-slate-400 shadow-2xs"
                              />
                            ) : (
                              <LockedOrPlainCell
                                isLocked={isMember && (isRowEditing || isInlineEditing)}
                                onLockedClick={() => setNotice(MEMBER_LOCK_HINT)}
                                className="font-bold text-slate-900"
                              >
                                {att.name || '-'}
                              </LockedOrPlainCell>
                            )}
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'name', 70)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('name');
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>
                          {statusCell}
                          {extraCols.slice(statusColumnAt).map(renderExtraCell)}

                          {/* Remarks / Memo Input. 컬럼 설정에서 비고를 지웠으면 없다. */}
                          {!isMemoHidden && (
                            <td
                              className="relative text-center px-3 py-2 h-[50px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isInlineEditing ? (
                                <InlineEditableCell
                                  value={att.memo ?? ''}
                                  ariaLabel={`${att.name} 비고`}
                                  onCommit={(next) => updateAttendeeText(att.id, 'memo', next)}
                                />
                              ) : isRowEditing ? (
                                <input
                                  value={att.memo || ''}
                                  onChange={(e) =>
                                    updateAttendeeText(att.id, 'memo', e.target.value)
                                  }
                                  placeholder="비고 입력"
                                  className="w-full text-center h-8 px-2.5 text-xs rounded-sm outline-none bg-white border border-slate-300 focus:border-slate-400 text-slate-800 placeholder:text-slate-400 shadow-2xs"
                                />
                              ) : (
                                <div className="w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs text-slate-600 truncate">
                                  {att.memo ? att.memo : <span className="text-slate-300">-</span>}
                                </div>
                              )}
                            </td>
                          )}

                          {/* Fixed Sticky Right Action Cell */}
                          <td
                            className="sticky right-0 bg-slate-50 group-hover:bg-slate-100 transition-colors z-10 w-20 min-w-[80px] max-w-[80px] px-2 py-2 h-[50px] text-center border-l border-slate-300 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="h-8 flex items-center justify-center mx-auto gap-1.5">
                              {editingRowId === att.id ? (
                                <Tooltip label="수정 완료" align="end">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      commitDrafts([att.id]);
                                      setEditingRowId(null);
                                    }}
                                    className="w-7 h-7 rounded-sm border border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 flex items-center justify-center cursor-pointer transition-colors"
                                    aria-label="수정 완료"
                                  >
                                    <Check size={14} />
                                  </button>
                                </Tooltip>
                              ) : (
                                // 기타 방식은 칸을 눌러 바로 입력하므로 행 수정 버튼이 없다.
                                !isTableEditMode &&
                                !isInlineEditing && (
                                  <Tooltip label="수정" align="end">
                                    <button
                                      aria-label="수정"
                                      type="button"
                                      onClick={() => setEditingRowId(att.id)}
                                      className="w-7 h-7 rounded-sm text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                                    >
                                      <Edit3 size={13} />
                                    </button>
                                  </Tooltip>
                                )
                              )}
                              <Tooltip label="삭제" align="end">
                                <button
                                  aria-label="삭제"
                                  type="button"
                                  onClick={() => {
                                    if (
                                      confirm(
                                        `[${att.name || '참가자'}] 님을 명단에서 삭제하시겠습니까?`,
                                      )
                                    ) {
                                      setAttendees((prev) => prev.filter((a) => a.id !== att.id));
                                    }
                                  }}
                                  className="w-7 h-7 rounded-sm text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </Tooltip>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>

              {/* Seamless Full-Height Guideline Overlay */}
              {(resizingColKey || activeHoverCol) && guidelineX !== null && (
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-slate-400 pointer-events-none z-30 -translate-x-1/2"
                  style={{ left: `${guidelineX}px` }}
                />
              )}
            </div>
          </div>

          {/* 컨퍼런스 명단 시트: 엑셀처럼 화면 맨 아래에 고정된 시트 탭으로 참석자 구분마다 따로 관리한다.
              탭을 키워(h-14) 글자가 화면 끝에서 떨어져 있게 하고, 작업 표시줄·Dock 쪽 가장자리까지 가지 않아도 누를 수 있게 한다.
              본문(main)의 아래 여백(1.75rem) 안쪽에 멈추지 않도록 그만큼 아래로 내린다(-bottom-7). */}
          {isConferenceEvent && (
            <div
              role="tablist"
              aria-label="명단 시트"
              className="sticky -bottom-7 z-30 -mx-8 mt-auto flex items-stretch gap-px border-t border-slate-200 bg-slate-100 px-8 shadow-[0_-4px_12px_-6px_rgba(15,23,42,0.12)]"
            >
              {CONFERENCE_SHEETS.map((sheet) => {
                const isActive = conferenceSheet === sheet.value;
                return (
                  <button
                    key={sheet.value}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleChangeConferenceSheet(sheet.value)}
                    className={`-mt-px inline-flex h-14 items-center border-x px-5 text-sm whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-300 ${
                      isActive
                        ? 'border-slate-200 bg-white font-bold text-slate-900 shadow-[inset_0_-2px_0_0_var(--color-slate-900)]'
                        : 'border-transparent font-medium text-slate-500 hover:bg-white/70 hover:text-slate-800'
                    }`}
                  >
                    {sheet.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: 전체 행사 목록 ─── */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {sortedEvents.length === 0 && (
              <div className="rounded-md border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <p className="text-sm font-bold text-slate-700">
                  {cohortLabelOf(cohortLabels, selectedCohort)} 반기에 등록된 행사가 없습니다.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  새 행사를 생성하면 선택한 반기에 등록됩니다.
                </p>
              </div>
            )}
            {sortedEvents.map((evt) => {
              return (
                <div
                  key={evt.id}
                  onClick={() => handleSelectEvent(evt.id, 'live')}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs px-6 py-5 transition-all cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-4">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-slate-950 transition-colors truncate">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {evt.date}
                      {evt.location ? ` · ${evt.location}` : ''}
                    </p>
                  </div>

                  {/* 액션 아이콘들 (다운로드 -> 톱니바퀴 -> 휴지통) */}
                  <div
                    className="flex items-center gap-1.5 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* 1. 다운로드 (CSV 저장) */}
                    <button
                      type="button"
                      onClick={() => handleExportEventCsv(evt)}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer"
                      title="출석부 CSV 다운로드"
                    >
                      <Download size={20} />
                    </button>

                    {/* 2. 톱니바퀴 (행사 설정) */}
                    <button
                      type="button"
                      onClick={() => handleOpenBasicInfoSettings(evt)}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-all cursor-pointer group/btn"
                      title="행사 기본 정보 수정"
                    >
                      <Settings
                        size={20}
                        className="group-hover/btn:rotate-45 transition-transform duration-200"
                      />
                    </button>

                    {/* 3. 휴지통 (행사 삭제) */}
                    <button
                      type="button"
                      onClick={() => handleDeleteEvent(evt.id, evt.title)}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                      title="행사 삭제"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: 양식 템플릿 설정 ─── */}
      {subTab === 'forms' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                출석 양식 템플릿 관리
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                운영지원팀의 용도에 맞게 출석 양식 템플릿과 추가 수집 항목(커스텀 필드)을 생성,
                수정, 삭제합니다.
              </p>
            </div>

            <button
              onClick={handleOpenCreateTemplate}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Plus size={14} />
              <span>+ 새 양식 템플릿 생성</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map((tmpl) => {
              return (
                <div
                  key={tmpl.id}
                  className="p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {tmpl.allowExternal ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                            외부인 허용
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
                            부원 전용
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setIsNewTemplate(false);
                            setEditingTemplate({
                              ...tmpl,
                              customFields: tmpl.customFields.map((f) => ({
                                ...f,
                                options: f.options ? [...f.options] : [],
                              })),
                            });
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 border border-slate-200 cursor-pointer transition-colors"
                          title="양식 수정"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(tmpl.id, tmpl.title)}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 cursor-pointer transition-colors"
                          title="양식 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-slate-900">{tmpl.title}</h3>
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">
                        {tmpl.description}
                      </p>
                    </div>

                    {/* Custom Fields Summary */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-600">
                        추가 입력 항목 ({tmpl.customFields.length}개):
                      </span>
                      {tmpl.customFields.length === 0 ? (
                        <p className="text-[11px] text-slate-400">기본 인적사항만 수집</p>
                      ) : (
                        <div className="space-y-1">
                          {tmpl.customFields.map((f) => (
                            <div
                              key={f.id}
                              className="flex items-center justify-between text-[11px] text-slate-700 font-mono"
                            >
                              <span>• {f.label}</span>
                              <span className="text-slate-400 text-[10px] font-sans">
                                [{f.type === 'SELECT' ? '선택형' : '텍스트'}]{' '}
                                {f.isRequired && <strong className="text-red-500">필수</strong>}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleCreateEventFromTemplate(tmpl)}
                    className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
                  >
                    <Plus size={13} />
                    <span>이 양식으로 행사 개설</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Drawer: + 1명 현장 빠른 추가 ─── */}
      {showQuickAddDrawer && (
        // 창 위쪽을 고정한다. BOAZ·외부인을 바꿔 입력 칸 수가 달라져도 창이 위아래로 튀지 않고 아래쪽만 늘고 준다.
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-start justify-center p-4 pt-[12vh] backdrop-blur-xs">
          <div
            // 일반 행사형의 출석 상태 버튼 8개가 한 줄에 들어가는 너비다.
            className={`w-full max-w-[640px] rounded-lg p-6 space-y-4 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">참가자 추가</h3>
              <button
                type="button"
                onClick={() => setShowQuickAddDrawer(false)}
                className={MODAL_CLOSE_BTN}
                aria-label="참가자 추가 창 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 text-xs max-h-[60vh] overflow-y-auto [scrollbar-gutter:stable] pr-1">
              {/* 이름과 활동 TERM을 한 줄에 둔다(활동 TERM 열이 없으면 이름이 한 줄을 다 쓴다). */}
              <div className={quickAddActivityTermField ? 'grid grid-cols-2 gap-x-3' : ''}>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-slate-500">이름 *</label>
                    {/* 외부 참석자는 컨퍼런스 1/2차형만 받는다. 외부인을 고르면 외부 참석자 양식(이름·출석·비고)으로 바뀐다. */}
                    {isConferenceEvent && (
                      <div
                        role="radiogroup"
                        aria-label="참가자 구분"
                        className="flex items-center gap-3"
                      >
                        {[
                          { isExternal: false, label: 'BOAZ' },
                          { isExternal: true, label: '외부인' },
                        ].map((item) => (
                          <label
                            key={item.label}
                            className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 hover:text-slate-900 select-none"
                          >
                            <input
                              type="radio"
                              name="quick-add-attendee-kind"
                              checked={quickAdd.isExternal === item.isExternal}
                              onChange={() => changeQuickAddExternal(item.isExternal)}
                              className="w-3.5 h-3.5 cursor-pointer accent-slate-900"
                            />
                            {/* 고른 쪽은 색만 진하게 한다(굵기를 바꾸면 글자 폭이 달라져 옆 버튼이 움직인다). */}
                            <span
                              className={
                                quickAdd.isExternal === item.isExternal ? 'text-slate-900' : ''
                              }
                            >
                              {item.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    value={quickAdd.name}
                    onChange={(e) => setQuickAdd((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="예: 홍길동"
                    aria-invalid={Boolean(quickAddNameError)}
                    className={quickAddNameError ? FIELD_INPUT_ERROR : FIELD_INPUT}
                  />
                  {quickAddNameError && <p className={FIELD_ERROR}>{quickAddNameError}</p>}
                </div>
                {quickAddActivityTermField && (
                  <div>
                    <label className={FIELD_LABEL}>{quickAddActivityTermField.label}</label>
                    {/* 활동 TERM은 BASE·ADV 중에서 고른다(부문과 같은 드롭다운). */}
                    <FilterDropdown
                      ariaLabel={quickAddActivityTermField.label}
                      title="선택"
                      value={quickAddValueOf(quickAddActivityTermField)}
                      options={ACTIVITY_TERM_DROPDOWN_OPTIONS}
                      onChange={(val) => changeQuickAddValue(quickAddActivityTermField, val)}
                      isFullWidth
                    />
                  </div>
                )}
              </div>

              {/* 현재 표에 설정된 추가 컬럼들에 맞춰 동적으로 입력창 표시 (설정된 컬럼만 정확히 노출). 기수·부문은 한 줄에 나란히.
                  선택 컬럼(뒤풀이 비용 O/X 등)은 아래 출석 상태와 같은 줄에 둔다. */}
              {quickAddGridFields.length > 0 && (
                <div className="grid grid-cols-2 gap-x-3 gap-y-5">
                  {quickAddGridFields.map((cf) => {
                    const currentVal = quickAddValueOf(cf);
                    const fieldError = quickAddFieldErrors[cf.id];
                    const changeValue = (val: string) => changeQuickAddValue(cf, val);

                    return (
                      <div key={cf.id} className={halfWidthIds.includes(cf.id) ? '' : 'col-span-2'}>
                        <label className={FIELD_LABEL}>{cf.label}</label>
                        {isTermLabel(cf.label) ? (
                          // 기수는 직접 입력하거나, 표 위 기수 필터와 같은 선택지(행사 DB의 참가자 기수)에서 고른다.
                          // 숫자가 아닌 글자가 있으면 칸 아래에 빨갛게 안내하고 추가하지 않는다.
                          <ComboInput
                            ariaLabel={cf.label}
                            value={currentVal}
                            options={quickAddTermOptions}
                            onChange={changeValue}
                            placeholder="예: 28"
                            hasError={Boolean(fieldError)}
                          />
                        ) : isTrackLabel(cf.label) ? (
                          // 부문은 분석·시각화·엔지니어링 중에서 고른다(반기·필터 드롭다운과 같은 모양).
                          <FilterDropdown
                            ariaLabel={cf.label}
                            title="선택"
                            value={currentVal}
                            options={TRACK_DROPDOWN_OPTIONS}
                            onChange={changeValue}
                            isFullWidth
                          />
                        ) : (
                          <input
                            value={currentVal}
                            onChange={(e) => changeValue(e.target.value)}
                            placeholder={`${cf.label} 입력`}
                            aria-invalid={Boolean(fieldError)}
                            className={fieldError ? FIELD_INPUT_ERROR : FIELD_INPUT}
                          />
                        )}
                        {fieldError && <p className={FIELD_ERROR}>{fieldError}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 출석 상태와 선택 컬럼(뒤풀이 비용 O/X 등)을 한 줄에 둔다. 한 줄에 다 들어가지 않으면 다음 줄로 내려간다. */}
              {(hasStatusColumns || quickAddSelectFields.length > 0) && (
                <div className="flex flex-wrap items-start gap-x-6 gap-y-5">
                  {/* 출석 상태 선택. 출결 열이 없는 기타 방식에는 없다. */}
                  {hasStatusColumns && (
                    <div>
                      <label className={FIELD_LABEL}>출석 상태</label>
                      <div role="radiogroup" aria-label="출석 상태" className={STATUS_BTN_GROUP}>
                        {quickAddStatusOptions.map((option) => {
                          const st = option.value;
                          const isSelected = quickAdd.status === st;
                          const styleCfg = ATTEND_STATUS_STYLES[st];

                          return (
                            <button
                              key={st}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              onClick={() => setQuickAdd((prev) => ({ ...prev, status: st }))}
                              className={`${STATUS_BTN} ${
                                isSelected ? styleCfg.active : styleCfg.inactive
                              }`}
                            >
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* 선택 컬럼은 출석 표와 같은 버튼으로 고른다. 고른 값을 다시 누르면 비운다. */}
                  {quickAddSelectFields.map((cf) => {
                    const currentVal = quickAddValueOf(cf);
                    return (
                      <div key={cf.id}>
                        <label className={FIELD_LABEL}>{cf.label}</label>
                        <div role="radiogroup" aria-label={cf.label} className={STATUS_BTN_GROUP}>
                          {(cf.options ?? []).map((option) => {
                            const isCurrent = currentVal === option;
                            return (
                              <button
                                key={option}
                                type="button"
                                role="radio"
                                aria-checked={isCurrent}
                                onClick={() => changeQuickAddValue(cf, isCurrent ? '' : option)}
                                className={`${STATUS_BTN} ${
                                  isCurrent ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 비고 입력. 컬럼 설정에서 비고를 지웠으면 없다. */}
              {!isMemoHidden && (
                <div>
                  <label className={FIELD_LABEL}>비고</label>
                  <input
                    value={quickAdd.memo}
                    onChange={(e) => setQuickAdd((prev) => ({ ...prev, memo: e.target.value }))}
                    placeholder="예: 사전 불참 통보, 추가 메모 등"
                    className={FIELD_INPUT}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowQuickAddDrawer(false)}
                className={MODAL_CANCEL_BTN}
              >
                취소
              </button>
              <button type="button" onClick={handleQuickAddSubmit} className={MODAL_CONFIRM_BTN}>
                추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 행사 / 출석 양식 등록 & 수정 (표 형식 / 컬럼 지정 포함) ─── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            // 새 행사 등록은 출결 방식에 따라 명단 파일 칸 수가 달라도 창 높이를 고정한다.
            // 칸이 가장 많은 컨퍼런스 1/2차형(3칸)이 스크롤 없이 들어가는 높이다(넘치면 창 안에서 스크롤).
            // 컬럼 설정 창은 표 구성 미리보기가 줄바꿈 없이 보이도록 더 넓다.
            className={`w-full ${eventModalType === 'COLUMNS_ONLY' ? 'max-w-4xl' : 'max-w-xl'} max-h-[92vh] flex flex-col rounded-lg p-6 space-y-4 overflow-hidden animate-in fade-in duration-150 ${
              eventModalType === 'CREATE_FULL' ? 'h-[584px]' : ''
            } ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {eventModalType === 'COLUMNS_ONLY'
                  ? '컬럼 설정'
                  : eventModalType === 'BASIC_INFO'
                    ? '행사 기본 정보 수정'
                    : '새 행사 등록'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className={MODAL_CLOSE_BTN}
                aria-label="창 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto [scrollbar-gutter:stable] space-y-5 pr-1 text-xs">
              {/* 1. 기본 정보 섹션 (BASIC_INFO 또는 CREATE_FULL) */}
              {(eventModalType === 'BASIC_INFO' || eventModalType === 'CREATE_FULL') && (
                <div className="space-y-5">
                  <div>
                    <label className={FIELD_LABEL}>행사명 *</label>
                    <input
                      value={editingEvent.title}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, title: e.target.value } : null,
                        )
                      }
                      className={FIELD_INPUT}
                    />
                  </div>

                  {/* 일자·장소는 선택 입력이다. 입력한 것만 행사 목록에 보인다. */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={FIELD_LABEL}>일자</label>
                      <input
                        type="date"
                        value={editingEvent.date}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, date: e.target.value } : null,
                          )
                        }
                        className={`${FIELD_INPUT}`}
                      />
                    </div>

                    <div>
                      <label className={FIELD_LABEL}>장소</label>
                      <input
                        value={editingEvent.location}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, location: e.target.value } : null,
                          )
                        }
                        className={FIELD_INPUT}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 새 행사 등록: 출결 방식 선택과 방식별 명단 업로드 */}
              {eventModalType === 'CREATE_FULL' && (
                <NewEventRosterSection
                  format={newEventFormat}
                  onChangeFormat={handleChangeNewEventFormat}
                  uploads={newEventUploads}
                  onSelectFile={handleNewEventCsvUpload}
                  onClearFile={clearNewEventCsv}
                />
              )}

              {/* 2. 출석 명단 표 컬럼 설정 섹션 (출석 체크 화면의 톱니바퀴에서만. 새 행사 등록에서는 컬럼을 추가하지 않는다) */}
              {eventModalType === 'COLUMNS_ONLY' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className={FIELD_LABEL}>컬럼 추가</label>
                    <div className="flex gap-2">
                      <input
                        value={newColInputText}
                        onChange={(e) => setNewColInputText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomColumn(newColInputText);
                          }
                        }}
                        placeholder="추가할 컬럼명을 입력하세요"
                        className={`min-w-0 flex-1 ${FIELD_INPUT}`}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomColumn(newColInputText)}
                        className={`h-10 shrink-0 ${MODAL_CONFIRM_BTN}`}
                      >
                        추가
                      </button>
                    </div>

                    {/* 지금 표의 컬럼을 표와 같은 순서로 보여 준다(창을 열 때 서버에서 읽은 행사 기준, 고치는 대로 바뀐다).
                        추가 컬럼은 끌어서 옮기고, 이름은 지울 수 없다. 출결·2차 출결·비고는 지운 뒤 같은 이름으로 추가하면 되살아난다. */}
                    {(() => {
                      const columns = tableColumnsOf(editingEvent, false);
                      // 끌어 옮기는 자리는 비고를 뺀 목록 기준이다(비고는 늘 맨 끝).
                      const movable: TableColumn[] = columns.filter(
                        (column) => column.kind !== 'memo',
                      );
                      const indicator = (
                        <div className="flex flex-col items-center justify-center -mx-1 px-1 pointer-events-none transition-all z-20">
                          <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                          <div className="w-[2.5px] h-6 bg-slate-900 rounded-full shadow-xs" />
                          <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                        </div>
                      );
                      const removeButton = (column: TableColumn) => (
                        <Tooltip label="삭제" align="end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (column.kind === 'field') {
                                handleRemoveCustomColumn(column.label);
                              } else {
                                handleRemoveTableColumn(column);
                              }
                            }}
                            className="text-slate-400 hover:text-slate-800 cursor-pointer transition-colors p-0.5 rounded-md hover:bg-slate-100"
                            aria-label={`${column.label} 컬럼 삭제`}
                          >
                            <X size={12} />
                          </button>
                        </Tooltip>
                      );

                      return (
                        <div className="space-y-1.5 pt-2.5">
                          <div
                            className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-md bg-slate-50 border border-slate-200"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              if (dropIndicatorIdx !== null) {
                                handleColDrop(e, dropIndicatorIdx);
                              }
                            }}
                          >
                            {columns.map((column) => {
                              const idx = movable.indexOf(column);
                              const showBeforeIndicator =
                                draggedColIdx !== null && idx >= 0 && dropIndicatorIdx === idx;
                              const showAfterIndicator =
                                draggedColIdx !== null &&
                                idx === movable.length - 1 &&
                                dropIndicatorIdx === movable.length;
                              const dropHandlers =
                                idx >= 0
                                  ? {
                                      onDragOver: (e: React.DragEvent) => handleColDragOver(e, idx),
                                      onDrop: (e: React.DragEvent) => {
                                        e.stopPropagation();
                                        if (dropIndicatorIdx !== null) {
                                          handleColDrop(e, dropIndicatorIdx);
                                        }
                                      },
                                    }
                                  : {};

                              return (
                                <div key={column.key} className="flex items-center">
                                  {showBeforeIndicator && indicator}
                                  {column.kind === 'field' ? (
                                    <div
                                      draggable
                                      onDragStart={(e) => handleColDragStart(e, idx)}
                                      onDragEnd={handleColDragEnd}
                                      {...dropHandlers}
                                      className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-grab active:cursor-grabbing ${
                                        draggedColIdx === idx
                                          ? 'opacity-25 border-dashed border-slate-400 bg-slate-200'
                                          : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                                      }`}
                                      title="드래그하여 순서를 변경할 수 있습니다"
                                    >
                                      <GripVertical
                                        size={13}
                                        className="text-slate-400 -ml-0.5 shrink-0"
                                      />
                                      {/* 글자 길이만큼만 넓어져 이름·출결 칸과 크기가 맞는다. */}
                                      <AutoWidthInput
                                        value={column.field.label}
                                        onChange={(e) =>
                                          handleRenameCustomColumn(column.field.id, e.target.value)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="text-xs font-semibold text-slate-800"
                                        aria-label={`${column.label} 컬럼명 수정`}
                                      />
                                      {removeButton(column)}
                                    </div>
                                  ) : (
                                    // 이름·출결·비고는 제자리에 있다(끌어 옮기지 않는다). 이름은 지울 수 없다.
                                    <div
                                      {...dropHandlers}
                                      className={`px-3 py-1.5 rounded-md border text-xs font-semibold flex items-center gap-1.5 select-none ${
                                        column.kind === 'name'
                                          ? 'border-slate-200 bg-slate-100 text-slate-500'
                                          : 'border-slate-200 bg-white text-slate-800 shadow-2xs'
                                      }`}
                                      title={
                                        column.kind === 'name'
                                          ? '이름 열은 지울 수 없습니다'
                                          : undefined
                                      }
                                    >
                                      {column.label}
                                      {column.kind !== 'name' && removeButton(column)}
                                    </div>
                                  )}
                                  {showAfterIndicator && indicator}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 실시간 표 헤더 미리보기 */}
                  <div className="pt-4 border-t border-slate-100">
                    <label className={FIELD_LABEL}>표 구성 미리보기</label>
                    {/* 컬럼 이름은 줄바꿈하지 않는다. 컬럼이 아주 많으면 미리보기 안에서 가로로 스크롤한다. */}
                    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
                      <table className="min-w-full w-max text-xs text-left whitespace-nowrap">
                        <thead>
                          <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-[11px] font-bold">
                            <th className="px-3 py-2 text-center w-10"></th>
                            {tableColumnsOf(editingEvent, false).map((column) =>
                              column.kind === 'field' ? (
                                <th
                                  key={column.key}
                                  className="px-3 py-2 whitespace-nowrap text-slate-800 font-bold"
                                >
                                  <AutoWidthInput
                                    value={column.field.label}
                                    onChange={(e) =>
                                      handleRenameCustomColumn(column.field.id, e.target.value)
                                    }
                                    className="text-xs font-bold text-slate-800"
                                    aria-label={`${column.label} 컬럼명 수정`}
                                  />
                                </th>
                              ) : (
                                <th
                                  key={column.key}
                                  className={`px-3 py-2 whitespace-nowrap ${
                                    column.kind === 'memo'
                                      ? 'font-medium text-slate-500'
                                      : column.kind === 'status'
                                        ? 'text-center font-bold text-slate-900'
                                        : 'font-bold text-slate-900'
                                  }`}
                                >
                                  {column.label}
                                </th>
                              ),
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-slate-400">
                            <td className="px-3 py-2 text-center text-[11px]">1</td>
                            {tableColumnsOf(editingEvent, false).map((column) => (
                              <td
                                key={column.key}
                                className={`px-3 py-2 ${
                                  column.kind === 'name'
                                    ? 'font-bold text-slate-800'
                                    : column.kind === 'status'
                                      ? 'text-center text-slate-400'
                                      : 'text-slate-400'
                                }`}
                              >
                                {column.kind === 'name' ? '홍길동' : '-'}
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3.5 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className={MODAL_CANCEL_BTN}
              >
                취소
              </button>
              <button type="button" onClick={handleSaveEvent} className={MODAL_CONFIRM_BTN}>
                {isNewEvent
                  ? '행사 생성하기'
                  : eventModalType === 'COLUMNS_ONLY'
                    ? '저장'
                    : '행사 정보 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 안내 토스트: 잘 보이도록 화면 오른쪽 위(머리글 바로 아래)에 띄운다 */}
      {notice && (
        <div
          role="status"
          className="fixed top-20 right-6 z-[70] flex max-w-sm items-center gap-2 rounded-md bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {/* 잠긴 칸 안내에만 자물쇠를 붙인다. */}
          {notice === MEMBER_LOCK_HINT ? (
            <Lock size={13} className="shrink-0 text-slate-300" aria-hidden="true" />
          ) : (
            <Info size={13} className="shrink-0 text-slate-300" aria-hidden="true" />
          )}
          {notice}
        </div>
      )}
    </div>
  );
}
