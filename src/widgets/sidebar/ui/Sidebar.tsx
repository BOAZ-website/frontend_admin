import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Megaphone,
  Settings,
} from "lucide-react";

import boazLogo from "@/shared/assets/boaz-logo.png";
import type { UserRole } from "@/entities/user/model/types";
import type { ActivePage } from "@/shared/config/activePage";

const SIDEBAR_NAV = [
  {
    id: "content",
    label: "콘텐츠 관리",
    icon: BookOpen,
    permission: "CONTENT_MANAGE",
    groups: [
      {
        title: "아카이브",
        pages: [
          { id: "content-archive", label: "아카이빙 (프로젝트·블로그·사진)" },
          { id: "content-reviews", label: "수료자 후기 관리" },
        ],
      },
      {
        title: "소개 및 안내",
        pages: [
          { id: "content-curriculum", label: "커리큘럼 관리" },
          { id: "content-faq", label: "자주 묻는 질문 (FAQ)" },
        ],
      },
    ],
  },
  {
    id: "recruiting",
    label: "리크루팅 공고",
    icon: Megaphone,
    permission: "RECRUITMENT_MANAGE",
    groups: [
      {
        title: "공고 및 문항",
        pages: [
          { id: "recruiting-posts", label: "모집 공고 관리" },
          { id: "recruiting-questions", label: "지원서 문항 설정" },
          { id: "recruiting-preview", label: "지원자 화면 미리보기" },
        ],
      },
      {
        title: "지원자 데이터",
        pages: [
          { id: "recruiting-csv", label: "지원서 CSV 추출" },
          { id: "recruiting-leads", label: "사전 알림 명단" },
        ],
      },
    ],
  },
  {
    id: "evaluation",
    label: "서류 평가",
    icon: FileText,
    permission: "EVALUATION",
    groups: [
      {
        title: "서류 심사",
        pages: [
          { id: "evaluation-evals", label: "서류 평가 대시보드 (SUBMITTED)" },
          { id: "evaluation-applicants", label: "전체 지원자 현황 (DRAFT 포함)" },
        ],
      },
      {
        title: "합격 및 승격",
        pages: [{ id: "evaluation-promote", label: "최종 합불 & 정회원 승격" }],
      },
    ],
  },
  {
    id: "attendance",
    label: "출결 & 점수 시스템",
    icon: ClipboardList,
    permission: "ATTENDANCE_*",
    groups: [
      {
        title: "출결 관리",
        pages: [
          { id: "att-session", label: "BASE Term 출결 관리" },
          { id: "att-adv", label: "ADV Term 출결 관리" },
          { id: "att-study", label: "스터디 출결 관리" },
          { id: "att-events", label: "행사 출결 관리" },
          { id: "att-scores", label: "출결 점수 집계" },
        ],
      },
      {
        title: "출결 입력",
        pages: [
          { id: "att-input-adv", label: "ADV Term 출결 입력" },
          { id: "att-input-study", label: "스터디 출결 입력" },
        ],
      },
      {
        title: "설정",
        pages: [
          { id: "att-hosts", label: "HOST 계정 관리" },
          { id: "att-rules", label: "출결 규정 관리" },
        ],
      },
    ],
  },
  {
    id: "system",
    label: "시스템·계정",
    icon: Settings,
    permission: "ACCOUNT_MANAGE",
    groups: [
      {
        title: "계정 및 권한",
        pages: [
          { id: "system-accounts", label: "운영진 계정 관리 (CRUD)" },
          { id: "system-permissions", label: "권한 매트릭스" },
        ],
      },
      {
        title: "보안",
        pages: [{ id: "system-audit", label: "보안 감사 로그" }],
      },
    ],
  },
];

export function Sidebar({
  activePage,
  onChange,
  open,
  onClose,
  currentRole,
  onToggleRole: _onToggleRole,
  onOpenLogin: _onOpenLogin,
  loggedHostTeam: _loggedHostTeam,
  loggedUsername: _loggedUsername,
}: {
  activePage: ActivePage;
  onChange: (p: ActivePage) => void;
  open: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onToggleRole?: () => void;
  onOpenLogin?: () => void;
  loggedHostTeam?: string;
  loggedUsername?: string;
}) {
  const getSectionIdFromPage = (page?: string): string => {
    if (!page || typeof page !== "string") return "recruiting";
    if (page.startsWith("content")) return "content";
    if (page.startsWith("recruiting")) return "recruiting";
    if (page.startsWith("evaluation")) return "evaluation";
    if (page.startsWith("att-")) return "attendance";
    if (page.startsWith("system")) return "system";
    return "recruiting";
  };

  const [expandedSection, setExpandedSection] = useState<string>(() => {
    return getSectionIdFromPage(activePage);
  });

  useEffect(() => {
    const currentSection = getSectionIdFromPage(activePage);
    setExpandedSection(currentSection);
  }, [activePage]);

  const toggleSection = (sectionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedSection((prev) => (prev === sectionId ? "" : sectionId));
  };

  // Notion-style Resizable Sidebar Width (Stored in localStorage)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("boaz_sidebar_width");
      return saved ? Math.max(180, Math.min(480, Number(saved))) : 260;
    } catch {
      return 260;
    }
  });

  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ x: number; isDrag: boolean }>({ x: 0, isDrag: false });

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, isDrag: false };
    setIsResizing(true);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length > 0) {
      dragStartRef.current = { x: e.touches[0].clientX, isDrag: false };
      setIsResizing(true);
    }
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (Math.abs(e.clientX - dragStartRef.current.x) > 3) {
        dragStartRef.current.isDrag = true;
      }
      const newWidth = Math.max(180, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        if (Math.abs(e.touches[0].clientX - dragStartRef.current.x) > 3) {
          dragStartRef.current.isDrag = true;
        }
        const newWidth = Math.max(180, Math.min(480, e.touches[0].clientX));
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      if (!dragStartRef.current.isDrag) {
        onClose();
      } else {
        try {
          localStorage.setItem("boaz_sidebar_width", String(sidebarWidth));
        } catch {}
      }
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, sidebarWidth, onClose]);

  useEffect(() => {
    if (currentRole === "HOST") {
      setExpandedSection("attendance");
    } else if (currentRole === "CONTENT_ADMIN") {
      setExpandedSection("content");
    }
  }, [currentRole]);

  const filteredNav = SIDEBAR_NAV.filter((section) => {
    if (currentRole === "HOST") {
      return section.id === "attendance";
    }
    if (currentRole === "CONTENT_ADMIN") {
      return section.id === "content";
    }
    return true;
  }).map((section) => {
    if (currentRole === "HOST" && section.id === "attendance") {
      return {
        ...section,
        groups: section.groups.filter((g) => g.title === "출결 입력"),
      };
    }
    return section;
  });

  if (!open) {
    return null;
  }

  return (
    <aside
      style={{
        width: `${sidebarWidth}px`,
        fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif",
      }}
      className={`relative shrink-0 h-full flex flex-col bg-white border-r border-slate-200/40 shadow-[0_0_15px_rgba(0,0,0,0.02)] select-none z-20 transition-[width] ${
        isResizing ? "transition-none" : "duration-75"
      }`}
    >
      {/* Brand Header */}
      <div className="h-14 shrink-0 px-4 flex items-center justify-between border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2.5">
          <img
            src={boazLogo}
            alt="bigdata BOAZ"
            className="w-8 h-8 rounded-full object-contain shrink-0 select-none border border-slate-100/80 shadow-2xs"
          />
          <span className="text-sm font-semibold text-slate-900 tracking-tight whitespace-nowrap">
            bigdata BOAZ
          </span>
        </div>
      </div>

      {/* Navigation List */}
      <nav
        className="flex-1 overflow-y-auto px-3 py-3 space-y-1"
        style={{ scrollbarWidth: "none" }}
      >
        {filteredNav.map((section) => {
          const Icon = section.icon;
          const isExpanded = expandedSection === section.id;
          const isSelected = Boolean(
            activePage &&
              (activePage.startsWith(section.id) ||
                (section.id === "attendance" && activePage.startsWith("att-")))
          );

          return (
            <div key={section.id} className="space-y-0.5">
              {/* Top-level Section Category Button */}
              <div
                onClick={() => {
                  toggleSection(section.id);
                  if (section.id === "recruiting") {
                    onChange("recruiting-posts");
                  } else if (section.id === "evaluation") {
                    onChange("evaluation-evals");
                  } else if (section.id === "attendance") {
                    onChange(currentRole === "HOST" ? "att-input-study" : "att-session");
                  } else if (section.id === "content") {
                    onChange("content-archive");
                  } else if (section.id === "system") {
                    onChange("system-accounts");
                  }
                }}
                className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer group select-none ${
                  isSelected
                    ? "bg-slate-100/90 text-slate-950 font-bold shadow-2xs"
                    : "text-slate-700 hover:bg-slate-100/60 hover:text-slate-950 font-semibold"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    size={15}
                    strokeWidth={isSelected ? 2.2 : 1.8}
                    className={`shrink-0 transition-colors ${
                      isSelected ? "text-sky-500" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span className="text-[12.5px] font-bold tracking-tight truncate">
                    {section.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => toggleSection(section.id, e)}
                  className="p-1 -mr-1 rounded-md hover:bg-slate-200/70 transition-colors text-slate-400 hover:text-slate-700 cursor-pointer"
                  title={isExpanded ? "접기" : "펼치기"}
                >
                  {isExpanded ? (
                    <ChevronDown size={14} className="text-slate-500" />
                  ) : (
                    <ChevronRight size={14} className="text-slate-400" />
                  )}
                </button>
              </div>

              {/* Submenu Accordion */}
              {isExpanded && (
                <div className="ml-2 pl-2.5 py-1 space-y-2 border-l border-slate-100 animate-in fade-in duration-100">
                  {section.groups.map((grp, gIdx) => (
                    <div key={gIdx} className="space-y-0.5">
                      {grp.title && (
                        <p className="text-[10.5px] font-bold text-slate-400 px-2 pt-1 pb-0.5 tracking-tight uppercase select-none">
                          {grp.title}
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {grp.pages.map((page) => {
                          const isActive = activePage === page.id;
                          return (
                            <button
                              key={page.id}
                              onClick={() => onChange(page.id as ActivePage)}
                              className={`flex items-center w-full px-2.5 py-1.5 rounded-lg text-left text-xs transition-all cursor-pointer ${
                                isActive
                                  ? "bg-sky-50 text-sky-600 font-bold shadow-2xs"
                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium"
                              }`}
                            >
                              <span className="truncate">{page.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Notion-style Right Resizer Drag & Close Handle */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="absolute top-0 -right-1 w-2.5 h-full cursor-col-resize select-none z-30 group flex items-center justify-center"
      >
        {/* Extremely faint guide line on hover / drag */}
        <div
          className={`w-[1px] h-full transition-colors duration-150 ${
            isResizing ? "bg-slate-300" : "bg-transparent group-hover:bg-slate-300/40"
          }`}
        />

        {/* Notion-style Floating Toast / Tooltip */}
        <div
          className={`absolute top-20 left-3.5 z-50 pointer-events-none transition-all duration-150 ease-out whitespace-nowrap ${
            isResizing
              ? "opacity-0 scale-95"
              : "opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-1"
          }`}
        >
          <div className="bg-[#2b2d31] text-white px-2.5 py-1.5 rounded-[6px] shadow-lg border border-white/5 flex flex-col gap-0.5 text-[12px] leading-snug tracking-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-white">닫기</span>
              <span className="text-[#9b9ea4] font-normal">클릭하거나 Ctrl+\ 사용</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-white">크기 조정</span>
              <span className="text-[#9b9ea4] font-normal">드래그</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
