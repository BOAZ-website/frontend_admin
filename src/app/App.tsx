import { useEffect, useMemo, useState } from "react";
import { ChevronRight, KeyRound, PanelLeft, ShieldCheck, User, X } from "lucide-react";

import { DashboardPage } from "@/pages/attendance-dashboard/ui/DashboardPage";
import { EventAttendanceManagePage } from "@/pages/attendance-events/ui/EventAttendanceManagePage";
import { HostsPage } from "@/pages/attendance-hosts/ui/HostsPage";
import { InputPage } from "@/pages/attendance-input/ui/InputPage";
import { InternalCategoryAttendancePage } from "@/pages/attendance-internal-category/ui/InternalCategoryAttendancePage";
import { RulesPage } from "@/pages/attendance-rules/ui/RulesPage";
import { ScoresPage } from "@/pages/attendance-scores/ui/ScoresPage";
import { ArchivingSection } from "@/pages/content-archive/ui/ArchivingSection";
import { CurriculumSection } from "@/pages/content-curriculum/ui/CurriculumSection";
import { FaqSection } from "@/pages/content-faq/ui/FaqSection";
import { ReviewsSection } from "@/pages/content-reviews/ui/ReviewsSection";
import { EvaluationManagePage } from "@/pages/recruiting-evaluation/ui/EvaluationManagePage";
import { RecruitmentManagePage } from "@/pages/recruiting-manage/ui/RecruitmentManagePage";
import { SystemAccountsPage } from "@/pages/system-accounts/ui/SystemAccountsPage";
import { LoginModal } from "@/widgets/login-modal/ui/LoginModal";
import { Sidebar } from "@/widgets/sidebar/ui/Sidebar";
import { WEEKS } from "@/entities/attendance/model/constants";
import { buildInitialAttendance, sessionKey } from "@/entities/attendance/model/lib";
import type { AttendanceState, AttendanceStatus } from "@/entities/attendance/model/types";
import { INITIAL_EXCEPTIONS } from "@/entities/exception-request/model/constants";
import type { ExceptionRequest } from "@/entities/exception-request/model/types";
import { INITIAL_HOSTS } from "@/entities/host-account/model/constants";
import type { HostAccount } from "@/entities/host-account/model/types";
import { INITIAL_RULES } from "@/entities/score-rule/model/constants";
import type { ScoreRule } from "@/entities/score-rule/model/types";
import { INITIAL_STUDY_TEAMS, MEMBERS } from "@/entities/study-team/model/constants";
import type { Member, StudyPeriodType, StudyTeamInfo } from "@/entities/study-team/model/types";
import type { UserRole } from "@/entities/user/model/types";
import type { ActivePage } from "@/shared/config/activePage";
import { PAGE_LABELS } from "@/shared/config/pageLabels";

const VALID_ACTIVE_PAGES = new Set<string>([
  "att-dashboard",
  "att-events",
  "att-hosts",
  "att-scores",
  "att-rules",
  "att-input",
  "att-input-adv",
  "att-input-study",
  "att-session",
  "att-adv",
  "att-study",
  "att-internal",
  "content-archive",
  "content-faq",
  "content-curriculum",
  "content-reviews",
  "content",
  "recruiting",
  "recruiting-posts",
  "recruiting-questions",
  "recruiting-preview",
  "recruiting-csv",
  "recruiting-leads",
  "evaluation",
  "evaluation-evals",
  "evaluation-applicants",
  "evaluation-promote",
  "system",
  "system-accounts",
  "system-permissions",
  "system-audit",
]);

function getInitialActivePage(): ActivePage {
  try {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash && VALID_ACTIVE_PAGES.has(hash)) {
      return hash as ActivePage;
    }
    const saved = localStorage.getItem("boaz_active_page");
    if (saved && VALID_ACTIVE_PAGES.has(saved)) {
      return saved as ActivePage;
    }
  } catch {
    // ignore
  }
  return "recruiting-posts";
}

export default function App() {
  const [scoreRules, setScoreRules] = useState<ScoreRule[]>(() => {
    try {
      const saved = localStorage.getItem("boaz_score_rules");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      // ignore malformed localStorage data, fall back to defaults
    }
    return INITIAL_RULES;
  });

  const handleUpdateScoreRules = (newRules: ScoreRule[]) => {
    setScoreRules(newRules);
    try {
      localStorage.setItem("boaz_score_rules", JSON.stringify(newRules));
      window.dispatchEvent(new Event("storage"));
    } catch (e) {
      // ignore localStorage write failures (e.g. quota exceeded, private mode)
    }
  };

  const [activePage, setActivePage] = useState<ActivePage>(getInitialActivePage);

  useEffect(() => {
    try {
      localStorage.setItem("boaz_active_page", activePage);
      if (window.location.hash.replace(/^#/, "") !== activePage) {
        window.history.replaceState(null, "", `#${activePage}`);
      }
    } catch {
      // ignore
    }
  }, [activePage]);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash && VALID_ACTIVE_PAGES.has(hash)) {
        setActivePage(hash as ActivePage);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("boaz_sidebar_open_v2");
      return saved !== null ? saved === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("boaz_sidebar_open_v2", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Notion-style Ctrl+\ (or Cmd+\) shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [studyTeams, setStudyTeams] = useState<StudyTeamInfo[]>(INITIAL_STUDY_TEAMS);
  const [membersMap, setMembersMap] = useState<Record<string, Member[]>>(MEMBERS);
  const [attendance, setAttendance] = useState<AttendanceState>(buildInitialAttendance);
  const [hosts, setHosts] = useState<HostAccount[]>(INITIAL_HOSTS);
  const [exceptions, setExceptions] = useState<ExceptionRequest[]>(INITIAL_EXCEPTIONS);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    try {
      const saved = localStorage.getItem("boaz_user_role");
      if (saved && ["TEAM", "HOST", "CONTENT_ADMIN", "SUPER"].includes(saved)) {
        return saved as UserRole;
      }
    } catch {}
    return "SUPER";
  });

  const [loggedHostTeam, setLoggedHostTeam] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("boaz_host_team");
      if (saved) return saved;
    } catch {}
    return "A팀";
  });

  const [loggedUsername, setLoggedUsername] = useState<string>(() => {
    try {
      const saved = localStorage.getItem("boaz_username");
      if (saved) return saved;
    } catch {}
    return "super";
  });

  useEffect(() => {
    try {
      localStorage.setItem("boaz_user_role", currentRole);
    } catch {}
  }, [currentRole]);

  useEffect(() => {
    try {
      localStorage.setItem("boaz_host_team", loggedHostTeam);
    } catch {}
  }, [loggedHostTeam]);

  useEffect(() => {
    try {
      localStorage.setItem("boaz_username", loggedUsername);
    } catch {}
  }, [loggedUsername]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem("boaz_is_logged_in") !== "false";
    } catch {
      return true;
    }
  });

  const displayName = useMemo(() => {
    if (currentRole === "HOST") {
      return loggedUsername || `${loggedHostTeam} 팀장`;
    }
    return "남민서";
  }, [currentRole, loggedHostTeam, loggedUsername]);

  function handleLogout() {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      setIsLoggedIn(false);
      try {
        localStorage.setItem("boaz_is_logged_in", "false");
      } catch {}
      setLoginModalOpen(true);
    }
  }

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [myCurrentPw, setMyCurrentPw] = useState("");
  const [myNewPw, setMyNewPw] = useState("");
  const [myConfirmPw, setMyConfirmPw] = useState("");
  const [masterPassword, setMasterPassword] = useState("super1234");
  const [myPwError, setMyPwError] = useState("");

  function handleRegisterStudyTeam(teamData: {
    teamName: string;
    studyName: string;
    category: string;
    leaderName: string;
    schedule: string;
    studyType?: StudyPeriodType;
    description?: string;
    customUsername: string;
    customPassword?: string;
    memberNames?: string[];
  }): HostAccount {
    const newStudy: StudyTeamInfo = {
      id: "st_" + Date.now(),
      teamName: teamData.teamName,
      studyName: teamData.studyName,
      category: teamData.category,
      leaderName: teamData.leaderName,
      schedule: teamData.schedule,
      studyType: teamData.studyType || "방학 스터디",
      description: teamData.description || "",
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const newHost: HostAccount = {
      id: "h_" + Date.now(),
      username: teamData.customUsername,
      initialPassword: teamData.customPassword || "boaz2026!a",
      hostName: `${teamData.leaderName} (${teamData.teamName}장)`,
      team: teamData.teamName,
      createdAt: new Date().toISOString().slice(0, 10),
      active: true,
    };

    const parsedNames =
      teamData.memberNames && teamData.memberNames.length > 0 ? teamData.memberNames : [];
    const newMemberList: Member[] = parsedNames.map((name, idx) => ({
      id: `${teamData.teamName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${idx + 1}`,
      name,
      year: `${22 + (idx % 3)}`,
    }));

    setStudyTeams((prev) => {
      // replace if existing or append
      const exists = prev.some((s) => s.teamName === teamData.teamName);
      if (exists) {
        return prev.map((s) => (s.teamName === teamData.teamName ? newStudy : s));
      }
      return [...prev, newStudy];
    });

    setHosts((prev) => [newHost, ...prev.filter((h) => h.team !== teamData.teamName)]);

    setMembersMap((prev) => ({
      ...prev,
      [teamData.teamName]: newMemberList,
    }));

    // initialize attendance keys for the new study team across all weeks
    setAttendance((prev) => {
      const updated = { ...prev };
      WEEKS.forEach((w) => {
        const k = sessionKey(w.id, "study", teamData.teamName);
        if (!updated[k]) {
          const statuses: Record<string, AttendanceStatus> = {};
          newMemberList.forEach((m) => {
            statuses[m.id] = "present";
          });
          updated[k] = {
            statuses,
            memos: {},
            photo: null,
            photoUrl: null,
            submitted: false,
            submittedAt: null,
          };
        }
      });
      return updated;
    });

    return newHost;
  }

  function approveException(id: string) {
    const ex = exceptions.find((e) => e.id === id);
    if (ex) {
      const weekNum = ex.week.replace(/[^0-9]/g, "");
      const wId = `w${weekNum}`;
      const actId = "study";
      const key = sessionKey(wId, actId, ex.team);
      const members = membersMap[ex.team] ?? [];
      const mem = members.find((m) => m.name === ex.memberName);
      if (mem && attendance[key]) {
        setAttendance((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            statuses: { ...prev[key].statuses, [mem.id]: ex.to },
          },
        }));
      }
    }
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  function rejectException(id: string) {
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  }

  function handleRequestException(
    team: string,
    week: string,
    memberName: string,
    from: AttendanceStatus,
    to: AttendanceStatus,
    reason: string
  ) {
    setExceptions((prev) => [
      {
        id: `e_${Date.now()}`,
        team,
        week,
        memberName,
        from,
        to,
        reason,
      },
      ...prev,
    ]);
  }

  function handleDirectEdit(
    w: string,
    a: string,
    t: string,
    memberId: string,
    to: AttendanceStatus,
    reason: string
  ) {
    const key = sessionKey(w, a, t);
    setAttendance((prev) => {
      const cur = prev[key];
      if (!cur) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...cur,
          statuses: { ...cur.statuses, [memberId]: to },
          memos: { ...(cur.memos ?? {}), [memberId]: `[운영지원팀 수정] ${reason}` },
        },
      };
    });
  }

  function handleConfirmAdmin(w: string, a: string, t: string) {
    const key = sessionKey(w, a, t);
    setAttendance((prev) => {
      const cur = prev[key];
      if (!cur) {
        return prev;
      }
      return {
        ...prev,
        [key]: {
          ...cur,
          confirmedByAdmin: true,
        },
      };
    });
  }

  function handleToggleRole() {
    if (currentRole === "SUPER") {
      setCurrentRole("TEAM");
      setLoggedUsername("admin");
      setActivePage("att-dashboard");
    } else if (currentRole === "TEAM") {
      setCurrentRole("HOST");
      setLoggedHostTeam(studyTeams[0]?.teamName || "A팀");
      setLoggedUsername("host_a");
      setActivePage("att-input");
    } else if (currentRole === "HOST") {
      setCurrentRole("CONTENT_ADMIN");
      setLoggedUsername("content");
      setActivePage("content-archive");
    } else {
      setCurrentRole("SUPER");
      setLoggedUsername("super");
      setActivePage("recruiting");
    }
  }

  function handleLoginSuccess(role: UserRole, hostTeam?: string, username?: string) {
    setIsLoggedIn(true);
    try {
      localStorage.setItem("boaz_is_logged_in", "true");
    } catch {}
    setCurrentRole(role);
    if (role === "HOST") {
      const chosenTeam = hostTeam || studyTeams[0]?.teamName || "A팀";
      setLoggedHostTeam(chosenTeam);
      setLoggedUsername(username || "host_a");
      const isAdvTeam =
        chosenTeam.startsWith("분석") ||
        chosenTeam.startsWith("시각화") ||
        chosenTeam.startsWith("엔지");
      setActivePage(isAdvTeam ? "att-input-adv" : "att-input-study");
    } else if (role === "CONTENT_ADMIN") {
      setLoggedUsername("content");
      setActivePage("content-archive");
    } else if (role === "SUPER") {
      setLoggedUsername("super");
      setActivePage("recruiting");
    } else {
      setLoggedUsername("admin");
      setActivePage("att-dashboard");
    }
  }

  function handleSaveMyPassword() {
    setMyPwError("");

    if (!myCurrentPw.trim() || !myNewPw.trim() || !myConfirmPw.trim()) {
      setMyPwError("모든 항목을 입력해 주세요.");
      return;
    }
    if (myCurrentPw !== masterPassword) {
      setMyPwError("현재 비밀번호가 일치하지 않습니다.");
      return;
    }
    if (myNewPw !== myConfirmPw) {
      setMyPwError("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setMasterPassword(myNewPw);
    setMyCurrentPw("");
    setMyNewPw("");
    setMyConfirmPw("");
    setShowMyProfileModal(false);
  }

  const isRecruiting = Boolean(activePage?.startsWith("recruiting"));
  const isEvaluation = Boolean(activePage?.startsWith("evaluation"));
  const isContentPage = Boolean(activePage?.startsWith("content"));
  const isAttendancePage = Boolean(activePage?.startsWith("att-"));

  return (
    <div
      className="flex h-screen overflow-hidden bg-[#f8fafc]"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      <Sidebar
        activePage={activePage}
        onChange={setActivePage}
        open={sidebarOpen}
        onClose={() => {
          setSidebarOpen(false);
          try {
            localStorage.setItem("boaz_sidebar_open_v2", "false");
          } catch {}
        }}
        currentRole={currentRole}
        onToggleRole={handleToggleRole}
        onOpenLogin={() => setLoginModalOpen(true)}
        loggedHostTeam={loggedHostTeam}
        loggedUsername={loggedUsername}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Topbar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-6 bg-white border-b border-slate-200/80 select-none z-10">
          <div className="flex items-center gap-2.5">
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title={sidebarOpen ? "사이드바 접기" : "사이드바 열기"}
            >
              <PanelLeft size={16} />
            </button>

            {!sidebarOpen && (
              <>
                <div className="w-[1px] h-3.5 bg-slate-200" />

                <div className="flex items-center gap-1.5 text-xs">
                  {isRecruiting && (
                    <>
                      <span className="font-medium text-slate-500">리크루팅</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isEvaluation && (
                    <>
                      <span className="font-medium text-slate-500">서류 평가</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isContentPage && (
                    <>
                      <span className="font-medium text-slate-500">콘텐츠 관리</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  {isAttendancePage && (
                    <>
                      <span className="font-medium text-slate-500">출결 관리</span>
                      <ChevronRight size={12} className="text-slate-400 stroke-[2]" />
                    </>
                  )}
                  <span className="text-slate-900 font-semibold tracking-tight">
                    {PAGE_LABELS[activePage] || "관리자 콘솔"}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Right User Auth Area (media_1789198942116 style) */}
          <div className="flex items-center">
            {isLoggedIn ? (
              <div className="flex items-center gap-4 text-sm select-none">
                <button
                  type="button"
                  onClick={() => setShowMyProfileModal(true)}
                  className="flex items-center gap-1.5 font-semibold text-slate-900 hover:text-slate-700 transition-colors cursor-pointer group"
                  title="내 프로필 정보 확인"
                >
                  <User
                    size={14}
                    className="text-slate-800 fill-slate-800 group-hover:text-slate-950 group-hover:fill-slate-950 transition-colors"
                  />
                  <span>{displayName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm text-slate-500 hover:text-slate-900 font-normal transition-colors cursor-pointer"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLoginModalOpen(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <User size={14} className="text-slate-700 fill-slate-700" />
                <span>로그인</span>
              </button>
            )}
          </div>
        </header>

        {/* Content Main Body */}
        <main className="flex-1 overflow-y-auto px-8 py-7" style={{ scrollbarWidth: "none" }}>
          {/* 1. Recruiting Management */}
          {isRecruiting && (
            <RecruitmentManagePage
              key={activePage}
              initialTab={
                activePage === "recruiting-questions"
                  ? "questions"
                  : activePage === "recruiting-preview"
                    ? "preview"
                    : activePage === "recruiting-csv"
                      ? "csv"
                      : activePage === "recruiting-leads"
                        ? "leads"
                        : "posts"
              }
              onTabChange={(pageId) => setActivePage(pageId as ActivePage)}
            />
          )}

          {/* 2. Evaluation Management */}
          {isEvaluation && (
            <EvaluationManagePage
              initialTab={
                activePage === "evaluation-applicants"
                  ? "applicants"
                  : activePage === "evaluation-promote"
                    ? "promotions"
                    : "evaluations"
              }
            />
          )}

          {/* 3. Content Management */}
          {(activePage === "content-archive" || activePage === "content") && <ArchivingSection />}
          {activePage === "content-faq" && <FaqSection />}
          {activePage === "content-curriculum" && <CurriculumSection />}
          {activePage === "content-reviews" && <ReviewsSection />}

          {/* 4. Attendance Management */}
          {activePage === "att-session" && (
            <InternalCategoryAttendancePage
              category="SESSION"
              activeScoreRule={scoreRules.find((r) => r.status === "ACTIVE")}
              attendance={attendance}
            />
          )}
          {activePage === "att-adv" && (
            <InternalCategoryAttendancePage
              category="ADV"
              activeScoreRule={scoreRules.find((r) => r.status === "ACTIVE")}
              attendance={attendance}
            />
          )}
          {activePage === "att-study" && (
            <InternalCategoryAttendancePage
              category="STUDY"
              activeScoreRule={scoreRules.find((r) => r.status === "ACTIVE")}
              attendance={attendance}
            />
          )}
          {activePage === "att-events" && <EventAttendanceManagePage />}
          {activePage === "att-scores" && (
            <ScoresPage attendance={attendance} studyTeams={studyTeams} membersMap={membersMap} />
          )}
          {(activePage === "att-input" ||
            activePage === "att-input-adv" ||
            activePage === "att-input-study") && (
            <InputPage
              pageTitle={
                activePage === "att-input-study"
                  ? "스터디 출결 입력"
                  : "ADV Term 출결 입력"
              }
              attendance={attendance}
              setAttendance={setAttendance}
              onRequestException={handleRequestException}
              currentHostTeam={loggedHostTeam}
              studyTeams={studyTeams}
              setStudyTeams={setStudyTeams}
              membersMap={membersMap}
              setMembersMap={setMembersMap}
              currentRole={currentRole}
              onOpenAddStudy={() => setActivePage("att-hosts")}
            />
          )}
          {activePage === "att-hosts" && (
            <HostsPage
              hosts={hosts}
              setHosts={setHosts}
              studyTeams={studyTeams}
              onRegisterStudyTeam={handleRegisterStudyTeam}
            />
          )}
          {activePage === "att-rules" && (
            <RulesPage rules={scoreRules} onUpdateRules={handleUpdateScoreRules} />
          )}
          {activePage === "att-dashboard" && (
            <DashboardPage
              attendance={attendance}
              exceptions={exceptions}
              studyTeams={studyTeams}
              membersMap={membersMap}
              onApprove={approveException}
              onReject={rejectException}
              onDirectEdit={handleDirectEdit}
              onConfirmAdmin={handleConfirmAdmin}
              onOpenAddStudy={() => setActivePage("att-hosts")}
            />
          )}

          {/* 5. System Section */}
          {(activePage.startsWith("system") || activePage === "system") && (
            <SystemAccountsPage
              initialSubTab={
                activePage === "system-permissions"
                  ? "permissions"
                  : activePage === "system-audit"
                    ? "audit"
                    : "accounts"
              }
            />
          )}
        </main>
      </div>

      {/* Global My Profile & Password Change Modal */}
      {showMyProfileModal && (
        <div className="fixed inset-0 bg-black/85 z-90 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-400" />
                <h3 className="text-base font-bold text-foreground">
                  내 계정 정보 & 비밀번호 변경
                </h3>
              </div>
              <button
                onClick={() => setShowMyProfileModal(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-100 space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">로그인 아이디:</span>
                <span className="text-foreground font-bold">@boaz_service_lead</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">성명 / 역할:</span>
                <span className="text-purple-300 font-sans font-bold">
                  남민서 (MASTER · 서비스운영팀장)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">소속 트랙 / 기수:</span>
                <span className="text-[#8ba5ff]">ANALYSIS · 28기</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <KeyRound size={13} className="text-[#8ba5ff]" />
                <span>비밀번호 변경 (PATCH /api/v1/admin/accounts/{"{id}"}/password)</span>
              </p>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  현재 비밀번호 (current_password) <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myCurrentPw}
                  onChange={(e) => setMyCurrentPw(e.target.value)}
                  placeholder="현재 사용 중인 비밀번호"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  새 비밀번호 (new_password) <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myNewPw}
                  onChange={(e) => setMyNewPw(e.target.value)}
                  placeholder="8자 이상 + 영문/숫자/특수문자(!@#$%^&*)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  새 비밀번호 확인 <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myConfirmPw}
                  onChange={(e) => setMyConfirmPw(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>

              {myPwError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-600">
                  {myPwError}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowMyProfileModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground bg-slate-100 hover:bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleSaveMyPassword}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 cursor-pointer shadow-lg shadow-purple-950/40"
              >
                비밀번호 변경 확정
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {loginModalOpen && (
        <LoginModal
          onClose={() => setLoginModalOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          hosts={hosts}
          studyTeams={studyTeams}
        />
      )}
    </div>
  );
}
