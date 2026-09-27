import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  GripVertical,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';

import { STATUS_CFG } from '@/entities/attendance/model/constants';
import { sessionKey } from '@/entities/attendance/model/lib';
import {
  ADV_DIRECT_SELECT_LAST_WEEK,
  currentPeriodOf,
  defaultWeekNum,
  weekStatusOf,
  type WeekInfo,
} from '@/entities/attendance/model/week';
import type {
  AttendanceState,
  AttendanceStatus,
  SessionRecord,
} from '@/entities/attendance/model/types';
import {
  MENTORING_TYPE_LABELS,
  studyDisplayName,
  studyLeaderLabel,
  type MentoringTypeLabel,
} from '@/entities/study-team/model/db';
import type { Member, StudyTeamInfo } from '@/entities/study-team/model/types';
import type { UserRole } from '@/entities/user/model/types';
import { formatFileSize, isPdfFile, MAX_PDF_SIZE_BYTES } from '@/shared/lib/file';
import { Btn } from '@/shared/ui/Btn';
import { PdfPreviewModal } from '@/shared/ui/PdfPreviewModal';
import { BRAND_SELECTED, MODAL_SURFACE } from '@/shared/ui/modalStyles';

// ─── Page: 출결 입력 (HOST 스터디장 전용 페이지) ───────────────────────────────

interface MemberRow {
  m: Member;
  rowKey: string;
  typeLabel: MentoringTypeLabel | null;
}

// 출결 입력은 출석/결석만 고른다(미정 버튼 없음).
const STATUS_BTNS: { id: AttendanceStatus; label: string }[] = [
  { id: 'present', label: '출석' },
  { id: 'absent', label: '결석' },
];

const padDatePart = (value: string | number) => String(value).padStart(2, '0');

function toLocalDateTimeValue(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())} ${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`;
}

function formatSubmittedAt(value: string) {
  const match = value.match(
    /^\d{4}[-.]\s*(\d{1,2})[-.]\s*(\d{1,2})[.\sT]+(?:(오전|오후)\s*)?(\d{1,2})(?::|시\s*)(\d{1,2})?/,
  );

  if (!match) return value;

  const [, month, day, meridiem, rawHour, minute = '00'] = match;
  let hour = Number(rawHour);

  if (meridiem === '오전' && hour === 12) hour = 0;
  if (meridiem === '오후' && hour < 12) hour += 12;

  return `${padDatePart(month)}-${padDatePart(day)} ${padDatePart(hour)}:${padDatePart(minute)}`;
}

const ATTEND_STATUS_STYLES: Record<AttendanceStatus, { active: string; inactive: string }> = {
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
  remote: {
    active: 'bg-[#eef2ff] text-[#4338ca] font-bold border border-[#c7d2fe] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#4338ca] hover:bg-white/60 border border-transparent font-medium',
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

const CLOSED_NOTICE_DURATION_MS = 3000;
const CLOSED_NOTICE_GAP_PX = 8;
const PDF_TOAST_DURATION_MS = 3000;

const EDIT_ICON_BUTTON_CLASS =
  'absolute right-2 top-1/2 z-10 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-slate-500 transition-[background-color,color,transform] duration-150 after:absolute after:-inset-1 hover:bg-slate-200 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 cursor-pointer';

export function InputPage({
  attendance,
  setAttendance,
  onRequestException,
  currentHostTeam,
  advTeams: propAdvTeams,
  studyTeams,
  membersMap,
  currentRole,
  setMembersMap,
  pageTitle,
  weeks,
}: {
  attendance: AttendanceState;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceState>>;
  onRequestException: (
    team: string,
    week: string,
    memberName: string,
    from: AttendanceStatus,
    to: AttendanceStatus,
    reason: string,
  ) => void;
  currentHostTeam: string;
  advTeams?: StudyTeamInfo[];
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  setMembersMap?: React.Dispatch<React.SetStateAction<Record<string, Member[]>>>;
  currentRole: UserRole;
  pageTitle?: string;
  /** 주차와 활성 상태(DB의 weeks). 진행 예정 주차는 입력할 수 없고, 진행 중 주차만 입력할 수 있다. */
  weeks: WeekInfo[];
}) {
  const [termPeriod, setTermPeriod] = useState<'방학' | '학기'>('방학');

  const isAdv = pageTitle?.includes('ADV') ?? false;
  const isHost = currentRole === 'HOST';

  const effectiveTeams = useMemo(
    () => (isAdv ? (propAdvTeams ?? []) : studyTeams),
    [isAdv, propAdvTeams, studyTeams],
  );

  // 선택한 팀의 id
  const [selectedTeam, setSelectedTeam] = useState<string>(() => {
    if (currentRole === 'HOST' && currentHostTeam) return currentHostTeam;
    return (isAdv ? (propAdvTeams ?? []) : studyTeams)[0]?.id ?? '';
  });

  // HOST 계정인 경우 본인 팀만 필터링, 관리자인 경우 전체 팀 노출
  const displayedTeams = useMemo(() => {
    if (isHost) {
      const myTeam = currentHostTeam || selectedTeam;
      const filtered = effectiveTeams.filter((t) => t.id === myTeam);
      return filtered.length > 0 ? filtered : effectiveTeams.slice(0, 1);
    }
    // 스터디는 스터디 출결 관리와 같이 방학/학기별로 나눠 보여준다.
    if (isAdv) return effectiveTeams;
    const periodType = termPeriod === '방학' ? '방학 스터디' : '학기 스터디';
    return effectiveTeams.filter((t) => t.studyType === periodType);
  }, [isHost, isAdv, termPeriod, currentHostTeam, selectedTeam, effectiveTeams]);

  useEffect(() => {
    if (currentRole === 'HOST' && currentHostTeam) {
      setSelectedTeam(currentHostTeam);
      return;
    }
    // 스터디/ADV 탭을 오가면 선택한 팀이 그 탭의 목록에 없을 수 있다. 이때는 목록의 첫 팀을 고른다.
    if (!effectiveTeams.some((t) => t.id === selectedTeam)) {
      setSelectedTeam(effectiveTeams[0]?.id ?? '');
    }
  }, [effectiveTeams, currentRole, currentHostTeam, selectedTeam]);

  // 지금이 방학인데 학기 탭으로 넘어가면 한 번 확인받는다(학기 주차는 아직 시작 전).
  const [isSemesterWarningOpen, setIsSemesterWarningOpen] = useState(false);

  const applyPeriodChange = (period: '방학' | '학기') => {
    setTermPeriod(period);
    setIsSemesterWarningOpen(false);
    if (!isAdv) {
      const periodTarget = period === '방학' ? '방학 스터디' : '학기 스터디';
      const available = (studyTeams || []).filter((s) => s.studyType === periodTarget);
      if (available.length > 0 && currentRole !== 'HOST') {
        setSelectedTeam(available[0].id);
      }
    } else {
      // ADV는 방학 1~8주차, 학기 9~16주차. 접근할 수 있는 주차 중 기본 주차(진행 중 → 마지막 종료 → 첫 주차)로 옮긴다.
      setWeekNum(
        defaultWeekNum(
          weeks.filter(
            (w) =>
              (period === '학기' ? w.weekNum >= 9 : w.weekNum <= 8) &&
              !(w.weekNum <= ADV_DIRECT_SELECT_LAST_WEEK),
          ),
        ),
      );
    }
    if (weekScrollRef.current) {
      weekScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  const handlePeriodChange = (period: '방학' | '학기') => {
    if (period === termPeriod) return;
    // 스터디는 학기에도 1~8주차를 쓰므로 학기 시작 전 경고 대상이 아니다(ADV만 9~16주차).
    if (isAdv && period === '학기' && currentPeriodOf(weeks) === '방학') {
      setIsSemesterWarningOpen(true);
      return;
    }
    applyPeriodChange(period);
  };

  // 화면에 보이는 주차 표: ADV 학기는 9~16주차, 그 외에는 1~8주차
  const visibleWeeks = useMemo(
    () => weeks.filter((w) => (isAdv && termPeriod === '학기' ? w.weekNum >= 9 : w.weekNum <= 8)),
    [weeks, isAdv, termPeriod],
  );
  // ADV는 3주차까지 ADV 출결 관리 탭에서 입력·제출하므로 이 탭에서는 그 주차에 접근할 수 없다.
  const isBlockedWeek = (targetWeek: number) => isAdv && targetWeek <= ADV_DIRECT_SELECT_LAST_WEEK;
  const accessibleWeeks = useMemo(
    () => visibleWeeks.filter((w) => !(isAdv && w.weekNum <= ADV_DIRECT_SELECT_LAST_WEEK)),
    [visibleWeeks, isAdv],
  );
  const [weekNum, setWeekNum] = useState(() =>
    defaultWeekNum(
      weeks.filter((w) => w.weekNum <= 8 && !(isAdv && w.weekNum <= ADV_DIRECT_SELECT_LAST_WEEK)),
    ),
  );
  const weekStatus = weekStatusOf(weeks, weekNum);
  const isPastWeek = weekStatus === 'CLOSED';
  const isFutureWeek = weekStatus === 'UPCOMING';
  const isOpenWeek = weekStatus === 'OPEN';
  // 아직 오지 않은(진행 예정) 주차도 미리 입력할 수 있다. 제출은 세션이 열린 뒤에 한다.
  const isInputWeek = isOpenWeek || isFutureWeek;
  const [isEditing, setIsEditing] = useState(false);
  const [isClosedNoticeOpen, setIsClosedNoticeOpen] = useState(false);
  const [isPdfToastOpen, setIsPdfToastOpen] = useState(false);
  const [closedNoticePos, setClosedNoticePos] = useState<{ top: number; right: number } | null>(
    null,
  );
  const closedNoticeAnchorRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isClosedNoticeOpen) {
      return;
    }
    const timer = window.setTimeout(() => setIsClosedNoticeOpen(false), CLOSED_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isClosedNoticeOpen]);

  // 토스트는 수정 버튼 바로 아래에 한 번 배치하고, 스크롤·리사이즈로 버튼과 어긋나기 전에 닫는다.
  useEffect(() => {
    const anchor = closedNoticeAnchorRef.current;
    if (!isClosedNoticeOpen || !anchor) {
      setClosedNoticePos(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    setClosedNoticePos({
      top: rect.bottom + CLOSED_NOTICE_GAP_PX,
      right: Math.max(window.innerWidth - rect.right, CLOSED_NOTICE_GAP_PX),
    });
    const dismiss = () => setIsClosedNoticeOpen(false);
    window.addEventListener('scroll', dismiss, { capture: true, passive: true });
    window.addEventListener('resize', dismiss);
    return () => {
      window.removeEventListener('scroll', dismiss, { capture: true });
      window.removeEventListener('resize', dismiss);
    };
  }, [isClosedNoticeOpen]);

  useEffect(() => {
    if (!isPdfToastOpen) {
      return;
    }
    const timer = window.setTimeout(() => setIsPdfToastOpen(false), PDF_TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [isPdfToastOpen]);

  function showClosedNotice(button: HTMLElement) {
    closedNoticeAnchorRef.current = button;
    setIsClosedNoticeOpen(true);
  }

  // ADV 탭 전환 또는 방학/학기 변경 시 주차 동기화
  useEffect(() => {
    if (!accessibleWeeks.some((w) => w.weekNum === weekNum)) {
      setWeekNum(defaultWeekNum(accessibleWeeks));
    }
  }, [accessibleWeeks, weekNum]);

  // 미래 주차(진행 예정) 이동 전 확인 경고 팝업 상태 및 핸들러
  const [futureWeekWarning, setFutureWeekWarning] = useState<number | null>(null);

  const handleSelectWeek = (targetWeek: number) => {
    if (targetWeek === weekNum || isBlockedWeek(targetWeek)) return;
    if (weekStatusOf(weeks, targetWeek) === 'UPCOMING') {
      setFutureWeekWarning(targetWeek);
      return;
    }
    setWeekNum(targetWeek);
  };

  const confirmMoveToFutureWeek = () => {
    if (futureWeekWarning !== null) {
      setWeekNum(futureWeekWarning);
      setFutureWeekWarning(null);
    }
  };
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [extStatuses, setExtStatuses] = useState<Record<string, Record<string, AttendanceStatus>>>(
    {},
  );

  const [uploadedImage, setUploadedImage] = useState<{
    file: File | null;
    url: string | null;
    name: string | null;
    size: string | null;
  }>({
    file: null,
    url: null,
    name: null,
    size: null,
  });

  // 멘멘 스터디 PDF 첨부 초안. 제출 전까지는 여기에만 담고, 제출할 때 출결 기록에 합친다.
  // url이 null이면 기존 첨부를 지운 상태이고, 초안이 없으면(null) 기존 기록을 그대로 쓴다.
  const [pdfDraft, setPdfDraft] = useState<{
    key: string;
    url: string | null;
    name: string | null;
    size: string | null;
  } | null>(null);

  const [pdfPreview, setPdfPreview] = useState<{ url: string; name: string } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqMember, setReqMember] = useState('');
  const [reqToStatus, setReqToStatus] = useState<AttendanceStatus>('present');
  const [reqReason, setReqReason] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Column Resizing for Member Table (like InternalCategoryAttendancePage)
  const DEFAULT_COL_WIDTHS = {
    name: 110,
    year: 75,
    track: 85,
    type: 64,
    status: 150,
    memo: 280,
    actions: 45,
  };

  const statusColWidth = 150;

  const MIN_COL_WIDTHS: Record<string, number> = {
    name: 80,
    year: 55,
    track: 65,
    type: 52,
    status: 130,
    memo: 180,
    actions: 40,
  };

  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);

  useEffect(() => {
    setColWidths((prev) => ({
      ...prev,
      status: statusColWidth,
    }));
  }, [statusColWidth]);
  const resizingCol = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);

  const handleResizeStart = (e: React.MouseEvent<HTMLElement>, key: string, minWidth = 50) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget.closest('th') ||
      e.currentTarget.closest('td')) as HTMLElement | null;
    const startX = e.clientX;
    const startWidth = cell
      ? cell.offsetWidth
      : colWidths[key as keyof typeof colWidths] || minWidth;
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingCol.current) return;
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - resizingCol.current.startX;
      const targetWidth = Math.max(minWidth, resizingCol.current.startWidth + deltaX);
      const activeKey = resizingCol.current.key;
      setColWidths((prev) => ({ ...prev, [activeKey]: targetWidth }));
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      setResizingColKey(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Horizontal Week Scroll State
  const weekScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkWeekScroll = () => {
    if (weekScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = weekScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  useEffect(() => {
    checkWeekScroll();
    const handleResize = () => checkWeekScroll();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleScrollWeeks = (direction: 'left' | 'right') => {
    if (weekScrollRef.current) {
      const offset = direction === 'left' ? -240 : 240;
      weekScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
      setTimeout(checkWeekScroll, 300);
    }
  };

  // Split Panel & Fullscreen state (InternalCategoryAttendancePage 스타일)
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState<number>(24);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handlePointerMove(e: MouseEvent | TouchEvent) {
      if (!containerRef.current) {
        return;
      }
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.min(Math.max(rawRatio, 15), 65);
      setSplitRatio(clampedRatio);
    }

    function handlePointerUp() {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging]);

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  const weekId = `w${weekNum}`;
  const key = sessionKey(weekId, 'study', selectedTeam);
  // 제출 전 입력(출결·비고)은 화면 초안에만 두고, 제출(또는 수정 저장)할 때 DB에 반영한다. 그때까지 DB는 미정이다.
  const draftKey = key || weekId;
  const rec: SessionRecord = attendance?.[key]
    ? attendance[key]
    : {
        statuses: {},
        memos: {},
        photo: null,
        photoUrl: null,
        submitted: false,
        submittedAt: null,
      };

  const isSubmitted = Boolean(rec?.submitted);
  // 열려있는 주차에서는 미제출 상태이거나, 사용자가 [수정] 버튼을 눌렀을 때만 수정 가능
  const canEdit = isInputWeek && (!isSubmitted || isEditing);
  // 파일(PDF)은 출결과 같은 규칙이다: 제출 전이거나, 제출 후에는 수정 모드(연필 버튼)에서만 올리고 지울 수 있다.
  const canEditPdf = canEdit && !isFutureWeek;
  // 활동 사진도 파일과 같은 규칙이다: 제출 전이거나, 제출 후에는 수정 모드(연필 버튼)에서만 바꾼다.
  const canEditPhoto = canEdit && !isFutureWeek;

  // 팀이나 주차 변경 시 수정 모드 자동 해제
  useEffect(() => {
    setIsEditing(false);
  }, [selectedTeam, weekNum]);

  const members = membersMap[selectedTeam] ?? [];

  // 멘멘 스터디는 부원마다 멘멘/친바 두 줄로 출결을 입력한다(스터디 출결 관리와 동일).
  const isMentoringTeam =
    !isAdv && effectiveTeams.find((t) => t.id === selectedTeam)?.studyKind === 'MENTORING';
  const memberRows = members.flatMap<MemberRow>((m) =>
    isMentoringTeam
      ? MENTORING_TYPE_LABELS.map((typeLabel) => ({ m, rowKey: `${m.id}:${typeLabel}`, typeLabel }))
      : [{ m, rowKey: m.id, typeLabel: null }],
  );

  // 스터디 출결 관리의 목록과 같은 구성: 멘멘(방학 전용, 부문별) / 일반.
  const studyTeamGroups = [
    {
      label: '멘멘 스터디',
      teams: displayedTeams.filter((t) => termPeriod === '방학' && t.studyKind === 'MENTORING'),
    },
    {
      label: '일반 스터디',
      teams: displayedTeams.filter((t) => termPeriod === '학기' || t.studyKind !== 'MENTORING'),
    },
  ];
  const mentoringTrackGroups = [
    { label: '분석', tracks: ['분석'] },
    { label: '시각화', tracks: ['시각화'] },
    { label: '엔지', tracks: ['엔지니어링', '엔지'] },
  ].map(({ label, tracks }) => ({
    label,
    teams: studyTeamGroups[0].teams.filter((t) => tracks.includes(t.track ?? '')),
  }));

  const renderStudyTeamCard = (team: StudyTeamInfo) => {
    const isSelected = selectedTeam === team.id;
    return (
      <div
        key={team.id || team.teamName}
        onClick={() => setSelectedTeam(team.id)}
        className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
          isSelected
            ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
            : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <h4
              className={`text-sm font-bold truncate ${
                isSelected
                  ? 'text-slate-950 font-bold'
                  : 'text-slate-900 group-hover:text-slate-950'
              }`}
            >
              {studyDisplayName(team)}
            </h4>
            {team.leaderName && (
              <p className="text-[11px] text-slate-500 font-medium">
                스터디장: {studyLeaderLabel(team, membersMap[team.id] ?? [])}
              </p>
            )}
          </div>
          <ChevronRight
            size={16}
            className={`shrink-0 transition-transform ${
              isSelected
                ? 'text-slate-500 translate-x-0.5'
                : 'text-slate-300 group-hover:text-slate-500'
            }`}
          />
        </div>
      </div>
    );
  };

  function handleDeleteMember(memberId: string) {
    if (!canEdit) {
      return;
    }
    if (window.confirm('해당 부원을 스터디 명단에서 삭제하시겠습니까?')) {
      if (setMembersMap) {
        setMembersMap((prev) => {
          const existing = prev[selectedTeam] || [];
          return {
            ...prev,
            [selectedTeam]: existing.filter((m) => m.id !== memberId),
          };
        });
      }
    }
  }
  const currentStudy =
    effectiveTeams.find((s) => s.id === selectedTeam) ||
    studyTeams.find((s) => s.id === selectedTeam);
  const selectedTeamName = currentStudy?.teamName ?? '';

  const currentPhotoUrl = uploadedImage?.url || rec?.photoUrl || null;
  const currentPhotoName = uploadedImage?.name || rec?.photoName || rec?.photo || null;
  const currentPhotoSize = uploadedImage?.size || rec?.photoSize || null;

  const activePdfDraft = pdfDraft?.key === key ? pdfDraft : null;
  const currentPdfUrl = activePdfDraft ? activePdfDraft.url : (rec?.pdfUrl ?? null);
  const currentPdfName = activePdfDraft ? activePdfDraft.name : (rec?.pdfName ?? null);
  const currentPdfSize = activePdfDraft ? activePdfDraft.size : (rec?.pdfSize ?? null);

  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    if (!currentPhotoUrl) {
      setPhotoDimensions(null);
      return;
    }
    const img = new Image();
    img.src = currentPhotoUrl;
    const update = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setPhotoDimensions({
          width: img.naturalWidth,
          height: img.naturalHeight,
        });
      }
    };
    if (img.complete && img.naturalWidth) {
      update();
    } else {
      img.onload = update;
    }
  }, [currentPhotoUrl]);

  const photoDisplaySize = useMemo(() => {
    if (!photoDimensions || photoDimensions.width === 0 || photoDimensions.height === 0) {
      return null;
    }
    const { width, height } = photoDimensions;
    const ratio = width / height;
    const maxW = 360;
    const maxH = 240;
    let w = maxW;
    let h = maxW / ratio;
    if (h > maxH) {
      h = maxH;
      w = maxH * ratio;
    }
    return {
      width: Math.round(w),
      height: Math.round(h),
      aspectRatio: ratio,
    };
  }, [photoDimensions]);

  function getStatus(memberId: string): AttendanceStatus {
    // DB에 없는 값은 미정으로 보인다.
    const fallbackStatus: AttendanceStatus = 'unmarked';
    const rawStatus =
      extStatuses[draftKey]?.[memberId] ?? rec?.statuses?.[memberId] ?? fallbackStatus;
    // 출석/결석/미정만 사용한다. 그 외 상태는 결석으로 본다.
    if (rawStatus !== 'present' && rawStatus !== 'absent' && rawStatus !== 'unmarked') {
      return 'absent';
    }
    // 세션이 열린 주차는 고르지 않은 값(DB의 미정 포함)을 출석에서 시작하고, 결석인 사람만 바꿔 제출한다.
    if (isOpenWeek && rawStatus === 'unmarked') {
      return 'present';
    }
    return rawStatus;
  }

  const renderStatusText = (st: AttendanceStatus) => {
    switch (st) {
      case 'present':
        return <span className="text-emerald-600 font-bold">출석</span>;
      case 'remote':
        return <span className="text-indigo-600 font-bold">비대면</span>;
      case 'late':
        return <span className="text-amber-600 font-bold">지각</span>;
      case 'earlyLeave':
        return <span className="text-amber-700 font-bold">조퇴</span>;
      case 'absent':
        return <span className="text-rose-600 font-bold">결석</span>;
      case 'excusedAbsent':
        return <span className="text-blue-600 font-bold">인정결석</span>;
      case 'unexcusedLate':
        return <span className="text-orange-600 font-bold">무단지각</span>;
      case 'unexcusedAbsent':
        return <span className="text-red-700 font-bold">무단결석</span>;
      case 'unmarked':
      default:
        return <span className="text-slate-400 font-normal">미정</span>;
    }
  };

  function setStatus(memberId: string, val: AttendanceStatus) {
    // 세션 오픈 전에는 버튼만 보이고 선택할 수 없다.
    if (!canEdit || isFutureWeek) {
      return;
    }
    setExtStatuses((prev) => ({
      ...prev,
      [draftKey]: { ...(prev[draftKey] ?? {}), [memberId]: val },
    }));
  }

  function getMemo(memberId: string): string {
    const memoKey = `${draftKey}-${memberId}`;
    return memos[memoKey] ?? rec?.memos?.[memberId] ?? '';
  }

  function setMemo(memberId: string, val: string) {
    if (!canEdit) {
      return;
    }
    const memoKey = `${draftKey}-${memberId}`;
    setMemos((prev) => ({ ...prev, [memoKey]: val }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canEditPhoto) {
      return;
    }
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    const url = URL.createObjectURL(file);
    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    setUploadedImage({
      file,
      url,
      name: file.name,
      size: sizeStr,
    });
    if (key) {
      setAttendance((prev) => {
        const curRec = prev?.[key];
        if (!curRec) return prev;
        return {
          ...prev,
          [key]: {
            ...curRec,
            photo: file.name,
            photoUrl: url,
            photoName: file.name,
            photoSize: sizeStr,
          },
        };
      });
    }
  }

  function handleRemovePhoto() {
    if (!canEditPhoto) {
      return;
    }
    setUploadedImage({ file: null, url: null, name: null, size: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (key) {
      setAttendance((prev) => {
        const curRec = prev?.[key];
        if (!curRec) return prev;
        return {
          ...prev,
          [key]: {
            ...curRec,
            photo: null,
            photoUrl: null,
            photoName: null,
            photoSize: null,
          },
        };
      });
    }
  }

  function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // 같은 파일을 다시 골라도 change 이벤트가 나게 한다.
    if (!canEditPdf || !file) {
      return;
    }
    if (!isPdfFile(file)) {
      alert('PDF 파일만 첨부할 수 있습니다.');
      return;
    }
    if (file.size > MAX_PDF_SIZE_BYTES) {
      alert(`PDF는 ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB 이하만 첨부할 수 있습니다.`);
      return;
    }
    applyPdf({ url: URL.createObjectURL(file), name: file.name, size: formatFileSize(file.size) });
    setIsPdfToastOpen(true);
  }

  function handleRemovePdf() {
    if (!canEditPdf) {
      return;
    }
    applyPdf({ url: null, name: null, size: null });
  }

  /** 초안에 담아 두었다가 제출(수정 모드에서는 저장 체크)할 때 출결 기록에 합친다. */
  function applyPdf(next: { url: string | null; name: string | null; size: string | null }) {
    setPdfDraft({ key, ...next });
  }

  function handleCancelEdit() {
    setPdfDraft(null);
    setExtStatuses((prev) => {
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
    setMemos((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([memoKey]) => !memoKey.startsWith(`${draftKey}-`)),
      ),
    );
    setUploadedImage({ file: null, url: null, name: null, size: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // 저장하지 않은 출결·비고 초안을 버리고 제출된 값으로 돌아간다.
    setExtStatuses((prev) => {
      const next = { ...prev };
      delete next[draftKey];
      return next;
    });
    setMemos((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([memoKey]) => !memoKey.startsWith(`${draftKey}-`)),
      ),
    );
    setIsEditing(false);
  }

  function submit() {
    // 아직 오지 않은 주차는 미리 입력만 해 둘 수 있고 제출은 세션이 열린 뒤에 한다.
    if (!key || !canEdit || isFutureWeek) {
      return;
    }

    if (!currentPhotoUrl) {
      const confirmNoPhoto = window.confirm(
        '출석 인증 사진이 첨부되지 않았습니다.\n운영지원팀의 확인을 위해 사진 업로드가 필요합니다.\n사진 없이 그대로 제출하시겠습니까?',
      );
      if (!confirmNoPhoto) {
        return;
      }
    }

    const currentStatuses: Record<string, AttendanceStatus> = {};
    const currentMemos: Record<string, string> = {};
    members.forEach((m) => {
      currentStatuses[m.id] = getStatus(m.id);
      const memo = getMemo(m.id);
      if (memo) {
        currentMemos[m.id] = memo;
      }
    });
    memberRows.forEach(({ rowKey }) => {
      if (rowKey.includes(':')) {
        currentStatuses[rowKey] = getStatus(rowKey);
      }
    });

    setAttendance((prev) => ({
      ...prev,
      [key]: {
        statuses: currentStatuses,
        memos: currentMemos,
        submitted: true,
        photo: currentPhotoName || `스터디_${selectedTeamName}_${weekNum}주차.jpg`,
        photoUrl: currentPhotoUrl,
        photoName: currentPhotoName || `스터디_${selectedTeamName}_${weekNum}주차.jpg`,
        photoSize: currentPhotoSize || '2.1 MB',
        // PDF는 멘멘 스터디만 첨부한다.
        pdfUrl: isMentoringTeam ? currentPdfUrl : null,
        pdfName: isMentoringTeam ? currentPdfName : null,
        pdfSize: isMentoringTeam ? currentPdfSize : null,
        submittedAt: toLocalDateTimeValue(new Date()),
        confirmedByAdmin: false,
      },
    }));
    setPdfDraft(null);
    setIsEditing(false);
  }

  function handleSendRequest() {
    if (!reqMember || !reqReason.trim()) {
      alert('부원과 수정 사유를 입력해 주세요.');
      return;
    }
    const mem = members.find((m) => m.id === reqMember);
    if (!mem) {
      return;
    }
    const fromStatus = getStatus(reqMember);
    onRequestException(
      selectedTeam,
      `${weekNum}주차`,
      mem.name,
      fromStatus,
      reqToStatus,
      reqReason,
    );
    setShowRequestModal(false);
    setReqReason('');
    alert('운영지원팀에 출결 수정 요청이 전송되었습니다.');
  }

  const effectiveColWidths = useMemo(() => {
    if (canEdit) {
      return colWidths;
    }
    // 텍스트만 보일 때: 이름/기수/부문/출결은 컴팩트하게 맞추고, 남는 공간은 비고가 길게 채움
    return {
      name: 110,
      year: 70,
      track: 90,
      type: 64,
      status: 85,
      memo: 0,
      actions: 0,
    };
  }, [canEdit, colWidths]);

  const tableMinWidth = useMemo(() => {
    if (!canEdit) {
      return 0; // 텍스트만 보일 때는 불필요한 가로 스크롤 제거 및 컴팩트 맞춤
    }
    let total =
      (colWidths.name || 110) +
      (colWidths.year || 75) +
      (colWidths.track || 85) +
      (isMentoringTeam ? colWidths.type || 64 : 0) +
      (colWidths.status || statusColWidth) +
      (colWidths.memo || 280);
    if (canEdit) {
      total += colWidths.actions || 45;
    }
    return total;
  }, [colWidths, canEdit, isMentoringTeam]);

  return (
    <div
      className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Header & Global Actions (InternalCategoryAttendancePage 스타일 통일) ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
            {pageTitle || 'ADV Term 출결 입력'}
          </h2>

          {/* 방학 / 학기 토글 버튼 (Segmented Control) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold select-none">
            <button
              type="button"
              onClick={() => handlePeriodChange('방학')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === '방학'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              방학
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('학기')}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === '학기'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              학기
            </button>
          </div>
        </div>
      </div>

      {/* ─── 주차 선택 토글 바 (수평 스크롤 & 위치 완전 고정) ─── */}
      <div className="relative flex items-center shrink-0 w-full pt-0.5 pb-2.5">
        {/* Left Scroll Arrow Button */}
        {canScrollLeft && (
          <div className="absolute left-0 z-20 flex items-center h-full pr-4 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollWeeks('left')}
              className="pointer-events-auto w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              title="이전 주차 보기"
            >
              <ChevronLeft size={13} />
            </button>
          </div>
        )}

        {/* Scrollable Buttons Container: 버튼 너비 및 테두리 완전 고정 */}
        <div
          ref={weekScrollRef}
          onScroll={checkWeekScroll}
          className="flex items-center gap-1.5 overflow-x-auto py-1 px-1 w-full flex-nowrap"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {visibleWeeks.map((w) => {
            const isActive = w.weekNum === weekNum;
            const isWeekFuture = w.status === 'UPCOMING';
            const isBlocked = isBlockedWeek(w.weekNum);

            return (
              <button
                key={w.id}
                type="button"
                disabled={isBlocked}
                onClick={() => handleSelectWeek(w.weekNum)}
                title={
                  isBlocked
                    ? `${w.weekNum}주차는 ADV 출결 관리 탭에서 입력합니다`
                    : isWeekFuture
                      ? `${w.weekNum}주차 (진행 예정)`
                      : `${w.weekNum}주차`
                }
                className={`w-[58px] h-[34px] rounded-xl text-xs font-bold transition-colors flex items-center justify-center shrink-0 select-none relative ${
                  isBlocked
                    ? 'cursor-not-allowed border border-slate-200/60 bg-slate-100/60 text-slate-300'
                    : isActive
                      ? BRAND_SELECTED + ' cursor-pointer'
                      : isWeekFuture
                        ? 'text-slate-400 hover:text-slate-700 bg-slate-50/70 border border-slate-200/70 cursor-pointer'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white border border-slate-200/90 shadow-2xs cursor-pointer'
                }`}
              >
                <span>{w.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Scroll Arrow Button */}
        {canScrollRight && (
          <div className="absolute right-0 z-20 flex items-center h-full pl-4 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={() => handleScrollWeeks('right')}
              className="pointer-events-auto w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-700 hover:text-slate-950 hover:bg-slate-50 transition-colors cursor-pointer"
              title="다음 주차 보기"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      <div
        ref={containerRef}
        className={`relative w-full flex-1 min-h-0 transition-all ${
          isFullScreen ? 'block h-full' : 'flex flex-row gap-0 h-full min-w-0'
        }`}
      >
        {/* ─── 좌측: 팀 목록 패널 (두번째 사진 스타일) ─── */}
        {!isFullScreen && (
          <div
            style={{
              width: `${splitRatio}%`,
              minWidth: '200px',
            }}
            className="space-y-2.5 shrink-0 h-full overflow-y-auto pr-1.5"
          >
            {/* 사이드바 상단: 헤더 */}
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isHost ? '내 담당 팀' : isAdv ? null : '스터디 팀'}
                </span>
                {isHost && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    HOST 전용
                  </span>
                )}
              </div>
            </div>

            {/* 등록된 팀이 없을 때 (Empty State) */}
            {displayedTeams.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3 my-2">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 mx-auto shadow-2xs">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {isAdv ? '개설된 팀이 없습니다' : '등록된 스터디가 없습니다'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAdv
                      ? 'ADV 출결 관리에서 팀을 개설해 주세요.'
                      : '스터디 출결 관리에서 스터디를 생성해 주세요.'}
                  </p>
                </div>
              </div>
            ) : isAdv ? (
              <div className="space-y-4">
                {(['분석', '시각화', '엔지니어링'] as const).map((trackName) => {
                  const trackTeams = displayedTeams.filter((t) => t.category === trackName);
                  if (trackTeams.length === 0) return null;

                  return (
                    <div key={trackName} className="space-y-2">
                      <div className="px-1 pt-1">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          {trackName}
                        </span>
                      </div>

                      <div className="space-y-2">
                        {trackTeams.map((team) => {
                          const isSelected = selectedTeam === team.id;
                          return (
                            <div
                              key={team.id || team.teamName}
                              onClick={() => setSelectedTeam(team.id)}
                              className={`relative rounded-2xl border transition-all cursor-pointer p-3.5 group select-none ${
                                isSelected
                                  ? 'bg-slate-100/80 border-slate-300 shadow-2xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <h4
                                    className={`text-sm font-bold truncate ${
                                      isSelected
                                        ? 'text-slate-950 font-bold'
                                        : 'text-slate-900 group-hover:text-slate-950'
                                    }`}
                                  >
                                    {team.studyName && team.studyName !== team.teamName
                                      ? `${team.teamName} (${team.studyName})`
                                      : team.teamName}
                                  </h4>
                                  {team.leaderName && (
                                    <p className="text-[11px] text-slate-500 font-medium">
                                      팀장: {team.leaderName}
                                    </p>
                                  )}
                                </div>

                                <ChevronRight
                                  size={16}
                                  className={`shrink-0 transition-transform ${
                                    isSelected
                                      ? 'text-slate-500 translate-x-0.5'
                                      : 'text-slate-300 group-hover:text-slate-500'
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-5">
                {studyTeamGroups
                  .filter((group) => group.label !== '멘멘 스터디' || termPeriod === '방학')
                  .map((group) => (
                    <section key={group.label} className="space-y-2.5">
                      <h3 className="px-1 text-[11px] font-bold text-slate-400 select-none">
                        {group.label}
                      </h3>
                      {group.label === '멘멘 스터디' ? (
                        <div className="space-y-4 pl-2">
                          {mentoringTrackGroups.map((trackGroup) => (
                            <div key={trackGroup.label} className="space-y-2">
                              <h4 className="px-1 text-[11px] font-bold text-slate-500 select-none">
                                {trackGroup.label}
                              </h4>
                              {trackGroup.teams.length === 0 ? (
                                <p className="px-1 py-1 text-[11px] text-slate-400">
                                  등록된 스터디가 없습니다.
                                </p>
                              ) : (
                                <div className="space-y-2.5">
                                  {trackGroup.teams.map(renderStudyTeamCard)}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : group.teams.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-3 py-4 text-center text-[11px] text-slate-400">
                          등록된 {group.label}가 없습니다.
                        </div>
                      ) : (
                        <div className="space-y-2.5">{group.teams.map(renderStudyTeamCard)}</div>
                      )}
                    </section>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ─── RESIZABLE DRAGGER / DIVIDER BAR ─── */}
        {!isFullScreen && (
          <div
            onMouseDown={handleDividerMouseDown}
            onTouchStart={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            className={`flex w-4 shrink-0 -mx-0.5 items-center justify-center cursor-col-resize group self-stretch z-20 select-none py-12 transition-colors ${
              isDragging ? 'bg-slate-200/50' : 'hover:bg-slate-100/80'
            }`}
            title="마우스로 드래그하여 패널 너비 조절"
          >
            <div
              className={`w-1 h-14 rounded-full transition-all flex flex-col items-center justify-center ${
                isDragging
                  ? 'bg-slate-700 h-20'
                  : 'bg-slate-300 group-hover:bg-slate-500 group-hover:h-16'
              }`}
            >
              <GripVertical
                size={10}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        )}

        {/* ─── 우측: 사진 & 출결 입력 영역 (두번째 사진 스타일) ─── */}
        <div
          style={{
            width: isFullScreen ? '100%' : `${100 - splitRatio}%`,
            minWidth: isFullScreen ? undefined : '320px',
          }}
          className={`min-w-0 flex-1 h-full overflow-y-auto ${
            displayedTeams.length === 0
              ? ''
              : 'rounded-2xl border border-slate-200/90 bg-white p-6 lg:p-7 shadow-sm space-y-5 animate-in slide-in-from-right duration-150'
          }`}
        >
          {displayedTeams.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-4 shadow-2xs my-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto shadow-2xs">
                <FolderPlus size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  {isAdv ? '개설된 팀이 없습니다' : '등록된 스터디가 없습니다'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isHost
                    ? '배정된 담당 팀이 없습니다. 운영지원팀에 문의하세요.'
                    : isAdv
                      ? 'ADV 출결 관리에서 팀을 개설하면 출결 입력을 시작할 수 있습니다.'
                      : '스터디 출결 관리에서 스터디를 생성하면 출결 입력을 시작할 수 있습니다.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={!canEditPhoto}
                className="hidden"
              />

              {/* 우측 상단 헤더: 선택된 팀 이름 & 제출 상태/버튼 & 전체화면 토글 */}
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug truncate">
                      {currentStudy
                        ? currentStudy.studyName && currentStudy.studyName !== currentStudy.teamName
                          ? `${currentStudy.teamName} (${currentStudy.studyName})`
                          : currentStudy.teamName
                        : selectedTeamName}
                    </h3>
                    {isHost && (
                      <span className="shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                        HOST 담당 팀
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isPastWeek ? (
                    <div className="flex items-center gap-2 select-none">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Check size={14} className="text-slate-500 stroke-[2.5]" />
                        <span>제출 완료 (마감)</span>
                        {(rec?.submittedAt ||
                          (weekNum === 1 ? '2026-08-04 21:15' : '2026-08-11 20:47')) && (
                          <span className="text-[11px] font-normal tabular-nums text-slate-400">
                            {formatSubmittedAt(
                              rec?.submittedAt ||
                                (weekNum === 1 ? '2026-08-04 21:15' : '2026-08-11 20:47'),
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : isSubmitted ? (
                    isEditing ? (
                      /* 수정 모드 활성화 상태 */
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleCancelEdit}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 shadow-2xs transition-all cursor-pointer"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      /* 기본 보기 상태: 제출 상태 */
                      <div className="flex items-center">
                        <div className="inline-flex h-8 items-center gap-2 text-xs text-slate-700 select-none">
                          <span className="inline-flex items-center gap-1.5 font-semibold">
                            <Check
                              size={13}
                              className="text-slate-500 stroke-2"
                              aria-hidden="true"
                            />
                            제출 완료
                          </span>
                          {rec?.submittedAt && (
                            <span className="border-l border-slate-200 pl-2 text-[11px] font-normal tabular-nums text-slate-400">
                              {formatSubmittedAt(rec.submittedAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      disabled={isFutureWeek}
                      title={isFutureWeek ? '세션이 열린 뒤에 제출할 수 있습니다' : undefined}
                      className={`px-3.5 py-1.5 rounded-sm text-xs transition-colors flex items-center gap-1.5 ${ATTEND_STATUS_STYLES.unmarked.active} ${
                        isFutureWeek
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-[#dde5ee] active:bg-[#d1dae5] cursor-pointer'
                      }`}
                    >
                      <span>제출</span>
                    </button>
                  )}

                  {/* 전체화면 확장 / 분할 뷰 축소 버튼 */}
                  <div className="flex items-center gap-1 shrink-0 ml-1 border-l border-slate-200 pl-2">
                    <button
                      type="button"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-semibold"
                      title={isFullScreen ? '분할 뷰로 축소' : '전체 화면으로 확장'}
                    >
                      {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 활동 사진은 가운데, 멘멘 스터디는 그 아래에 파일 업로드 줄을 둔다 */}
              <div
                className={
                  isMentoringTeam ? 'flex w-full flex-col items-center gap-3 py-2' : 'contents'
                }
              >
                {/* 활동 인증 사진 섹션 (중앙 배치 & 모던 카드 디자인) */}
                <div className="flex flex-col items-center justify-center w-full py-2">
                  {currentPhotoUrl ? (
                    <div className="flex flex-col items-center gap-2.5 w-full">
                      <div
                        onClick={() => {
                          if (canEdit) {
                            fileInputRef.current?.click();
                          } else {
                            setLightboxOpen(true);
                          }
                        }}
                        style={
                          photoDisplaySize
                            ? {
                                width: `${photoDisplaySize.width}px`,
                                maxWidth: '100%',
                                aspectRatio: `${photoDisplaySize.aspectRatio}`,
                              }
                            : undefined
                        }
                        className={`relative group rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs select-none transition-all duration-300 hover:shadow-md hover:border-slate-300 mx-auto max-w-[360px] max-h-[240px] ${
                          canEdit ? 'cursor-pointer ring-2 ring-blue-500/20' : 'cursor-zoom-in'
                        }`}
                        title={canEdit ? '클릭하여 사진 변경' : '클릭하여 원본 사진 크게 보기'}
                      >
                        <img
                          src={currentPhotoUrl}
                          alt={`${selectedTeamName} ${termPeriod} ${weekNum}주차 인증 사진`}
                          onLoad={(e) => {
                            const { naturalWidth, naturalHeight } = e.currentTarget;
                            if (naturalWidth && naturalHeight) {
                              setPhotoDimensions({ width: naturalWidth, height: naturalHeight });
                            }
                          }}
                          className="w-full h-full object-cover block transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                        />

                        {/* 수정 모드일 때 사진 우측 상단 플로팅 액션 컨트롤 */}
                        {canEditPhoto && (
                          <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-0.5 rounded-md bg-white/70 p-0.5 backdrop-blur-sm">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fileInputRef.current?.click();
                              }}
                              className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
                              title="사진 변경"
                            >
                              <Upload size={11} aria-hidden="true" />
                              <span>변경</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemovePhoto();
                              }}
                              className="cursor-pointer rounded-md p-1 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="사진 삭제"
                              aria-label="사진 삭제"
                            >
                              <Trash2 size={12} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => canEditPhoto && fileInputRef.current?.click()}
                      className={`group w-full max-w-[360px] h-36 sm:h-40 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-2.5 transition-colors select-none border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/60 ${
                        canEditPhoto ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Camera size={26} strokeWidth={1.4} className="text-slate-400" />
                        <p
                          className={`text-xs sm:text-sm text-slate-600 font-medium transition-colors ${
                            canEditPhoto ? 'group-hover:text-slate-900 group-hover:underline' : ''
                          }`}
                        >
                          {isFutureWeek
                            ? '세션 오픈 후 사진을 등록할 수 있습니다'
                            : isPastWeek
                              ? '등록된 사진이 없습니다 (마감)'
                              : isSubmitted && !isEditing
                                ? '등록된 사진이 없습니다'
                                : '사진을 등록해 주세요'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {/* 멘멘 스터디 파일(PDF) 업로드 줄: 폴더 아이콘 · 파일명 · 초록 체크 */}
                {isMentoringTeam && (
                  <div className="w-full max-w-[360px]">
                    <input
                      ref={pdfInputRef}
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={handlePdfChange}
                      disabled={!canEditPdf}
                      className="hidden"
                    />
                    {currentPdfUrl ? (
                      <div className="flex h-14 items-center gap-3 rounded-sm border border-slate-200 bg-white px-4 shadow-2xs">
                        <Folder
                          size={20}
                          strokeWidth={1.3}
                          className="shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPdfPreview({
                              url: currentPdfUrl,
                              name: currentPdfName ?? 'PDF 자료',
                            })
                          }
                          className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm text-slate-800 hover:underline"
                          title={`${currentPdfName ?? 'PDF 자료'}${currentPdfSize ? ` (${currentPdfSize})` : ''} 미리보기`}
                        >
                          {currentPdfName ?? 'PDF 자료'}
                        </button>
                        <Check
                          size={20}
                          strokeWidth={2.4}
                          className="shrink-0 text-emerald-500"
                          aria-label="업로드 완료"
                        />
                        {canEditPdf && (
                          <button
                            type="button"
                            onClick={handleRemovePdf}
                            className="shrink-0 cursor-pointer rounded p-0.5 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                            title="파일 삭제"
                            aria-label="파일 삭제"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div
                        onClick={() => canEditPdf && pdfInputRef.current?.click()}
                        className={`group flex h-14 select-none items-center gap-3 rounded-sm border border-dashed border-slate-300 bg-white px-4 transition-colors hover:border-slate-400 hover:bg-slate-50/60 ${
                          canEditPdf ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'
                        }`}
                      >
                        <Folder
                          size={20}
                          strokeWidth={1.3}
                          className="shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        <span
                          className={`min-w-0 flex-1 truncate text-sm text-slate-500 transition-colors ${
                            canEditPdf ? 'group-hover:text-slate-900 group-hover:underline' : ''
                          }`}
                        >
                          {isFutureWeek
                            ? '세션 오픈 후 파일을 등록할 수 있습니다'
                            : canEditPdf
                              ? '파일을 업로드해 주세요'
                              : '등록된 파일이 없습니다'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {members.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Users size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">아직 등록된 팀원이 없습니다</p>
                  <p className="text-[11px] text-slate-500">
                    {isAdv
                      ? '팀 개설 시 등록된 팀원 명단이 표시됩니다.'
                      : '스터디 생성 시 선택한 스터디원 명단이 표시됩니다.'}
                  </p>
                </div>
              ) : (
                <div className="w-full rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto select-none relative">
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={tableMinWidth > 0 ? { minWidth: `${tableMinWidth}px` } : undefined}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          {/* 이름 */}
                          <th
                            style={{ width: `${effectiveColWidths.name}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            {canEdit && (
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, 'name', MIN_COL_WIDTHS.name)
                                }
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                title="열 너비 조절"
                              >
                                <div
                                  className={`w-[2px] transition-all rounded-full ${
                                    resizingColKey === 'name'
                                      ? 'bg-slate-700 h-full'
                                      : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                  }`}
                                />
                              </div>
                            )}
                          </th>

                          {/* 기수 */}
                          <th
                            style={{ width: `${effectiveColWidths.year}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            {canEdit && (
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, 'year', MIN_COL_WIDTHS.year)
                                }
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                title="열 너비 조절"
                              >
                                <div
                                  className={`w-[2px] transition-all rounded-full ${
                                    resizingColKey === 'year'
                                      ? 'bg-slate-700 h-full'
                                      : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                  }`}
                                />
                              </div>
                            )}
                          </th>

                          {/* 부문 */}
                          <th
                            style={{ width: `${effectiveColWidths.track}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">부문</div>
                            {canEdit && (
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, 'track', MIN_COL_WIDTHS.track)
                                }
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                title="열 너비 조절"
                              >
                                <div
                                  className={`w-[2px] transition-all rounded-full ${
                                    resizingColKey === 'track'
                                      ? 'bg-slate-700 h-full'
                                      : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                  }`}
                                />
                              </div>
                            )}
                          </th>

                          {/* 유형 (멘멘 스터디: 멘멘/친바) */}
                          {isMentoringTeam && (
                            <th
                              style={{ width: `${effectiveColWidths.type}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">유형</div>
                              {canEdit && (
                                <div
                                  onMouseDown={(e) =>
                                    handleResizeStart(e, 'type', MIN_COL_WIDTHS.type)
                                  }
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                  title="열 너비 조절"
                                >
                                  <div
                                    className={`w-[2px] transition-all rounded-full ${
                                      resizingColKey === 'type'
                                        ? 'bg-slate-700 h-full'
                                        : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                    }`}
                                  />
                                </div>
                              )}
                            </th>
                          )}

                          {/* 출결 */}
                          <th
                            style={{
                              width: `${effectiveColWidths.status}px`,
                              minWidth: canEdit ? `${MIN_COL_WIDTHS.status}px` : undefined,
                            }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-50/80"
                          >
                            <div className="h-9 flex items-center justify-center">출결</div>
                            {canEdit && (
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, 'status', MIN_COL_WIDTHS.status)
                                }
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                title="열 너비 조절"
                              >
                                <div
                                  className={`w-[2px] transition-all rounded-full ${
                                    resizingColKey === 'status'
                                      ? 'bg-slate-700 h-full'
                                      : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                  }`}
                                />
                              </div>
                            )}
                          </th>

                          {/* 비고 */}
                          <th
                            style={{
                              width: canEdit ? `${effectiveColWidths.memo}px` : undefined,
                              minWidth: canEdit ? `${MIN_COL_WIDTHS.memo}px` : undefined,
                            }}
                            className="relative text-center px-3 py-1 text-slate-700 font-semibold"
                          >
                            <div className="h-9 flex items-center justify-center">비고</div>
                            {isSubmitted && !isEditing && isInputWeek && (
                              <button
                                type="button"
                                onClick={() => setIsEditing(true)}
                                className={EDIT_ICON_BUTTON_CLASS}
                                title="출결 수정"
                                aria-label="출결 수정"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                            )}
                            {isPastWeek && (
                              <button
                                type="button"
                                onClick={(e) => showClosedNotice(e.currentTarget)}
                                className={EDIT_ICON_BUTTON_CLASS}
                                title="출결 수정"
                                aria-label="출결 수정"
                              >
                                <Pencil size={14} aria-hidden="true" />
                              </button>
                            )}
                            {canEdit && (
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, 'memo', MIN_COL_WIDTHS.memo)
                                }
                                className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                                title="열 너비 조절"
                              >
                                <div
                                  className={`w-[2px] transition-all rounded-full ${
                                    resizingColKey === 'memo'
                                      ? 'bg-slate-700 h-full'
                                      : 'h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5'
                                  }`}
                                />
                              </div>
                            )}
                          </th>

                          {/* 관리 */}
                          {canEdit && (
                            <th
                              style={{ width: `${effectiveColWidths.actions}px` }}
                              className="text-center px-1 py-1 text-slate-400 font-semibold w-10"
                            >
                              <div className="h-9 flex items-center justify-center">
                                {isEditing ? (
                                  <button
                                    type="button"
                                    onClick={submit}
                                    className="relative inline-flex size-8 items-center justify-center rounded-md text-slate-500 transition-[background-color,color,transform] duration-150 after:absolute after:-inset-1 hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 active:scale-95 cursor-pointer"
                                    title="수정 사항 저장"
                                    aria-label="수정 사항 저장"
                                  >
                                    <Check size={15} strokeWidth={2} aria-hidden="true" />
                                  </button>
                                ) : (
                                  '관리'
                                )}
                              </div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      {members.map((m) => {
                        // 멘멘 스터디는 유형(멘멘/친바)마다 출결 한 줄, 그 외에는 한 줄.
                        const types = isMentoringTeam ? MENTORING_TYPE_LABELS : [null];
                        const rowSpan = types.length;
                        const currentMemo = getMemo(m.id); // 비고는 팀원 한 명에 하나

                        const memberRowsJsx = types.map((typeLabel, typeIndex) => {
                          const rowKey = typeLabel ? `${m.id}:${typeLabel}` : m.id;
                          const s = getStatus(rowKey);
                          const isFirstRow = typeIndex === 0;

                          return (
                            <tr
                              key={rowKey}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[42px]"
                            >
                              {isFirstRow && (
                                <>
                                  <td
                                    rowSpan={rowSpan}
                                    className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans whitespace-nowrap"
                                  >
                                    {m.name}
                                  </td>
                                  <td
                                    rowSpan={rowSpan}
                                    className="relative px-2 py-1.5 text-center text-slate-600 text-xs whitespace-nowrap"
                                  >
                                    {m.year ? `${m.year}기` : '—'}
                                  </td>
                                  <td
                                    rowSpan={rowSpan}
                                    className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap"
                                  >
                                    {m.track || '분석'}
                                  </td>
                                </>
                              )}
                              {isMentoringTeam && (
                                <td className="relative px-2 py-1.5 text-center text-slate-700 text-xs font-sans font-semibold whitespace-nowrap">
                                  {typeLabel}
                                </td>
                              )}
                              <td className="relative px-2 py-1.5 text-center">
                                {canEdit ? (
                                  <div className="flex items-center justify-center w-full px-1">
                                    <div className="grid w-full p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs grid-cols-2 max-w-[140px] min-w-[130px]">
                                      {STATUS_BTNS.map((btn) => {
                                        const active = s === btn.id;
                                        const styleCfg =
                                          ATTEND_STATUS_STYLES[btn.id] ||
                                          ATTEND_STATUS_STYLES.unmarked;
                                        return (
                                          <button
                                            key={btn.id}
                                            type="button"
                                            onClick={() => setStatus(rowKey, btn.id)}
                                            disabled={isFutureWeek}
                                            className={`py-1 text-[10.5px] font-semibold rounded transition-all text-center whitespace-nowrap px-0.5 ${
                                              isFutureWeek
                                                ? 'cursor-not-allowed opacity-50 ' +
                                                  styleCfg.inactive
                                                : 'cursor-pointer ' +
                                                  (active ? styleCfg.active : styleCfg.inactive)
                                            }`}
                                          >
                                            {btn.label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-center h-8 font-sans text-xs">
                                    {renderStatusText(s)}
                                  </div>
                                )}
                              </td>
                              {isFirstRow && (
                                <td
                                  rowSpan={rowSpan}
                                  className="relative border-l border-slate-200 px-3 py-2 text-center"
                                >
                                  {canEdit ? (
                                    <div className="h-8 flex items-center justify-center">
                                      <input
                                        type="text"
                                        value={currentMemo}
                                        onChange={(e) => setMemo(m.id, e.target.value)}
                                        placeholder="—"
                                        className="w-full h-8 text-center px-3 text-xs font-sans text-slate-700 placeholder:text-slate-300 placeholder:font-mono rounded-lg bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-100 outline-none transition-all shadow-2xs"
                                      />
                                    </div>
                                  ) : (
                                    <div className="h-8 flex items-center justify-center font-sans text-xs text-slate-600 truncate px-2">
                                      {currentMemo || (
                                        <span className="text-slate-300 font-mono">—</span>
                                      )}
                                    </div>
                                  )}
                                </td>
                              )}
                              {isFirstRow && canEdit && (
                                <td
                                  rowSpan={rowSpan}
                                  className="border-l border-slate-200 px-2 py-1.5 text-center w-10"
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMember(m.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="명단에서 삭제"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        });

                        return (
                          <tbody
                            key={m.id}
                            className="border-b border-slate-300 last:border-b-0 font-mono [&>tr+tr]:border-t [&>tr+tr]:border-slate-100"
                          >
                            {memberRowsJsx}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
      {closedNoticePos && (
        <div
          role="status"
          style={{ top: closedNoticePos.top, right: closedNoticePos.right }}
          className="fixed z-70 w-max max-w-sm rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium leading-relaxed text-white shadow-xl"
        >
          마감된 출결은 수정할 수 없습니다.
          <br />
          수정이 필요하면 운영지원팀에 문의해 주세요.
        </div>
      )}

      {lightboxOpen && currentPhotoUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={currentPhotoUrl}
              alt="출석 인증 사진"
              className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300"
            />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>
                {selectedTeamName} · {weekNum}주차 출석 인증 사진 ({currentPhotoName})
              </span>
              <button
                onClick={() => setLightboxOpen(false)}
                className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Request Modal */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div
            className={`w-full max-w-md rounded-2xl overflow-hidden p-5 space-y-4 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">운영지원팀에 출결 수정 요청</h3>
              <button
                onClick={() => setShowRequestModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">대상 부원</label>
                <select
                  value={reqMember}
                  onChange={(e) => setReqMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground"
                >
                  <option value="">부원을 선택하세요</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id} className="bg-white">
                      {m.name} ({m.year}기)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">변경 희망 상태</label>
                <div className="flex gap-2">
                  {(['present', 'absent'] as AttendanceStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReqToStatus(s)}
                      className="flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer"
                      style={
                        reqToStatus === s
                          ? { background: STATUS_CFG[s].color, color: '#000', fontWeight: 'bold' }
                          : { background: '#f1f5f9', color: '#64748b' }
                      }
                    >
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">수정 요청 사유 (필수)</label>
                <textarea
                  value={reqReason}
                  onChange={(e) => setReqReason(e.target.value)}
                  placeholder="구체적인 사유를 작성하세요 (예: 출결 체크 오기재, 지각 사유 서류 제출 완료)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowRequestModal(false)}>
                취소
              </Btn>
              <Btn onClick={handleSendRequest}>요청 보내기</Btn>
            </div>
          </div>
        </div>
      )}

      {isPdfToastOpen && (
        <div
          role="status"
          className="fixed right-6 top-20 z-70 flex max-w-sm items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          <Check
            size={15}
            strokeWidth={2.5}
            className="shrink-0 text-emerald-300"
            aria-hidden="true"
          />
          <span>PDF 첨부가 완료되었습니다.</span>
        </div>
      )}

      {pdfPreview && (
        <PdfPreviewModal
          url={pdfPreview.url}
          name={pdfPreview.name}
          onClose={() => setPdfPreview(null)}
        />
      )}

      {/* 방학 중 학기 탭 이동 확인 경고 모달 */}
      {isSemesterWarningOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsSemesterWarningOpen(false)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                학기는 아직 시작 전입니다
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                아직 방학 기간이라 학기 출결 데이터가 없습니다. 학기로 이동할까요?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsSemesterWarningOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => applyPeriodChange('학기')}
                className="px-4 py-2 text-xs font-semibold rounded-sm border border-slate-300 bg-transparent text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 cursor-pointer"
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 미래 주차(세션 미오픈) 이동 확인 경고 모달 */}
      {futureWeekWarning !== null && (
        <div
          className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setFutureWeekWarning(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {futureWeekWarning}주차 세션 미오픈
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                아직 진행되지 않은 주차입니다. 해당 주차 화면으로 이동하시겠습니까?
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setFutureWeekWarning(null)}
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-sm transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmMoveToFutureWeek}
                className="px-4 py-2 text-xs font-semibold rounded-sm border border-slate-300 bg-transparent text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 cursor-pointer"
              >
                이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
