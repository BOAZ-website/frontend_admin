import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { STATUS_CFG } from "@/entities/attendance/model/constants";
import { sessionKey } from "@/entities/attendance/model/lib";
import type {
  AttendanceState,
  AttendanceStatus,
  SessionRecord,
} from "@/entities/attendance/model/types";
import {
  ADV_INITIAL_TEAMS,
  ADV_MEMBERS,
  INITIAL_STUDY_TEAMS,
  MEMBERS,
} from "@/entities/study-team/model/constants";
import type { Member, StudyTeamInfo } from "@/entities/study-team/model/types";
import type { UserRole } from "@/entities/user/model/types";
import { Btn } from "@/shared/ui/Btn";

// ─── Page: 출결 입력 (HOST 스터디장 전용 페이지) ───────────────────────────────

const EXT_STATUS_BTNS: { id: AttendanceStatus; label: string }[] = [
  { id: "present", label: "출석" },
  { id: "late", label: "지각" },
  { id: "earlyLeave", label: "조퇴" },
  { id: "absent", label: "결석" },
  { id: "excusedAbsent", label: "인정결석" },
  { id: "unexcusedLate", label: "무단지각" },
  { id: "unexcusedAbsent", label: "무단결석" },
  { id: "unmarked", label: "미정" },
];

const ATTEND_STATUS_STYLES: Record<AttendanceStatus, { active: string; inactive: string }> = {
  present: {
    active: "bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#0f5132] hover:bg-white/60 border border-transparent font-medium",
  },
  late: {
    active: "bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium",
  },
  earlyLeave: {
    active: "bg-[#fef3c7] text-[#7c4a03] font-bold border border-[#fde68a] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium",
  },
  absent: {
    active: "bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#8a1c32] hover:bg-white/60 border border-transparent font-medium",
  },
  excusedAbsent: {
    active: "bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#1e40af] hover:bg-white/60 border border-transparent font-medium",
  },
  remote: {
    active: "bg-[#eef2ff] text-[#4338ca] font-bold border border-[#c7d2fe] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#4338ca] hover:bg-white/60 border border-transparent font-medium",
  },
  unexcusedLate: {
    active: "bg-[#fff7ed] text-[#c2410c] font-bold border border-[#fed7aa] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#c2410c] hover:bg-white/60 border border-transparent font-medium",
  },
  unexcusedAbsent: {
    active: "bg-[#fee2e2] text-[#991b1b] font-bold border border-[#fca5a5] shadow-2xs",
    inactive:
      "text-slate-400 hover:text-[#991b1b] hover:bg-white/60 border border-transparent font-medium",
  },
  unmarked: {
    active: "bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs",
    inactive:
      "text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium",
  },
};

export function InputPage({
  attendance,
  setAttendance,
  onRequestException,
  currentHostTeam,
  studyTeams,
  setStudyTeams,
  membersMap,
  currentRole,
  onOpenAddStudy,
  setMembersMap,
  pageTitle,
}: {
  attendance: AttendanceState;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceState>>;
  onRequestException: (
    team: string,
    week: string,
    memberName: string,
    from: AttendanceStatus,
    to: AttendanceStatus,
    reason: string
  ) => void;
  currentHostTeam: string;
  studyTeams: StudyTeamInfo[];
  setStudyTeams?: React.Dispatch<React.SetStateAction<StudyTeamInfo[]>>;
  membersMap: Record<string, Member[]>;
  setMembersMap?: React.Dispatch<React.SetStateAction<Record<string, Member[]>>>;
  currentRole: UserRole;
  onOpenAddStudy?: () => void;
  pageTitle?: string;
}) {
  const [termPeriod, setTermPeriod] = useState<"방학" | "학기">("방학");

  const isAdv = pageTitle?.includes("ADV") ?? false;
  const isHost = currentRole === "HOST";

  const [advTeams, setAdvTeams] = useState<StudyTeamInfo[]>(ADV_INITIAL_TEAMS);
  const effectiveTeams = isAdv ? advTeams : (studyTeams || INITIAL_STUDY_TEAMS);

  // 팀 개설 모달 상태
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [newTeamTrack, setNewTeamTrack] = useState<"분석" | "시각화" | "엔지니어링">("분석");
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamLeader, setNewTeamLeader] = useState("");
  const [newTeamMembersText, setNewTeamMembersText] = useState("");

  const [selectedTeam, setSelectedTeam] = useState(
    currentRole === "HOST"
      ? currentHostTeam || (isAdv ? "분석 1팀" : "A팀")
      : isAdv
      ? "분석 1팀"
      : studyTeams[0]?.teamName || "A팀"
  );

  // HOST 계정인 경우 본인 팀만 필터링, 관리자인 경우 전체 팀 노출
  const displayedTeams = useMemo(() => {
    if (isHost) {
      const myTeam = currentHostTeam || selectedTeam;
      const filtered = effectiveTeams.filter(
        (t) => t.teamName === myTeam || (myTeam && t.teamName.includes(myTeam))
      );
      return filtered.length > 0 ? filtered : effectiveTeams.slice(0, 1);
    }
    return effectiveTeams;
  }, [isHost, currentHostTeam, selectedTeam, effectiveTeams]);

  const TOTAL_WEEKS = 8;

  useEffect(() => {
    if (currentRole === "HOST" && currentHostTeam) {
      setSelectedTeam(currentHostTeam);
      return;
    }
    if (isAdv) {
      if (
        !selectedTeam.startsWith("분석") &&
        !selectedTeam.startsWith("시각화") &&
        !selectedTeam.startsWith("엔지")
      ) {
        setSelectedTeam(effectiveTeams[0]?.teamName || "분석 1팀");
      }
    } else {
      if (
        selectedTeam.startsWith("분석") ||
        selectedTeam.startsWith("시각화") ||
        selectedTeam.startsWith("엔지")
      ) {
        setSelectedTeam(effectiveTeams[0]?.teamName || "A팀");
      }
    }
  }, [isAdv, effectiveTeams, currentRole, currentHostTeam]);

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) {
      alert("팀명을 입력해 주세요.");
      return;
    }
    const memberNames = newTeamMembersText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (memberNames.length === 0) {
      alert("팀원 이름을 입력해 주세요.");
      return;
    }

    const finalTeamName = newTeamName.trim();
    const finalLeader = newTeamLeader.trim() || memberNames[0] || "팀장 미정";
    const teamId = `team_${Date.now()}`;

    const newTeamObj: StudyTeamInfo = {
      id: teamId,
      teamName: finalTeamName,
      studyName: finalTeamName,
      leaderName: finalLeader,
      category: newTeamTrack,
      schedule: "매주 정기 세션",
      studyType: termPeriod === "방학" ? "방학 스터디" : "학기 스터디",
      description: "",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const combinedNames =
      newTeamLeader.trim() && !memberNames.includes(newTeamLeader.trim())
        ? [newTeamLeader.trim(), ...memberNames]
        : memberNames;

    const newMemberList: Member[] = combinedNames.map((name, idx) => ({
      id: `mem_${Date.now()}_${idx}`,
      name,
      year: "28",
      track: newTeamTrack,
    }));

    if (isAdv) {
      setAdvTeams((prev) => [...prev, newTeamObj]);
    } else if (setStudyTeams) {
      setStudyTeams((prev) => [...prev, newTeamObj]);
    }

    if (setMembersMap) {
      setMembersMap((prev) => ({
        ...prev,
        [finalTeamName]: newMemberList,
      }));
    }

    setSelectedTeam(finalTeamName);
    setShowCreateTeamModal(false);
    setNewTeamName("");
    setNewTeamLeader("");
    setNewTeamMembersText("");
  };

  const handlePeriodChange = (period: "방학" | "학기") => {
    setTermPeriod(period);
    if (!isAdv) {
      const periodTarget = period === "방학" ? "방학 스터디" : "학기 스터디";
      const available = (studyTeams || []).filter((s) => s.studyType === periodTarget);
      if (available.length > 0 && currentRole !== "HOST") {
        setSelectedTeam(available[0].teamName);
      }
    }
  };

  const CURRENT_ACTIVE_WEEK = 3;
  const [weekNum, setWeekNum] = useState(3);
  const isPastWeek = weekNum < CURRENT_ACTIVE_WEEK;
  const isFutureWeek = weekNum > CURRENT_ACTIVE_WEEK;
  // 3주차(현재 활성 제출 기간)에는 제출을 완료한 상태여도 계속 수정 가능
  const canEdit = !isPastWeek && !isFutureWeek;

  // 미래 주차(진행 예정) 이동 전 확인 경고 팝업 상태 및 핸들러
  const [futureWeekWarning, setFutureWeekWarning] = useState<number | null>(null);

  const handleSelectWeek = (targetWeek: number) => {
    if (targetWeek === weekNum) return;
    if (targetWeek > CURRENT_ACTIVE_WEEK) {
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
    {}
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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqMember, setReqMember] = useState("");
  const [reqToStatus, setReqToStatus] = useState<AttendanceStatus>("present");
  const [reqReason, setReqReason] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dynamic Column Resizing for Member Table (like InternalCategoryAttendancePage)
  const DEFAULT_COL_WIDTHS = {
    name: 110,
    year: 75,
    track: 85,
    status: 455,
    memo: 280,
    actions: 45,
  };

  const MIN_COL_WIDTHS: Record<string, number> = {
    name: 80,
    year: 55,
    track: 65,
    status: 435,
    memo: 180,
    actions: 40,
  };

  const [colWidths, setColWidths] = useState(DEFAULT_COL_WIDTHS);
  const resizingCol = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);

  const handleResizeStart = (
    e: React.MouseEvent<HTMLElement>,
    key: string,
    minWidth = 50
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget.closest("th") ||
      e.currentTarget.closest("td")) as HTMLElement | null;
    const startX = e.clientX;
    const startWidth = cell ? cell.offsetWidth : colWidths[key as keyof typeof colWidths] || minWidth;
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

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
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
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
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleScrollWeeks = (direction: "left" | "right") => {
    if (weekScrollRef.current) {
      const offset = direction === "left" ? -240 : 240;
      weekScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
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
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.min(Math.max(rawRatio, 15), 65);
      setSplitRatio(clampedRatio);
    }

    function handlePointerUp() {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove);
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  const WEEKS_LIST = Array.from({ length: TOTAL_WEEKS }, (_, i) => ({
    id: `w${i + 1}`,
    weekNum: i + 1,
    label: `${i + 1}주차`,
  }));

  const weekId = `w${weekNum}`;
  const key = sessionKey(weekId, "study", selectedTeam);
  const rec: SessionRecord =
    attendance?.[key]
      ? attendance[key]
      : {
          statuses: {},
          memos: {},
          photo: null,
          photoUrl: null,
          submitted: false,
          submittedAt: null,
        };

  const members =
    (membersMap && membersMap[selectedTeam]) ||
    (isAdv ? ADV_MEMBERS[selectedTeam] || [] : MEMBERS[selectedTeam] || []);

  function handleDeleteMember(memberId: string) {
    if (rec?.submitted || isPastWeek || isFutureWeek) {
      return;
    }
    if (window.confirm("해당 부원을 스터디 명단에서 삭제하시겠습니까?")) {
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
    effectiveTeams.find((s) => s.teamName === selectedTeam) ||
    (studyTeams && studyTeams.find((s) => s.teamName === selectedTeam)) ||
    INITIAL_STUDY_TEAMS.find((s) => s.teamName === selectedTeam);

  const currentPhotoUrl = uploadedImage?.url || rec?.photoUrl || null;
  const currentPhotoName = uploadedImage?.name || rec?.photoName || rec?.photo || null;
  const currentPhotoSize = uploadedImage?.size || rec?.photoSize || null;

  const [photoDimensions, setPhotoDimensions] = useState<{ width: number; height: number } | null>(null);

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
    const maxW = 520;
    const maxH = 380;
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
    if (isFutureWeek) {
      return "unmarked";
    }
    return extStatuses[weekId]?.[memberId] ?? rec?.statuses?.[memberId] ?? "present";
  }

  function setStatus(memberId: string, val: AttendanceStatus) {
    if (!canEdit) {
      return;
    }
    if (key) {
      setAttendance((prev) => {
        const curRec = prev?.[key] ?? {
          statuses: {},
          memos: {},
          photo: null,
          submitted: false,
          submittedAt: null,
        };
        return {
          ...prev,
          [key]: {
            ...curRec,
            statuses: { ...(curRec.statuses ?? {}), [memberId]: val },
          },
        };
      });
    }
    setExtStatuses((prev) => ({
      ...prev,
      [weekId]: { ...(prev[weekId] ?? {}), [memberId]: val },
    }));
  }

  function getMemo(memberId: string): string {
    if (isFutureWeek) {
      return "";
    }
    const memoKey = `${weekId}-${memberId}`;
    return memos[memoKey] ?? rec?.memos?.[memberId] ?? "";
  }

  function setMemo(memberId: string, val: string) {
    if (!canEdit) {
      return;
    }
    const memoKey = `${weekId}-${memberId}`;
    setMemos((prev) => ({ ...prev, [memoKey]: val }));
    if (key) {
      setAttendance((prev) => {
        const curRec = prev?.[key] ?? {
          statuses: {},
          memos: {},
          photo: null,
          submitted: false,
          submittedAt: null,
        };
        return {
          ...prev,
          [key]: {
            ...curRec,
            memos: { ...(curRec.memos ?? {}), [memberId]: val },
          },
        };
      });
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!canEdit) {
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

  function handleRemoveImage() {
    if (!canEdit) {
      return;
    }
    setUploadedImage({ file: null, url: null, name: null, size: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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

  function submit() {
    if (!key || !canEdit) {
      return;
    }

    if (!currentPhotoUrl) {
      const confirmNoPhoto = window.confirm(
        "출석 인증 사진이 첨부되지 않았습니다.\n운영지원팀의 확인을 위해 사진 업로드가 필요합니다.\n사진 없이 그대로 제출하시겠습니까?"
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

    setAttendance((prev) => ({
      ...prev,
      [key]: {
        statuses: currentStatuses,
        memos: currentMemos,
        submitted: true,
        photo: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoUrl: currentPhotoUrl,
        photoName: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoSize: currentPhotoSize || "2.1 MB",
        submittedAt: new Date().toLocaleString("ko-KR", { hour12: false }).slice(0, 16),
        confirmedByAdmin: false,
      },
    }));
  }

  function handleSendRequest() {
    if (!reqMember || !reqReason.trim()) {
      alert("부원과 수정 사유를 입력해 주세요.");
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
      reqReason
    );
    setShowRequestModal(false);
    setReqReason("");
    alert("운영지원팀에 출결 수정 요청이 전송되었습니다.");
  }

  void onOpenAddStudy;
  const tableMinWidth = useMemo(() => {
    let total =
      (colWidths.name || 110) +
      (colWidths.year || 75) +
      (colWidths.track || 85) +
      (colWidths.status || 455) +
      (colWidths.memo || 280);
    if (canEdit) {
      total += colWidths.actions || 45;
    }
    return total;
  }, [colWidths, canEdit]);

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
            {pageTitle || "ADV Term 출결 입력"}
          </h2>

          {/* 방학 / 학기 토글 버튼 (Segmented Control) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold select-none">
            <button
              type="button"
              onClick={() => handlePeriodChange("방학")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === "방학"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              방학
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("학기")}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === "학기"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
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
              onClick={() => handleScrollWeeks("left")}
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
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {WEEKS_LIST.map((w) => {
            const isActive = w.weekNum === weekNum;
            const isWeekFuture = w.weekNum > CURRENT_ACTIVE_WEEK;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelectWeek(w.weekNum)}
                className={`w-[58px] h-[34px] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0 select-none relative ${
                  isActive
                    ? "bg-slate-900 text-white border border-slate-900 shadow-xs"
                    : isWeekFuture
                    ? "text-slate-400 hover:text-slate-700 bg-slate-50/70 border border-slate-200/70"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white border border-slate-200/90 shadow-2xs"
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
              onClick={() => handleScrollWeeks("right")}
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
          isFullScreen ? "block h-full" : "flex flex-row gap-0 h-full min-w-0"
        }`}
      >
        {/* ─── 좌측: 팀 목록 패널 (두번째 사진 스타일) ─── */}
        {!isFullScreen && (
          <div
            style={{
              width: `${splitRatio}%`,
              minWidth: "200px",
            }}
            className="space-y-2.5 shrink-0 h-full overflow-y-auto pr-1.5"
          >
            {/* 사이드바 상단: 헤더 및 팀 개설 버튼 */}
            <div className="flex items-center justify-between px-1 pb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {isHost ? "내 담당 팀" : isAdv ? "ADV 프로젝트 팀" : "스터디 팀"}
                </span>
                {isHost && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                    HOST 전용
                  </span>
                )}
              </div>

              {!isHost && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTeamName("");
                    setShowCreateTeamModal(true);
                  }}
                  className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
                >
                  <Plus size={12} />
                  <span>팀 개설</span>
                </button>
              )}
            </div>

            {/* 등록된 팀이 없을 때 (Empty State) */}
            {displayedTeams.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 space-y-3 my-2">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 mx-auto shadow-2xs">
                  <FolderPlus size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800">개설된 팀이 없습니다</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isAdv ? "새로운 ADV 프로젝트 팀을 개설하세요." : "새로운 스터디 팀을 개설하세요."}
                  </p>
                </div>
                {!isHost && (
                  <button
                    type="button"
                    onClick={() => setShowCreateTeamModal(true)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs flex items-center gap-1 mx-auto cursor-pointer transition-colors"
                  >
                    <Plus size={12} />
                    <span>팀 개설하기</span>
                  </button>
                )}
              </div>
            ) : isAdv ? (
              <div className="space-y-4">
                {(["분석", "시각화", "엔지니어링"] as const).map((trackName) => {
                  const trackTeams = displayedTeams.filter(
                    (t) => t.category === trackName || (t as any).track === trackName
                  );
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
                          const isSelected = selectedTeam === team.teamName;
                          return (
                            <div
                              key={team.id || team.teamName}
                              onClick={() => setSelectedTeam(team.teamName)}
                              className={`relative rounded-2xl border transition-all cursor-pointer p-3.5 group select-none ${
                                isSelected
                                  ? "bg-slate-100/80 border-slate-300 shadow-2xs"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <h4
                                    className={`text-sm font-bold truncate ${
                                      isSelected
                                        ? "text-slate-950 font-bold"
                                        : "text-slate-900 group-hover:text-slate-950"
                                    }`}
                                  >
                                    {team.studyName && team.studyName !== team.teamName ? `${team.teamName} (${team.studyName})` : team.teamName}
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
                                      ? "text-slate-500 translate-x-0.5"
                                      : "text-slate-300 group-hover:text-slate-500"
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
              <div className="space-y-2.5">
                <div className="px-1 pt-1 text-[11px] font-bold text-slate-400 select-none">
                  개별 스터디
                </div>
                <div className="space-y-2.5">
                  {displayedTeams.map((team) => {
                    const isSelected = selectedTeam === team.teamName;
                    return (
                      <div
                        key={team.id || team.teamName}
                        onClick={() => setSelectedTeam(team.teamName)}
                        className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                          isSelected
                            ? "bg-slate-100/80 border-slate-300 shadow-2xs"
                            : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="space-y-1 min-w-0 flex-1">
                            <h4
                              className={`text-sm font-bold truncate ${
                                isSelected
                                  ? "text-slate-950 font-bold"
                                  : "text-slate-900 group-hover:text-slate-950"
                              }`}
                            >
                              {team.studyName && team.studyName !== team.teamName ? `${team.teamName} (${team.studyName})` : team.teamName}
                            </h4>
                            {team.leaderName && (
                              <p className="text-[11px] text-slate-500 font-medium">
                                스터디장: {team.leaderName}
                              </p>
                            )}
                          </div>

                          <ChevronRight
                            size={16}
                            className={`shrink-0 transition-transform ${
                              isSelected
                                ? "text-slate-500 translate-x-0.5"
                                : "text-slate-300 group-hover:text-slate-500"
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
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
              isDragging ? "bg-slate-200/50" : "hover:bg-slate-100/80"
            }`}
            title="마우스로 드래그하여 패널 너비 조절"
          >
            <div
              className={`w-1 h-14 rounded-full transition-all flex flex-col items-center justify-center ${
                isDragging
                  ? "bg-slate-700 h-20"
                  : "bg-slate-300 group-hover:bg-slate-500 group-hover:h-16"
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
            width: isFullScreen ? "100%" : `${100 - splitRatio}%`,
            minWidth: isFullScreen ? undefined : "320px",
          }}
          className={`min-w-0 flex-1 h-full overflow-y-auto ${
            displayedTeams.length === 0
              ? ""
              : "rounded-2xl border border-slate-200/90 bg-white p-6 lg:p-7 shadow-sm space-y-5 animate-in slide-in-from-right duration-150"
          }`}
        >
          {displayedTeams.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 bg-white space-y-4 shadow-2xs my-2">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 mx-auto shadow-2xs">
                <FolderPlus size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">개설된 팀이 없습니다</h3>
                <p className="text-xs text-slate-500">
                  {isHost
                    ? "배정된 담당 팀이 없습니다. 운영지원팀에 문의하세요."
                    : `새로운 ${isAdv ? "ADV 프로젝트" : "스터디"} 팀을 개설하여 출결 입력을 시작하세요.`}
                </p>
              </div>
              {!isHost && (
                <button
                  type="button"
                  onClick={() => {
                    setNewTeamName("");
                    setShowCreateTeamModal(true);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>새 팀 개설하기</span>
                </button>
              )}
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={!canEdit}
                className="hidden"
              />

              {/* 우측 상단 헤더: 선택된 팀 이름 & 제출 상태/버튼 & 전체화면 토글 */}
              <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug truncate">
                          {currentStudy ? (currentStudy.studyName && currentStudy.studyName !== currentStudy.teamName ? `${currentStudy.teamName} (${currentStudy.studyName})` : currentStudy.teamName) : selectedTeam}
                        </h3>
                        {isHost && (
                          <span className="shrink-0 px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                            HOST 담당 팀
                          </span>
                        )}
                      </div>
                    </div>

                <div className="flex items-center gap-2">
                  {isFutureWeek ? (
                    <span className="text-xs font-medium text-slate-400 select-none">
                      세션 미오픈 (진행 예정)
                    </span>
                  ) : isPastWeek ? (
                    <div className="flex items-center gap-2 select-none">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Check size={14} className="text-emerald-600 stroke-[2.5]" />
                        <span>제출 완료 (마감)</span>
                        {(rec?.submittedAt || (weekNum === 1 ? "2026-08-04 21:15" : "2026-08-11 20:47")) && (
                          <span className="text-[11px] font-normal text-slate-400 font-mono">
                            {(rec?.submittedAt || (weekNum === 1 ? "2026-08-04 21:15" : "2026-08-11 20:47")).slice(5, 16)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowRequestModal(true)}
                        className="text-xs font-medium text-slate-400 hover:text-slate-700 transition-colors cursor-pointer px-1 py-0.5 rounded hover:bg-slate-100"
                        title="운영지원팀에 출결 수정 요청"
                      >
                        수정 요청
                      </button>
                    </div>
                  ) : rec?.submitted ? (
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 select-none">
                        <Check size={14} className="text-emerald-600 stroke-[2.5]" />
                        <span>제출 완료</span>
                        {rec?.submittedAt && (
                          <span className="text-[11px] font-normal text-slate-400 font-mono">
                            {rec.submittedAt.slice(5, 16)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={submit}
                        className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                        title="수정한 출결 내용을 저장합니다"
                      >
                        <Check size={13} />
                        <span>수정 사항 저장</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={submit}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
                    >
                      <Check size={13} />
                      <span>출결 제출하기</span>
                    </button>
                  )}

                  {/* 전체화면 확장 / 분할 뷰 축소 버튼 */}
                  <div className="flex items-center gap-1 shrink-0 ml-1 border-l border-slate-200 pl-2">
                    <button
                      type="button"
                      onClick={() => setIsFullScreen(!isFullScreen)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-semibold"
                      title={isFullScreen ? "분할 뷰로 축소" : "전체 화면으로 확장"}
                    >
                      {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* 활동 인증 사진 섹션 (중앙 배치 & 모던 카드 디자인) */}
              <div className="flex flex-col items-center justify-center w-full py-2">
                {currentPhotoUrl ? (
                  <div className="flex flex-col items-center gap-2.5 w-full">
                    <div
                      onClick={() => setLightboxOpen(true)}
                      style={
                        photoDisplaySize
                          ? {
                              width: `${photoDisplaySize.width}px`,
                              maxWidth: "100%",
                              aspectRatio: `${photoDisplaySize.aspectRatio}`,
                            }
                          : undefined
                      }
                      className="relative group rounded-2xl overflow-hidden border border-slate-200/90 shadow-2xs cursor-zoom-in select-none transition-all duration-300 hover:shadow-md hover:border-slate-300 mx-auto max-w-[520px] max-h-[380px]"
                      title="클릭하여 원본 사진 크게 보기"
                    >
                      <img
                        src={currentPhotoUrl}
                        alt={`${selectedTeam} ${termPeriod} ${weekNum}주차 인증 사진`}
                        onLoad={(e) => {
                          const { naturalWidth, naturalHeight } = e.currentTarget;
                          if (naturalWidth && naturalHeight) {
                            setPhotoDimensions({ width: naturalWidth, height: naturalHeight });
                          }
                        }}
                        className="w-full h-full object-cover block transition-transform duration-300 ease-out group-hover:scale-[1.03]"
                      />
                    </div>

                    {canEdit && (
                      <div
                        style={
                          photoDisplaySize
                            ? {
                                width: `${Math.max(photoDisplaySize.width, 360)}px`,
                                maxWidth: "100%",
                              }
                            : undefined
                        }
                        className="flex items-center justify-between w-full max-w-[520px] px-1"
                      >
                        <p className="text-[11px] text-slate-400 font-medium">
                          사진을 클릭하면 크게 확인할 수 있습니다.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                          >
                            <Upload size={13} />
                            <span>사진 변경</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/60 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-[0.98]"
                          >
                            <Trash2 size={13} />
                            <span>삭제</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    onClick={() => canEdit && fileInputRef.current?.click()}
                    className={`w-full max-w-[520px] h-44 sm:h-48 rounded-2xl border border-dashed flex flex-col items-center justify-center gap-3 transition-colors select-none border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/60 ${
                      canEdit ? "cursor-pointer" : "opacity-60 cursor-not-allowed"
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera size={26} strokeWidth={1.4} className="text-slate-400" />
                      <p className="text-xs sm:text-sm text-slate-600 font-medium">
                        {isFutureWeek
                          ? "세션 오픈 후 활동 사진을 등록할 수 있습니다"
                          : isPastWeek
                          ? "등록된 활동 사진이 없습니다 (마감)"
                          : "활동 사진을 등록해 주세요"}
                      </p>
                    </div>

                    {canEdit && (
                      <div
                        className="flex items-center justify-center mt-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Upload size={13} className="text-slate-500" />
                          <span>사진 업로드</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {members.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Users size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">
                    아직 등록된 팀원이 없습니다
                  </p>
                  <p className="text-[11px] text-slate-500">
                    팀 개설 시 등록된 팀원 명단이 표시됩니다.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto select-none relative">
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={{ minWidth: `${tableMinWidth}px` }}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          {/* 이름 */}
                          <th
                            style={{ width: `${colWidths.name}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, "name", MIN_COL_WIDTHS.name)
                              }
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                              title="열 너비 조절"
                            >
                              <div
                                className={`w-[2px] transition-all rounded-full ${
                                  resizingColKey === "name"
                                    ? "bg-slate-700 h-full"
                                    : "h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5"
                                }`}
                              />
                            </div>
                          </th>

                          {/* 기수 */}
                          <th
                            style={{ width: `${colWidths.year}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, "year", MIN_COL_WIDTHS.year)
                              }
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                              title="열 너비 조절"
                            >
                              <div
                                className={`w-[2px] transition-all rounded-full ${
                                  resizingColKey === "year"
                                    ? "bg-slate-700 h-full"
                                    : "h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5"
                                }`}
                              />
                            </div>
                          </th>

                          {/* 부문 */}
                          <th
                            style={{ width: `${colWidths.track}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">부문</div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, "track", MIN_COL_WIDTHS.track)
                              }
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                              title="열 너비 조절"
                            >
                              <div
                                className={`w-[2px] transition-all rounded-full ${
                                  resizingColKey === "track"
                                    ? "bg-slate-700 h-full"
                                    : "h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5"
                                }`}
                              />
                            </div>
                          </th>

                          {/* 출결 */}
                          <th
                            style={{
                              width: `${colWidths.status}px`,
                              minWidth: `${MIN_COL_WIDTHS.status}px`,
                            }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-50/80"
                          >
                            <div className="h-9 flex items-center justify-center">출결</div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, "status", MIN_COL_WIDTHS.status)
                              }
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                              title="열 너비 조절"
                            >
                              <div
                                className={`w-[2px] transition-all rounded-full ${
                                  resizingColKey === "status"
                                    ? "bg-slate-700 h-full"
                                    : "h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5"
                                }`}
                              />
                            </div>
                          </th>

                          {/* 비고 */}
                          <th
                            style={{
                              width: `${colWidths.memo}px`,
                              minWidth: `${MIN_COL_WIDTHS.memo}px`,
                            }}
                            className="relative text-center px-3 py-1 text-slate-700 font-semibold"
                          >
                            <div className="h-9 flex items-center justify-center">비고</div>
                            <div
                              onMouseDown={(e) =>
                                handleResizeStart(e, "memo", MIN_COL_WIDTHS.memo)
                              }
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20 flex items-center justify-center group"
                              title="열 너비 조절"
                            >
                              <div
                                className={`w-[2px] transition-all rounded-full ${
                                  resizingColKey === "memo"
                                    ? "bg-slate-700 h-full"
                                    : "h-3 bg-slate-200 group-hover:bg-slate-400 group-hover:h-4.5"
                                }`}
                              />
                            </div>
                          </th>

                          {/* 관리 */}
                          {canEdit && (
                            <th
                              style={{ width: `${colWidths.actions}px` }}
                              className="text-center px-1 py-1 text-slate-400 font-semibold w-10"
                            >
                              <div className="h-9 flex items-center justify-center">관리</div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {members.map((m) => {
                          const s = getStatus(m.id);
                          const currentMemo = getMemo(m.id);

                          return (
                            <tr
                              key={m.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[42px]"
                            >
                              {/* 이름 */}
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans whitespace-nowrap">
                                {m.name}
                              </td>

                              {/* 기수 */}
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs whitespace-nowrap">
                                {m.year ? `${m.year}기` : "—"}
                              </td>

                              {/* 부문 */}
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap">
                                {m.track || "분석"}
                              </td>

                              {/* 출결 */}
                              <td className="relative px-2 py-1.5 text-center">
                                <div className="flex items-center justify-center w-full px-1">
                                  <div className="grid grid-cols-8 w-full max-w-[445px] min-w-[425px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                    {EXT_STATUS_BTNS.map((btn) => {
                                      const active = s === btn.id;
                                      const styleCfg =
                                        ATTEND_STATUS_STYLES[btn.id] ||
                                        ATTEND_STATUS_STYLES.unmarked;
                                      return (
                                        <button
                                          key={btn.id}
                                          type="button"
                                          onClick={() => setStatus(m.id, btn.id)}
                                          disabled={!canEdit}
                                          className={`py-1 text-[10.5px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 disabled:cursor-not-allowed ${
                                            active ? styleCfg.active : styleCfg.inactive
                                          }`}
                                        >
                                          {btn.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </td>

                              {/* 비고 */}
                              <td className="relative px-3 py-2 text-center">
                                <div className="h-8 flex items-center justify-center">
                                  <input
                                    type="text"
                                    value={currentMemo}
                                    onChange={(e) => setMemo(m.id, e.target.value)}
                                    disabled={!canEdit}
                                    placeholder={isFutureWeek ? "미오픈" : isPastWeek ? "마감" : "—"}
                                    className="w-full h-8 text-center px-3 text-xs font-sans text-slate-700 placeholder:text-slate-300 placeholder:font-mono rounded-lg bg-white border border-slate-200 hover:border-slate-300 focus:border-slate-800 focus:ring-2 focus:ring-slate-100 outline-none transition-all shadow-2xs disabled:bg-slate-50 disabled:text-slate-400"
                                  />
                                </div>
                              </td>

                              {/* 관리 */}
                              {canEdit && (
                                <td className="px-2 py-1.5 text-center w-10">
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
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Lightbox Modal */}
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
                {selectedTeam} · {weekNum}주차 출석 인증 사진 ({currentPhotoName})
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
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-5 space-y-4 bg-white border border-slate-200 shadow-2xl">
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
                  {(["present", "late", "absent"] as AttendanceStatus[]).map((s) => (
                    <button
                      key={s}
                      onClick={() => setReqToStatus(s)}
                      className="flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer"
                      style={
                        reqToStatus === s
                          ? { background: STATUS_CFG[s].color, color: "#000", fontWeight: "bold" }
                          : { background: "#f1f5f9", color: "#64748b" }
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

      {/* 팀 개설 모달 */}
      {showCreateTeamModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-5 bg-white border border-slate-200 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {isAdv ? "ADV 팀 개설" : "스터디 팀 개설"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <div className="space-y-4 text-xs">
              {/* 부문 (트랙) 선택 */}
              <div>
                <label className="text-slate-700 block mb-1.5 font-semibold">
                  부문 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["분석", "시각화", "엔지니어링"] as const).map((track) => (
                    <button
                      key={track}
                      type="button"
                      onClick={() => setNewTeamTrack(track)}
                      className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        newTeamTrack === track
                          ? "bg-slate-900 border-slate-900 text-white shadow-xs"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {track}
                    </button>
                  ))}
                </div>
              </div>

              {/* 팀명 & 팀장 이름 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1.5 font-semibold">
                    팀명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder={isAdv ? "예: 분석 1팀" : "예: 데이터 분석 스터디"}
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-slate-400 transition-colors font-medium"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1.5 font-semibold">
                    팀장 이름
                  </label>
                  <input
                    value={newTeamLeader}
                    onChange={(e) => setNewTeamLeader(e.target.value)}
                    placeholder="예: 홍길동"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-slate-400 transition-colors font-medium"
                  />
                </div>
              </div>

              {/* 팀원 이름 */}
              <div>
                <label className="text-slate-700 block mb-1.5 font-semibold">
                  팀원 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  value={newTeamMembersText}
                  onChange={(e) => setNewTeamMembersText(e.target.value)}
                  placeholder="예: 홍길동, 김철수, 이영희"
                  className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 focus:bg-white focus:border-slate-400 transition-colors font-medium text-xs"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCreateTeamModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateTeam}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-xs transition-all cursor-pointer"
              >
                개설
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
            className="w-full max-w-sm rounded-2xl p-6 space-y-4 bg-white border border-slate-200/90 shadow-xl animate-in zoom-in-95 duration-150"
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
                className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmMoveToFutureWeek}
                className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all active:scale-[0.98] cursor-pointer shadow-2xs"
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
