import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  Download,
  Edit3,
  Folder,
  GripVertical,
  Plus,
  Search,
  Settings,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import type {
  AttendanceEvent,
  AttendeeRecord,
  AttendStatus,
  CheckinMethod,
  CustomFormField,
  FormTemplate,
} from '@/entities/event/model/types';
import { MODAL_PRIMARY_BTN, MODAL_SURFACE } from '@/shared/ui/modalStyles';

const ATTEND_STATUS_CFG: Record<
  AttendStatus,
  {
    label: string;
    code: string;
    color: string;
    bg: string;
    border: string;
    activeBg: string;
    activeText: string;
  }
> = {
  present: {
    label: '출석',
    code: '0',
    color: '#0f5132',
    bg: '#def2e6',
    border: '#b6e3c9',
    activeBg: '#def2e6',
    activeText: '#0f5132',
  },
  late: {
    label: '지각',
    code: '1',
    color: '#7c4a03',
    bg: '#fceed2',
    border: '#f5d5a4',
    activeBg: '#fceed2',
    activeText: '#7c4a03',
  },
  earlyLeave: {
    label: '조퇴',
    code: '1E',
    color: '#7c4a03',
    bg: '#fef3c7',
    border: '#fde68a',
    activeBg: '#fef3c7',
    activeText: '#7c4a03',
  },
  absent: {
    label: '결석',
    code: '2',
    color: '#8a1c32',
    bg: '#fce4e6',
    border: '#f8b4bc',
    activeBg: '#fce4e6',
    activeText: '#8a1c32',
  },
  excusedAbsent: {
    label: '인정결석',
    code: '3',
    color: '#1e40af',
    bg: '#eff6ff',
    border: '#bfdbfe',
    activeBg: '#eff6ff',
    activeText: '#1e40af',
  },
  unexcusedLate: {
    label: '무단지각',
    code: '4',
    color: '#c2410c',
    bg: '#fff7ed',
    border: '#fed7aa',
    activeBg: '#fff7ed',
    activeText: '#c2410c',
  },
  unexcusedAbsent: {
    label: '무단결석',
    code: '5',
    color: '#991b1b',
    bg: '#fee2e2',
    border: '#fca5a5',
    activeBg: '#fee2e2',
    activeText: '#991b1b',
  },
  unmarked: {
    label: '미정',
    code: '-',
    color: '#334155',
    bg: '#e9eef4',
    border: '#cbd5e1',
    activeBg: '#e9eef4',
    activeText: '#334155',
  },
};

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

// Smart resolver for attendee values based on dynamic column labels
function getAttendeeFieldValue(att: AttendeeRecord, label: string, id: string): string {
  if (att.customAnswers?.[label] !== undefined && att.customAnswers[label] !== '') {
    return att.customAnswers[label];
  }
  if (att.customAnswers?.[id] !== undefined && att.customAnswers[id] !== '') {
    return att.customAnswers[id];
  }

  const clean = label.trim().toLowerCase();

  // 학교 / 대학교 / 출신학교
  if (clean.includes('학교') || clean.includes('대학')) {
    if (att.email.includes('yonsei')) {
      return '연세대학교';
    }
    if (att.email.includes('snu')) {
      return '서울대학교';
    }
    if (att.email.includes('ewha')) {
      return '이화여자대학교';
    }
    if (att.email.includes('hanyang')) {
      return '한양대학교';
    }
    if (att.email.includes('sogang')) {
      return '서강대학교';
    }
    if (att.email.includes('korea')) {
      return '고려대학교';
    }
    if (att.email.includes('skku')) {
      return '성균관대학교';
    }
    if (att.affiliation.includes('대')) {
      return att.affiliation.split(' ')[0];
    }
    return '서울대학교';
  }

  // 소속 / 회사 / 직장 / 기업
  if (
    clean.includes('소속') ||
    clean.includes('회사') ||
    clean.includes('직장') ||
    clean.includes('기업')
  ) {
    return att.affiliation || (att.isExternal ? '외부 게스트' : 'BOAZ 28기');
  }

  // 기수 / 기
  if (clean === '기수' || clean === '기' || clean.includes('기수')) {
    return att.term ? `${att.term}기` : att.affiliation.match(/\d+기/)?.[0] || '28기';
  }

  // 부문 / 트랙 / 분야 / 세부트랙
  if (clean.includes('부문') || clean.includes('트랙') || clean.includes('분야')) {
    if (att.affiliation.includes('분석')) {
      return '분석 트랙';
    }
    if (att.affiliation.includes('엔지니어링') || att.affiliation.includes('엔지니어')) {
      return '엔지니어링 트랙';
    }
    if (att.affiliation.includes('시각화')) {
      return '시각화 트랙';
    }
    return '분석 트랙';
  }

  // 팀 / 팀명 / 배정팀 / 배정 팀명 / 조
  if (clean.includes('팀') || clean.includes('조') || clean.includes('배정')) {
    return (
      att.customAnswers?.['배정 팀명'] ||
      att.customAnswers?.['팀명'] ||
      (att.id.includes('1') || att.id.includes('2') ? '1조' : '2조')
    );
  }

  // 전화번호 / 연락처 / 핸드폰 / 휴대폰
  if (
    clean.includes('전화') ||
    clean.includes('연락') ||
    clean.includes('핸드폰') ||
    clean.includes('휴대폰') ||
    clean.includes('phone')
  ) {
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

  // 기념품 / 수령
  if (clean.includes('기념품') || clean.includes('수령')) {
    return att.customAnswers?.['기념품 수령'] || '수령 완료';
  }

  // 과제 / 제출
  if (clean.includes('과제') || clean.includes('제출')) {
    return att.customAnswers?.['과제 제출'] || '제출 완료';
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
  customAnswers: Record<string, string>;
}

export interface EventAttendanceManagePageProps {
  events: AttendanceEvent[];
  setEvents: Dispatch<SetStateAction<AttendanceEvent[]>>;
  attendees: AttendeeRecord[];
  setAttendees: Dispatch<SetStateAction<AttendeeRecord[]>>;
  templates: FormTemplate[];
  setTemplates: Dispatch<SetStateAction<FormTemplate[]>>;
}

/** 행사 출결 화면. 행사·참가자·양식 템플릿은 App이 DB에서 불러와 넘겨 주고, 바꾸면 DB에 저장된다. */
export function EventAttendanceManagePage({
  events,
  setEvents,
  attendees,
  setAttendees,
  templates,
  setTemplates,
}: EventAttendanceManagePageProps) {
  const [subTab, setSubTab] = useState<'events' | 'live' | 'forms' | 'stats'>(() => {
    try {
      const saved = localStorage.getItem('boaz_event_subtab');
      if (saved && ['events', 'live', 'forms', 'stats'].includes(saved)) {
        return saved as 'events' | 'live' | 'forms' | 'stats';
      }
    } catch {}
    return 'events';
  });

  const [selectedEventId, setSelectedEventId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('boaz_event_selected_id');
      if (saved) return saved;
    } catch {}
    return 'evt_conf_28';
  });

  useEffect(() => {
    try {
      localStorage.setItem('boaz_event_subtab', subTab);
    } catch {}
  }, [subTab]);

  useEffect(() => {
    try {
      localStorage.setItem('boaz_event_selected_id', selectedEventId);
    } catch {}
  }, [selectedEventId]);

  // ─── Browser History: 뒤로가기 시 행사 세부 탭 -> 행사 전체 목록 이동 연동 ───
  useEffect(() => {
    // 마운트 시 초기 history state 동기화
    if (subTab !== 'events') {
      if (!window.history.state || window.history.state.subTab !== 'detail') {
        window.history.replaceState(
          { page: 'att-events', subTab: 'events' },
          '',
          window.location.href,
        );
        window.history.pushState(
          { page: 'att-events', subTab: 'detail', eventId: selectedEventId, tab: subTab },
          '',
          window.location.href,
        );
      }
    } else {
      if (!window.history.state || window.history.state.subTab !== 'events') {
        window.history.replaceState(
          { page: 'att-events', subTab: 'events' },
          '',
          window.location.href,
        );
      }
    }

    const handlePopState = (e: PopStateEvent) => {
      const state = e.state;
      if (state && state.subTab === 'detail') {
        setSubTab(state.tab || 'live');
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
    // The listener intentionally captures the initial detail state; later navigation is handled by popstate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSelectEvent(eventId: string, tab: 'live' | 'forms' | 'stats' = 'live') {
    setSelectedEventId(eventId);
    setSubTab(tab);
    window.history.pushState(
      { page: 'att-events', subTab: 'detail', eventId, tab },
      '',
      window.location.href,
    );
  }

  function handleGoBackToList() {
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

  // Fast Keyboard Check-in Mode State
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [isKeyboardModeActive] = useState(true);

  // Quick Add Drawer
  const [showQuickAddDrawer, setShowQuickAddDrawer] = useState(false);
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
  const [newEventRoster, setNewEventRoster] = useState<ParsedRosterItem[]>([]);
  const [newEventCsvName, setNewEventCsvName] = useState('');
  const newEventCsvInputRef = useRef<HTMLInputElement>(null);

  // Modal: Event Form Create / Edit (BASIC_INFO: 기본정보, COLUMNS_ONLY: 출석컬럼, CREATE_FULL: 새 행사 전체)
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [eventModalType, setEventModalType] = useState<
    'BASIC_INFO' | 'COLUMNS_ONLY' | 'CREATE_FULL'
  >('CREATE_FULL');
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [newColInputText, setNewColInputText] = useState('');
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dropIndicatorIdx, setDropIndicatorIdx] = useState<number | null>(null);

  // Modal: Template Create / Edit
  const [editingTemplate, setEditingTemplate] = useState<FormTemplate | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState(false);

  // Table Edit Mode State (switch between clean text view & inline input edit mode)
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);

  // Table Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    index: 50,
    name: 120,
    status: 450,
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

  // 최신 활동일자순 (날짜 내림차순 -> 생성일 내림차순) 정렬
  const sortedEvents = [...events].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
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
    targetTerms: [28],
    targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
    totalTargetCount: 0,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: '2026-08-20',
  };

  const selectedEvent =
    events.find((e) => e.id === selectedEventId) || sortedEvents[0] || events[0] || fallbackEvent;
  const currentEventAttendees = attendees.filter((a) => a.eventId === (selectedEvent?.id || ''));

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

  const filteredAttendees = currentEventAttendees.filter((a) => {
    const rawText = [
      a.affiliation || '',
      a.isExternal ? '외부인 외부' : '부원 기수',
      ...Object.values(a.customAnswers || {}),
    ]
      .join(' ')
      .toLowerCase();

    // 1. 기수 필터 (Term filter)
    if (termFilter !== 'ALL') {
      const termMatch =
        (a.term && String(a.term) === termFilter) ||
        (a.affiliation && a.affiliation.includes(`${termFilter}기`)) ||
        rawText.includes(`${termFilter}기`);
      if (!termMatch) {
        return false;
      }
    }

    // 2. 트랙 및 구분 필터
    if (attendeeCategoryFilter === 'ANALYSIS') {
      if (!rawText.includes('분석')) {
        return false;
      }
    } else if (attendeeCategoryFilter === 'VISUALIZATION') {
      if (!rawText.includes('시각화') && !rawText.includes('시각')) {
        return false;
      }
    } else if (attendeeCategoryFilter === 'ENGINEERING') {
      if (!rawText.includes('엔지') && !rawText.includes('개발')) {
        return false;
      }
    } else if (attendeeCategoryFilter === 'EXTERNAL') {
      if (
        !a.isExternal &&
        !rawText.includes('외') &&
        !rawText.includes('게스트') &&
        !rawText.includes('기업')
      ) {
        return false;
      }
    }

    if (attendStatusFilter !== 'ALL' && a.status !== attendStatusFilter) {
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
  const totalRosterCount = currentEventAttendees.length;
  const presentCount = currentEventAttendees.filter((a) => a.status === 'present').length;
  const lateCount = currentEventAttendees.filter((a) => a.status === 'late').length;
  const earlyLeaveCount = currentEventAttendees.filter((a) => a.status === 'earlyLeave').length;
  const absentCount = currentEventAttendees.filter((a) => a.status === 'absent').length;
  const excusedAbsentCount = currentEventAttendees.filter(
    (a) => a.status === 'excusedAbsent',
  ).length;
  const unexcusedLateCount = currentEventAttendees.filter(
    (a) => a.status === 'unexcusedLate',
  ).length;
  const unexcusedAbsentCount = currentEventAttendees.filter(
    (a) => a.status === 'unexcusedAbsent',
  ).length;
  const unmarkedCount = currentEventAttendees.filter((a) => a.status === 'unmarked').length;

  // 출석 표의 추가 컬럼과, 출결 컬럼이 놓일 자리(CSV로 만든 행사는 CSV의 출결 열 자리)
  const eventExtraCols = (selectedEvent.customFields || []).filter(
    (f) =>
      f.label !== '이름' &&
      f.label !== '비고' &&
      f.label !== '출석 상태' &&
      f.label !== '출석상태',
  );
  const statusColumnAt = Math.min(
    Math.max(selectedEvent.statusColumnIndex ?? eventExtraCols.length, 0),
    eventExtraCols.length,
  );

  const attendanceRate =
    totalRosterCount > 0
      ? Math.round(((presentCount + lateCount + earlyLeaveCount) / totalRosterCount) * 100)
      : 0;
  const externalPresent = currentEventAttendees.filter(
    (a) => a.isExternal && a.status === 'present',
  ).length;

  // ─── Keyboard Hotkeys (0: 출석, 1: 지각, 2: 조퇴, 3: 결석, 4: 인정결석, 5: 무단지각, 6: 무단결석, ↑/↓ 이동) ───
  useEffect(() => {
    if (
      subTab !== 'live' ||
      !isKeyboardModeActive ||
      editingEvent ||
      showQuickAddDrawer ||
      isDropdownOpen ||
      editingTemplate
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

      if (e.key === '0') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'present');
      } else if (e.key === '1') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'late');
      } else if (e.key === '2') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'earlyLeave');
      } else if (e.key === '3') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'absent');
      } else if (e.key === '4') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'excusedAbsent');
      } else if (e.key === '5') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'unexcusedLate');
      } else if (e.key === '6') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'unexcusedAbsent');
      } else if (e.key === '7') {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, 'unmarked');
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
    subTab,
    isKeyboardModeActive,
    focusedIndex,
    filteredAttendees,
    editingEvent,
    showQuickAddDrawer,
    isDropdownOpen,
    editingTemplate,
  ]);

  function changeStatusAndMoveNext(attendeeId: string, status: AttendStatus) {
    const timeNow = new Date().toTimeString().slice(0, 5);
    setAttendees((prev) =>
      prev.map((a) =>
        a.id === attendeeId
          ? {
              ...a,
              status,
              checkedInAt:
                status === 'present' || status === 'late' || status === 'unexcusedLate'
                  ? a.checkedInAt === '-'
                    ? timeNow
                    : a.checkedInAt
                  : '-',
            }
          : a,
      ),
    );

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
  function rosterColumnsFromText(text: string): {
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
    const statusLabels = ['출결', '출석상태', '출석 상태'];
    const fixedLabels = ['번호', '이름', '성명', '비고', ...statusLabels];
    const labels: string[] = [];
    let statusColumnIndex: number | undefined;
    rawHeaderTokens.forEach((label) => {
      // 출결 열이 오는 자리 = 그 앞에 나온 추가 컬럼 수
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
    const fields = labels.map((label, idx) => ({
      id: `cf_${Date.now()}_${idx}`,
      label,
      type: 'TEXT' as const,
      isRequired: false,
      target: 'ALL' as const,
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
      let affiliation = event.allowExternal ? '외부 참가자' : 'BOAZ 28기';
      let email = '';
      let phone = '';
      let isExt = false;
      const customAnswers: Record<string, string> = {};

      const eventCols = event.customFields || [];

      tokens.forEach((val, idx) => {
        if (!val) {
          return;
        }
        const colHeader = headerMap[idx] || (eventCols[idx] ? eventCols[idx].label : `col_${idx}`);

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
        parsed.push({ name, affiliation, email, phone, isExternal: isExt, customAnswers });
      }
    }

    return parsed;
  }

  function toAttendeeRecords(
    items: ParsedRosterItem[],
    eventId: string,
    idPrefix: string,
  ): AttendeeRecord[] {
    return items.map((item, idx) => ({
      id: `${idPrefix}_${Date.now()}_${idx}`,
      eventId,
      isExternal: item.isExternal,
      name: item.name,
      affiliation: item.affiliation,
      term: item.term,
      email: item.email,
      phone: item.phone,
      status: 'unmarked' as AttendStatus,
      checkedInAt: '-',
      customAnswers: item.customAnswers || {},
    }));
  }

  /** 새 행사 등록 창에서 고른 CSV를 읽어, 행사를 만들 때 함께 등록할 명단으로 담아 둔다. */
  function handleNewEventCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const input = e.target;
    if (!file || !editingEvent) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result ?? '');
      const roster = parseRosterText(text, editingEvent);
      if (roster.length === 0) {
        alert('CSV에서 읽을 수 있는 명단이 없습니다. 이름 열이 있는지 확인해 주세요.');
        clearNewEventCsv();
        return;
      }
      setNewEventRoster(roster);
      setNewEventCsvName(file.name);
      // 올린 파일의 머리글대로 이 행사의 출석 표 컬럼을 구성한다.
      const { fields, statusColumnIndex } = rosterColumnsFromText(text);
      setEditingEvent((prev) =>
        prev ? { ...prev, customFields: fields, statusColumnIndex } : prev,
      );
    };
    reader.readAsText(file, 'UTF-8');
    input.value = '';
  }

  function clearNewEventCsv() {
    setNewEventRoster([]);
    setNewEventCsvName('');
    // 올린 파일에서 만든 컬럼도 함께 비운다(새 행사 등록에서는 컬럼을 직접 추가하지 않는다).
    setEditingEvent((prev) =>
      prev && isNewEvent ? { ...prev, customFields: [], statusColumnIndex: undefined } : prev,
    );
  }

  function handleQuickAddSubmit() {
    if (!quickAdd.name.trim()) {
      alert('이름을 입력하세요.');
      return;
    }

    const answers = { ...quickAdd.customAnswers };
    if (quickAdd.affiliation && !answers['소속']) {
      answers['소속'] = quickAdd.affiliation.trim();
    }
    if (quickAdd.phone && !answers['연락처']) {
      answers['연락처'] = quickAdd.phone.trim();
    }
    if (quickAdd.email && !answers['이메일']) {
      answers['이메일'] = quickAdd.email.trim();
    }

    const newRec: AttendeeRecord = {
      id: `att_quick_${Date.now()}`,
      eventId: selectedEvent.id,
      isExternal: quickAdd.isExternal,
      name: quickAdd.name.trim(),
      affiliation:
        answers['소속'] ||
        quickAdd.affiliation.trim() ||
        (quickAdd.isExternal ? '외부 게스트' : 'BOAZ 28기'),
      email: answers['이메일'] || quickAdd.email.trim(),
      phone: answers['연락처'] || quickAdd.phone.trim(),
      status: quickAdd.status,
      checkedInAt:
        quickAdd.status === 'present' || quickAdd.status === 'late'
          ? new Date().toTimeString().slice(0, 5)
          : '-',
      memo: quickAdd.memo?.trim() || '',
      customAnswers: answers,
    };

    setAttendees((prev) => [newRec, ...prev]);
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
    setShowQuickAddDrawer(false);
  }

  // Simple comma-separated column input state (for extra columns)
  function handleAddCustomColumn(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !editingEvent) {
      return;
    }
    if (
      trimmed === '이름' ||
      trimmed === '출결' ||
      trimmed === '비고' ||
      trimmed === '출석 상태' ||
      trimmed === '출석상태'
    ) {
      return;
    }
    const exists = (editingEvent.customFields || []).some((f) => f.label === trimmed);
    if (exists) {
      return;
    }
    const newField: CustomFormField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: trimmed,
      type: 'TEXT',
      isRequired: false,
      target: 'ALL',
    };
    setEditingEvent({
      ...editingEvent,
      customFields: [...(editingEvent.customFields || []), newField],
    });
    setNewColInputText('');
  }

  function handleRemoveCustomColumn(label: string) {
    if (!editingEvent) {
      return;
    }
    setEditingEvent({
      ...editingEvent,
      customFields: (editingEvent.customFields || []).filter((f) => f.label !== label),
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

    const validFields = (editingEvent.customFields || []).filter(
      (f) =>
        f.label !== '이름' &&
        f.label !== '비고' &&
        f.label !== '출석 상태' &&
        f.label !== '출석상태',
    );

    // If dropped at same relative position, no-op
    if (draggedColIdx === targetSlot || draggedColIdx + 1 === targetSlot) {
      setDraggedColIdx(null);
      setDropIndicatorIdx(null);
      return;
    }

    const reordered = [...validFields];
    const [moved] = reordered.splice(draggedColIdx, 1);
    const insertAt = targetSlot > draggedColIdx ? targetSlot - 1 : targetSlot;
    reordered.splice(insertAt, 0, moved);

    setEditingEvent({
      ...editingEvent,
      customFields: reordered,
    });
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
    clearNewEventCsv();
    setEditingEvent({
      id: 'evt_' + Date.now(),
      title: '',
      status: 'UPCOMING',
      date: new Date().toISOString().slice(0, 10),
      startTime: '14:00',
      endTime: '18:00',
      location: '',
      description: '',
      allowExternal: true,
      checkinMethod: 'QR_CODE',
      checkinCode: String(Math.floor(1000 + Math.random() * 9000)),
      targetTerms: [28],
      targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
      totalTargetCount: 50,
      internalAttendedCount: 0,
      externalAttendedCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [],
    });
  }

  // 1. 출석 체크 화면 톱니바퀴 -> 출석 컬럼 설정만 오픈
  function handleOpenColumnSettings(e: AttendanceEvent) {
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
      setEvents((prev) => [editingEvent, ...prev]);
      if (newEventRoster.length > 0) {
        const records = toAttendeeRecords(newEventRoster, editingEvent.id, 'att_new');
        setAttendees((prev) => [...records, ...prev]);
      }
      clearNewEventCsv();
      setSelectedEventId(editingEvent.id);
    } else {
      setEvents((prev) => prev.map((e) => (e.id === editingEvent.id ? editingEvent : e)));
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
        const remaining = events.filter((e) => e.id !== evtId);
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
    const headers = ['번호', '이름', ...extraHeaders, '출석코드(0,1,2)', '출석상태', '비고'];
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
        ATTEND_STATUS_CFG[a.status]?.code || '-',
        ATTEND_STATUS_CFG[a.status]?.label || '미정',
        a.memo || '-',
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
  }

  function handleExportCsv() {
    handleExportEventCsv(selectedEvent);
  }

  // ─── Template Management Functions (Create, Edit, Delete, Instantiate) ───
  function handleOpenCreateTemplate() {
    setIsNewTemplate(true);
    setEditingTemplate({
      id: 'tmpl_' + Date.now(),
      title: '새 출석 양식 템플릿',
      description: '운영 목적에 맞춘 출석 체크 및 추가 확인 항목 양식',
      allowExternal: false,
      defaultCheckinMethod: 'QR_CODE',
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [
        {
          id: 'f_' + Date.now(),
          label: '과제 제출 여부',
          type: 'SELECT',
          options: ['제출 완료', '미제출'],
          isRequired: true,
          target: 'ALL',
        },
      ],
    });
  }

  function handleSaveTemplate() {
    if (!editingTemplate) {
      return;
    }
    if (!editingTemplate.title.trim()) {
      alert('양식명을 입력하세요.');
      return;
    }

    if (isNewTemplate) {
      setTemplates((prev) => [...prev, editingTemplate]);
    } else {
      setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)));
    }
    setEditingTemplate(null);
  }

  function handleDeleteTemplate(tmplId: string, title: string) {
    if (confirm(`'${title}' 양식 템플릿을 삭제하시겠습니까?`)) {
      setTemplates((prev) => prev.filter((t) => t.id !== tmplId));
    }
  }

  function handleCreateEventFromTemplate(tmpl: FormTemplate) {
    setIsNewEvent(true);
    clearNewEventCsv();
    setEditingEvent({
      id: 'evt_' + Date.now(),
      title: `${tmpl.title.replace(' 템플릿', '').replace(' 양식', '')} (${new Date().toISOString().slice(5, 10)})`,
      status: 'UPCOMING',
      date: new Date().toISOString().slice(0, 10),
      startTime: '14:00',
      endTime: '18:00',
      location: '동아리 지정 세미나실',
      description: tmpl.description,
      allowExternal: tmpl.allowExternal,
      checkinMethod: tmpl.defaultCheckinMethod,
      checkinCode: String(Math.floor(1000 + Math.random() * 9000)),
      targetTerms: [28],
      targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
      totalTargetCount: 50,
      internalAttendedCount: 0,
      externalAttendedCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [...tmpl.customFields],
    });
  }

  return (
    <div
      className="space-y-5 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Breadcrumb & Navigation Bar ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
        {/* Breadcrumb Hierarchy - Standardized matching all pages */}
        <div className="flex items-center gap-2.5">
          {subTab === 'events' ? (
            <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
              행사 전체 목록
            </h2>
          ) : (
            <>
              <button
                type="button"
                onClick={handleGoBackToList}
                className="text-slate-500 hover:text-slate-900 font-bold transition-colors cursor-pointer text-lg sm:text-xl tracking-tight flex items-center gap-1 group"
                title="행사 전체 목록으로 돌아가기"
              >
                <ChevronLeft
                  size={20}
                  className="text-slate-400 group-hover:text-slate-900 transition-colors stroke-[2.5]"
                />
                <span>행사 전체 목록</span>
              </button>

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
        <div className="flex items-center gap-2">
          {subTab === 'live' && (
            <>
              {/* CSV 저장 버튼 */}
              <button
                type="button"
                onClick={handleExportCsv}
                className={`px-3.5 py-2 rounded-sm text-xs transition-colors hover:bg-[#dde5ee] active:bg-[#d1dae5] flex items-center gap-1.5 cursor-pointer ${ATTEND_STATUS_STYLES.unmarked.active}`}
                title="현재 행사 출석부 CSV 다운로드"
              >
                <Download size={13} />
                <span>CSV 저장</span>
              </button>
            </>
          )}

          <button
            onClick={handleOpenNewEvent}
            className={`px-3.5 py-2 rounded-sm text-xs transition-colors hover:bg-[#dde5ee] active:bg-[#d1dae5] flex items-center gap-1.5 cursor-pointer ${ATTEND_STATUS_STYLES.unmarked.active}`}
          >
            <Plus size={14} />
            <span>새 행사 생성하기</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: 현장 출석 체크 ─── */}
      {subTab === 'live' && (
        <div className="space-y-4">
          {/* Clean Inline Stats Text */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 py-1 px-1 text-xs text-slate-500 flex-wrap border-b border-slate-100 pb-3 font-medium">
            <div className="flex items-center gap-1">
              <span>총 등록</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {totalRosterCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>출석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{presentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>지각</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{lateCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>조퇴</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {earlyLeaveCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{absentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>인정결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {excusedAbsentCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>무단지각</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {unexcusedLateCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>무단결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {unexcusedAbsentCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>출석률</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{attendanceRate}%</span>
            </div>
          </div>

          {/* Filter Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 기수 드롭다운 (API 연동 드롭다운) */}
              <div className="relative">
                <select
                  value={termFilter}
                  onChange={(e) => {
                    setTermFilter(e.target.value);
                    setFocusedIndex(0);
                  }}
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="ALL">기수 (전체)</option>
                  <option value="28">28기</option>
                  <option value="27">27기</option>
                  <option value="26">26기</option>
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
                />
              </div>

              {/* 출결 상태 필터 드롭다운 (기수 바로 옆 배치) */}
              <div className="relative">
                <select
                  value={attendStatusFilter}
                  onChange={(e) => {
                    setAttendStatusFilter(e.target.value as 'ALL' | AttendStatus);
                    setFocusedIndex(0);
                  }}
                  className="appearance-none pl-3 pr-7 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-800 text-xs font-semibold shadow-2xs outline-none focus:border-slate-400 cursor-pointer"
                >
                  <option value="ALL">출결 (전체)</option>
                  <option value="present">출석</option>
                  <option value="late">지각</option>
                  <option value="earlyLeave">조퇴</option>
                  <option value="absent">결석</option>
                  <option value="excusedAbsent">인정결석</option>
                  <option value="unexcusedLate">무단지각</option>
                  <option value="unexcusedAbsent">무단결석</option>
                  <option value="unmarked">미정</option>
                </select>
                <ChevronDown
                  size={12}
                  className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none"
                />
              </div>

              {/* 트랙 및 구분 필터 캡슐 */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
                {(['ALL', 'ANALYSIS', 'VISUALIZATION', 'ENGINEERING', 'EXTERNAL'] as const).map(
                  (cat) => {
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
                    {(() => {
                      const renderExtraTh = (cf: CustomFormField) => {
                        const colKey = `custom_${cf.id}`;
                        return (
                          <th
                            key={cf.id}
                            style={{ width: `${colWidths[colKey] || 140}px`, minWidth: '120px' }}
                            className="relative text-center px-2 py-2.5 text-slate-800 font-bold"
                          >
                            {cf.label}
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
                          </th>
                        );
                      };
                      const statusTh = (
                    <th
                      style={{ width: `${colWidths.status || 450}px`, minWidth: '450px' }}
                      className="relative text-center px-2 py-2.5 text-slate-900 font-bold"
                    >
                      출결
                      <div
                        onMouseDown={(e) => handleResizeStart(e, 'status', 450)}
                        onMouseEnter={(e) => {
                          if (!resizingColKey) {
                            setActiveHoverCol('status');
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
                      );
                      return (
                        <>
                          {eventExtraCols.slice(0, statusColumnAt).map(renderExtraTh)}
                          {statusTh}
                          {eventExtraCols.slice(statusColumnAt).map(renderExtraTh)}
                        </>
                      );
                    })()}
                    <th
                      style={{ width: `${colWidths.memo || 240}px`, minWidth: '220px' }}
                      className="relative text-center px-3 py-2.5 text-slate-700 font-semibold"
                    >
                      비고
                    </th>
                    {/* Fixed Sticky Right Action Column */}
                    <th
                      style={{ width: '80px', minWidth: '80px', maxWidth: '80px' }}
                      className="sticky right-0 top-0 bg-slate-50 z-20 px-2 py-3 w-20 min-w-[80px] max-w-[80px] text-center select-none border-l border-slate-200 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]"
                    >
                      <div className="flex items-center justify-center mx-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenColumnSettings(selectedEvent)}
                          className="p-1 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-800 transition-colors cursor-pointer flex items-center justify-center"
                          title="출석 명단 표 컬럼 설정"
                        >
                          <Settings size={14} />
                        </button>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5 + (selectedEvent.customFields?.length || 0)}
                        className="py-16 text-center text-sm text-slate-400"
                      >
                        해당 조건의 참가자가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((att, idx) => {
                      const extraCols = (selectedEvent.customFields || []).filter(
                        (f) =>
                          f.label !== '이름' &&
                          f.label !== '비고' &&
                          f.label !== '출석 상태' &&
                          f.label !== '출석상태',
                      );
                      const isRowEditing = isTableEditMode || editingRowId === att.id;

                      const renderExtraCell = (cf: CustomFormField) => {
                            const val = getAttendeeFieldValue(att, cf.label, cf.id);
                            const colKey = `custom_${cf.id}`;

                            return (
                              <td
                                key={cf.id}
                                className="relative text-center px-2 py-1.5 h-[50px] text-slate-700 font-sans"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isRowEditing ? (
                                  <input
                                    value={val}
                                    onChange={(e) => {
                                      const newVal = e.target.value;
                                      setAttendees((prev) =>
                                        prev.map((a) =>
                                          a.id === att.id
                                            ? {
                                                ...a,
                                                affiliation: cf.label.includes('소속')
                                                  ? newVal
                                                  : a.affiliation,
                                                phone:
                                                  cf.label.includes('전화') ||
                                                  cf.label.includes('연락처')
                                                    ? newVal
                                                    : a.phone,
                                                email: cf.label.includes('메일') ? newVal : a.email,
                                                isExternal: cf.label.includes('구분')
                                                  ? newVal.includes('외')
                                                  : a.isExternal,
                                                customAnswers: {
                                                  ...(a.customAnswers || {}),
                                                  [cf.id]: newVal,
                                                  [cf.label]: newVal,
                                                },
                                              }
                                            : a,
                                        ),
                                      );
                                    }}
                                    placeholder={`${cf.label}`}
                                    className="w-full text-center h-8 px-2.5 text-xs rounded-lg outline-none bg-white border border-slate-300 focus:border-slate-900 text-slate-800 font-sans placeholder:text-slate-400 shadow-2xs font-medium"
                                  />
                                ) : (
                                  <div className="w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs text-slate-700 font-medium truncate font-sans">
                                    {val || <span className="text-slate-300">-</span>}
                                  </div>
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
                      const statusCell = (
                          <td className="relative text-center px-2 py-1.5 h-[50px]">
                            <div className="h-8 flex items-center justify-center font-sans">
                              <div className="grid grid-cols-8 w-[445px] shrink-0 p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                {(
                                  [
                                    'present',
                                    'late',
                                    'earlyLeave',
                                    'absent',
                                    'excusedAbsent',
                                    'unexcusedLate',
                                    'unexcusedAbsent',
                                    'unmarked',
                                  ] as AttendStatus[]
                                ).map((st) => {
                                  const isCurrent = att.status === st;
                                  const label = ATTEND_STATUS_CFG[st]?.label || '';
                                  const styleCfg = ATTEND_STATUS_STYLES[st];

                                  return (
                                    <button
                                      key={st}
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        changeStatusAndMoveNext(att.id, st);
                                      }}
                                      className={`py-1 text-[10px] rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 ${
                                        isCurrent
                                          ? styleCfg?.active || ''
                                          : styleCfg?.inactive || ''
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, 'status', 450)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol('status');
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

                      return (
                        <tr
                          key={att.id}
                          className={`transition-colors divide-x divide-slate-200/70 ${
                            isRowEditing ? 'bg-slate-50/90' : 'hover:bg-slate-50/60'
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

                          {/* Default Fixed Column: 이름 */}
                          <td
                            className="relative text-center px-2 py-1.5 h-[50px] text-slate-900 font-sans"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isRowEditing ? (
                              <input
                                value={att.name}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setAttendees((prev) =>
                                    prev.map((a) => (a.id === att.id ? { ...a, name: newVal } : a)),
                                  );
                                }}
                                placeholder="이름"
                                className="w-full text-center h-8 px-2.5 text-xs font-bold rounded-lg outline-none bg-white border border-slate-400 focus:border-slate-900 text-slate-900 font-sans placeholder:text-slate-400 shadow-2xs"
                              />
                            ) : (
                              <div className="w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs font-bold text-slate-900 truncate font-sans">
                                {att.name || '-'}
                              </div>
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

                          {/* 추가 컬럼과 출결 컬럼(CSV로 만든 행사는 CSV의 출결 열 자리) */}
                          {extraCols.slice(0, statusColumnAt).map(renderExtraCell)}
                          {statusCell}
                          {extraCols.slice(statusColumnAt).map(renderExtraCell)}

                          {/* Remarks / Memo Input */}
                          <td
                            className="relative text-center px-3 py-2 h-[50px]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isRowEditing ? (
                              <input
                                value={att.memo || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAttendees((prev) =>
                                    prev.map((a) => (a.id === att.id ? { ...a, memo: val } : a)),
                                  );
                                }}
                                placeholder="비고 입력 (선택)"
                                className="w-full text-center h-8 px-2.5 text-xs rounded-lg outline-none bg-white border border-slate-300 focus:border-slate-900 text-slate-800 font-sans placeholder:text-slate-400 shadow-2xs"
                              />
                            ) : (
                              <div className="w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs text-slate-600 truncate font-sans">
                                {att.memo ? att.memo : <span className="text-slate-300">-</span>}
                              </div>
                            )}
                          </td>

                          {/* Fixed Sticky Right Action Cell */}
                          <td
                            className="sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 w-20 min-w-[80px] max-w-[80px] px-2 py-2 h-[50px] font-sans text-center border-l border-slate-200 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="h-8 flex items-center justify-center mx-auto gap-1.5">
                              {editingRowId === att.id ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingRowId(null)}
                                  className="w-7 h-7 rounded-lg bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-2xs cursor-pointer transition-all"
                                  title="수정 완료"
                                >
                                  <Check size={14} />
                                </button>
                              ) : (
                                !isTableEditMode && (
                                  <button
                                    type="button"
                                    onClick={() => setEditingRowId(att.id)}
                                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
                                    title="수정"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                )
                              )}
                              <button
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
                                className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 size={13} />
                              </button>
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
        </div>
      )}

      {/* ─── TAB 2: 전체 행사 목록 ─── */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3.5">
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

      {/* ─── TAB 4: 출석 통계 & 리포트 ─── */}
      {subTab === 'stats' && (
        <div className="space-y-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedEvent.title} 통계</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selectedEvent.date} · 총 {totalRosterCount}명 등록
                </p>
              </div>
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
              >
                <Download size={13} />
                <span>출석부 CSV 다운로드</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">전체 출석률</p>
                <p className="text-3xl font-bold font-mono text-emerald-600 mt-1">
                  {attendanceRate}%
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {presentCount + lateCount}명 참석 / {totalRosterCount}명
                </p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">정상 출석 / 지각 / 결석</p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  <span className="text-emerald-600">{presentCount}</span> /{' '}
                  <span className="text-amber-600">{lateCount}</span> /{' '}
                  <span className="text-red-600">{absentCount}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">미정 {unmarkedCount}명</p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">외부인 참석자 수</p>
                <p className="text-3xl font-bold font-mono text-purple-600 mt-1">
                  {externalPresent}명
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">게스트 체크인 완료</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Drawer: + 1명 현장 빠른 추가 ─── */}
      {showQuickAddDrawer && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`w-full max-w-md rounded-2xl p-6 space-y-4 ${MODAL_SURFACE}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={15} className="text-slate-700" />
                <span>현장 1명 추가</span>
                <span className="text-xs font-normal text-slate-400 font-sans">
                  ({selectedEvent.title})
                </span>
              </h3>
              <button
                onClick={() => setShowQuickAddDrawer(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs max-h-[60vh] overflow-y-auto pr-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-slate-700 font-semibold text-xs">이름 *</label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 hover:text-slate-900 select-none">
                    <input
                      type="checkbox"
                      checked={quickAdd.isExternal}
                      onChange={(e) =>
                        setQuickAdd((prev) => ({ ...prev, isExternal: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 rounded text-slate-900 border-slate-300 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                    />
                    <span>외부인 (게스트)</span>
                  </label>
                </div>
                <input
                  value={quickAdd.name}
                  onChange={(e) => setQuickAdd((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 placeholder:text-slate-400 shadow-2xs"
                />
              </div>

              {/* 현재 표에 설정된 추가 컬럼들에 맞춰 동적으로 입력창 표시 (설정된 컬럼만 정확히 노출) */}
              {(selectedEvent.customFields || [])
                .filter(
                  (f) =>
                    f.label !== '이름' &&
                    f.label !== '비고' &&
                    f.label !== '출석 상태' &&
                    f.label !== '출석상태',
                )
                .map((cf) => {
                  const currentVal =
                    quickAdd.customAnswers[cf.label] ??
                    quickAdd.customAnswers[cf.id] ??
                    (cf.label.includes('소속')
                      ? quickAdd.affiliation
                      : cf.label.includes('전화') || cf.label.includes('연락처')
                        ? quickAdd.phone
                        : cf.label.includes('메일')
                          ? quickAdd.email
                          : '');

                  return (
                    <div key={cf.id}>
                      <label className="text-slate-700 block mb-1.5 font-semibold">
                        {cf.label}
                      </label>
                      <input
                        value={currentVal}
                        onChange={(e) => {
                          const val = e.target.value;
                          setQuickAdd((prev) => ({
                            ...prev,
                            affiliation: cf.label.includes('소속') ? val : prev.affiliation,
                            phone:
                              cf.label.includes('전화') || cf.label.includes('연락처')
                                ? val
                                : prev.phone,
                            email: cf.label.includes('메일') ? val : prev.email,
                            customAnswers: { ...prev.customAnswers, [cf.label]: val, [cf.id]: val },
                          }));
                        }}
                        placeholder={`${cf.label} 입력`}
                        className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 placeholder:text-slate-400 shadow-2xs"
                      />
                    </div>
                  );
                })}

              {/* 출석 상태 선택 (일체형 세그먼트 컨트롤 - 흔들림 방지) */}
              <div>
                <label className="text-slate-700 block mb-1.5 font-semibold">출석 상태</label>
                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200/60">
                  {(
                    [
                      'present',
                      'late',
                      'earlyLeave',
                      'absent',
                      'excusedAbsent',
                      'unexcusedLate',
                      'unexcusedAbsent',
                      'unmarked',
                    ] as AttendStatus[]
                  ).map((st) => {
                    const cfg = ATTEND_STATUS_CFG[st];
                    const isSelected = quickAdd.status === st;
                    const styleCfg = ATTEND_STATUS_STYLES[st];

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setQuickAdd((prev) => ({ ...prev, status: st }))}
                        className={`h-7.5 w-full flex items-center justify-center rounded-md text-xs transition-all cursor-pointer ${
                          isSelected ? styleCfg.active : styleCfg.inactive
                        }`}
                      >
                        <span>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 비고 입력 */}
              <div>
                <label className="text-slate-700 block mb-1.5 font-semibold">비고 (선택)</label>
                <input
                  value={quickAdd.memo}
                  onChange={(e) => setQuickAdd((prev) => ({ ...prev, memo: e.target.value }))}
                  placeholder="예: 사전 불참 통보, 추가 메모 등"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 placeholder:text-slate-400 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowQuickAddDrawer(false)}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleQuickAddSubmit}
                className={`px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all active:scale-[0.98] ${MODAL_PRIMARY_BTN}`}
              >
                추가 및 출석 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 행사 / 출석 양식 등록 & 수정 (표 형식 / 컬럼 지정 포함) ─── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl p-6 space-y-4 overflow-hidden ${MODAL_SURFACE}`}>
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {eventModalType === 'COLUMNS_ONLY'
                    ? '출석 명단 표 컬럼 설정'
                    : eventModalType === 'BASIC_INFO'
                      ? '행사 기본 정보 수정'
                      : '새 행사 등록'}
                </h3>
                {eventModalType !== 'CREATE_FULL' && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    {eventModalType === 'COLUMNS_ONLY'
                      ? `대상: ${editingEvent.title || selectedEvent.title}`
                      : '행사명, 일자, 장소 등 기본 정보를 수정합니다.'}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditingEvent(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              {/* 1. 기본 정보 섹션 (BASIC_INFO 또는 CREATE_FULL) */}
              {(eventModalType === 'BASIC_INFO' || eventModalType === 'CREATE_FULL') && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      행사명 *
                    </label>
                    <input
                      value={editingEvent.title}
                      onChange={(e) =>
                        setEditingEvent((prev) =>
                          prev ? { ...prev, title: e.target.value } : null,
                        )
                      }
                      placeholder="예: BOAZ 제28기 Big Data Conference"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        일자
                      </label>
                      <input
                        type="date"
                        value={editingEvent.date}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, date: e.target.value } : null,
                          )
                        }
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">
                        장소
                      </label>
                      <input
                        value={editingEvent.location}
                        onChange={(e) =>
                          setEditingEvent((prev) =>
                            prev ? { ...prev, location: e.target.value } : null,
                          )
                        }
                        placeholder="예: 서울대학교 글로벌공학센터"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 새 행사 등록: 참가자 명단 업로드 */}
              {eventModalType === 'CREATE_FULL' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 block">
                    참가자 명단 업로드
                  </label>
                  <input
                    ref={newEventCsvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleNewEventCsvUpload}
                    className="hidden"
                  />
                  {newEventCsvName ? (
                    <div className="flex h-14 w-full max-w-[360px] items-center gap-3 rounded-sm border border-slate-200 bg-white px-4 shadow-2xs">
                      <Folder size={20} strokeWidth={1.3} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <span
                        className="min-w-0 flex-1 truncate text-left text-sm text-slate-800"
                        title={`${newEventCsvName} (${newEventRoster.length}명)`}
                      >
                        {newEventCsvName} · {newEventRoster.length}명
                      </span>
                      <Check size={20} strokeWidth={2.4} className="shrink-0 text-emerald-500" aria-label="업로드 완료" />
                      <button
                        type="button"
                        onClick={clearNewEventCsv}
                        className="shrink-0 cursor-pointer rounded p-0.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        title="파일 삭제"
                        aria-label="파일 삭제"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => newEventCsvInputRef.current?.click()}
                      className="group flex h-14 w-full max-w-[360px] cursor-pointer select-none items-center gap-3 rounded-sm border border-dashed border-slate-300 bg-white px-4 transition-colors hover:border-slate-400 hover:bg-slate-50/60"
                    >
                      <Folder size={20} strokeWidth={1.3} className="shrink-0 text-slate-400" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-500 transition-colors group-hover:text-slate-900 group-hover:underline">
                        파일을 업로드해 주세요
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. 출석 명단 표 컬럼 설정 섹션 (출석 체크 화면의 톱니바퀴에서만. 새 행사 등록에서는 컬럼을 추가하지 않는다) */}
              {eventModalType === 'COLUMNS_ONLY' && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                      컬럼 추가
                    </label>
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
                        className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddCustomColumn(newColInputText)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 ${MODAL_PRIMARY_BTN}`}
                      >
                        + 추가
                      </button>
                    </div>

                    {/* 현재 추가된 컬럼 태그 목록 (드래그하여 순서 변경 가능) */}
                    {(() => {
                      const validFields = (editingEvent.customFields || []).filter(
                        (f) =>
                          f.label !== '이름' &&
                          f.label !== '비고' &&
                          f.label !== '출석 상태' &&
                          f.label !== '출석상태',
                      );
                      if (validFields.length === 0) {
                        return null;
                      }

                      return (
                        <div className="space-y-1.5 pt-2.5">
                          <div
                            className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={(e) => {
                              if (dropIndicatorIdx !== null) {
                                handleColDrop(e, dropIndicatorIdx);
                              }
                            }}
                          >
                            {validFields.map((f, idx) => {
                              const isDragging = draggedColIdx === idx;
                              const showBeforeIndicator =
                                draggedColIdx !== null && dropIndicatorIdx === idx;
                              const showAfterIndicator =
                                draggedColIdx !== null &&
                                idx === validFields.length - 1 &&
                                dropIndicatorIdx === validFields.length;

                              return (
                                <div key={f.id} className="flex items-center">
                                  {/* Vertical Insertion Bar Indicator Before Item */}
                                  {showBeforeIndicator && (
                                    <div className="flex flex-col items-center justify-center -mx-1 px-1 pointer-events-none transition-all z-20">
                                      <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                                      <div className="w-[2.5px] h-6 bg-slate-900 rounded-full shadow-xs" />
                                      <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                                    </div>
                                  )}

                                  <div
                                    draggable
                                    onDragStart={(e) => handleColDragStart(e, idx)}
                                    onDragOver={(e) => handleColDragOver(e, idx)}
                                    onDrop={(e) => {
                                      e.stopPropagation();
                                      if (dropIndicatorIdx !== null) {
                                        handleColDrop(e, dropIndicatorIdx);
                                      }
                                    }}
                                    onDragEnd={handleColDragEnd}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-grab active:cursor-grabbing ${
                                      isDragging
                                        ? 'opacity-25 border-dashed border-slate-400 bg-slate-200'
                                        : 'bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs'
                                    }`}
                                    title="드래그하여 순서를 변경할 수 있습니다"
                                  >
                                    <GripVertical
                                      size={13}
                                      className="text-slate-400 -ml-0.5 shrink-0"
                                    />
                                    <span>{f.label}</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveCustomColumn(f.label);
                                      }}
                                      className="text-slate-400 hover:text-red-600 cursor-pointer transition-colors p-0.5 rounded-md hover:bg-slate-100"
                                      title="삭제"
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>

                                  {/* Vertical Insertion Bar Indicator After Last Item */}
                                  {showAfterIndicator && (
                                    <div className="flex flex-col items-center justify-center -mx-1 px-1 pointer-events-none transition-all z-20">
                                      <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                                      <div className="w-[2.5px] h-6 bg-slate-900 rounded-full shadow-xs" />
                                      <div className="w-1 h-1 rounded-full bg-slate-900 shadow-xs" />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <p className="text-[11px] text-slate-400 flex items-center gap-1">
                            <GripVertical size={11} className="text-slate-400 shrink-0" />
                            <span>항목을 드래그하여 표에서의 표시 순서를 변경할 수 있습니다.</span>
                          </p>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 실시간 표 헤더 미리보기 */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <label className="text-[11px] font-semibold text-slate-500 block">
                      표 구성 미리보기
                    </label>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] font-semibold">
                            <th className="px-3 py-2 text-center w-10"></th>
                            <th className="px-3 py-2 font-bold text-slate-900">이름</th>
                            {(editingEvent.customFields || [])
                              .filter(
                                (f) =>
                                  f.label !== '이름' &&
                                  f.label !== '비고' &&
                                  f.label !== '출석 상태' &&
                                  f.label !== '출석상태',
                              )
                              .map((cf) => (
                                <th key={cf.id} className="px-3 py-2 text-slate-800 font-bold">
                                  {cf.label}
                                </th>
                              ))}
                            <th className="px-3 py-2 text-center font-bold text-slate-900">출결</th>
                            <th className="px-3 py-2 font-medium text-slate-500">비고</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="text-slate-400 font-sans">
                            <td className="px-3 py-2 text-center text-[11px]">1</td>
                            <td className="px-3 py-2 font-bold text-slate-800">홍길동</td>
                            {(editingEvent.customFields || [])
                              .filter(
                                (f) =>
                                  f.label !== '이름' &&
                                  f.label !== '비고' &&
                                  f.label !== '출석 상태' &&
                                  f.label !== '출석상태',
                              )
                              .map((cf) => (
                                <td key={cf.id} className="px-3 py-2 text-slate-400">
                                  -
                                </td>
                              ))}
                            <td className="px-3 py-2 text-center text-slate-400">-</td>
                            <td className="px-3 py-2 text-slate-400">-</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-all"
              >
                취소
              </button>
              <button
                onClick={handleSaveEvent}
                className={`px-4 py-2 rounded-sm text-xs transition-colors hover:bg-[#dde5ee] active:bg-[#d1dae5] cursor-pointer ${ATTEND_STATUS_STYLES.unmarked.active}`}
              >
                {isNewEvent
                  ? '행사 생성하기'
                  : eventModalType === 'COLUMNS_ONLY'
                    ? '컬럼 설정 저장'
                    : '행사 정보 저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 양식 템플릿 생성 / 수정 ─── */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-4 ${MODAL_SURFACE}`}>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isNewTemplate ? '새 출석 양식 템플릿 생성' : '출석 양식 템플릿 수정'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  행사 특성에 맞추어 외부인 허용 여부와 수집할 추가 질문 항목을 정의합니다.
                </p>
              </div>
              <button
                onClick={() => setEditingTemplate(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">양식명 *</label>
                  <input
                    value={editingTemplate.title}
                    onChange={(e) =>
                      setEditingTemplate((prev) =>
                        prev ? { ...prev, title: e.target.value } : null,
                      )
                    }
                    placeholder="예: 28기 빅콘 출석 양식"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                  />
                </div>

              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">양식 설명</label>
                <textarea
                  rows={2}
                  value={editingTemplate.description}
                  onChange={(e) =>
                    setEditingTemplate((prev) =>
                      prev ? { ...prev, description: e.target.value } : null,
                    )
                  }
                  placeholder="양식의 사용 목적 및 출결 체크 기준을 입력하세요..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.allowExternal}
                    onChange={(e) =>
                      setEditingTemplate((prev) =>
                        prev ? { ...prev, allowExternal: e.target.checked } : null,
                      )
                    }
                    className="rounded accent-slate-900 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-900">
                    외부인 (게스트/참관객) 출석 허용
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600">기본 인증 방식:</span>
                  <select
                    value={editingTemplate.defaultCheckinMethod}
                    onChange={(e) =>
                      setEditingTemplate((prev) =>
                        prev
                          ? { ...prev, defaultCheckinMethod: e.target.value as CheckinMethod }
                          : null,
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-900 font-semibold"
                  >
                    <option value="QR_CODE">QR 코드</option>
                    <option value="CODE">4자리 번호 코드</option>
                    <option value="MANUAL">수동 체크</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Custom Form Fields List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="text-slate-800 font-bold text-xs flex items-center gap-1.5">
                    <span>추가 입력 필드 설정 ({editingTemplate.customFields.length}개)</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newField: CustomFormField = {
                        id: 'f_' + Date.now(),
                        label: '새 입력 항목',
                        type: 'TEXT',
                        isRequired: false,
                        target: 'ALL',
                      };
                      setEditingTemplate((prev) =>
                        prev ? { ...prev, customFields: [...prev.customFields, newField] } : null,
                      );
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>+ 필드 추가</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {editingTemplate.customFields.map((field, idx) => (
                    <div
                      key={field.id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[11px] font-mono text-slate-400 font-bold">
                            #{idx + 1}
                          </span>
                          <input
                            value={field.label}
                            onChange={(e) => {
                              const updated = editingTemplate.customFields.map((f, i) =>
                                i === idx ? { ...f, label: e.target.value } : f,
                              );
                              setEditingTemplate((prev) =>
                                prev ? { ...prev, customFields: updated } : null,
                              );
                            }}
                            placeholder="항목 라벨 (예: 소속 대학, 기념품 수령)"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = editingTemplate.customFields.filter(
                              (_, i) => i !== idx,
                            );
                            setEditingTemplate((prev) =>
                              prev ? { ...prev, customFields: updated } : null,
                            );
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="필드 삭제"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <div>
                          <label className="text-slate-500 block mb-0.5">입력 형태</label>
                          <select
                            value={field.type}
                            onChange={(e) => {
                              const newType = e.target.value as any;
                              const updated = editingTemplate.customFields.map((f, i) =>
                                i === idx
                                  ? {
                                      ...f,
                                      type: newType,
                                      options:
                                        newType === 'SELECT'
                                          ? f.options || ['옵션1', '옵션2']
                                          : undefined,
                                    }
                                  : f,
                              );
                              setEditingTemplate((prev) =>
                                prev ? { ...prev, customFields: updated } : null,
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-slate-800"
                          >
                            <option value="TEXT">텍스트 입력</option>
                            <option value="SELECT">선택형 (드롭다운)</option>
                            <option value="PHONE">연락처</option>
                            <option value="EMAIL">이메일</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-slate-500 block mb-0.5">대상자</label>
                          <select
                            value={field.target}
                            onChange={(e) => {
                              const updated = editingTemplate.customFields.map((f, i) =>
                                i === idx ? { ...f, target: e.target.value as any } : f,
                              );
                              setEditingTemplate((prev) =>
                                prev ? { ...prev, customFields: updated } : null,
                              );
                            }}
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-slate-800"
                          >
                            <option value="ALL">전체 대상</option>
                            <option value="EXTERNAL_ONLY">외부인 전용</option>
                            <option value="INTERNAL_ONLY">부원 전용</option>
                          </select>
                        </div>

                        <div className="flex items-end pb-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-800 font-semibold">
                            <input
                              type="checkbox"
                              checked={field.isRequired}
                              onChange={(e) => {
                                const updated = editingTemplate.customFields.map((f, i) =>
                                  i === idx ? { ...f, isRequired: e.target.checked } : f,
                                );
                                setEditingTemplate((prev) =>
                                  prev ? { ...prev, customFields: updated } : null,
                                );
                              }}
                              className="rounded accent-slate-900"
                            />
                            <span>필수 입력</span>
                          </label>
                        </div>
                      </div>

                      {field.type === 'SELECT' && (
                        <div className="pt-1">
                          <label className="text-slate-500 block text-[10px] mb-0.5">
                            선택지 (쉼표로 구분):
                          </label>
                          <input
                            value={field.options?.join(', ') || ''}
                            onChange={(e) => {
                              const opts = e.target.value
                                .split(',')
                                .map((s) => s.trim())
                                .filter(Boolean);
                              const updated = editingTemplate.customFields.map((f, i) =>
                                i === idx ? { ...f, options: opts } : f,
                              );
                              setEditingTemplate((prev) =>
                                prev ? { ...prev, customFields: updated } : null,
                              );
                            }}
                            placeholder="예: 수령 완료, 미수령"
                            className="w-full px-2 py-1 rounded bg-white border border-slate-200 text-slate-800 text-xs font-mono"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setEditingTemplate(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveTemplate}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${MODAL_PRIMARY_BTN}`}
              >
                양식 템플릿 저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
