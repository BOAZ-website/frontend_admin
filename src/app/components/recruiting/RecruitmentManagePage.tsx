import { useState, useEffect } from "react";
import {
  Megaphone, Plus, Calendar, Download, Trash2, Edit3,
  CheckCircle2, AlertCircle, FileSpreadsheet, BellRing,
  HelpCircle, ChevronRight, FileText, MoveUp, MoveDown,
  Layers, Check, Copy, AlertTriangle, Eye, Sparkles,
  Search, Filter, ExternalLink, X, BookOpen, Clock, ShieldCheck,
  Smartphone, Monitor, Send, Users, UserCheck, Inbox, Table,
  ListPlus, Columns, RefreshCw, MessageSquare, CheckCheck, UserPlus,
  Sparkle, CheckSquare, MessageCircle, BookmarkCheck, Save, RotateCcw
} from "lucide-react";

export type QuestionCategory = "COMMON" | "ANALYSIS" | "ENGINEERING" | "VISUALIZATION";
export type QuestionType = "SHORT_TEXT" | "LONG_TEXT" | "TABLE";
export type TrackType = "ANALYSIS" | "ENGINEERING" | "VISUALIZATION";

export interface ScheduleStep {
  step: string;
  startDate: string;
  endDate: string;
}

export interface RecruitmentPost {
  id: number;
  term: number;
  start_date: string;
  end_date: string;
  schedule: ScheduleStep[];
  brochure_url?: string;
  is_active?: boolean;
  created_at: string;
}

export interface LocalApplicant {
  id: number;
  term: number;
  status: "DRAFT" | "SUBMITTED";
  track: TrackType;
  name: string;
}

export interface QuestionMetadata {
  multiple?: boolean;
  columns: string[];
  rows: string[];
}

export interface ApplicationQuestion {
  id: string;
  recruitment_id: number;
  label: string;
  category: QuestionCategory;
  type: QuestionType;
  content: string;
  description?: string;
  limit_length?: number | null;
  metadata?: QuestionMetadata | null;
  order_num: number;
  is_required: boolean;
  has_answers?: boolean;
}

export interface PreNotificationLead {
  id: number;
  name: string;
  email: string;
  phone: string;
  interestedTrack: TrackType;
  registeredAt: string;
  notifySent: boolean;
}

const INITIAL_POSTS: RecruitmentPost[] = [
  {
    id: 1,
    term: 28,
    start_date: "2026-08-01T00:00:00",
    end_date: "2026-08-25T23:59:59",
    is_active: true,
    created_at: "2026-07-20",
    brochure_url: "https://boaz-bucket.s3.ap-northeast-2.amazonaws.com/brochures/28th_boaz_recruit.pdf",
    schedule: [
      { step: "서류 접수", startDate: "2026-08-01", endDate: "2026-08-25" },
      { step: "1차 서류 발표", startDate: "2026-08-28", endDate: "2026-08-28" },
      { step: "2차 면접 전형", startDate: "2026-08-30", endDate: "2026-09-02" },
      { step: "최종 합격자 발표", startDate: "2026-09-04", endDate: "2026-09-04" },
    ],
  },
  {
    id: 2,
    term: 27,
    start_date: "2026-01-05T00:00:00",
    end_date: "2026-01-28T23:59:59",
    is_active: false,
    created_at: "2025-12-20",
    brochure_url: "https://boaz-bucket.s3.ap-northeast-2.amazonaws.com/brochures/27th_boaz_recruit.pdf",
    schedule: [
      { step: "서류 접수", startDate: "2026-01-05", endDate: "2026-01-28" },
      { step: "1차 서류 발표", startDate: "2026-01-31", endDate: "2026-01-31" },
      { step: "2차 면접 전형", startDate: "2026-02-02", endDate: "2026-02-05" },
      { step: "최종 합격자 발표", startDate: "2026-02-07", endDate: "2026-02-07" },
    ],
  },
];

const INITIAL_LOCAL_APPLICANTS: LocalApplicant[] = [
  ...Array.from({ length: 52 }, (_, i) => ({
    id: 100 + i,
    term: 28,
    status: "SUBMITTED" as const,
    track: (i % 3 === 0 ? "ANALYSIS" : i % 3 === 1 ? "ENGINEERING" : "VISUALIZATION") as TrackType,
    name: `지원자_${i + 1}`,
  })),
  ...Array.from({ length: 24 }, (_, i) => ({
    id: 200 + i,
    term: 28,
    status: "DRAFT" as const,
    track: (i % 3 === 0 ? "ANALYSIS" : i % 3 === 1 ? "ENGINEERING" : "VISUALIZATION") as TrackType,
    name: `작성중_${i + 1}`,
  })),
  ...Array.from({ length: 110 }, (_, i) => ({
    id: 300 + i,
    term: 27,
    status: "SUBMITTED" as const,
    track: (i % 3 === 0 ? "ANALYSIS" : i % 3 === 1 ? "ENGINEERING" : "VISUALIZATION") as TrackType,
    name: `27기수료_${i + 1}`,
  })),
];

const INITIAL_QUESTIONS: ApplicationQuestion[] = [
  { id: "q1", recruitment_id: 28, label: "공통1", category: "COMMON", type: "LONG_TEXT", content: "BOAZ에 지원하게 된 동기와 입부 후 활동 목표를 구체적으로 서술해 주세요.", limit_length: 800, order_num: 1, is_required: true, has_answers: true },
  { id: "q2", recruitment_id: 28, label: "공통2", category: "COMMON", type: "LONG_TEXT", content: "협업 또는 팀 프로젝트 과정에서 발생한 의견 충돌이나 어려움을 주도적으로 해결한 경험을 작성해 주세요.", limit_length: 800, order_num: 2, is_required: true, has_answers: true },
  {
    id: "q3",
    recruitment_id: 28,
    label: "분석1",
    category: "ANALYSIS",
    type: "TABLE",
    content: "데이터 분석 관련 수강 이력 또는 다뤄본 라이브러리 목록을 입력해 주세요.",
    description: "과목/라이브러리명, 숙련도, 활용 프로젝트 내용을 행 단위로 작성",
    metadata: {
      multiple: true,
      columns: ["과목/라이브러리명", "숙련도 (상/중/하)", "활용 경험 및 프로젝트"],
      rows: ["1. 기초 통계학 / 머신러닝", "2. 딥러닝 프레임워크 (PyTorch/TensorFlow)", "3. 데이터 전처리 / SQL"]
    },
    limit_length: null,
    order_num: 1,
    is_required: true,
    has_answers: true
  },
  { id: "q4", recruitment_id: 28, label: "분석2", category: "ANALYSIS", type: "LONG_TEXT", content: "머신러닝/딥러닝 모델링 프로젝트 중 가설 설정부터 성능 검증까지의 전 과정을 구체적으로 설명해 주세요.", limit_length: 1000, order_num: 2, is_required: true, has_answers: false },
  { id: "q5", recruitment_id: 28, label: "엔지니어링1", category: "ENGINEERING", type: "LONG_TEXT", content: "데이터 파이프라인 구축 또는 백엔드/클라우드 인프라 운영 경험을 기술해 주세요.", limit_length: 1000, order_num: 1, is_required: true, has_answers: true },
  { id: "q6", recruitment_id: 28, label: "시각화1", category: "VISUALIZATION", type: "LONG_TEXT", content: "데이터를 효과적으로 전달하기 위해 UI/UX 또는 대시보드를 직접 기획/개발한 경험을 기술해 주세요.", limit_length: 1000, order_num: 1, is_required: true, has_answers: true },
];

const INITIAL_LEADS: PreNotificationLead[] = [
  { id: 1, name: "이민석", email: "ms.lee@yonsei.ac.kr", phone: "010-4491-0021", interestedTrack: "ANALYSIS", registeredAt: "2026-07-25 14:20", notifySent: true },
  { id: 2, name: "박지수", email: "jisu.park@korea.ac.kr", phone: "010-8812-9930", interestedTrack: "ENGINEERING", registeredAt: "2026-07-28 19:10", notifySent: true },
  { id: 3, name: "최은우", email: "eunwoo@snu.ac.kr", phone: "010-3391-7712", interestedTrack: "VISUALIZATION", registeredAt: "2026-07-30 11:45", notifySent: true },
  { id: 4, name: "김태형", email: "th.kim@hanyang.ac.kr", phone: "010-6629-1829", interestedTrack: "ANALYSIS", registeredAt: "2026-08-01 09:15", notifySent: false },
  { id: 5, name: "정다은", email: "daeun.j@snu.ac.kr", phone: "010-7712-4490", interestedTrack: "ENGINEERING", registeredAt: "2026-08-02 16:30", notifySent: false },
];

const DEFAULT_NOTIFY_TEMPLATE = `[BOAZ] {name}님, 기다리시던 BOAZ 제{term}기 정규 신입 부원 모집이 시작되었습니다!

국내 최초 빅데이터 동아리 BOAZ에서 함께 성장할 열정적인 {track} 트랙 부원을 모집합니다.

■ 모집 기간: {start_date} ~ {end_date} 23:59까지
■ 모집 트랙: 데이터 분석 / 데이터 엔지니어링 / 데이터 시각화
■ 지원서 작성: https://boaz-bigdata.com/recruitment
■ 홍보 브로슈어: https://boaz-bucket.s3.ap-northeast-2.amazonaws.com/brochures/28th_boaz_recruit.pdf

새로운 도전을 기다립니다. 많은 관심과 지원 부탁드립니다!
(문의: 카카오톡 채널 @BOAZ / 인스타그램 @boaz_bigdata)`;

function getRecruitmentStatusInfo(post: RecruitmentPost): {
  label: string;
  subLabel: string;
  isActive: boolean;
  color: string;
  bg: string;
  border: string;
} {
  const now = new Date();
  const start = new Date(post.start_date);
  const end = new Date(post.end_date);

  if (now < start) {
    return { label: "모집 예정", subLabel: "UPCOMING", isActive: false, color: "#d97706", bg: "#fffbeb", border: "#fde68a" };
  } else if (now > end || post.is_active === false) {
    return { label: "모집 마감", subLabel: "CLOSED", isActive: false, color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" };
  } else {
    return { label: "모집 진행중", subLabel: "ACTIVE", isActive: true, color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" };
  }
}

function getLocalApplicantCounts(term: number, applicants: LocalApplicant[]): { draft: number; submitted: number; total: number } {
  const termApplicants = applicants.filter(a => a.term === term);
  const draft = termApplicants.filter(a => a.status === "DRAFT").length;
  const submitted = termApplicants.filter(a => a.status === "SUBMITTED").length;
  return { draft, submitted, total: termApplicants.length };
}

const CATEGORY_META: Record<QuestionCategory, { label: string; short: string; color: string; bg: string; border: string }> = {
  COMMON: { label: "전체 공통 문항", short: "공통", color: "#334155", bg: "#f1f5f9", border: "#cbd5e1" },
  ANALYSIS: { label: "데이터 분석 트랙", short: "분석", color: "#0f172a", bg: "#f8fafc", border: "#cbd5e1" },
  ENGINEERING: { label: "데이터 엔지니어링 트랙", short: "엔지니어링", color: "#0f172a", bg: "#f8fafc", border: "#cbd5e1" },
  VISUALIZATION: { label: "데이터 시각화 트랙", short: "시각화", color: "#0f172a", bg: "#f8fafc", border: "#cbd5e1" },
};

const BASE_CSV_COLUMNS = ["user_id", "지원자명", "성별", "이메일주소", "전화번호", "지원트랙", "지원상태", "합불결과", "서류평가점수", "최종평가점수", "제출일시"];

const FIXED_CSV_HEADERS = [
  "지원자 식별자(user_id)", "지원 트랙", "이름", "이메일", "전화번호", "1차 합불결과",
  "대학교", "전공", "복수전공", "재학 학기", "병역",
  "생년월일", "졸업예정연월", "향후계획", "제출일시"
];

function sanitizeCsvValue(val: any): string {
  if (val === null || val === undefined) return "";
  let str = String(val).trim();
  if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@") || str.startsWith("\t") || str.startsWith("\r")) {
    str = "'" + str;
  }
  return str;
}

export function RecruitmentManagePage({
  initialTab = "posts",
  onTabChange,
}: {
  initialTab?: "posts" | "questions" | "preview" | "csv" | "notifications" | "leads";
  onTabChange?: (tab: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"posts" | "questions" | "preview" | "csv" | "notifications" | "leads">(
    (initialTab === "leads" ? "notifications" : initialTab) as any
  );
  const [posts, setPosts] = useState<RecruitmentPost[]>(INITIAL_POSTS);
  const [localApplicants, setLocalApplicants] = useState<LocalApplicant[]>(INITIAL_LOCAL_APPLICANTS);
  const [questions, setQuestions] = useState<ApplicationQuestion[]>(INITIAL_QUESTIONS);
  const [selectedCat, setSelectedCat] = useState<"ALL" | QuestionCategory>("ALL");
  const [previewTrack, setPreviewTrack] = useState<TrackType>("ANALYSIS");

  // Leads & Notification Template State with Default Custom Persistence
  const [leads, setLeads] = useState<PreNotificationLead[]>(INITIAL_LEADS);
  const [savedDefaultTemplate, setSavedDefaultTemplate] = useState<string>(() => {
    return localStorage.getItem("boaz_custom_notify_template") || DEFAULT_NOTIFY_TEMPLATE;
  });
  const [notifyTemplate, setNotifyTemplate] = useState<string>(() => {
    return localStorage.getItem("boaz_custom_notify_template") || DEFAULT_NOTIFY_TEMPLATE;
  });
  const [copiedLeadId, setCopiedLeadId] = useState<number | null>(null);
  const [copiedAllTemplate, setCopiedAllTemplate] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedLeadForPreview, setSelectedLeadForPreview] = useState<PreNotificationLead>(INITIAL_LEADS[0]);

  // Reference-style Table Filters & Multi-Selection
  const [leadSearchQuery, setLeadSearchQuery] = useState("");
  const [leadTrackFilter, setLeadTrackFilter] = useState<"ALL" | TrackType>("ALL");
  const [leadStatusFilter, setLeadStatusFilter] = useState<"ALL" | "SENT" | "PENDING">("ALL");
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);

  // Quick Add Lead Modal
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", email: "", phone: "", interestedTrack: "ANALYSIS" as TrackType });

  // Sync initialTab when sidebar navigates
  useEffect(() => {
    if (initialTab) {
      setActiveTab((initialTab === "leads" ? "notifications" : initialTab) as any);
    }
  }, [initialTab]);

  // Modal: Edit/Create Post
  const [editingPost, setEditingPost] = useState<RecruitmentPost | null>(null);
  const [isNewPost, setIsNewPost] = useState(false);

  // Modal: Edit/Create Question
  const [editingQuestion, setEditingQuestion] = useState<ApplicationQuestion | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState(false);

  // CSV Extraction State
  const [csvTerm, setCsvTerm] = useState<number>(28);
  const [csvDecision, setCsvDecision] = useState<"ALL" | "PASS" | "FAIL" | "PENDING">("ALL");
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const activePost = posts.find(p => p.is_active) || posts[0];

  function showToast(msg: string) {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }

  function handleTabClick(tab: "posts" | "questions" | "preview" | "csv" | "notifications") {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab === "posts" ? "recruiting-posts" : tab === "questions" ? "recruiting-questions" : tab === "preview" ? "recruiting-preview" : tab === "csv" ? "recruiting-csv" : "recruiting-leads");
    }
  }

  function handleSavePost() {
    if (!editingPost) return;
    if (isNewPost) {
      setPosts(prev => [editingPost, ...prev]);
    } else {
      setPosts(prev => prev.map(p => p.id === editingPost.id ? editingPost : p));
    }
    setEditingPost(null);
    showToast("모집 공고가 성공적으로 저장되었습니다.");
  }

  function handleDeletePost(post: RecruitmentPost) {
    if (confirm(`제${post.term}기 모집 공고를 정말 삭제하시겠습니까?`)) {
      setPosts(prev => prev.filter(p => p.id !== post.id));
      showToast(`제${post.term}기 모집 공고가 삭제되었습니다.`);
    }
  }

  function handleSaveQuestion() {
    if (!editingQuestion) return;
    if (!editingQuestion.content.trim()) { alert("문항 내용을 입력하세요."); return; }

    let qToSave = { ...editingQuestion };
    if (qToSave.type === "TABLE") {
      qToSave.limit_length = null;
      if (!qToSave.metadata || (!qToSave.metadata.columns.length && !qToSave.metadata.rows.length)) {
        qToSave.metadata = {
          columns: ["과목/라이브러리명", "숙련도", "활용 경험"],
          rows: ["1. 기초 통계학 / 머신러닝", "2. 딥러닝 프레임워크 (PyTorch)", "3. 데이터 전처리 / SQL"],
          multiple: true
        };
      }
    } else {
      qToSave.metadata = null;
      if (!qToSave.limit_length) qToSave.limit_length = 800;
    }

    if (isNewQuestion) {
      setQuestions(prev => [...prev, qToSave]);
    } else {
      setQuestions(prev => prev.map(q => q.id === qToSave.id ? qToSave : q));
    }
    setEditingQuestion(null);
    showToast("지원서 문항이 성공적으로 저장되었습니다.");
  }

  function handleDeleteQuestion(q: ApplicationQuestion) {
    if (q.has_answers) {
      alert(`[삭제 불가] 해당 문항은 이미 지원자가 답변을 작성하여 삭제할 수 없습니다. (QUESTION_HAS_ANSWERS)`);
      return;
    }
    if (confirm(`'${q.label}' 문항을 삭제하시겠습니까?`)) {
      setQuestions(prev => prev.filter(item => item.id !== q.id));
      showToast(`'${q.label}' 문항이 삭제되었습니다.`);
    }
  }

  function handleMoveQuestionOrder(qId: string, direction: "UP" | "DOWN") {
    const targetQ = questions.find(q => q.id === qId);
    if (!targetQ) return;
    const catList = questions.filter(q => q.category === targetQ.category).sort((a, b) => a.order_num - b.order_num);
    const idx = catList.findIndex(q => q.id === qId);
    if (direction === "UP" && idx > 0) {
      const prevQ = catList[idx - 1];
      const tmp = targetQ.order_num;
      targetQ.order_num = prevQ.order_num;
      prevQ.order_num = tmp;
    } else if (direction === "DOWN" && idx < catList.length - 1) {
      const nextQ = catList[idx + 1];
      const tmp = targetQ.order_num;
      targetQ.order_num = nextQ.order_num;
      nextQ.order_num = tmp;
    }
    setQuestions([...questions]);
  }

  function handleDownloadTrackCsv(track: TrackType) {
    const commonQuestions = questions.filter(q => q.category === "COMMON").sort((a, b) => a.order_num - b.order_num);
    const trackQuestions = questions.filter(q => q.category === track).sort((a, b) => a.order_num - b.order_num);
    const allHeaders = [...FIXED_CSV_HEADERS, ...commonQuestions.map(q => q.label), ...trackQuestions.map(q => q.label)];
    const headerRow = allHeaders.map(h => `"${sanitizeCsvValue(h)}"`).join(",");

    const mockRows = [
      [
        "usr_101", track, "이도현", "dohyun@snu.ac.kr", "010-3819-2910", "합격",
        "서울대학교", "통계학과", "컴퓨터공학 복전", "4학년 1학기", "군필",
        "2001-05-14", "2027-02", "미정", "2026-08-15 19:20",
        "통계적 가설 검정과 ML을 응용한 데이터 분석가가 되고 싶어 지원했습니다.",
        "해커톤에서 결측치 처리 기준 갈등을 EDA 차트로 설득하여 최우수상을 수상했습니다.",
        track === "ANALYSIS" ? "과목/라이브러리명: Scikit-learn, PyTorch\n프로젝트 내용: 뉴스 텍스트 감성 분류" : "RDBMS 인덱스 최적화 및 데이터 파이프라인 구축",
        "가설 설정부터 LightGBM 모델링, A/B 테스트 검증까지 진행했습니다."
      ],
      [
        "usr_102", track, "김서하", "seoha@yonsei.ac.kr", "010-5519-8821", csvDecision === "FAIL" ? "불합격" : "합격",
        "연세대학교", "경영학과", "빅데이터 응용", "3학년 2학기", "해당없음",
        "2002-09-22", "2027-08", "진학 예정", "2026-08-16 11:30",
        "비즈니스 관점의 그로스 데이터 분석가가 되고 싶습니다.",
        "홍보 예산 집행 시 A/B 테스트로 전환율 개선 경험",
        track === "ANALYSIS" ? "과목/라이브러리: Pandas, SQL\n프로젝트 경험: 코호트 분석" : "Docker 컨테이너 인프라 관리",
        "이커머스 고객 이탈 예측 모델링 수행"
      ],
    ];

    const dataRows = mockRows.map(row => row.map(v => `"${sanitizeCsvValue(v).replace(/"/g, '""')}"`).join(","));
    const csvContent = "\uFEFF" + [headerRow, ...dataRows].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applicants_${track}_${csvDecision}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(`${CATEGORY_META[track].short} 트랙 지원서 CSV가 성공적으로 다운로드되었습니다.`);
    setTimeout(() => setDownloadSuccess(null), 4000);
  }

  // ─── Personalized Notification Formatting & Copy ───
  function formatPersonalizedMessage(lead: PreNotificationLead): string {
    const post = activePost;
    const trackLabel = CATEGORY_META[lead.interestedTrack]?.label || "데이터 분석";
    const startDate = post.start_date.slice(0, 10);
    const endDate = post.end_date.slice(0, 10);

    return notifyTemplate
      .replace(/\{name\}/g, lead.name)
      .replace(/\{term\}/g, String(post.term))
      .replace(/\{track\}/g, trackLabel)
      .replace(/\{start_date\}/g, startDate)
      .replace(/\{end_date\}/g, endDate);
  }

  function handleCopyPersonalizedMessage(lead: PreNotificationLead) {
    const text = formatPersonalizedMessage(lead);
    navigator.clipboard.writeText(text);
    setCopiedLeadId(lead.id);
    setSelectedLeadForPreview(lead);
    showToast(`[${lead.name}] 님 맞춤 알림 문구가 복사되었습니다! (Ctrl+V로 발송)`);
    setTimeout(() => setCopiedLeadId(null), 2500);
  }

  function handleCopyAllTemplate() {
    navigator.clipboard.writeText(notifyTemplate);
    setCopiedAllTemplate(true);
    showToast("알림 템플릿 기본 문구가 클립보드에 복사되었습니다.");
    setTimeout(() => setCopiedAllTemplate(false), 2500);
  }

  // Save current edited text as the new custom default template
  function handleSaveAsDefaultTemplate() {
    setSavedDefaultTemplate(notifyTemplate);
    localStorage.setItem("boaz_custom_notify_template", notifyTemplate);
    showToast("현재 수정한 문구가 '새 기본 양식'으로 저장되었습니다.");
  }

  // Reset to the custom default template or system template
  function handleResetToSavedDefault() {
    setNotifyTemplate(savedDefaultTemplate);
    showToast("저장된 기본 양식으로 복원되었습니다.");
  }

  function handleResetToSystemDefault() {
    setNotifyTemplate(DEFAULT_NOTIFY_TEMPLATE);
    setSavedDefaultTemplate(DEFAULT_NOTIFY_TEMPLATE);
    localStorage.removeItem("boaz_custom_notify_template");
    showToast("시스템 표준 초기 양식으로 초기화되었습니다.");
  }

  function handleAddLead() {
    if (!newLead.name.trim()) { alert("이름을 입력하세요."); return; }
    const item: PreNotificationLead = {
      id: Date.now(),
      name: newLead.name.trim(),
      email: newLead.email.trim(),
      phone: newLead.phone.trim(),
      interestedTrack: newLead.interestedTrack,
      registeredAt: new Date().toISOString().slice(0, 16).replace("T", " "),
      notifySent: false,
    };
    setLeads(prev => [item, ...prev]);
    setNewLead({ name: "", email: "", phone: "", interestedTrack: "ANALYSIS" });
    setShowAddLeadModal(false);
    showToast(`[${item.name}] 님이 사전 알림 명단에 추가되었습니다.`);
  }

  function handleDeleteLead(id: number, name: string) {
    if (confirm(`'${name}' 님의 사전 알림 신청 내역을 삭제하시겠습니까?`)) {
      setLeads(prev => prev.filter(l => l.id !== id));
      showToast(`'${name}' 님의 신청 내역이 삭제되었습니다.`);
    }
  }

  function handleMarkAllSent() {
    if (confirm(`미발송 상태인 ${leads.filter(l => !l.notifySent).length}명의 발송 상태를 '발송 완료'로 일괄 변경하시겠습니까?`)) {
      setLeads(prev => prev.map(l => ({ ...l, notifySent: true })));
      showToast("모든 신청자의 발송 상태가 '발송 완료'로 업데이트되었습니다.");
    }
  }

  const filteredQuestions = questions.filter(q => selectedCat === "ALL" || q.category === selectedCat).sort((a, b) => a.order_num - b.order_num);

  const previewQuestions = [
    ...questions.filter(q => q.category === "COMMON").sort((a, b) => a.order_num - b.order_num),
    ...questions.filter(q => q.category === previewTrack).sort((a, b) => a.order_num - b.order_num),
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-70 bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center gap-2.5 border border-slate-700/80 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ─── 1. Premium Segmented Navigation Tabs ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl border border-slate-300/50">
          {[
            { id: "posts", label: "모집 공고 관리", icon: Megaphone },
            { id: "questions", label: "지원서 문항 설정", icon: HelpCircle },
            { id: "preview", label: "지원자 화면 미리보기", icon: Eye },
            { id: "csv", label: "지원서 CSV 추출", icon: Download },
            { id: "notifications", label: "사전 알림 명단 & 발송", icon: BellRing },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isActive
                    ? "bg-white text-slate-950 shadow-xs font-bold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/40"
                }`}
              >
                <Icon size={14} className={isActive ? "text-red-600" : "text-slate-400"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB 1: 모집 공고 관리 (Posts) ─── */}
      {activeTab === "posts" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">모집 공고 관리</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                기수별 모집 일정, 전형 단계, 브로슈어 첨부 및 실시간 지원자 접수 현황을 관리합니다.
              </p>
            </div>
            <button
              onClick={() => {
                setIsNewPost(true);
                setEditingPost({
                  id: Date.now(),
                  term: 29,
                  start_date: new Date().toISOString().slice(0, 10) + "T00:00:00",
                  end_date: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) + "T23:59:59",
                  is_active: true,
                  created_at: new Date().toISOString().slice(0, 10),
                  brochure_url: "",
                  schedule: [
                    { step: "서류 접수", startDate: new Date().toISOString().slice(0, 10), endDate: new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10) },
                    { step: "1차 서류 발표", startDate: new Date(Date.now() + 23 * 86400000).toISOString().slice(0, 10), endDate: new Date(Date.now() + 23 * 86400000).toISOString().slice(0, 10) },
                  ],
                });
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Plus size={14} /> 새 모집 공고 등록
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {posts.map(post => {
              const statusInfo = getRecruitmentStatusInfo(post);
              const applicantCounts = getLocalApplicantCounts(post.term, localApplicants);

              return (
                <div
                  key={post.id}
                  className={`rounded-2xl border bg-white p-6 space-y-5 transition-all shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-md ${
                    post.is_active ? "border-red-200 ring-1 ring-red-500/10" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                          제{post.term}기
                        </span>
                        <span
                          className="px-2.5 py-0.5 rounded-md text-xs font-bold font-mono border"
                          style={{ background: statusInfo.bg, color: statusInfo.color, borderColor: statusInfo.border }}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          등록일: {post.created_at}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                        BOAZ 제{post.term}기 정규 신입 부원 모집
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar size={13} className="text-red-500" />
                        <span>접수 기간: <strong className="text-slate-900 font-mono">{post.start_date.replace("T", " ")} ~ {post.end_date.replace("T", " ")}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {post.brochure_url && (
                        <a
                          href={post.brochure_url}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-blue-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
                        >
                          <BookOpen size={13} />
                          <span>홍보 책자 (PDF)</span>
                        </a>
                      )}
                      <button
                        onClick={() => { setIsNewPost(false); setEditingPost({ ...post }); }}
                        className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                      >
                        <Edit3 size={13} />
                        <span>수정</span>
                      </button>
                      <button
                        onClick={() => handleDeletePost(post)}
                        className="p-1.5 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 border border-slate-200 text-xs cursor-pointer transition-colors"
                        title="공고 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 text-xs">
                    <div>
                      <p className="text-slate-500 text-[11px] font-medium">모집 기수</p>
                      <p className="font-bold text-slate-900 text-sm mt-0.5 font-mono">
                        {post.term}기 (정규)
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[11px] font-medium">작성중 지원서</p>
                      <p className="font-bold text-amber-600 text-sm mt-0.5 font-mono">
                        {applicantCounts.draft}건
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[11px] font-medium">제출 완료</p>
                      <p className="font-bold text-emerald-600 text-sm mt-0.5 font-mono">
                        {applicantCounts.submitted}건
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 text-[11px] font-medium">홍보 브로슈어</p>
                      <p className="text-slate-700 mt-0.5 font-mono text-[11px] truncate">
                        {post.brochure_url ? "S3 등록 완료" : "미등록"}
                      </p>
                    </div>
                  </div>

                  {/* 전형 일정 */}
                  {post.schedule && post.schedule.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock size={13} className="text-red-500" />
                        <span>전형별 상세 일정</span>
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {post.schedule.map((step, idx) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs">
                            <p className="font-bold text-slate-800">{step.step}</p>
                            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                              {step.startDate} ~ {step.endDate}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: 지원서 문항 관리 (Questions) ─── */}
      {activeTab === "questions" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">지원서 문항 설정</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                공통 문항 및 분석/엔지니어링/시각화 트랙별 전용 문항과 테이블 형태 문항(행/열 메타데이터)을 설정합니다.
              </p>
            </div>
            <button
              onClick={() => {
                const targetCat = selectedCat === "ALL" ? "COMMON" : selectedCat;
                const nextOrder = questions.filter(q => q.category === targetCat).length + 1;
                setIsNewQuestion(true);
                setEditingQuestion({
                  id: "q_" + Date.now(),
                  recruitment_id: 28,
                  label: `${CATEGORY_META[targetCat].short}${nextOrder}`,
                  category: targetCat,
                  type: "LONG_TEXT",
                  content: "",
                  order_num: nextOrder,
                  is_required: true,
                  limit_length: 800,
                  metadata: null,
                  has_answers: false,
                });
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Plus size={14} /> 새 문항 추가
            </button>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedCat("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedCat === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              전체 문항 ({questions.length})
            </button>
            {(["COMMON", "ANALYSIS", "ENGINEERING", "VISUALIZATION"] as QuestionCategory[]).map(cat => {
              const meta = CATEGORY_META[cat];
              const count = questions.filter(q => q.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCat(cat)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs"
                  style={
                    selectedCat === cat
                      ? { background: meta.color, color: "#ffffff", borderColor: meta.color }
                      : { background: meta.bg, color: meta.color, borderColor: meta.border }
                  }
                >
                  {meta.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Questions List */}
          <div className="space-y-3">
            {filteredQuestions.map(q => {
              const meta = CATEGORY_META[q.category];
              return (
                <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-bold border" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                        {meta.label}
                      </span>
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        [{q.label}]
                      </span>
                      {q.is_required && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-red-50 text-red-600 border border-red-200">
                          필수
                        </span>
                      )}
                      {q.has_answers && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200" title="제출된 답변이 있어 삭제 불가">
                          답변 작성됨
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleMoveQuestionOrder(q.id, "UP")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
                        title="위로 이동"
                      >
                        <MoveUp size={13} />
                      </button>
                      <button
                        onClick={() => handleMoveQuestionOrder(q.id, "DOWN")}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer transition-colors"
                        title="아래로 이동"
                      >
                        <MoveDown size={13} />
                      </button>
                      <button
                        onClick={() => {
                          setIsNewQuestion(false);
                          setEditingQuestion({
                            ...q,
                            metadata: q.metadata ? {
                              columns: [...(q.metadata.columns || [])],
                              rows: [...(q.metadata.rows || [])],
                              multiple: q.metadata.multiple ?? false
                            } : null
                          });
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
                        title="수정"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(q)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 cursor-pointer transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-semibold text-slate-800 leading-relaxed">
                    {q.content}
                  </p>

                  {/* Table Question Metadata Summary (Rows & Columns) */}
                  {q.type === "TABLE" && q.metadata && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Table size={14} className="text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">테이블 구조 메타데이터</span>
                        {q.metadata.multiple && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200 font-mono font-bold">
                            multiple: true
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-slate-500 text-[11px] font-semibold block mb-1">
                            열 헤더 ({q.metadata.columns?.length || 0}개):
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {q.metadata.columns?.map((col, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono text-[11px] shadow-2xs">
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <span className="text-slate-500 text-[11px] font-semibold block mb-1">
                            행 항목 ({q.metadata.rows?.length || 0}개):
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {q.metadata.rows?.map((row, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200 font-mono text-[11px] shadow-2xs">
                                {row}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100 font-mono">
                    <span>유형: {q.type === "TABLE" ? "테이블 입력형 (TABLE)" : q.type === "LONG_TEXT" ? "장문형 (LONG_TEXT)" : "단문형 (SHORT_TEXT)"}</span>
                    <span>{q.type === "TABLE" ? "테이블 행/열 응답" : q.limit_length ? `${q.limit_length}자 이내` : "제한 없음"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 3: 지원자 화면 미리보기 (Preview) ─── */}
      {activeTab === "preview" && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Eye size={16} className="text-red-600" />
                <span>지원자 화면 실시간 미리보기</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                실제 신입 지원자가 보게 될 공통 및 트랙별 지원서 입력 화면입니다.
              </p>
            </div>

            {/* Track Selector for Preview */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
              {(["ANALYSIS", "ENGINEERING", "VISUALIZATION"] as TrackType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setPreviewTrack(t)}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    previewTrack === t ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {CATEGORY_META[t].short} 트랙 뷰
                </button>
              ))}
            </div>
          </div>

          {/* Form Preview Container */}
          <div className="rounded-2xl bg-white border border-slate-200 p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-200 pb-4 space-y-1">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600 border border-red-200">
                제28기 신입 지원서
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                BOAZ 제28기 정규 부원 지원서 ({CATEGORY_META[previewTrack].label})
              </h1>
              <p className="text-xs text-slate-500">
                작성 중인 내용은 임시저장(DRAFT)되며, 최종 제출(SUBMITTED) 전까지 자유롭게 수정할 수 있습니다.
              </p>
            </div>

            {/* Basic Info Mock */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <h3 className="text-xs font-bold text-slate-700">1. 기본 인적 사항 (자동 기재)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px]">이름</span>
                  <span className="font-bold text-slate-800">홍길동</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">지원 트랙</span>
                  <span className="font-bold text-blue-600">{CATEGORY_META[previewTrack].label}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">이메일</span>
                  <span className="font-mono text-slate-800">gildong@univ.ac.kr</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">전화번호</span>
                  <span className="font-mono text-slate-800">010-1234-5678</span>
                </div>
              </div>
            </div>

            {/* Dynamic Application Questions List */}
            <div className="space-y-6">
              <h3 className="text-xs font-bold text-slate-700">2. 자기소개 및 전공 역량 문항 ({previewQuestions.length}문항)</h3>

              {previewQuestions.map((q, idx) => {
                const meta = CATEGORY_META[q.category];
                return (
                  <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold border" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                          {meta.short}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          Q{idx + 1}. {q.label}
                        </span>
                        {q.is_required && (
                          <span className="text-red-500 font-bold text-xs">*</span>
                        )}
                      </div>
                      {q.limit_length && (
                        <span className="text-xs text-slate-400 font-mono">
                          0 / {q.limit_length}자
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {q.content}
                    </p>

                    {q.type === "TABLE" ? (
                      <div className="space-y-2 overflow-x-auto">
                        <table className="w-full text-xs border border-slate-200 rounded-lg overflow-hidden bg-white">
                          <thead>
                            <tr className="bg-slate-100 text-slate-700 font-semibold">
                              <th className="text-left px-3 py-2.5 border-r border-slate-200 w-44 bg-slate-200/60">구분 / 항목</th>
                              {q.metadata?.columns?.map((c, i) => (
                                <th key={i} className="text-left px-3 py-2.5 border-r border-slate-200 last:border-r-0">{c}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 font-mono">
                            {(q.metadata?.rows && q.metadata.rows.length > 0 ? q.metadata.rows : ["항목 1"]).map((rowLabel, rIdx) => (
                              <tr key={rIdx} className="hover:bg-slate-50/70">
                                <td className="px-3 py-2 border-r border-slate-200 bg-slate-50 font-bold text-slate-800 text-[11px] font-sans">
                                  {rowLabel}
                                </td>
                                {q.metadata?.columns?.map((_, cIdx) => (
                                  <td key={cIdx} className="px-3 py-2 border-r border-slate-200 last:border-r-0">
                                    <input
                                      placeholder="내용 입력..."
                                      className="w-full px-2 py-1 rounded bg-slate-50/50 border border-slate-200 outline-none text-xs text-slate-900 focus:bg-white focus:border-blue-500 transition-colors"
                                    />
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <textarea
                        rows={4}
                        placeholder="답변을 작성해 주세요..."
                        className="w-full p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 outline-none focus:border-blue-500 transition-colors"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
              <button className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer">
                임시 저장 (DRAFT)
              </button>
              <button className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer shadow-xs">
                지원서 최종 제출 (SUBMITTED)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: 지원서 CSV 추출 (CSV Download) ─── */}
      {activeTab === "csv" && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">지원서 CSV 추출</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              기수 및 트랙별 지원서 데이터를 UTF-8 BOM 엑셀 호환 CSV 형식으로 브라우저에서 즉시 다운로드합니다.
            </p>
          </div>

          {downloadSuccess && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2.5 shadow-2xs">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(["ANALYSIS", "ENGINEERING", "VISUALIZATION"] as TrackType[]).map(track => {
              const meta = CATEGORY_META[track];
              const applicants = localApplicants.filter(a => a.track === track && a.term === csvTerm);
              return (
                <div key={track} className="p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4 hover:border-slate-300 transition-all">
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold border" style={{ background: meta.bg, color: meta.color, borderColor: meta.border }}>
                      {meta.label}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-2">{meta.short} 트랙 지원서</h3>
                    <p className="text-xs text-slate-500 font-mono">제{csvTerm}기 지원자: {applicants.length}명</p>
                  </div>

                  <button
                    onClick={() => handleDownloadTrackCsv(track)}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white shadow-xs flex items-center justify-center gap-2 cursor-pointer transition-all hover:opacity-95 active:scale-[0.98]"
                    style={{ background: meta.color }}
                  >
                    <Download size={14} />
                    <span>{meta.short} 트랙 CSV 즉시 받기</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 5: 사전 알림 명단 & 발송 안내 템플릿 (Notifications & Leads) ─── */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          {/* Header Controls */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <BellRing size={20} className="text-blue-600" />
                <span>모집 사전 알림 명단 & 발송 관리</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                모집 오픈 전 알림을 신청한 예비 지원자 명단을 확인하고, 맞춤 발송 문구를 원클릭으로 복사하여 안내를 발송합니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddLeadModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <UserPlus size={13} className="text-blue-600" />
                <span>+ 알림 신청자 직접 등록</span>
              </button>

              <button
                onClick={handleMarkAllSent}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
              >
                <CheckCheck size={14} />
                <span>미발송자 전원 발송완료 처리</span>
              </button>
            </div>
          </div>

          {/* 1. Two-Column Layout: Message Template Editor (Left) & Real Mobile Chat Preview (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Message Template Editor */}
            <div className="lg:col-span-7 p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <MessageSquare size={15} className="text-blue-600" />
                    <span>모집 시작 알림 메시지 양식 (대표진 직접 수정 가능)</span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    아래 템플릿의 문구를 자유롭게 수정하세요. 실시간으로 오른쪽 미리보기에 반영됩니다.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {/* [현재 내용을 기본 양식으로 설정] Button */}
                  <button
                    onClick={handleSaveAsDefaultTemplate}
                    className="w-[132px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                    title="현재 수정한 문구를 영구 기본 양식으로 저장합니다."
                  >
                    <Save size={12} />
                    <span>기본 양식으로 설정</span>
                  </button>

                  {/* [기본 양식 복원] Button */}
                  <button
                    onClick={handleResetToSavedDefault}
                    className="w-[105px] justify-center py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    title="저장된 기본 양식으로 되돌립니다."
                  >
                    <RotateCcw size={11} />
                    <span>기본 양식 복원</span>
                  </button>

                  {/* [전체 템플릿 복사] Button */}
                  <button
                    onClick={handleCopyAllTemplate}
                    className="w-[90px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
                  >
                    {copiedAllTemplate ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{copiedAllTemplate ? "복사 완료!" : "양식 복사"}</span>
                  </button>
                </div>
              </div>

              {/* Variable Chips Toolbar */}
              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <span className="text-slate-500 font-semibold">자동 치환 변수:</span>
                {[
                  { tag: "{name}", desc: "이름" },
                  { tag: "{term}", desc: "기수" },
                  { tag: "{track}", desc: "트랙" },
                  { tag: "{start_date}", desc: "시작일" },
                  { tag: "{end_date}", desc: "마감일" },
                ].map(v => (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => setNotifyTemplate(prev => prev + ` ${v.tag}`)}
                    className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 font-mono font-bold cursor-pointer transition-colors"
                  >
                    {v.tag} ({v.desc})
                  </button>
                ))}
              </div>

              {/* Editable Textarea */}
              <textarea
                rows={9}
                value={notifyTemplate}
                onChange={e => setNotifyTemplate(e.target.value)}
                placeholder="모집 시작 알림 안내 메시지를 입력하세요..."
                className="w-full p-4 rounded-xl bg-slate-50/80 border border-slate-200 text-xs font-mono leading-relaxed text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all shadow-2xs"
              />
            </div>

            {/* Right: Live Mobile / SMS Chat Preview */}
            <div className="lg:col-span-5 p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-xl space-y-3 flex flex-col justify-between">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Smartphone size={15} className="text-blue-400" />
                  <span className="text-xs font-bold">카카오톡 / 문자 미리보기</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono border border-blue-500/30">
                  수신자: {selectedLeadForPreview.name} ({CATEGORY_META[selectedLeadForPreview.interestedTrack]?.short || "분석"})
                </span>
              </div>

              {/* Chat Bubble Frame */}
              <div className="flex-1 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 overflow-y-auto max-h-72 text-xs leading-relaxed font-sans text-slate-100 whitespace-pre-wrap selection:bg-blue-500 selection:text-white">
                {formatPersonalizedMessage(selectedLeadForPreview)}
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => handleCopyPersonalizedMessage(selectedLeadForPreview)}
                  className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-[0.98]"
                >
                  <Copy size={13} />
                  <span>이 수신자 문구 복사 (Ctrl+V)</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Applicant Leads Table with Reference Image 2 Style */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-0">
            {/* Header Area */}
            <div className="px-6 py-4.5 flex items-center justify-between flex-wrap gap-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  사전 알림 신청자 명단 (Record Selection)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  총 {leads.length}명의 예비 지원자 등록됨 · 개별 복사 및 일괄 선택 관리
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedLeadIds.length > 0 && (
                  <button
                    onClick={() => {
                      const selectedSet = new Set(selectedLeadIds);
                      setLeads(prev => prev.map(l => selectedSet.has(l.id) ? { ...l, notifySent: true } : l));
                      setSelectedLeadIds([]);
                      showToast(`${selectedSet.size}명의 발송 상태가 '발송 완료'로 일괄 변경되었습니다.`);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all"
                  >
                    <CheckCheck size={13} />
                    <span>선택 {selectedLeadIds.length}명 발송완료</span>
                  </button>
                )}

                <button
                  onClick={() => setShowAddLeadModal(true)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
                >
                  <Plus size={13} />
                  <span>+ 새 신청자 등록</span>
                </button>
              </div>
            </div>

            {/* Filter Toolbar (Reference Image 2) */}
            <div className="px-6 py-3.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
                {/* Search Input */}
                <div className="relative w-64">
                  <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    value={leadSearchQuery}
                    onChange={e => setLeadSearchQuery(e.target.value)}
                    placeholder="이름, 연락처, 이메일 검색..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 shadow-2xs transition-all"
                  />
                  {leadSearchQuery && (
                    <button onClick={() => setLeadSearchQuery("")} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500 text-[11px]">상태:</span>
                  <select
                    value={leadStatusFilter}
                    onChange={e => setLeadStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 outline-none focus:border-blue-500 shadow-2xs font-medium cursor-pointer"
                  >
                    <option value="ALL">전체 (All)</option>
                    <option value="SENT">발송 완료</option>
                    <option value="PENDING">대기중 (Pending)</option>
                  </select>
                </div>

                {/* Track Filter */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-semibold text-slate-500 text-[11px]">트랙:</span>
                  <select
                    value={leadTrackFilter}
                    onChange={e => setLeadTrackFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs rounded-xl bg-white border border-slate-200 text-slate-800 outline-none focus:border-blue-500 shadow-2xs font-medium cursor-pointer"
                  >
                    <option value="ALL">전체 트랙</option>
                    <option value="ANALYSIS">데이터 분석</option>
                    <option value="ENGINEERING">데이터 엔지니어링</option>
                    <option value="VISUALIZATION">데이터 시각화</option>
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                검색 결과: <strong className="text-slate-900">{
                  leads.filter(l => {
                    if (leadTrackFilter !== "ALL" && l.interestedTrack !== leadTrackFilter) return false;
                    if (leadStatusFilter === "SENT" && !l.notifySent) return false;
                    if (leadStatusFilter === "PENDING" && l.notifySent) return false;
                    if (leadSearchQuery.trim()) {
                      const q = leadSearchQuery.toLowerCase();
                      return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q);
                    }
                    return true;
                  }).length
                }</strong> / {leads.length}명
              </div>
            </div>

            {/* Table Container (Reference Image 2 Table) */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[760px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/40 text-slate-400 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">
                    <th className="text-center px-4 py-3.5 w-12">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.length > 0 && selectedLeadIds.length === leads.length}
                        onChange={() => {
                          if (selectedLeadIds.length === leads.length) {
                            setSelectedLeadIds([]);
                          } else {
                            setSelectedLeadIds(leads.map(l => l.id));
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="text-left px-4 py-3.5 w-24">신청자명</th>
                    <th className="text-left px-4 py-3.5 w-36">관심 트랙 (TYPE)</th>
                    <th className="text-left px-4 py-3.5">연락처 / 이메일</th>
                    <th className="text-left px-4 py-3.5 w-36">신청 일시 (DATE) ↑</th>
                    <th className="text-center px-4 py-3.5 w-28">발송 상태 (STATUS)</th>
                    <th className="text-center px-4 py-3.5 w-36 text-blue-600 font-bold">맞춤 알림 발송</th>
                    <th className="text-center px-4 py-3.5 w-20">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {leads
                    .filter(l => {
                      if (leadTrackFilter !== "ALL" && l.interestedTrack !== leadTrackFilter) return false;
                      if (leadStatusFilter === "SENT" && !l.notifySent) return false;
                      if (leadStatusFilter === "PENDING" && l.notifySent) return false;
                      if (leadSearchQuery.trim()) {
                        const q = leadSearchQuery.toLowerCase();
                        return l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || l.phone.includes(q);
                      }
                      return true;
                    })
                    .map((lead, idx) => {
                      const isCopied = copiedLeadId === lead.id;
                      const isSelected = selectedLeadForPreview.id === lead.id;
                      const isChecked = selectedLeadIds.includes(lead.id);

                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLeadForPreview(lead)}
                          className={`transition-colors cursor-pointer ${
                            isSelected ? "bg-blue-50/50" : isChecked ? "bg-slate-50/80" : "hover:bg-slate-50/60"
                          }`}
                        >
                          {/* Row Checkbox */}
                          <td className="text-center px-4 py-4 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedLeadIds(prev =>
                                  prev.includes(lead.id) ? prev.filter(x => x !== lead.id) : [...prev, lead.id]
                                );
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* Applicant Name */}
                          <td className="px-4 py-4 font-bold text-slate-900 text-sm whitespace-nowrap">
                            {lead.name}
                          </td>

                          {/* Track Type with Colored Dot (Reference Image 2) */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-bold text-xs">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{
                                  background:
                                    lead.interestedTrack === "ANALYSIS"
                                      ? "#10b981"
                                      : lead.interestedTrack === "ENGINEERING"
                                      ? "#3b82f6"
                                      : "#a855f7"
                                }}
                              />
                              <span className="text-slate-700">
                                {lead.interestedTrack === "ANALYSIS"
                                  ? "데이터 분석"
                                  : lead.interestedTrack === "ENGINEERING"
                                  ? "데이터 엔지니어링"
                                  : "데이터 시각화"}
                              </span>
                            </span>
                          </td>

                          {/* Contact Info */}
                          <td className="px-4 py-4 text-slate-600">
                            <div className="font-bold text-slate-800">{lead.phone || "-"}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{lead.email || "-"}</div>
                          </td>

                          {/* Registered Date */}
                          <td className="px-4 py-4 text-slate-500 text-xs font-mono whitespace-nowrap">
                            {lead.registeredAt}
                          </td>

                          {/* Status Badge (Reference Image 2 Soft Pill) */}
                          <td className="px-4 py-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, notifySent: !l.notifySent } : l));
                              }}
                              className="cursor-pointer inline-flex items-center justify-center transition-transform hover:scale-105"
                              title="클릭하여 발송 상태 토글"
                            >
                              {lead.notifySent ? (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-50 text-rose-600 border border-rose-200/70 shadow-2xs whitespace-nowrap">
                                  발송 완료
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200/70 shadow-2xs whitespace-nowrap">
                                  대기중 (Pending)
                                </span>
                              )}
                            </button>
                          </td>

                          {/* Quick Message Copy Action */}
                          <td className="px-4 py-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyPersonalizedMessage(lead);
                              }}
                              className={`w-full py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs whitespace-nowrap ${
                                isCopied
                                  ? "bg-emerald-600 text-white shadow-emerald-600/20"
                                  : "bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80"
                              }`}
                            >
                              {isCopied ? <Check size={12} /> : <Copy size={12} />}
                              <span>{isCopied ? "복사 완료!" : "메시지 복사"}</span>
                            </button>
                          </td>

                          {/* Row Action Icons (Reference Image 2) */}
                          <td className="px-4 py-4 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 text-slate-400">
                              <button
                                onClick={() => setSelectedLeadForPreview(lead)}
                                className="p-1.5 rounded-lg hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="미리보기"
                              >
                                <Eye size={13} />
                              </button>
                              <button
                                onClick={() => handleDeleteLead(lead.id, lead.name)}
                                className="p-1.5 rounded-lg hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                                title="삭제"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 사전 알림 신청자 직접 등록 ─── */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <UserPlus size={15} className="text-blue-600" />
                <span>새 사전 알림 신청자 등록</span>
              </h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">이름 *</label>
                <input
                  value={newLead.name}
                  onChange={e => setNewLead(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">관심 트랙</label>
                <select
                  value={newLead.interestedTrack}
                  onChange={e => setNewLead(prev => ({ ...prev, interestedTrack: e.target.value as TrackType }))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                >
                  <option value="ANALYSIS">데이터 분석 트랙</option>
                  <option value="ENGINEERING">데이터 엔지니어링 트랙</option>
                  <option value="VISUALIZATION">데이터 시각화 트랙</option>
                </select>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">연락처</label>
                <input
                  value={newLead.phone}
                  onChange={e => setNewLead(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">이메일</label>
                <input
                  value={newLead.email}
                  onChange={e => setNewLead(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setShowAddLeadModal(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer">
                취소
              </button>
              <button onClick={handleAddLead} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-xs">
                신청자 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 공고 등록 / 수정 ─── */}
      {editingPost && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">
                {isNewPost ? "새 모집 공고 등록" : "모집 공고 수정"}
              </h3>
              <button onClick={() => setEditingPost(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">모집 기수 (term)</label>
                <input
                  type="number"
                  value={editingPost.term}
                  onChange={e => setEditingPost(prev => prev ? ({ ...prev, term: Number(e.target.value) }) : null)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">접수 시작일</label>
                  <input
                    type="date"
                    value={editingPost.start_date.slice(0, 10)}
                    onChange={e => setEditingPost(prev => prev ? ({ ...prev, start_date: e.target.value + "T00:00:00" }) : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">접수 마감일</label>
                  <input
                    type="date"
                    value={editingPost.end_date.slice(0, 10)}
                    onChange={e => setEditingPost(prev => prev ? ({ ...prev, end_date: e.target.value + "T23:59:59" }) : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">홍보 책자 PDF URL (S3)</label>
                <input
                  value={editingPost.brochure_url || ""}
                  onChange={e => setEditingPost(prev => prev ? ({ ...prev, brochure_url: e.target.value }) : null)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                />
              </div>

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPost.is_active !== false}
                    onChange={e => setEditingPost(prev => prev ? ({ ...prev, is_active: e.target.checked }) : null)}
                    className="rounded accent-red-600 w-4 h-4"
                  />
                  <span className="font-bold text-slate-900">공고 활성화</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setEditingPost(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer">
                취소
              </button>
              <button onClick={handleSavePost} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer shadow-xs">
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 문항 추가 / 수정 ─── */}
      {editingQuestion && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isNewQuestion ? "새 지원서 문항 추가" : "문항 수정"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  질문 유형과 제약사항, 테이블 행/열 메타데이터를 설정합니다.
                </p>
              </div>
              <button onClick={() => setEditingQuestion(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">트랙 구분</label>
                  <select
                    value={editingQuestion.category}
                    onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, category: e.target.value as QuestionCategory }) : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                  >
                    <option value="COMMON">전체 공통 (COMMON)</option>
                    <option value="ANALYSIS">데이터 분석 (ANALYSIS)</option>
                    <option value="ENGINEERING">엔지니어링 (ENGINEERING)</option>
                    <option value="VISUALIZATION">시각화 (VISUALIZATION)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">문항 라벨 (표기명)</label>
                  <input
                    value={editingQuestion.label}
                    onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, label: e.target.value }) : null)}
                    placeholder="예: 공통1, 분석2"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">문항 내용 (질문 텍스트) *</label>
                <textarea
                  rows={2}
                  value={editingQuestion.content}
                  onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  placeholder="지원자가 읽고 답변할 질문을 입력하세요..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">문항 보조 설명 (선택)</label>
                <input
                  value={editingQuestion.description || ""}
                  onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  placeholder="지원자가 답변 작성 시 참고할 안내 가이드..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">문항 유형</label>
                  <select
                    value={editingQuestion.type}
                    onChange={e => {
                      const newType = e.target.value as QuestionType;
                      setEditingQuestion(prev => {
                        if (!prev) return null;
                        if (newType === "TABLE") {
                          return {
                            ...prev,
                            type: newType,
                            limit_length: null,
                            metadata: prev.metadata || {
                              columns: ["과목/라이브러리명", "숙련도", "활용 경험"],
                              rows: ["1. 기초 통계학 / 머신러닝", "2. 딥러닝 프레임워크", "3. 데이터 전처리 / SQL"],
                              multiple: true
                            }
                          };
                        } else {
                          return {
                            ...prev,
                            type: newType,
                            limit_length: prev.limit_length || 800,
                            metadata: null
                          };
                        }
                      });
                    }}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                  >
                    <option value="LONG_TEXT">장문 서술형 (LONG_TEXT)</option>
                    <option value="SHORT_TEXT">단문형 (SHORT_TEXT)</option>
                    <option value="TABLE">테이블 입력형 (TABLE)</option>
                  </select>
                </div>

                {editingQuestion.type !== "TABLE" ? (
                  <div>
                    <label className="text-slate-700 block mb-1 font-semibold">글자수 제한 (limitLength)</label>
                    <input
                      type="number"
                      value={editingQuestion.limit_length || ""}
                      onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, limit_length: e.target.value ? Number(e.target.value) : null }) : null)}
                      placeholder="예: 800"
                      className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold"
                    />
                  </div>
                ) : (
                  <div className="flex items-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-semibold">
                      <input
                        type="checkbox"
                        checked={editingQuestion.metadata?.multiple ?? true}
                        onChange={e => {
                          const isMultiple = e.target.checked;
                          setEditingQuestion(prev => prev ? ({
                            ...prev,
                            metadata: {
                              columns: prev.metadata?.columns || ["열 1"],
                              rows: prev.metadata?.rows || ["행 1"],
                              multiple: isMultiple
                            }
                          }) : null);
                        }}
                        className="rounded accent-red-600 w-4 h-4"
                      />
                      <span>다중 행 작성 허용 (multiple)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* ─── TABLE Metadata Configuration: 행(Rows) & 열(Columns) 편집기 ─── */}
              {editingQuestion.type === "TABLE" && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Table size={14} className="text-blue-600" />
                      <span>테이블 행(Rows) 및 열(Columns) 메타데이터 설정</span>
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">JSON metadata</span>
                  </div>

                  {/* 1. Columns Config */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-bold text-xs flex items-center gap-1">
                        <Columns size={12} className="text-slate-500" />
                        <span>열 헤더 목록 (Columns, {editingQuestion.metadata?.columns?.length || 0}개)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const curCols = editingQuestion.metadata?.columns || [];
                          const updated = [...curCols, `새 컬럼 ${curCols.length + 1}`];
                          setEditingQuestion(prev => prev ? ({
                            ...prev,
                            metadata: {
                              rows: prev.metadata?.rows || ["행 1"],
                              columns: updated,
                              multiple: prev.metadata?.multiple ?? true
                            }
                          }) : null);
                        }}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} /> + 열 추가
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {editingQuestion.metadata?.columns?.map((col, cIdx) => (
                        <div key={cIdx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400 w-12 text-right">열 {cIdx + 1}:</span>
                          <input
                            value={col}
                            onChange={e => {
                              const newCols = [...(editingQuestion.metadata?.columns || [])];
                              newCols[cIdx] = e.target.value;
                              setEditingQuestion(prev => prev ? ({
                                ...prev,
                                metadata: {
                                  rows: prev.metadata?.rows || ["행 1"],
                                  columns: newCols,
                                  multiple: prev.metadata?.multiple ?? true
                                }
                              }) : null);
                            }}
                            placeholder="열 이름 입력..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newCols = editingQuestion.metadata?.columns?.filter((_, i) => i !== cIdx) || [];
                              setEditingQuestion(prev => prev ? ({
                                ...prev,
                                metadata: {
                                  rows: prev.metadata?.rows || ["행 1"],
                                  columns: newCols,
                                  multiple: prev.metadata?.multiple ?? true
                                }
                              }) : null);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="열 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Rows Config */}
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-bold text-xs flex items-center gap-1">
                        <ListPlus size={12} className="text-slate-500" />
                        <span>행 항목 목록 (Rows, {editingQuestion.metadata?.rows?.length || 0}개)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const curRows = editingQuestion.metadata?.rows || [];
                          const updated = [...curRows, `${curRows.length + 1}. 새 항목`];
                          setEditingQuestion(prev => prev ? ({
                            ...prev,
                            metadata: {
                              columns: prev.metadata?.columns || ["열 1"],
                              rows: updated,
                              multiple: prev.metadata?.multiple ?? true
                            }
                          }) : null);
                        }}
                        className="px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={11} /> + 행 추가
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {editingQuestion.metadata?.rows?.map((rowItem, rIdx) => (
                        <div key={rIdx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400 w-12 text-right">행 {rIdx + 1}:</span>
                          <input
                            value={rowItem}
                            onChange={e => {
                              const newRows = [...(editingQuestion.metadata?.rows || [])];
                              newRows[rIdx] = e.target.value;
                              setEditingQuestion(prev => prev ? ({
                                ...prev,
                                metadata: {
                                  columns: prev.metadata?.columns || ["열 1"],
                                  rows: newRows,
                                  multiple: prev.metadata?.multiple ?? true
                                }
                              }) : null);
                            }}
                            placeholder="행 항목 라벨 입력..."
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-900 font-semibold"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newRows = editingQuestion.metadata?.rows?.filter((_, i) => i !== rIdx) || [];
                              setEditingQuestion(prev => prev ? ({
                                ...prev,
                                metadata: {
                                  columns: prev.metadata?.columns || ["열 1"],
                                  rows: newRows,
                                  multiple: prev.metadata?.multiple ?? true
                                }
                              }) : null);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="행 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 3. Live Matrix Preview */}
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <span className="text-[11px] font-bold text-slate-600">실시간 테이블 그리드 미리보기:</span>
                    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 font-semibold">
                            <th className="px-2.5 py-2 border-r border-slate-200 text-left bg-slate-200/50">행 항목</th>
                            {editingQuestion.metadata?.columns?.map((c, i) => (
                              <th key={i} className="px-2.5 py-2 border-r border-slate-200 last:border-r-0 text-left font-mono text-[11px]">{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {editingQuestion.metadata?.rows?.map((r, rI) => (
                            <tr key={rI}>
                              <td className="px-2.5 py-1.5 border-r border-slate-200 bg-slate-50 font-sans font-bold text-slate-800">{r}</td>
                              {editingQuestion.metadata?.columns?.map((_, cI) => (
                                <td key={cI} className="px-2.5 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-400 italic">
                                  [지원자 입력칸]
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-900">
                  <input
                    type="checkbox"
                    checked={editingQuestion.is_required}
                    onChange={e => setEditingQuestion(prev => prev ? ({ ...prev, is_required: e.target.checked }) : null)}
                    className="rounded accent-red-600 w-4 h-4"
                  />
                  <span>지원서 제출 시 필수 응답 (isRequired)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => setEditingQuestion(null)} className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer">
                취소
              </button>
              <button onClick={handleSaveQuestion} className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 cursor-pointer shadow-xs">
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
