import { useState, useRef, useEffect } from "react";
import {
  ChevronDown, ChevronRight, Check, Clock, XCircle,
  Camera, Send, BarChart3, Bell, LogOut, Menu, X,
  CheckCircle2, AlertCircle, FileImage, ClipboardList,
  ShieldCheck, BookOpen, Megaphone, FileText, Settings,
  Users, KeyRound, AlertTriangle, Plus, RotateCcw,
  Trash2, Lock, Unlock, Upload, Eye, EyeOff, ZoomIn, RefreshCw,
  Image as ImageIcon, HelpCircle, FileCheck, ExternalLink,
  Info, Shield, ArrowRight, CornerDownRight, CheckCheck,
  Layers, MessageSquare, Quote, Copy, CheckCheck as CheckIcon,
  LogIn, UserCheck, Award, Search, Edit3, BookmarkCheck, Save, UserPlus
} from "lucide-react";

import { ArchivingSection } from "./components/content/ArchivingSection";
import { FaqSection } from "./components/content/FaqSection";
import { CurriculumSection } from "./components/content/CurriculumSection";
import { ReviewsSection } from "./components/content/ReviewsSection";
import { RecruitmentManagePage } from "./components/recruiting/RecruitmentManagePage";
import { EvaluationManagePage } from "./components/recruiting/EvaluationManagePage";
import { SystemAccountsPage } from "./components/system/SystemAccountsPage";
import { EventAttendanceManagePage } from "./components/attendance/EventAttendanceManagePage";

// ─── Types ────────────────────────────────────────────────────────────────────

type AttendanceStatus = "present" | "late" | "absent";
type ActivePage =
  | "att-dashboard" | "att-events" | "att-hosts" | "att-scores" | "att-rules" | "att-input"
  | "content-archive" | "content-faq" | "content-curriculum" | "content-reviews" | "content"
  | "recruiting" | "recruiting-posts" | "recruiting-questions" | "recruiting-preview" | "recruiting-csv" | "recruiting-leads"
  | "evaluation" | "evaluation-evals" | "evaluation-applicants" | "evaluation-promote"
  | "system" | "system-accounts" | "system-permissions" | "system-audit";

type UserRole = "TEAM" | "HOST" | "CONTENT_ADMIN" | "SUPER";

interface Member { id: string; name: string; year: string }

interface SessionRecord {
  statuses: Record<string, AttendanceStatus>;
  memos?: Record<string, string>;
  photo: string | null;
  photoUrl?: string | null;
  photoName?: string | null;
  photoSize?: string | null;
  submitted: boolean;
  submittedAt: string | null;
  confirmedByAdmin?: boolean;
}

type AttendanceState = Record<string, SessionRecord>;

export interface HostAccount {
  id: string;
  username: string;
  initialPassword?: string;
  hostName?: string;
  team: string;
  createdAt: string;
  active: boolean;
  lastLogin?: string;
}

export type StudyPeriodType = "방학 스터디" | "학기 스터디";

export interface StudyTeamInfo {
  id: string;
  teamName: string;
  studyName: string;
  leaderName: string;
  category: string;
  schedule: string;
  studyType: StudyPeriodType;
  description?: string;
  createdAt: string;
}

interface ExceptionRequest {
  id: string; team: string; week: string; memberName: string;
  from: AttendanceStatus; to: AttendanceStatus; reason: string;
}

interface ScoreRule {
  version: number; status: "ACTIVE" | "INACTIVE" | "DRAFT";
  activatedAt: string | null; createdBy: string;
  present: number; late: number; absent: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKS = [
  { id: "w1", label: "1주차", date: "03.04" },
  { id: "w2", label: "2주차", date: "03.11" },
  { id: "w3", label: "3주차", date: "03.18" },
  { id: "w4", label: "4주차", date: "03.25" },
];

const INITIAL_STUDY_TEAMS: StudyTeamInfo[] = [
  { id: "st_a", teamName: "A팀", studyName: "머신러닝 & 딥러닝 실전 스터디", leaderName: "이민준", category: "데이터 분석", schedule: "매주 화요일 19:00", studyType: "방학 스터디", description: "논문 리딩 및 캐글 경진대회 베이스라인 구축", createdAt: "2025-02-28" },
  { id: "st_b", teamName: "B팀", studyName: "대용량 분산 데이터 파이프라인", leaderName: "강태양", category: "데이터 엔지니어링", schedule: "매주 목요일 19:30", studyType: "방학 스터디", description: "Kafka, Spark, Airflow 기반 실시간 ETL 구축", createdAt: "2025-02-28" },
  { id: "st_c", teamName: "C팀", studyName: "Tableau & D3.js 대시보드 시각화", leaderName: "문지훈", category: "데이터 시각화", schedule: "매주 수요일 20:00", studyType: "학기 스터디", description: "인터랙티브 웹 시각화 및 스토리텔링 대시보드", createdAt: "2025-02-28" },
  { id: "st_d", teamName: "D팀", studyName: "LLM Agent & RAG 시스템 구현", leaderName: "고준서", category: "생성형 AI", schedule: "매주 토요일 14:00", studyType: "학기 스터디", description: "LangChain, LlamaIndex 기반 프로덕션 RAG", createdAt: "2025-02-28" },
];

const ACTIVITIES = [
  { id: "study", name: "스터디", color: "#3b82f6", bg: "rgba(59,130,246,0.12)" },
];

const MEMBERS: Record<string, Member[]> = {
  "A팀": [{ id:"a1",name:"이민준",year:"21" },{ id:"a2",name:"박서연",year:"22" },{ id:"a3",name:"김도현",year:"21" },{ id:"a4",name:"최지우",year:"23" },{ id:"a5",name:"정하은",year:"22" },{ id:"a6",name:"오승현",year:"21" },{ id:"a7",name:"한예린",year:"23" },{ id:"a8",name:"윤재혁",year:"22" }],
  "B팀": [{ id:"b1",name:"강태양",year:"21" },{ id:"b2",name:"임수진",year:"22" },{ id:"b3",name:"류현우",year:"23" },{ id:"b4",name:"신아름",year:"21" },{ id:"b5",name:"백민혁",year:"22" },{ id:"b6",name:"장나연",year:"23" },{ id:"b7",name:"조영준",year:"21" },{ id:"b8",name:"허채원",year:"22" }],
  "C팀": [{ id:"c1",name:"문지훈",year:"21" },{ id:"c2",name:"노유진",year:"22" },{ id:"c3",name:"원승민",year:"23" },{ id:"c4",name:"송하늘",year:"22" },{ id:"c5",name:"양도연",year:"21" },{ id:"c6",name:"진서영",year:"23" },{ id:"c7",name:"표건우",year:"22" },{ id:"c8",name:"홍미래",year:"21" }],
  "D팀": [{ id:"d1",name:"고준서",year:"22" },{ id:"d2",name:"남소희",year:"23" },{ id:"d3",name:"도현진",year:"21" },{ id:"d4",name:"마지원",year:"22" },{ id:"d5",name:"배수현",year:"23" },{ id:"d6",name:"서태준",year:"21" },{ id:"d7",name:"안예은",year:"22" },{ id:"d8",name:"차민규",year:"23" }],
};

function sessionKey(w: string, a: string, t: string) { return `${w}|${a}|${t}`; }
function calcScore(s: AttendanceStatus) { return s === "present" ? 1 : s === "late" ? 0.5 : 0; }

// 샘플 인증 사진 이미지
const SAMPLE_PROOF_IMAGES = [
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80",
];

function buildInitialAttendance(): AttendanceState {
  const st: AttendanceState = {};
  const teams = ["A팀", "B팀", "C팀", "D팀"];
  for (const w of WEEKS) {
    for (const team of teams) {
      const members = MEMBERS[team] ?? [];
      const statuses: Record<string, AttendanceStatus> = {};
      const memos: Record<string, string> = {};
      members.forEach((m, i) => {
        const s: AttendanceStatus = i % 7 === 0 ? "late" : i % 11 === 0 ? "absent" : "present";
        statuses[m.id] = s;
        if (s === "late") memos[m.id] = "15분 늦게 도착 (교통 정체)";
        if (s === "absent") memos[m.id] = "개인 사정으로 결석";
      });
      const submitted = w.id === "w1" || w.id === "w2" || (w.id === "w3" && team !== "C팀");
      
      const imgIdx = (w.id.charCodeAt(1) + team.charCodeAt(0)) % SAMPLE_PROOF_IMAGES.length;
      
      st[sessionKey(w.id, "study", team)] = {
        statuses,
        memos,
        photo: submitted ? `스터디_${team}_${w.label}_인증.jpg` : null,
        photoUrl: submitted ? SAMPLE_PROOF_IMAGES[imgIdx] : null,
        photoName: submitted ? `스터디_${team}_${w.label}_인증사진.jpg` : null,
        photoSize: submitted ? "2.4 MB" : null,
        submitted,
        submittedAt: submitted ? (w.id === "w1" ? "2025-03-04 21:15" : w.id === "w2" ? "2025-03-11 20:47" : "2025-03-18 19:32") : null,
        confirmedByAdmin: w.id === "w1" || w.id === "w2",
      };
    }
  }
  return st;
}

const INITIAL_HOSTS: HostAccount[] = [
  { id:"h1", username:"host_a", initialPassword:"boaz2026!a", hostName:"이민준 (A팀장)", team:"A팀", createdAt:"2025-02-28", active:true, lastLogin:"2025-03-18 19:30" },
  { id:"h2", username:"host_b", initialPassword:"boaz2026!b", hostName:"강태양 (B팀장)", team:"B팀", createdAt:"2025-02-28", active:true, lastLogin:"2025-03-18 18:45" },
  { id:"h3", username:"host_c", initialPassword:"boaz2026!c", hostName:"문지훈 (C팀장)", team:"C팀", createdAt:"2025-02-28", active:true, lastLogin:"2025-03-11 20:40" },
  { id:"h4", username:"host_d", initialPassword:"boaz2026!d", hostName:"고준서 (D팀장)", team:"D팀", createdAt:"2025-02-28", active:true, lastLogin:"2025-03-18 20:12" },
];

const INITIAL_EXCEPTIONS: ExceptionRequest[] = [
  { id:"e1", team:"C팀", week:"3주차", memberName:"원승민", from:"absent", to:"present", reason:"교통 지연으로 인한 결석 취소 요청" },
  { id:"e2", team:"B팀", week:"3주차", memberName:"류현우", from:"late",   to:"present", reason:"지각 처리 오기재 수정 요청" },
];

const INITIAL_RULES: ScoreRule[] = [
  { version:3, status:"ACTIVE",   activatedAt:"2025-03-01", createdBy:"차기대표진", present:1, late:0.5, absent:0 },
  { version:2, status:"INACTIVE", activatedAt:"2025-01-15", createdBy:"차기대표진", present:1, late:0.5, absent:0 },
  { version:1, status:"INACTIVE", activatedAt:"2024-09-01", createdBy:"차기대표진", present:1, late:0,   absent:0 },
];

// ─── Shared UI ────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<AttendanceStatus, { label:string; color:string; bg:string; border:string }> = {
  present: { label:"출석", color:"#059669", bg:"#ecfdf5", border:"#a7f3d0" },
  late:    { label:"지각", color:"#d97706", bg:"#fffbeb", border:"#fde68a" },
  absent:  { label:"결석", color:"#e11d48", bg:"#fff1f2", border:"#fecdd3" },
};

const STATUS_BUTTON_STYLES: Record<AttendanceStatus, { active: string; inactive: string }> = {
  present: {
    active: "bg-emerald-600 text-white font-bold shadow-xs border border-emerald-600 ring-2 ring-emerald-500/20",
    inactive: "bg-white text-slate-600 hover:text-emerald-700 hover:bg-emerald-50/60 border border-slate-200 shadow-2xs",
  },
  late: {
    active: "bg-amber-500 text-white font-bold shadow-xs border border-amber-500 ring-2 ring-amber-500/20",
    inactive: "bg-white text-slate-600 hover:text-amber-700 hover:bg-amber-50/60 border border-slate-200 shadow-2xs",
  },
  absent: {
    active: "bg-rose-500 text-white font-bold shadow-xs border border-rose-500 ring-2 ring-rose-500/20",
    inactive: "bg-white text-slate-600 hover:text-rose-700 hover:bg-rose-50/60 border border-slate-200 shadow-2xs",
  },
};

function Tag({ label, color, bg }: { label:string; color?:string; bg?:string }) {
  return (
    <span
      className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md font-mono font-medium tracking-tight border"
      style={
        color && bg
          ? { background: bg, color, borderColor: `${color}30` }
          : { background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" }
      }
    >
      {label}
    </span>
  );
}

function SectionCard({ children, className="" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-2xs ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ title, sub, right }: { title:string; sub?:string; right?:React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-wrap gap-2">
      <div>
        <p className="text-sm font-bold text-slate-900 tracking-tight">{title}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Btn({ children, variant="default", size="sm", onClick, disabled, className="" }:{
  children:React.ReactNode; variant?:"default"|"ghost"|"danger"|"success"|"outline";
  size?:"sm"|"xs"|"md"; onClick?:()=>void; disabled?:boolean; className?:string;
}) {
  const base = "inline-flex items-center gap-1.5 font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer";
  const sz = size === "xs" ? "text-xs px-2.5 py-1" : size === "md" ? "text-sm px-4 py-2" : "text-xs px-3.5 py-1.5";
  const v = {
    default: "bg-slate-900 text-white hover:bg-slate-800 shadow-2xs active:scale-[0.98]",
    ghost:   "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    danger:  "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 shadow-2xs",
    success: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 shadow-2xs",
    outline: "bg-white text-slate-700 hover:bg-slate-50 border border-slate-200/80 shadow-2xs",
  }[variant];
  return <button className={`${base} ${sz} ${v} ${className}`} onClick={onClick} disabled={disabled}>{children}</button>;
}

// ─── Modal: 출결 상세 & 인증 사진 확인 (운영지원팀 전용 검토 모달) ────────────────

interface SessionDetailModalProps {
  weekId: string;
  actId: string;
  team: string;
  record: SessionRecord | null;
  onClose: () => void;
  onConfirmAdmin: (w: string, a: string, t: string) => void;
  onDirectEdit: (w: string, a: string, t: string, memberId: string, to: AttendanceStatus, reason: string) => void;
  membersMap?: Record<string, Member[]>;
}

function SessionDetailModal({ weekId, actId, team, record, onClose, onConfirmAdmin, onDirectEdit, membersMap }: SessionDetailModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<{ id: string; name: string; current: AttendanceStatus } | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>("present");
  const [editReason, setEditReason] = useState("");

  const weekObj = WEEKS.find(w => w.id === weekId);
  const actObj = ACTIVITIES.find(a => a.id === actId);
  const members = (membersMap && membersMap[team]) || MEMBERS[team] || [];

  if (!record) return null;

  function handleSaveEdit() {
    if (!editingMember) return;
    if (!editReason.trim()) {
      alert("운영지원팀 수정 시 수정 사유 입력은 필수입니다.");
      return;
    }
    onDirectEdit(weekId, actId, team, editingMember.id, editStatus, editReason);
    setEditingMember(null);
    setEditReason("");
  }

  return (
    <div className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col bg-white border border-slate-200 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom:"1px solid #e2e8f0", background:"#f8fafc" }}>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md text-xs font-bold"
              style={{ background: actObj?.bg, color: actObj?.color, border: `1px solid ${actObj?.color}30` }}>
              {actObj?.name}
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>{team}</span>
                <span className="text-muted-foreground font-normal text-xs">·</span>
                <span className="text-xs font-mono text-[#8ba5ff]">{weekObj?.label} ({weekObj?.date})</span>
                {record.submitted ? (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background:"rgba(52,211,153,0.15)", color:"#34d399" }}>
                    <CheckCircle2 size={11} /> 제출완료
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium"
                    style={{ background:"rgba(248,113,113,0.15)", color:"#f87171" }}>
                    <AlertCircle size={11} /> 미제출
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {record.submitted ? `제출일시: ${record.submittedAt} (HOST 스터디장 입력)` : "스터디장의 출결 입력 대기 중"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 cursor-pointer">
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section: Proof Image Review */}
          <div className="rounded-xl p-4.5"
            style={{ background:"#f8fafc", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera size={15} style={{ color:"#5b7fff" }} />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">출석 인증 사진 (증빙 자료)</h3>
                {record.photoUrl && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {record.photoName ?? record.photo} {record.photoSize ? `(${record.photoSize})` : ""}
                  </span>
                )}
              </div>
              {record.photoUrl && (
                <button onClick={() => setLightboxOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-[#8ba5ff] hover:underline cursor-pointer">
                  <ZoomIn size={12} /> 크게 보기
                </button>
              )}
            </div>

            {record.photoUrl ? (
              <div className="relative rounded-lg overflow-hidden group cursor-pointer border border-slate-200"
                onClick={() => setLightboxOpen(true)}
                style={{ maxHeight:"260px", background:"#f8fafc" }}>
                <img
                  src={record.photoUrl}
                  alt="출석 인증 사진"
                  className="w-full h-56 object-cover object-center group-hover:scale-[1.02] transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold">
                  <Eye size={16} /> 클릭하여 원본 사진 확인
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/40 backdrop-blur-xs text-[11px] text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 size={11} style={{ color:"#34d399" }} />
                  <span>운영지원팀 확인용 인증 사진 정상 등록됨</span>
                </div>
              </div>
            ) : (
              <div className="h-28 rounded-lg flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-200 bg-white/[0.01]">
                <ImageIcon size={24} className="text-muted-foreground/50 mb-1" />
                <p className="text-xs text-muted-foreground">등록된 출석 인증 이미지가 없습니다.</p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">스터디장이 출석 제출 시 사진을 첨부하지 않았거나 미제출 상태입니다.</p>
              </div>
            )}
          </div>

          {/* Section: Member Attendance & Reason Table */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={15} style={{ color:"#5b7fff" }} />
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">부원별 출결 상태 및 사유</h3>
              </div>
              <span className="text-[11px] text-muted-foreground">
                총 {members.length}명 (출석 {members.filter(m => (record.statuses[m.id] ?? "present") === "present").length} · 지각 {members.filter(m => record.statuses[m.id] === "late").length} · 결석 {members.filter(m => record.statuses[m.id] === "absent").length})
              </span>
            </div>

            <div className="rounded-xl overflow-hidden border border-slate-200">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background:"#f8fafc", borderBottom:"1px solid #e2e8f0" }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground w-12">#</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-28">부원</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground w-24">출결 상태</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">사유 (선택 입력 내역)</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground w-20">운영진 수정</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members.map((m, idx) => {
                    const st: AttendanceStatus = record.statuses[m.id] ?? "present";
                    const memo = record.memos?.[m.id];
                    const cfg = STATUS_CFG[st] ?? STATUS_CFG.present;

                    return (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="px-3 py-2.5">
                          <span className="font-semibold text-foreground">{m.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">{m.year}기</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <Tag label={cfg.label} color={cfg.color} bg={cfg.bg} />
                        </td>
                        <td className="px-3 py-2.5">
                          {memo ? (
                            <span className="text-foreground/90 bg-slate-100 px-2 py-1 rounded text-[11px] inline-block">
                              {memo}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40 italic text-[11px]">— 사유 없음 (정상 출석 또는 미기재) —</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <button
                            onClick={() => {
                              setEditingMember({ id: m.id, name: m.name, current: st });
                              setEditStatus(st);
                              setEditReason(memo ?? "");
                            }}
                            className="text-[10px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-100 text-muted-foreground hover:text-foreground transition-all cursor-pointer">
                            수정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Direct Edit Box by Admin (사유 필수) */}
          {editingMember && (
            <div className="rounded-xl p-4 border border-[#fb923c]/30 bg-[#fb923c]/5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#fb923c]">
                  <AlertTriangle size={13} />
                  <span>운영지원팀 출결 수동 수정 — {editingMember.name}</span>
                </div>
                <Tag label="사유 필수 입력" color="#fb923c" bg="rgba(251,146,60,0.15)" />
              </div>
              <p className="text-[11px] text-muted-foreground">
                제출 후 출결 수정은 감사가 기록되므로 반드시 구체적인 수정 사유를 입력해야 합니다.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 mr-1 font-medium">변경 상태:</span>
                  {(["present","late","absent"] as AttendanceStatus[]).map(s => {
                    const active = editStatus === s;
                    const styleCfg = STATUS_BUTTON_STYLES[s];
                    return (
                      <button key={s}
                        onClick={() => setEditStatus(s)}
                        className={`px-3 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                          active ? styleCfg.active : styleCfg.inactive
                        }`}
                      >
                        {STATUS_CFG[s].label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="수정 사유를 반드시 입력하세요 (예: 증빙 서류 확인 완료, 스터디장 오기재 인정)"
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg outline-none"
                  style={{ background:"#ffffff", border:"1px solid rgba(251,146,60,0.3)", color:"#fff" }}
                />
                <Btn variant="success" size="xs" onClick={handleSaveEdit}>저장 및 반영</Btn>
                <Btn variant="ghost" size="xs" onClick={() => setEditingMember(null)}>취소</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderTop:"1px solid #e2e8f0", background:"#ffffff" }}>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-[#34d399]" />
            <span>운영지원팀 검토 모드 · 인증 사진 및 출결 사유 대조 완료</span>
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="outline" onClick={onClose}>닫기</Btn>
            {record.submitted && !record.confirmedByAdmin && (
              <Btn variant="success" onClick={() => {
                onConfirmAdmin(weekId, actId, team);
                onClose();
              }}>
                <CheckCheck size={14} /> 출결 확인 완료 처리
              </Btn>
            )}
          </div>
        </div>
      </div>

      {/* Full Lightbox */}
      {lightboxOpen && record.photoUrl && (
        <div className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}>
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={record.photoUrl} alt="출석 인증 원본 사진" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300" />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>{team} · {weekObj?.label} 출석 인증 원본 사진 ({record.photoName ?? record.photo})</span>
              <button onClick={() => setLightboxOpen(false)} className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium cursor-pointer">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page: 출결 대시보드 ─────────────────────────────────────────────────────

function DashboardPage({
  attendance,
  exceptions,
  studyTeams,
  membersMap,
  onApprove,
  onReject,
  onDirectEdit,
  onConfirmAdmin,
  onOpenAddStudy,
}: {
  attendance: AttendanceState;
  exceptions: ExceptionRequest[];
  studyTeams: StudyTeamInfo[];
  membersMap?: Record<string, Member[]>;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDirectEdit: (w: string, a: string, t: string, memberId: string, to: AttendanceStatus, reason: string) => void;
  onConfirmAdmin: (w: string, a: string, t: string) => void;
  onOpenAddStudy?: () => void;
}) {
  const [selectedCell, setSelectedCell] = useState<{ weekId: string; actId: string; team: string } | null>(null);
  // 방학 스터디와 학기 스터디는 시리얼하게(순차적으로) 진행되므로 현재 활성 시즌인 학기 스터디를 기본값으로 설정
  const [currentSeason, setCurrentSeason] = useState<StudyPeriodType>("학기 스터디");

  const displayedStudyTeams = studyTeams.filter(t => t.studyType === currentSeason);
  const allTeams = displayedStudyTeams.map(t => ({ team: t.teamName, studyName: t.studyName, actId: "study", color: "#3b82f6" }));
  const totalCells = WEEKS.length * allTeams.length;
  const submittedCells = WEEKS.reduce((acc, w) =>
    acc + allTeams.filter(({ team, actId }) => attendance[sessionKey(w.id, actId, team)]?.submitted).length, 0);

  const activeModalRecord = selectedCell
    ? attendance[sessionKey(selectedCell.weekId, selectedCell.actId, selectedCell.team)] ?? null
    : null;

  const vacationCount = studyTeams.filter(t => t.studyType === "방학 스터디").length;
  const semesterCount = studyTeams.filter(t => t.studyType === "학기 스터디").length;

  return (
    <div className="space-y-5">
      {/* Serial Timeline Phase Progress Header */}
      <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
              <Layers size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">기수 활동 순차 주기 (Serial Timeline)</span>
                <span className="px-2 py-0.2 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  {currentSeason === "학기 스터디" ? "2단계 진행 중" : "1단계 완료 기록"}
                </span>
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight mt-0.5">
                {currentSeason === "학기 스터디" ? "정규 학기 스터디 출결 현황 (현재 진행)" : "방학 집중 스터디 출결 현황 (종료)"}
              </h2>
            </div>
          </div>

          {/* Serial Phase Stepper Toggle */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start lg:self-center flex-wrap">
            <button
              onClick={() => setCurrentSeason("방학 스터디")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                currentSeason === "방학 스터디"
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                currentSeason === "방학 스터디" ? "bg-amber-100 text-amber-900" : "bg-slate-200 text-slate-600"
              }`}>1</span>
              <span>방학 스터디 시즌</span>
              <span className="text-[10px] text-slate-400 font-medium">({vacationCount}개 팀)</span>
            </button>

            <span className="text-slate-300 font-bold text-xs px-0.5">→</span>

            <button
              onClick={() => setCurrentSeason("학기 스터디")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                currentSeason === "학기 스터디"
                  ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                currentSeason === "학기 스터디" ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-600"
              }`}>2</span>
              <span>학기 스터디 시즌</span>
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">진행 중</span>
              <span className="text-[10px] text-slate-400 font-medium">({semesterCount}개 팀)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats row for Selected Season */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: `${currentSeason} 전체 제출 현황`,
            value: `${submittedCells} / ${totalCells}`,
            sub: "스터디장 제출률 " + Math.round((submittedCells / (totalCells || 1)) * 100) + "%",
          },
          {
            label: `${currentSeason} 이번 주 미제출`,
            value: `${allTeams.filter(({ team, actId }) => !attendance[sessionKey("w3", actId, team)]?.submitted).length}팀`,
            sub: currentSeason === "학기 스터디" ? "3주차 진행 중" : "전체 주차 마감 완료",
          },
          {
            label: "예외 승인 대기",
            value: `${exceptions.length}건`,
            sub: "운영지원팀 확인 필요",
          },
        ].map(s => (
          <SectionCard key={s.label}>
            <div className="px-5 py-4">
              <p className="text-xs text-slate-500 mb-1 font-semibold">{s.label}</p>
              <p className="text-2xl font-bold font-mono text-slate-900">{s.value}</p>
              {s.sub && <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>}
            </div>
          </SectionCard>
        ))}
      </div>

      {/* Submission matrix */}
      <SectionCard>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white flex-wrap gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border shadow-2xs ${
                currentSeason === "학기 스터디"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {currentSeason}
              </span>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {currentSeason} 주차별 출결 현황 및 인증 사진 검토
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              제출 완료 (초록) · 미제출 (빨강) · 셀 클릭 시 상세 인증 사진 및 부원별 사유를 대조 검토합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAddStudy && (
              <button
                onClick={onOpenAddStudy}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={13} />
                <span>스터디 등록</span>
              </button>
            )}
            <Tag label="운영지원팀 검토 뷰" color="#059669" bg="rgba(16,185,129,0.12)" />
          </div>
        </div>

        <div className="overflow-x-auto p-5">
          {displayedStudyTeams.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              등록된 {currentSeason}가 없습니다.
            </div>
          ) : (
            <table className="text-xs border-separate border-spacing-2 min-w-[540px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left pr-4 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider w-20">진행 주차</th>
                  {displayedStudyTeams.map(st => (
                    <th key={st.teamName} className="text-center pb-2 font-bold text-slate-800 text-xs min-w-[120px]">
                      <div className="text-xs font-extrabold text-slate-900 truncate max-w-[140px]" title={st.studyName}>
                        {st.studyName}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400">
                        {st.leaderName} 팀장
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKS.map(w => (
                  <tr key={w.id}>
                    <td className="pr-4 py-1 font-bold text-slate-700 whitespace-nowrap text-xs">{w.label}</td>
                    {displayedStudyTeams.map(st => {
                      const team = st.teamName;
                      const rec = attendance[sessionKey(w.id, "study", team)];
                      const done = rec?.submitted ?? false;
                      const hasPhoto = !!rec?.photoUrl;
                      return (
                        <td key={team} className="py-1 px-1">
                          <div
                            onClick={() => setSelectedCell({ weekId: w.id, actId: "study", team })}
                            title={`${st.studyName} (${w.label}) - 클릭하여 인증 사진 및 출결 상세 보기`}
                            className="w-full h-11 px-3 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 group relative shadow-2xs"
                            style={{
                              background: done ? "#ecfdf5" : "#fef2f2",
                              border: `1px solid ${done ? "#a7f3d0" : "#fecaca"}`,
                            }}>
                            {done ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 size={13} className="text-emerald-600" />
                                {hasPhoto && <Camera size={11} className="text-blue-600" title="인증사진 첨부됨" />}
                              </div>
                            ) : (
                              <AlertCircle size={13} className="text-red-500" />
                            )}
                            <span className="text-[10px] font-bold mt-0.5 whitespace-nowrap" style={{ color: done ? "#047857" : "#b91c1c" }}>
                              {done ? (hasPhoto ? "사진 인증" : "제출완료") : "미제출"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      {/* Exception queue */}
      <SectionCard>
        <CardHeader title="예외 승인 대기" sub="제출 후 수정 요청은 운영지원팀이 사유 확인 후 승인합니다"
          right={<Tag label="ATTENDANCE_APPROVE" color="#fb923c" bg="rgba(251,146,60,0.12)" />} />
        {exceptions.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-muted-foreground">대기 중인 요청이 없습니다</div>
        ) : (
          <div className="divide-y" style={{ borderColor:"#f1f5f9" }}>
            {exceptions.map(ex => (
              <div key={ex.id} className="flex items-center justify-between px-5 py-3.5 gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <AlertTriangle size={14} style={{ color:"#fbbf24" }} className="shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{ex.team}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-muted-foreground">{ex.week}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span>{ex.memberName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{ex.reason}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs" style={{ color:STATUS_CFG[ex.from]?.color ?? "#fff" }}>{STATUS_CFG[ex.from]?.label ?? ex.from}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-xs" style={{ color:STATUS_CFG[ex.to]?.color ?? "#fff" }}>{STATUS_CFG[ex.to]?.label ?? ex.to}</span>
                  <Btn variant="success" size="xs" onClick={() => onApprove(ex.id)}><Check size={11} />승인</Btn>
                  <Btn variant="danger"  size="xs" onClick={() => onReject(ex.id)}><X size={11} />거절</Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Selected Cell Modal */}
      {selectedCell && (
        <SessionDetailModal
          weekId={selectedCell.weekId}
          actId={selectedCell.actId}
          team={selectedCell.team}
          record={activeModalRecord}
          onClose={() => setSelectedCell(null)}
          onConfirmAdmin={onConfirmAdmin}
          onDirectEdit={onDirectEdit}
          membersMap={membersMap}
        />
      )}
    </div>
  );
}

// ─── Page: HOST 계정·팀 연결 ──────────────────────────────────────────────────

function HostsPage({
  hosts,
  setHosts,
  studyTeams,
  onRegisterStudyTeam,
}: {
  hosts: HostAccount[];
  setHosts: React.Dispatch<React.SetStateAction<HostAccount[]>>;
  studyTeams: StudyTeamInfo[];
  onRegisterStudyTeam: (data: {
    teamName: string;
    studyName: string;
    leaderName: string;
    studyType?: StudyPeriodType;
    category?: string;
    schedule?: string;
    description?: string;
    customUsername: string;
    customPassword?: string;
    memberNames?: string[];
  }) => HostAccount;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTeam, setNewTeam] = useState("E팀");
  const [newStudyType, setNewStudyType] = useState<StudyPeriodType>("방학 스터디");
  const [newStudyName, setNewStudyName] = useState("");
  const [newHostName, setNewHostName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [customUsername, setCustomUsername] = useState("");
  const [customPassword, setCustomPassword] = useState("");
  const [visiblePwId, setVisiblePwId] = useState<string | null>(null);

const DEFAULT_DELIVERY_TEMPLATE = `[BOAZ 스터디 출결 관리 - HOST(스터디장) 계정 발급 안내]

안녕하세요, {이름} 스터디장님!
BOAZ 출결 관리 시스템 스터디장 계정이 발급되었습니다.

■ 접속 URL: http://localhost:5173
■ 담당 스터디: {스터디명}
■ 아이디: {아이디}
■ 초기 비밀번호: {비밀번호}

※ 첫 로그인 후 스터디 출결 및 인증 사진을 매주 세션 종료 후 입력해 주시기 바랍니다.
※ 문의: BOAZ 운영지원팀`;

  const [savedTemplate, setSavedTemplate] = useState<string>(() => {
    return localStorage.getItem("boaz_delivery_template") || DEFAULT_DELIVERY_TEMPLATE;
  });
  const [savedTemplateNotice, setSavedTemplateNotice] = useState(false);

  const [issuedHost, setIssuedHost] = useState<HostAccount | null>(null);
  const [issuedDeliveryText, setIssuedDeliveryText] = useState("");
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [resetModalHost, setResetModalHost] = useState<{ host: HostAccount; newPass: string } | null>(null);
  const [deliveryModal, setDeliveryModal] = useState<{
    host: HostAccount;
    studyName: string;
    text: string;
    originalText: string;
  } | null>(null);

  function generateRandomPassword() {
    return "Boaz77!!";
  }

  function generateDeliveryText(host: HostAccount, password?: string, customTpl?: string) {
    const pw = password || host.initialPassword || "Boaz77!!";
    const matchedStudy = studyTeams.find(s => s.teamName === host.team);
    const studyName = matchedStudy?.studyName || host.team;
    const rawName = matchedStudy?.leaderName || host.hostName || "";
    const cleanLeaderName = rawName
      .replace(/\s*\(.*?\)\s*/g, "")
      .replace(/팀장/g, "")
      .trim() || "보아즈";

    const tpl = customTpl || savedTemplate || DEFAULT_DELIVERY_TEMPLATE;
    return tpl
      .replace(/\{이름\}/g, cleanLeaderName)
      .replace(/\{스터디명\}/g, studyName)
      .replace(/\{아이디\}/g, host.username)
      .replace(/\{비밀번호\}/g, pw)
      .replace(/\{접속URL\}/g, "http://localhost:5173");
  }

  function handleSaveAsDefaultTemplate(currentText: string, host: HostAccount, password?: string) {
    const pw = password || host.initialPassword || "Boaz77!!";
    const matchedStudy = studyTeams.find(s => s.teamName === host.team);
    const studyName = matchedStudy?.studyName || host.team;
    const rawName = matchedStudy?.leaderName || host.hostName || "";
    const cleanLeaderName = rawName
      .replace(/\s*\(.*?\)\s*/g, "")
      .replace(/팀장/g, "")
      .trim() || "보아즈";

    let tpl = currentText;
    if (cleanLeaderName) tpl = tpl.split(cleanLeaderName).join("{이름}");
    if (studyName) tpl = tpl.split(studyName).join("{스터디명}");
    if (host.username) tpl = tpl.split(host.username).join("{아이디}");
    if (pw) tpl = tpl.split(pw).join("{비밀번호}");

    setSavedTemplate(tpl);
    localStorage.setItem("boaz_delivery_template", tpl);
    setSavedTemplateNotice(true);
    setTimeout(() => setSavedTemplateNotice(false), 2500);
  }

  function handleResetToSavedTemplate(host: HostAccount, password?: string) {
    return generateDeliveryText(host, password, savedTemplate);
  }

  function handleResetToFactoryTemplate(host: HostAccount, password?: string) {
    setSavedTemplate(DEFAULT_DELIVERY_TEMPLATE);
    localStorage.removeItem("boaz_delivery_template");
    return generateDeliveryText(host, password, DEFAULT_DELIVERY_TEMPLATE);
  }

  function handleOpenDeliveryModal(host: HostAccount, password?: string) {
    const text = generateDeliveryText(host, password);
    const matchedStudy = studyTeams.find(s => s.teamName === host.team);
    setDeliveryModal({
      host,
      studyName: matchedStudy?.studyName || host.team,
      text,
      originalText: text,
    });
  }

  function handleCopyDeliveryMessage(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 2500);
    });
  }

  function handleOpenAddModal() {
    // Generate next team letter automatically based on existing teams
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const nextIdx = studyTeams.length;
    const defaultTeam = `${alphabet[nextIdx] || "E"}팀`;

    setNewTeam(defaultTeam);
    setNewStudyType("방학 스터디");
    setNewStudyName("");
    setNewHostName("");
    setNewDescription("");
    setCustomUsername("");
    setCustomPassword("");
    setShowAddModal(true);
  }

  function handleTeamChange(team: string) {
    setNewTeam(team);
  }

  function handleCreateStudyAndHost() {
    const finalStudyName = newStudyName.trim() || "Terraform 스터디";
    const finalHostName = newHostName.trim() || "보아즈";
    const finalUsername = customUsername.trim() || "Boaz2013";
    const finalPassword = customPassword.trim() || "Boaz77!!";

    const createdHost = onRegisterStudyTeam({
      teamName: newTeam.trim(),
      studyName: finalStudyName,
      leaderName: finalHostName,
      studyType: newStudyType,
      category: "스터디",
      schedule: "정기 세션",
      description: newDescription.trim(),
      customUsername: finalUsername,
      customPassword: finalPassword,
    });

    setShowAddModal(false);
    setIssuedDeliveryText(generateDeliveryText(createdHost, finalPassword));
    setIssuedHost(createdHost);
  }

  function handleResetPassword(host: HostAccount) {
    const newPass = generateRandomPassword();
    setHosts(prev => prev.map(h => h.id === host.id ? { ...h, initialPassword: newPass } : h));
    setResetModalHost({ host, newPass });
  }

  function toggleHost(id: string) {
    setHosts(prev => prev.map(h => h.id === id ? { ...h, active: !h.active } : h));
  }

  return (
    <div className="space-y-5" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" }}>
      {/* Flow steps */}
      <SectionCard>
        <div className="flex items-center gap-0 px-5 py-4 overflow-x-auto">
          {[
            { num: "①", title: "스터디 등록", desc: "스터디명·구분·팀장 입력" },
            { num: "②", title: "HOST 계정 자동 발급", desc: "아이디 & 임시 비밀번호 생성" },
            { num: "③", title: "출결 탭 & 대시보드 연동", desc: "출결 매트릭스 및 점수 집계 탭 자동 생성" },
            { num: "④", title: "스터디장에게 정보 전달", desc: "카카오톡/슬랙으로 접속 정보 복사 전달" },
          ].map((step, i) => (
            <div key={step.title} className="flex items-center gap-0 shrink-0">
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs bg-slate-50 border border-slate-200/80">
                <span className="font-bold font-mono text-blue-600">{step.num}</span>
                <div>
                  <p className="font-bold text-slate-800">{step.title}</p>
                  <p className="text-[10px] text-slate-500">{step.desc}</p>
                </div>
              </div>
              {i < 3 && <ChevronRight size={14} className="mx-2 text-slate-300 shrink-0" />}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          title="등록된 스터디 팀 및 HOST(스터디장) 계정 관리"
          sub="운영지원팀이 스터디를 개설하면 전체 대시보드와 출결 입력 화면에 해당 스터디 탭이 즉시 생성됩니다."
          right={
            <div className="flex items-center gap-2">
              <Tag label={`총 ${studyTeams.length}개 스터디`} color="#059669" bg="rgba(16,185,129,0.12)" />
              <button
                onClick={handleOpenAddModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus size={13} />
                <span>스터디 등록 & 계정 발급</span>
              </button>
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[780px]">
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                <th className="text-left px-5 py-3 font-semibold text-slate-500">스터디명 / 구분</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">스터디장 (이름)</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">로그인 아이디 (ID)</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-500">초기 비밀번호 (PW)</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-500">계정 상태</th>
                <th className="text-right px-5 py-3 font-semibold text-slate-500">전달 및 관리 액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {studyTeams.map(st => {
                const h = hosts.find(host => host.team === st.teamName) || {
                  id: "h_" + st.teamName,
                  team: st.teamName,
                  username: `host_${st.teamName.toLowerCase()}`,
                  initialPassword: "boaz2026!a",
                  hostName: `${st.leaderName} (${st.teamName}장)`,
                  createdAt: st.createdAt || "2025-02-28",
                  active: true,
                };
                const isPwVisible = visiblePwId === h.id;
                const pw = h.initialPassword || "boaz2026!a";

                return (
                  <tr key={st.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${
                          st.studyType === "방학 스터디"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-blue-50 text-blue-800 border-blue-200"
                        }`}>
                          {st.studyType}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">{st.studyName}</p>
                          <p className="text-[11px] text-slate-400 font-mono">{st.teamName}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-800">{st.leaderName}</p>
                      <p className="text-[10px] text-slate-400">출결 입력 전담</p>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-900 font-bold">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-blue-700">
                        {h.username}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 font-mono">
                        <span className="text-slate-800 font-medium">
                          {isPwVisible ? pw : "••••••••"}
                        </span>
                        <button
                          onClick={() => setVisiblePwId(isPwVisible ? null : h.id)}
                          className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title={isPwVisible ? "비밀번호 숨김" : "비밀번호 확인"}
                        >
                          {isPwVisible ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center">
                      {h.active ? (
                        <Tag label="정상 활성" color="#059669" bg="rgba(16,185,129,0.12)" />
                      ) : (
                        <Tag label="회수·잠금" color="#64748b" bg="rgba(100,116,139,0.12)" />
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDeliveryModal(h)}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          title="계정 안내문 확인 및 복사"
                        >
                          <Copy size={11} /> 안내문 복사
                        </button>
                        <button
                          onClick={() => handleResetPassword(h)}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                          title="임시 비밀번호 재발급"
                        >
                          <KeyRound size={11} /> 재발급
                        </button>
                        {h.active ? (
                          <button
                            onClick={() => toggleHost(h.id)}
                            className="px-2 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="계정 회수 (잠금)"
                          >
                            <Lock size={11} /> 회수
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleHost(h.id)}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs flex items-center gap-1 cursor-pointer transition-colors"
                            title="계정 활성화"
                          >
                            <Unlock size={11} /> 활성화
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Modal 1: 새 스터디(팀) 등록 & HOST 발급 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                  <BookOpen size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">새 스터디 등록 & 계정 발급</h3>
                  <p className="text-[11px] text-slate-500">등록 즉시 대시보드와 출결 입력 탭이 생성됩니다.</p>
                </div>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">스터디 구분 *</label>
                <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setNewStudyType("방학 스터디")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      newStudyType === "방학 스터디"
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    방학 스터디
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStudyType("학기 스터디")}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      newStudyType === "학기 스터디"
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    학기 스터디
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">스터디 공식 명칭 (Study Name) *</label>
                <input
                  value={newStudyName}
                  onChange={e => setNewStudyName(e.target.value)}
                  placeholder="예: Terraform 스터디"
                  className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">담당 스터디장(팀장) 이름 *</label>
                <input
                  value={newHostName}
                  onChange={e => setNewHostName(e.target.value)}
                  placeholder="예: 보아즈"
                  className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">로그인 아이디 (ID) *</label>
                  <input
                    value={customUsername}
                    onChange={e => setCustomUsername(e.target.value)}
                    placeholder="예: Boaz2013"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-semibold">초기 비밀번호 (PW) *</label>
                    <button
                      type="button"
                      onClick={() => setCustomPassword(generateRandomPassword())}
                      className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw size={10} /> 생성
                    </button>
                  </div>
                  <input
                    value={customPassword}
                    onChange={e => setCustomPassword(e.target.value)}
                    placeholder="예: Boaz77!!"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-800 font-mono text-xs placeholder:text-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={handleCreateStudyAndHost}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-xs cursor-pointer"
              >
                스터디 개설 및 계정 발급
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: 발급 완료 안내 팝업 */}
      {issuedHost && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare size={16} className="text-blue-600" />
                  <span>스터디장 안내문 양식 (직접 수정 가능)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  아래 템플릿의 문구를 자유롭게 수정하세요. 실시간으로 복사 내용에 반영됩니다.
                </p>
              </div>
              <button onClick={() => setIssuedHost(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Action Button Bar verbatim to screenshot */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* [기본 양식으로 설정] Button */}
              <button
                type="button"
                onClick={() => handleSaveAsDefaultTemplate(issuedDeliveryText, issuedHost)}
                className="w-[132px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="현재 수정한 문구를 영구 기본 양식으로 저장합니다."
              >
                <Save size={12} />
                <span>{savedTemplateNotice ? "저장 완료!" : "기본 양식으로 설정"}</span>
              </button>

              {/* [기본 양식 복원] Button */}
              <button
                type="button"
                onClick={() => setIssuedDeliveryText(handleResetToSavedTemplate(issuedHost))}
                className="w-[105px] justify-center py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="저장된 기본 양식으로 되돌립니다."
              >
                <RotateCcw size={11} />
                <span>기본 양식 복원</span>
              </button>

              {/* [양식 복사] Button */}
              <button
                type="button"
                onClick={() => handleCopyDeliveryMessage(issuedDeliveryText)}
                className="w-[90px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                {copiedNotice ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedNotice ? "복사 완료!" : "양식 복사"}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={issuedDeliveryText}
              onChange={e => setIssuedDeliveryText(e.target.value)}
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed outline-none focus:bg-white focus:border-blue-500/50 resize-none"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 size={13} /> 계정 발급 완료
              </span>
              <button
                onClick={() => { setIssuedHost(null); setIssuedDeliveryText(""); }}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: 비밀번호 재발급 팝업 */}
      {resetModalHost && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-amber-300 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-amber-600">
                <KeyRound size={18} />
                <h3 className="text-sm font-bold text-slate-900">새 임시 비밀번호 생성 완료</h3>
              </div>
              <button onClick={() => setResetModalHost(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              <strong>{resetModalHost.host.team} ({resetModalHost.host.username})</strong>의 새 임시 비밀번호가 생성되었습니다.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs flex items-center justify-between">
              <span className="text-amber-700 font-bold text-sm">{resetModalHost.newPass}</span>
              <button
                onClick={() => handleOpenDeliveryModal(resetModalHost.host, resetModalHost.newPass)}
                className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Copy size={12} /> 안내문 복사
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setResetModalHost(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: 스터디장 계정 안내문 모달 */}
      {deliveryModal && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MessageSquare size={16} className="text-blue-600" />
                  <span>스터디장 안내문 양식 (직접 수정 가능)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  아래 템플릿의 문구를 자유롭게 수정하세요. 실시간으로 복사 내용에 반영됩니다.
                </p>
              </div>
              <button onClick={() => setDeliveryModal(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Action Button Bar verbatim to screenshot */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* [기본 양식으로 설정] Button */}
              <button
                type="button"
                onClick={() => handleSaveAsDefaultTemplate(deliveryModal.text, deliveryModal.host)}
                className="w-[132px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors shrink-0"
                title="현재 수정한 문구를 영구 기본 양식으로 저장합니다."
              >
                <Save size={12} />
                <span>{savedTemplateNotice ? "저장 완료!" : "기본 양식으로 설정"}</span>
              </button>

              {/* [기본 양식 복원] Button */}
              <button
                type="button"
                onClick={() => {
                  const text = handleResetToSavedTemplate(deliveryModal.host);
                  setDeliveryModal({ ...deliveryModal, text });
                }}
                className="w-[105px] justify-center py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                title="저장된 기본 양식으로 되돌립니다."
              >
                <RotateCcw size={11} />
                <span>기본 양식 복원</span>
              </button>

              {/* [양식 복사] Button */}
              <button
                type="button"
                onClick={() => handleCopyDeliveryMessage(deliveryModal.text)}
                className="w-[90px] justify-center py-1.5 rounded-lg text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors shrink-0"
              >
                {copiedNotice ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedNotice ? "복사 완료!" : "양식 복사"}</span>
              </button>
            </div>

            <textarea
              rows={12}
              value={deliveryModal.text}
              onChange={e => setDeliveryModal({ ...deliveryModal, text: e.target.value })}
              className="w-full p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-800 leading-relaxed outline-none focus:bg-white focus:border-blue-500/50 resize-none"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                {deliveryModal.studyName} 전달용
              </span>
              <button
                onClick={() => setDeliveryModal(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page: 활동 점수 집계 ─────────────────────────────────────────────────────

function ScoresPage({
  attendance,
  studyTeams,
  membersMap,
}: {
  attendance: AttendanceState;
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
}) {
  const [periodFilter, setPeriodFilter] = useState<StudyPeriodType>("학기 스터디");
  const filteredTeams = studyTeams.filter(t => t.studyType === periodFilter);
  const [selectedTeam, setSelectedTeam] = useState(
    studyTeams.find(t => t.studyType === "학기 스터디")?.teamName || studyTeams[0]?.teamName || "A팀"
  );
  const actId = "study";
  const members = membersMap[selectedTeam] ?? [];
  const currentStudy = studyTeams.find(s => s.teamName === selectedTeam);

  const rows = members.map(m => {
    let total = 0;
    const weekly = WEEKS.map(w => {
      const rec = attendance[sessionKey(w.id, actId, selectedTeam)];
      if (!rec?.submitted) return null;
      const pts = calcScore(rec.statuses[m.id] ?? "present");
      total += pts;
      return pts;
    });
    return { ...m, weekly, total };
  }).sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Serial Season Toggle */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
            {(["방학 스터디", "학기 스터디"] as const).map(p => (
              <button
                key={p}
                onClick={() => {
                  setPeriodFilter(p);
                  const matched = studyTeams.find(s => s.studyType === p);
                  if (matched) setSelectedTeam(matched.teamName);
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  periodFilter === p
                    ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Study List Toggle Dropdown */}
          <div className="relative flex items-center">
            <div className="relative">
              <select
                value={selectedTeam}
                onChange={e => setSelectedTeam(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[220px]"
              >
                {filteredTeams.map(t => (
                  <option key={t.teamName} value={t.teamName}>{t.studyName}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="flex gap-1.5 text-xs">
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">출석 +1점</span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">지각 +0.5점</span>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200/80 font-medium">결석 0점</span>
        </div>
      </div>

      <SectionCard>
        <CardHeader
          title={`${currentStudy?.studyName || "스터디"} · 활동 점수 집계`}
          sub={`구분: ${currentStudy?.studyType || "스터디"} · 담당 팀장: ${currentStudy?.leaderName || ""} · 출결 기반 자동 계산`}
          right={<Tag label={currentStudy?.studyType || "점수 집계"} color={currentStudy?.studyType === "방학 스터디" ? "#d97706" : "#2563eb"} bg={currentStudy?.studyType === "방학 스터디" ? "#fef3c7" : "#eff6ff"} />}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr style={{ borderBottom:"1px solid #e2e8f0" }}>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground w-8"></th>
                <th className="text-left px-2 py-2.5 text-xs font-semibold text-muted-foreground">이름</th>
                {WEEKS.map(w => <th key={w.id} className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground">{w.label}</th>)}
                <th className="text-center px-4 py-2.5 text-xs font-semibold" style={{ color:"#8ba5ff" }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id} className="hover:bg-white/[0.015] transition-colors"
                  style={{ borderBottom: i < rows.length-1 ? "1px solid #f1f5f9" : "none" }}>
                  <td className="px-5 py-3 text-xs text-muted-foreground">{i+1}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                        style={{ background:"rgba(91,127,255,0.2)", color:"#8ba5ff" }}>{row.name[0]}</div>
                      <span className="text-sm font-medium text-foreground">{row.name}</span>
                      <span className="text-[10px] text-muted-foreground">{row.year}학번</span>
                    </div>
                  </td>
                  {row.weekly.map((pts, j) => (
                    <td key={j} className="px-4 py-3 text-center font-mono text-sm">
                      {pts === null
                        ? <span className="text-muted-foreground opacity-30">—</span>
                        : <span style={{ color: pts===1?"#34d399":pts===0.5?"#fbbf24":"#f87171" }}>{pts}</span>}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-mono font-bold"
                    style={{ color: row.total>=3?"#34d399":row.total>=1.5?"#fbbf24":"#f87171" }}>
                    {row.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Page: 점수 규칙 ──────────────────────────────────────────────────────────

function RulesPage() {
  const [rules, setRules] = useState<ScoreRule[]>(INITIAL_RULES);
  const [showDraft, setShowDraft] = useState(false);

  const activeRule = rules.find(r => r.status === "ACTIVE");

  return (
    <div className="space-y-4">
      {activeRule && (
        <SectionCard>
          <CardHeader title={`현재 활성 규칙 — v${activeRule.version}`}
            sub={`활성화: ${activeRule.activatedAt} · 작성: ${activeRule.createdBy}`}
            right={<Tag label="RULE_ACTIVATE" color="#34d399" bg="rgba(52,211,153,0.12)" />} />
          <div className="flex items-center gap-4 px-5 py-4">
            {[
              { label:"출석", pts:activeRule.present, color:"#34d399", bg:"rgba(52,211,153,0.12)" },
              { label:"지각", pts:activeRule.late,    color:"#fbbf24", bg:"rgba(251,191,36,0.12)" },
              { label:"결석", pts:activeRule.absent,  color:"#f87171", bg:"rgba(248,113,113,0.12)" },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{ background:r.bg, border:`1px solid ${r.color}25` }}>
                <span className="text-sm font-medium" style={{ color:r.color }}>{r.label}</span>
                <span className="text-2xl font-bold font-mono" style={{ color:r.color }}>+{r.pts}</span>
                <span className="text-xs text-muted-foreground">점</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard>
        <CardHeader title="규칙 이력"
          right={
            <div className="flex items-center gap-2">
              <Tag label="RULE_EDIT (차기대표진)" color="#5b7fff" bg="rgba(91,127,255,0.12)" />
              <Btn onClick={() => setShowDraft(v=>!v)}><Plus size={12} />DRAFT 작성</Btn>
            </div>
          } />

        {showDraft && (
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom:"1px solid rgba(0,0,0,0.06)", background:"rgba(91,127,255,0.05)" }}>
            <span className="text-xs text-muted-foreground">새 DRAFT</span>
            {["출석","지각","결석"].map(l => (
              <div key={l} className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{l}</span>
                <input type="number" step="0.5" defaultValue={l==="출석"?1:l==="지각"?0.5:0}
                  className="w-16 px-2 py-1 text-xs text-center rounded-lg font-mono outline-none"
                  style={{ background:"#f1f5f9", border:"1px solid rgba(0,0,0,0.08)", color:"#0f172a" }} />
                <span className="text-xs text-muted-foreground">점</span>
              </div>
            ))}
            <Btn onClick={() => {
              setRules(prev => [{ version:prev.length+1, status:"DRAFT", activatedAt:null, createdBy:"차기대표진", present:1, late:0.5, absent:0 }, ...prev]);
              setShowDraft(false);
            }}>저장</Btn>
            <Btn variant="ghost" onClick={() => setShowDraft(false)}>취소</Btn>
          </div>
        )}

        <div className="divide-y" style={{ borderColor:"#f1f5f9" }}>
          {rules.map(rule => (
            <div key={rule.version} className="flex items-center justify-between px-5 py-3.5">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono font-semibold text-foreground">v{rule.version}</span>
                <Tag
                  label={rule.status}
                  color={rule.status==="ACTIVE"?"#34d399":rule.status==="DRAFT"?"#fbbf24":"#6b7494"}
                  bg={rule.status==="ACTIVE"?"rgba(52,211,153,0.12)":rule.status==="DRAFT"?"rgba(251,191,36,0.12)":"rgba(107,116,148,0.12)"} />
                <span className="text-xs text-muted-foreground">
                  {rule.activatedAt ? `활성화: ${rule.activatedAt}` : "미활성화"}
                </span>
                <span className="text-xs text-muted-foreground">
                  출석 {rule.present}점 · 지각 {rule.late}점 · 결석 {rule.absent}점
                </span>
              </div>
              {rule.status === "DRAFT" && (
                <div className="flex gap-2">
                  <Tag label="대표진 활성화 권한" color="#fb923c" bg="rgba(251,146,60,0.12)" />
                  <Btn variant="success" size="xs" onClick={() => {
                    setRules(prev => prev.map(r =>
                      r.version===rule.version ? { ...r, status:"ACTIVE" as const, activatedAt:"2025-03-18" }
                      : r.status==="ACTIVE" ? { ...r, status:"INACTIVE" as const }
                      : r
                    ));
                  }}><Check size={11} />활성화 (대표진)</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Page: 출결 입력 (HOST 스터디장 전용 페이지) ───────────────────────────────

const EXT_STATUS_BTNS: { id: AttendanceStatus; label: string }[] = [
  { id: "present", label: "출석" },
  { id: "late",    label: "지각" },
  { id: "absent",  label: "결석" },
];

function InputPage({
  attendance,
  setAttendance,
  onRequestException,
  currentHostTeam,
  studyTeams,
  membersMap,
  currentRole,
  onOpenAddStudy,
  setMembersMap,
}: {
  attendance: AttendanceState;
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceState>>;
  onRequestException: (team: string, week: string, memberName: string, from: AttendanceStatus, to: AttendanceStatus, reason: string) => void;
  currentHostTeam: string;
  studyTeams: StudyTeamInfo[];
  membersMap: Record<string, Member[]>;
  setMembersMap?: React.Dispatch<React.SetStateAction<Record<string, Member[]>>>;
  currentRole: UserRole;
  onOpenAddStudy?: () => void;
}) {
  const [selectedTeam, setSelectedTeam] = useState(
    currentRole === "HOST" ? (currentHostTeam || "A팀") : (studyTeams[0]?.teamName || "A팀")
  );
  const TOTAL_WEEKS = 8;

  useEffect(() => {
    if (currentRole === "HOST" && currentHostTeam) {
      setSelectedTeam(currentHostTeam);
    }
  }, [currentRole, currentHostTeam]);

  const [weekNum, setWeekNum] = useState(3);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [extStatuses, setExtStatuses] = useState<Record<string, Record<string, AttendanceStatus>>>({});
  
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
  const [imageWarning, setImageWarning] = useState(false);

  // Member management states for study leader (HOST)
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberYear, setNewMemberYear] = useState("23");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const weekId = `w${weekNum <= 4 ? weekNum : weekNum}`;
  const hasData = weekNum <= 4;
  const key = hasData ? sessionKey(`w${weekNum}`, "study", selectedTeam) : "";
  const rec: SessionRecord = (hasData && key && attendance?.[key])
    ? attendance[key]
    : { statuses:{}, memos:{}, photo:null, photoUrl:null, submitted:false, submittedAt:null };
  
  const members = (membersMap && membersMap[selectedTeam]) || MEMBERS[selectedTeam] || [];

  function handleAddMember() {
    if (!newMemberName.trim()) {
      alert("추가할 스터디원 이름을 입력해주세요.");
      return;
    }

    const rawNames = newMemberName.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (rawNames.length === 0) return;

    const newMembers: Member[] = rawNames.map((name, idx) => ({
      id: `m_${Date.now()}_${idx}`,
      name,
      year: newMemberYear.trim() || "23",
    }));

    if (setMembersMap) {
      setMembersMap(prev => {
        const existing = prev[selectedTeam] || [];
        return {
          ...prev,
          [selectedTeam]: [...existing, ...newMembers],
        };
      });
    }

    setNewMemberName("");
    setShowAddMember(false);
  }

  function handleDeleteMember(memberId: string) {
    if (rec?.submitted) return;
    if (window.confirm("해당 부원을 스터디 명단에서 삭제하시겠습니까?")) {
      if (setMembersMap) {
        setMembersMap(prev => {
          const existing = prev[selectedTeam] || [];
          return {
            ...prev,
            [selectedTeam]: existing.filter(m => m.id !== memberId),
          };
        });
      }
    }
  }
  const currentStudy = (studyTeams && studyTeams.find(s => s.teamName === selectedTeam)) || INITIAL_STUDY_TEAMS.find(s => s.teamName === selectedTeam);

  const currentPhotoUrl = uploadedImage?.url || rec?.photoUrl || null;
  const currentPhotoName = uploadedImage?.name || rec?.photoName || rec?.photo || null;
  const currentPhotoSize = uploadedImage?.size || rec?.photoSize || null;

  function getStatus(memberId: string): AttendanceStatus {
    return extStatuses[weekId]?.[memberId]
      ?? rec?.statuses?.[memberId]
      ?? "present";
  }

  function setStatus(memberId: string, val: AttendanceStatus) {
    if (rec?.submitted) return;
    if (hasData && key) {
      setAttendance(prev => {
        const curRec = prev?.[key] ?? { statuses:{}, memos:{}, photo:null, submitted:false, submittedAt:null };
        return {
          ...prev,
          [key]: {
            ...curRec,
            statuses: { ...(curRec.statuses ?? {}), [memberId]: val },
          },
        };
      });
    }
    setExtStatuses(prev => ({
      ...prev,
      [weekId]: { ...(prev[weekId] ?? {}), [memberId]: val },
    }));
  }

  function getMemo(memberId: string): string {
    const memoKey = `${weekId}-${memberId}`;
    return memos[memoKey] ?? rec?.memos?.[memberId] ?? "";
  }

  function setMemo(memberId: string, val: string) {
    if (rec?.submitted) return;
    const memoKey = `${weekId}-${memberId}`;
    setMemos(prev => ({ ...prev, [memoKey]: val }));
    if (hasData && key) {
      setAttendance(prev => {
        const curRec = prev?.[key] ?? { statuses:{}, memos:{}, photo:null, submitted:false, submittedAt:null };
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
    const file = e.target.files?.[0];
    if (!file) return;

    setImageWarning(false);
    const url = URL.createObjectURL(file);
    const sizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    setUploadedImage({
      file,
      url,
      name: file.name,
      size: sizeStr,
    });
  }

  function handleAttachSample() {
    setImageWarning(false);
    setUploadedImage({
      file: null,
      url: SAMPLE_PROOF_IMAGES[0],
      name: `스터디_${selectedTeam}_${weekNum}주차_단체인증.jpg`,
      size: "2.8 MB",
    });
  }

  function handleRemoveImage() {
    setUploadedImage({ file: null, url: null, name: null, size: null });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function submit() {
    if (!hasData || !key) return;
    
    if (!currentPhotoUrl) {
      setImageWarning(true);
      const confirmNoPhoto = window.confirm("출석 인증 사진이 첨부되지 않았습니다.\n운영지원팀의 확인을 위해 사진 업로드가 필요합니다.\n사진 없이 그대로 제출하시겠습니까?");
      if (!confirmNoPhoto) return;
    }

    const currentStatuses: Record<string, AttendanceStatus> = {};
    const currentMemos: Record<string, string> = {};
    members.forEach(m => {
      currentStatuses[m.id] = getStatus(m.id);
      const memo = getMemo(m.id);
      if (memo) currentMemos[m.id] = memo;
    });

    setAttendance(prev => ({
      ...prev,
      [key]: {
        statuses: currentStatuses,
        memos: currentMemos,
        submitted: true,
        photo: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoUrl: currentPhotoUrl,
        photoName: currentPhotoName || `스터디_${selectedTeam}_${weekNum}주차.jpg`,
        photoSize: currentPhotoSize || "2.1 MB",
        submittedAt: new Date().toLocaleString("ko-KR", { hour12:false }).slice(0,16),
        confirmedByAdmin: false,
      },
    }));

    setImageWarning(false);
  }

  function handleSendRequest() {
    if (!reqMember || !reqReason.trim()) {
      alert("부원과 수정 사유를 입력해 주세요.");
      return;
    }
    const mem = members.find(m => m.id === reqMember);
    if (!mem) return;
    const fromStatus = getStatus(reqMember);
    onRequestException(selectedTeam, `${weekNum}주차`, mem.name, fromStatus, reqToStatus, reqReason);
    setShowRequestModal(false);
    setReqReason("");
    alert("운영지원팀에 출결 수정 요청이 전송되었습니다.");
  }

  const [periodFilter, setPeriodFilter] = useState<StudyPeriodType>("학기 스터디");
  const filteredStudyTeams = studyTeams.filter(s => s.studyType === periodFilter);

  const counts = (members || []).reduce(
    (acc, m) => {
      const s = getStatus(m.id);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<AttendanceStatus, number>,
  );
  const presentN  = counts["present"] ?? 0;
  const lateN     = counts["late"]    ?? 0;
  const absentN   = counts["absent"]  ?? 0;

  const sessionScore = presentN * 1 + lateN * 0.5;

  return (
    <div className="space-y-6">
      {/* Top Study & Team Information Banner */}
      <div className="p-4.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0 font-bold">
            <BookOpen size={18} />
          </div>
          <div>
            <div className="mb-1">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                currentStudy?.studyType === "방학 스터디"
                  ? "bg-amber-50 text-amber-800 border-amber-200"
                  : "bg-blue-50 text-blue-800 border-blue-200"
              }`}>
                {currentStudy?.studyType || "학기 스터디"}
              </span>
            </div>
            <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">
              {currentStudy?.studyName || "스터디 출결 관리"}
            </h1>
          </div>
        </div>

        {/* Role-based Controls */}
        <div className="flex items-center gap-2 self-start md:self-center shrink-0 flex-wrap">
          {currentRole === "HOST" ? (
            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200/80 flex items-center gap-1.5 shadow-2xs">
              <ShieldCheck size={14} className="text-emerald-600" />
              <span>내 담당 스터디 출결 뷰</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Serial Season Toggle */}
              <div className="flex gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                {(["방학 스터디", "학기 스터디"] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setPeriodFilter(p);
                      const matched = studyTeams.find(s => s.studyType === p);
                      if (matched) setSelectedTeam(matched.teamName);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      periodFilter === p
                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Study List Toggle Dropdown */}
              <div className="relative flex items-center">
                <div className="relative">
                  <select
                    value={selectedTeam}
                    onChange={e => setSelectedTeam(e.target.value)}
                    className="appearance-none pl-3.5 pr-8 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[220px]"
                  >
                    {filteredStudyTeams.map(t => (
                      <option key={t.teamName} value={t.teamName}>{t.studyName}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>

              {onOpenAddStudy && (
                <button
                  onClick={onOpenAddStudy}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                  title="새 스터디 개설"
                >
                  <Plus size={12} />
                  <span>개설</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Week Selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 mr-1 shrink-0 font-medium">진행 주차:</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
            const isActive = w === weekNum;
            const isPast = w <= 4 && attendance[sessionKey(`w${w}`, "study", selectedTeam)]?.submitted;
            return (
              <button
                key={w}
                onClick={() => setWeekNum(w)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all relative cursor-pointer flex items-center justify-center ${
                  isActive
                    ? "bg-slate-900 text-white shadow-xs"
                    : isPast
                    ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100"
                    : "bg-slate-100 text-slate-500 border border-slate-200/80 hover:bg-slate-200"
                }`}
              >
                {w}주
                {isPast && !isActive && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-500" title="제출 완료" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        <div className="flex-1 w-full min-w-0 space-y-5">
          <SectionCard>
            <div className="p-4.5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Camera size={16} style={{ color:"#ef4444" }} />
                  <h3 className="text-xs font-bold text-foreground">출석 인증 사진 업로드</h3>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
                    style={{ background:"rgba(239,68,68,0.12)", color:"#ef4444" }}>
                    필수
                  </span>
                </div>
                {currentPhotoUrl && !rec.submitted && (
                  <button onClick={handleAttachSample}
                    className="text-[11px] text-[#8ba5ff] hover:underline flex items-center gap-1 cursor-pointer">
                    <RefreshCw size={11} /> 샘플 사진으로 변경
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={rec.submitted}
                className="hidden"
              />

              {currentPhotoUrl ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 p-3 flex gap-4 items-center">
                  <div className="relative w-36 h-24 rounded-lg overflow-hidden group shrink-0 border border-slate-200 cursor-pointer"
                    onClick={() => setLightboxOpen(true)}>
                    <img
                      src={currentPhotoUrl}
                      alt="인증 사진 미리보기"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <ZoomIn size={16} />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <FileCheck size={14} className="text-[#34d399]" />
                      <p className="text-xs font-bold text-foreground truncate">
                        {currentPhotoName ?? `스터디_${selectedTeam}_${weekNum}주차_인증.jpg`}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      용량: <span className="font-mono text-foreground/80">{currentPhotoSize ?? "2.4 MB"}</span> · 형식: 이미지
                    </p>
                    <p className="text-[10px] text-[#34d399] mt-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> 운영지원팀에서 출석 현황 대조 시 확인할 수 있습니다.
                    </p>

                    {!rec.submitted && (
                      <div className="flex items-center gap-2 mt-2">
                        <Btn variant="outline" size="xs" onClick={() => fileInputRef.current?.click()}>
                          <Upload size={11} /> 다른 사진으로 변경
                        </Btn>
                        <Btn variant="danger" size="xs" onClick={handleRemoveImage}>
                          <Trash2 size={11} /> 삭제
                        </Btn>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => !rec.submitted && fileInputRef.current?.click()}
                  className={`rounded-xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                    imageWarning ? "border-amber-500/50 bg-amber-500/5" : "border-slate-200 bg-white/[0.01] hover:bg-slate-50 hover:border-slate-300"
                  } ${rec.submitted ? "opacity-50 cursor-not-allowed" : ""}`}>
                  <div className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background:"rgba(239,68,68,0.12)" }}>
                    <Upload size={18} style={{ color:"#ef4444" }} />
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    클릭하여 스터디 출석 인증 사진 업로드
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    스터디 현장 단체 사진 또는 온라인 화면 캡처 파일 (JPG, PNG)
                  </p>
                  
                  {!rec.submitted && (
                    <div className="mt-3 flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                      <Btn size="xs" onClick={() => fileInputRef.current?.click()}>
                        <Upload size={11} /> 파일 선택
                      </Btn>
                      <Btn variant="outline" size="xs" onClick={handleAttachSample}>
                        <ImageIcon size={11} /> 샘플 사진 바로 첨부
                      </Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard>
            <div className="p-4.5">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Users size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    부원별 출결 입력
                    <span className="text-xs font-normal text-slate-500 ml-1.5 font-mono">({members.length}명)</span>
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!rec?.submitted && (
                    <button
                      type="button"
                      onClick={() => setShowAddMember(v => !v)}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                    >
                      <UserPlus size={13} />
                      <span>+ 스터디원 추가</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 hidden sm:flex">
                    <Info size={12} className="text-blue-500" />
                    <span>사유는 <strong>선택 사항</strong>입니다.</span>
                  </div>
                </div>
              </div>

              {/* Inline Add Member Panel for Study Leader */}
              {showAddMember && !rec?.submitted && (
                <div className="p-3.5 mb-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                      <UserPlus size={13} className="text-blue-600" />
                      <span>새 스터디 부원 추가</span>
                    </p>
                    <button onClick={() => setShowAddMember(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                      <X size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      value={newMemberName}
                      onChange={e => setNewMemberName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleAddMember(); }}
                      placeholder="부원 이름 (쉼표로 구분하여 여러 명 추가 가능: 예: 김보아즈, 이서연)"
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white border border-blue-200 outline-none focus:border-blue-500 text-slate-900 placeholder:text-slate-400"
                    />
                    <div className="flex items-center gap-1">
                      <input
                        value={newMemberYear}
                        onChange={e => setNewMemberYear(e.target.value)}
                        placeholder="23"
                        className="w-14 px-2.5 py-1.5 text-xs text-center rounded-lg bg-white border border-blue-200 outline-none focus:border-blue-500 text-slate-900 font-mono"
                      />
                      <span className="text-xs text-slate-500 font-medium">기</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMember}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                    >
                      추가
                    </button>
                  </div>
                </div>
              )}

              {members.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Users size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">아직 등록된 스터디원이 없습니다</p>
                  <p className="text-[11px] text-slate-500">우측 상단의 [+ 스터디원 추가] 버튼을 눌러 스터디원을 등록해 주세요.</p>
                  {!rec?.submitted && (
                    <button
                      type="button"
                      onClick={() => setShowAddMember(true)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 cursor-pointer shadow-xs inline-flex items-center gap-1.5 mt-1"
                    >
                      <UserPlus size={13} />
                      <span>스터디원 추가하기</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[620px]">
                    <div className="grid text-xs font-semibold text-slate-500 pb-2.5 mb-1.5 items-center"
                      style={{ gridTemplateColumns:"36px 120px 130px 1fr 180px 40px", borderBottom:"1px solid #e2e8f0" }}>
                      <span className="text-center"></span>
                      <span className="font-bold text-slate-900">이름</span>
                      <span className="font-bold text-slate-800">소속 / 기수</span>
                      <span className="text-center font-bold text-slate-900">출결</span>
                      <span className="font-semibold text-slate-700">비고</span>
                      <span className="text-center text-slate-400">관리</span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {members.map((m, i) => {
                        const s = getStatus(m.id);
                        const currentMemo = getMemo(m.id);

                        return (
                          <div key={m.id}
                            className="grid items-center py-2.5 gap-2 hover:bg-slate-50/60 px-1 rounded-xl transition-colors"
                            style={{ gridTemplateColumns:"36px 120px 130px 1fr 180px 40px" }}>
                            <span className="text-xs text-slate-400 font-mono text-center">{i + 1}</span>

                            <div>
                              <p className="text-xs font-bold text-slate-900">{m.name}</p>
                            </div>

                            <div>
                              <span className="text-xs text-slate-700 font-medium">
                                {m.year ? `${m.year}기 부원` : "부원"}
                              </span>
                            </div>

                            <div className="flex items-center justify-center gap-1">
                              {EXT_STATUS_BTNS.map(btn => {
                                const active = s === btn.id;
                                const statusStyles: Record<string, { active: string; inactive: string }> = {
                                  present: {
                                    active: "bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs",
                                    inactive: "bg-white text-slate-400 hover:text-[#0f5132] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium",
                                  },
                                  late: {
                                    active: "bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs",
                                    inactive: "bg-white text-slate-400 hover:text-[#7c4a03] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium",
                                  },
                                  absent: {
                                    active: "bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs",
                                    inactive: "bg-white text-slate-400 hover:text-[#8a1c32] hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium",
                                  },
                                };
                                const styleCfg = statusStyles[btn.id] || {
                                  active: "bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs",
                                  inactive: "bg-white text-slate-400 hover:bg-slate-50 border border-slate-200/90 shadow-2xs font-medium",
                                };
                                return (
                                  <button key={btn.id}
                                    type="button"
                                    onClick={() => setStatus(m.id, btn.id)}
                                    disabled={rec?.submitted ?? false}
                                    className={`px-3 py-1 text-xs rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed ${
                                      active ? styleCfg.active : styleCfg.inactive
                                    }`}
                                  >
                                    {btn.label}
                                  </button>
                                );
                              })}
                            </div>

                            <div>
                              <input
                                value={currentMemo}
                                onChange={e => setMemo(m.id, e.target.value)}
                                disabled={rec?.submitted ?? false}
                                placeholder="비고 입력 (선택)"
                                className="w-full px-2.5 py-1 text-xs rounded-lg outline-none transition-all bg-white border border-slate-200 focus:border-blue-500 text-slate-900 placeholder:text-slate-400 shadow-2xs"
                              />
                            </div>

                            <div className="flex items-center justify-center">
                              {!rec?.submitted ? (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMember(m.id)}
                                  className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                  title="스터디원 삭제"
                                >
                                  <Trash2 size={13} />
                                </button>
                              ) : (
                                <span className="text-slate-300 text-xs">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="w-full lg:w-72 shrink-0 lg:sticky top-4 space-y-4">
          <SectionCard>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <p className="text-sm font-black text-slate-900 tracking-tight">
                    {weekNum}주차 출결 요약
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate max-w-[150px]">
                    {currentStudy?.studyName || "스터디"}
                  </p>
                </div>
                {rec?.submitted ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs">
                    제출완료
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs">
                    작성중
                  </span>
                )}
              </div>

              {/* 3 Attendance Metrics */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label:"출석", val:presentN, badge:"bg-emerald-50 text-emerald-800 border-emerald-200/70", numColor:"text-emerald-700" },
                  { label:"지각", val:lateN,    badge:"bg-amber-50 text-amber-800 border-amber-200/70", numColor:"text-amber-700" },
                  { label:"결석", val:absentN,  badge:"bg-rose-50 text-rose-800 border-rose-200/70", numColor:"text-rose-700" },
                ].map(({ label, val, badge, numColor }) => (
                  <div key={label} className={`p-2.5 rounded-xl border ${badge} transition-all shadow-2xs`}>
                    <p className="text-[11px] font-bold opacity-80 mb-0.5">{label}</p>
                    <p className={`text-xl font-black font-mono ${numColor}`}>
                      {val}<span className="text-xs font-semibold text-slate-600 ml-1">명</span>
                    </p>
                  </div>
                ))}
              </div>

              {/* Photo Status Card - Neutral Slate/Blue for high distinction */}
              {currentPhotoUrl ? (
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/90 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Camera size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">인증 사진 첨부됨</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate max-w-[110px]">
                        {currentPhotoName || "인증사진.jpg"}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200/90 shadow-2xs cursor-pointer shrink-0 transition-colors"
                  >
                    사진 확인
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-center justify-between shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-amber-950">인증 사진 미첨부</p>
                      <p className="text-[10px] text-amber-700">제출 전 사진 등록 필요</p>
                    </div>
                  </div>
                  {!rec?.submitted && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-950 text-xs font-bold border border-amber-300/80 shadow-2xs cursor-pointer shrink-0 transition-colors"
                    >
                      사진 등록
                    </button>
                  )}
                </div>
              )}

              {!rec?.submitted ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={submit}
                    className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 shadow-sm transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send size={13} />
                    <span>출결 & 사진 제출하기</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 leading-tight">
                    제출 후에는 운영지원팀 요청을 통해서만 수정할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  {/* Distinct Solid Emerald Submission Receipt Banner */}
                  <div className="p-3.5 rounded-2xl bg-emerald-600 text-white space-y-1.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs">
                        <CheckCircle2 size={15} className="text-white shrink-0" />
                        <span>최종 제출 완료</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white/20 text-white px-2 py-0.5 rounded-md">
                        저장됨
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-100 font-mono bg-black/15 px-2.5 py-1 rounded-lg">
                      제출일시: {rec.submittedAt}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                    <p className="text-xs font-bold text-slate-800">출결 수정이 필요하신가요?</p>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      제출 후 스터디장은 직접 수정이 불가합니다. 운영지원팀에 사유와 함께 수정 요청을 보내세요.
                    </p>
                    <button
                      onClick={() => setShowRequestModal(true)}
                      className="w-full py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200/90 shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      운영지원팀에 수정 요청
                    </button>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && currentPhotoUrl && (
        <div className="fixed inset-0 bg-black/90 z-60 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxOpen(false)}>
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center" onClick={e => e.stopPropagation()}>
            <img src={currentPhotoUrl} alt="출석 인증 사진" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-300" />
            <div className="mt-3 flex items-center justify-between w-full text-xs text-slate-700">
              <span>{selectedTeam} · {weekNum}주차 출석 인증 사진 ({currentPhotoName})</span>
              <button onClick={() => setLightboxOpen(false)} className="px-3 py-1 rounded bg-white/20 hover:bg-white/30 text-white font-medium cursor-pointer">닫기</button>
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
              <button onClick={() => setShowRequestModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
                <X size={16} />
              </button>
            </div>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-muted-foreground block mb-1">대상 부원</label>
                <select
                  value={reqMember}
                  onChange={e => setReqMember(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground">
                  <option value="">부원을 선택하세요</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id} className="bg-white">{m.name} ({m.year}기)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">변경 희망 상태</label>
                <div className="flex gap-2">
                  {(["present","late","absent"] as AttendanceStatus[]).map(s => (
                    <button key={s}
                      onClick={() => setReqToStatus(s)}
                      className="flex-1 py-1.5 text-xs font-medium rounded transition-all cursor-pointer"
                      style={reqToStatus === s
                        ? { background: STATUS_CFG[s].color, color:"#000", fontWeight:"bold" }
                        : { background:"#f1f5f9", color:"#64748b" }}>
                      {STATUS_CFG[s].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-muted-foreground block mb-1">수정 요청 사유 (필수)</label>
                <textarea
                  value={reqReason}
                  onChange={e => setReqReason(e.target.value)}
                  placeholder="구체적인 사유를 작성하세요 (예: 출결 체크 오기재, 지각 사유 서류 제출 완료)"
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg outline-none bg-slate-100 border border-slate-200 text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={() => setShowRequestModal(false)}>취소</Btn>
              <Btn onClick={handleSendRequest}>요청 보내기</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Login Modal ──────────────────────────────────────────────────────────────

function LoginModal({
  onClose,
  onLoginSuccess,
  hosts,
  studyTeams,
}: {
  onClose: () => void;
  onLoginSuccess: (role: UserRole, hostTeam?: string, username?: string) => void;
  hosts: HostAccount[];
  studyTeams: StudyTeamInfo[];
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [selectedQuickHostTeam, setSelectedQuickHostTeam] = useState(studyTeams[0]?.teamName || "A팀");

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");

    const u = username.trim();
    const p = password.trim();

    if (!u || !p) {
      setErrorMsg("아이디와 비밀번호를 모두 입력해 주세요.");
      return;
    }

    // 0. 최고 관리자 (SUPER)
    if (u === "super" && (p === "super1234" || p === "1234")) {
      onLoginSuccess("SUPER", undefined, "super");
      onClose();
      return;
    }

    // 1. 운영지원팀 마스터 계정 (TEAM)
    if (u === "admin" && (p === "admin1234" || p === "1234")) {
      onLoginSuccess("TEAM", undefined, "admin");
      onClose();
      return;
    }

    // 2. 서비스운영팀(콘텐츠) 계정
    if (u === "content" && (p === "content1234" || p === "1234")) {
      onLoginSuccess("CONTENT_ADMIN", undefined, "content");
      onClose();
      return;
    }

    // 3. HOST (스터디장) 발급 계정 대조
    const foundHost = hosts.find(h => h.username === u && (h.initialPassword === p || p === "boaz2026!a" || p === "1234"));
    if (foundHost) {
      if (!foundHost.active) {
        setErrorMsg("해당 HOST 계정은 현재 회수(잠금) 상태입니다. 운영지원팀에 문의하세요.");
        return;
      }
      onLoginSuccess("HOST", foundHost.team, foundHost.username);
      onClose();
      return;
    }

    setErrorMsg("아이디 또는 비밀번호가 일치하지 않습니다. (아래 퀵 로그인 버튼을 이용해 보세요)");
  }

  const currentSelectedHost = hosts.find(h => h.team === selectedQuickHostTeam) || hosts[0];

  return (
    <div className="fixed inset-0 bg-black/60 z-70 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl overflow-hidden p-6 space-y-5 bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <LogIn size={18} className="text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">BOAZ 콘솔 로그인</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleLogin} className="space-y-3.5 text-xs">
          <div>
            <label className="text-slate-700 block mb-1 font-semibold">로그인 아이디 (ID)</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="예: super, admin, host_a"
              className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono"
            />
          </div>

          <div>
            <label className="text-slate-700 block mb-1 font-semibold">비밀번호 (Password)</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-[11px] text-red-600">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-xs"
          >
            로그인
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-[11px] text-slate-500 font-semibold">빠른 역할 전환 테스트 계정</p>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <button
              onClick={() => { onLoginSuccess("SUPER", undefined, "super"); onClose(); }}
              className="p-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">차기대표진 (SUPER)</p>
              <p className="text-[10px] text-purple-600 font-mono">전 부문 권한 · 승격 전권</p>
            </button>
            <button
              onClick={() => { onLoginSuccess("TEAM", undefined, "admin"); onClose(); }}
              className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">운영지원팀 (출결)</p>
              <p className="text-[10px] text-blue-600 font-mono">admin / admin1234</p>
            </button>
            <button
              onClick={() => {
                const targetTeam = selectedQuickHostTeam;
                const h = hosts.find(item => item.team === targetTeam);
                onLoginSuccess("HOST", targetTeam, h?.username || `host_${targetTeam.toLowerCase()}`);
                onClose();
              }}
              className="p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-left cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">{selectedQuickHostTeam} 스터디장</p>
                <select
                  value={selectedQuickHostTeam}
                  onChange={e => { e.stopPropagation(); setSelectedQuickHostTeam(e.target.value); }}
                  onClick={e => e.stopPropagation()}
                  className="text-[10px] bg-white border border-emerald-300 rounded px-1 py-0.5 font-sans"
                >
                  {studyTeams.map(t => (
                    <option key={t.teamName} value={t.teamName}>{t.teamName}</option>
                  ))}
                </select>
              </div>
              <p className="text-[10px] text-emerald-600 font-mono">
                {currentSelectedHost?.username || `host_${selectedQuickHostTeam.toLowerCase()}`} (HOST)
              </p>
            </button>
            <button
              onClick={() => { onLoginSuccess("CONTENT_ADMIN", undefined, "content"); onClose(); }}
              className="p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-left cursor-pointer transition-colors"
            >
              <p className="font-bold">서비스운영팀 (콘텐츠)</p>
              <p className="text-[10px] text-amber-600 font-mono">content / content1234</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const SIDEBAR_NAV = [
  {
    id:"content", label:"1. 콘텐츠 관리", icon:BookOpen, permission:"CONTENT_MANAGE",
    pages:[
      { id:"content-archive",    label:"아카이빙 (프로젝트·블로그·사진)" },
      { id:"content-faq",        label:"자주 묻는 질문 (FAQ)" },
      { id:"content-curriculum", label:"커리큘럼 관리" },
      { id:"content-reviews",    label:"수료자 후기 관리" },
    ],
  },
  {
    id:"recruiting", label:"2. 리크루팅 공고", icon:Megaphone, permission:"RECRUITMENT_MANAGE",
    pages:[
      { id:"recruiting-posts",     label:"모집 공고 관리" },
      { id:"recruiting-questions", label:"지원서 문항 설정" },
      { id:"recruiting-preview",   label:"지원자 화면 미리보기" },
      { id:"recruiting-csv",       label:"지원서 CSV 추출" },
      { id:"recruiting-leads",     label:"사전 알림 명단" },
    ],
  },
  {
    id:"evaluation", label:"3. 서류 평가", icon:FileText, permission:"EVALUATION",
    pages:[
      { id:"evaluation-evals",      label:"서류 평가 대시보드 (SUBMITTED)" },
      { id:"evaluation-applicants", label:"전체 지원자 현황 (DRAFT 포함)" },
      { id:"evaluation-promote",    label:"최종 합불 & 정회원 승격" },
    ],
  },
  {
    id:"attendance", label:"4. 출결 & 점수 시스템", icon:ClipboardList, permission:"ATTENDANCE_*",
    pages:[
      { id:"att-dashboard", label:"출결 대시보드 (운영지원팀)" },
      { id:"att-events",    label:"행사·세션·컨퍼런스 출석 (양식/외부인)" },
      { id:"att-input",     label:"출결 입력 & 사진 (스터디장)" },
      { id:"att-hosts",     label:"HOST 계정·팀 연결 (ID/PW 발급)" },
      { id:"att-scores",    label:"활동 점수 집계" },
      { id:"att-rules",     label:"점수 규칙" },
    ],
  },
  {
    id:"system", label:"5. 시스템·계정", icon:Settings, permission:"ACCOUNT_MANAGE",
    pages:[
      { id:"system-accounts",    label:"운영진 계정 관리 (CRUD)" },
      { id:"system-permissions", label:"권한 매트릭스 (10대 Permission)" },
      { id:"system-audit",       label:"보안 감사 로그" },
    ],
  },
];

function Sidebar({ activePage, onChange, open, onClose, currentRole, onToggleRole, onOpenLogin, loggedHostTeam, loggedUsername }: {
  activePage:ActivePage; onChange:(p:ActivePage)=>void; open:boolean; onClose:()=>void;
  currentRole: UserRole; onToggleRole: () => void;
  onOpenLogin: () => void; loggedHostTeam?: string; loggedUsername?: string;
}) {
  const [expanded, setExpanded] = useState<string>("recruiting");
  const [navSearch, setNavSearch] = useState("");

  const filteredNav = SIDEBAR_NAV.filter(section => {
    if (!navSearch.trim()) return true;
    const q = navSearch.toLowerCase();
    return section.label.toLowerCase().includes(q) || section.pages.some(p => p.label.toLowerCase().includes(q));
  });

  return (
    <>
      {open && <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-20 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed top-0 left-0 h-full z-30 w-72 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto bg-white border-r border-slate-200/80 shadow-[0_0_15px_rgba(0,0,0,0.03)] ${open ? "translate-x-0" : "-translate-x-full"}`}
        style={{ fontFamily: "'Pretendard', 'Noto Sans KR', -apple-system, sans-serif" }}
      >
        {/* Brand Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white font-black text-base shadow-md shadow-blue-500/20 tracking-tighter">
              B
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-extrabold text-slate-900 tracking-tight">BOAZ Console</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-blue-50 text-blue-600 border border-blue-200/60">
                  v28
                </span>
              </div>
              <p className="text-[11px] text-slate-600 font-medium">빅데이터 동아리 관리 시스템</p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-700 p-1 rounded-lg cursor-pointer"><X size={18}/></button>
        </div>

        {/* Search Toolbar */}
        <div className="px-4 pt-3.5 pb-2">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              value={navSearch}
              onChange={e => setNavSearch(e.target.value)}
              placeholder="메뉴 및 기능 검색..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200/80 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white transition-all shadow-2xs font-medium"
            />
            {navSearch && (
              <button onClick={() => setNavSearch("")} className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Role Pill Card */}
        <div className="px-4 py-2">
          <div className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-semibold">로그인 권한</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs">
                {currentRole === "SUPER" ? "차기대표진" : currentRole === "HOST" ? `HOST (${loggedHostTeam || "A팀"})` : currentRole === "CONTENT_ADMIN" ? "서비스운영팀" : "운영지원팀"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={onToggleRole}
                className="py-1 text-[11px] font-semibold rounded-lg bg-white hover:bg-slate-100 text-slate-700 transition-all flex items-center justify-center gap-1 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <RefreshCw size={10} className="text-slate-400" /> 역할 전환
              </button>
              <button
                onClick={onOpenLogin}
                className="py-1 text-[11px] font-semibold rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all flex items-center justify-center gap-1 cursor-pointer border border-blue-200/80 shadow-2xs"
              >
                <LogIn size={10} /> 계정 변경
              </button>
            </div>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5" style={{ scrollbarWidth: "none" }}>
          {filteredNav.map(section => {
            const Icon = section.icon;
            const isExpanded = expanded === section.id || navSearch.trim().length > 0;
            const isSelected = activePage.startsWith(section.id) || (section.id === "attendance" && activePage.startsWith("att-"));

            return (
              <div key={section.id} className="space-y-1">
                <button
                  onClick={() => {
                    setExpanded(isExpanded && !navSearch ? "" : section.id);
                    if (section.id === "recruiting") onChange("recruiting-posts");
                    if (section.id === "evaluation") onChange("evaluation-evals");
                  }}
                  className={`flex items-center gap-2.5 w-full p-2 rounded-xl text-left transition-all cursor-pointer group ${
                    isSelected
                      ? "bg-blue-50/70 text-blue-900 font-bold"
                      : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 shadow-2xs ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-blue-500/20"
                      : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80 group-hover:text-slate-800"
                  }`}>
                    <Icon size={15} />
                  </div>
                  <span className="flex-1 text-xs truncate">{section.label}</span>
                  {isExpanded ? <ChevronDown size={14} className="text-slate-400"/> : <ChevronRight size={14} className="text-slate-400"/>}
                </button>

                {isExpanded && (
                  <div className="ml-5 space-y-0.5 border-l-2 border-slate-100 pl-3 py-0.5">
                    {section.pages.map(page => {
                      const isActive = activePage === page.id;
                      return (
                        <button
                          key={page.id}
                          onClick={() => { onChange(page.id as ActivePage); onClose(); }}
                          className={`flex items-center w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? "bg-blue-600 text-white shadow-xs font-bold"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                          }`}
                        >
                          <span className="truncate">{page.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User Footer Card */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shadow-2xs text-white bg-slate-900">
              {currentRole === "SUPER" ? "대표" : currentRole === "CONTENT_ADMIN" ? "운영" : currentRole === "HOST" ? "팀장" : "지원"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">
                {currentRole === "SUPER" ? "차기대표진 (SUPER)" : currentRole === "CONTENT_ADMIN" ? "서비스운영팀" : currentRole === "HOST" ? `${loggedHostTeam || "A팀"} (${loggedUsername || "host_a"})` : "운영지원팀 (admin)"}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate">
                {currentRole === "SUPER" ? "전 부문 총괄 승격 권한" : currentRole === "CONTENT_ADMIN" ? "콘텐츠 관리 권한" : currentRole === "HOST" ? "출결 입력 권한" : "출결 관리/승인 권한"}
              </p>
            </div>
            <button onClick={onOpenLogin} className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer" title="로그아웃 / 계정 변경">
              <LogOut size={14}/>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<ActivePage, string> = {
  "content-archive":    "아카이빙 (프로젝트·블로그·사진)",
  "content-faq":        "자주 묻는 질문 (FAQ)",
  "content-curriculum": "커리큘럼 관리",
  "content-reviews":    "수료자 후기 관리",
  "content":            "콘텐츠 관리",
  "recruiting":         "모집 공고 관리",
  "recruiting-posts":   "모집 공고 관리",
  "recruiting-questions": "지원서 문항 설정",
  "recruiting-preview": "지원자 화면 미리보기",
  "recruiting-csv":     "지원서 CSV 추출",
  "recruiting-leads":   "사전 알림 명단",
  "evaluation":         "서류 평가 대시보드",
  "evaluation-evals":   "서류 평가 대시보드 (SUBMITTED)",
  "evaluation-applicants": "전체 지원자 현황 (DRAFT 포함)",
  "evaluation-promote": "최종 합불 & 정회원 승격",
  "att-dashboard":      "출결 대시보드 & 인증 검토",
  "att-events":         "행사·세션·컨퍼런스 출석 (양식/외부인 관리)",
  "att-hosts":          "HOST 계정·팀 연결 (ID/PW 발급)",
  "att-scores":         "활동 점수 집계",
  "att-rules":          "점수 규칙",
  "att-input":          "출결 입력 & 사진 인증 (스터디장)",
  "system":             "시스템·계정",
  "system-accounts":    "운영진 계정 관리 (CRUD)",
  "system-permissions": "권한 매트릭스 (10대 Permission)",
  "system-audit":       "보안 감사 로그",
};

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>("recruiting");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [studyTeams, setStudyTeams] = useState<StudyTeamInfo[]>(INITIAL_STUDY_TEAMS);
  const [membersMap, setMembersMap] = useState<Record<string, Member[]>>(MEMBERS);
  const [attendance, setAttendance] = useState<AttendanceState>(buildInitialAttendance);
  const [hosts, setHosts] = useState<HostAccount[]>(INITIAL_HOSTS);
  const [exceptions, setExceptions] = useState<ExceptionRequest[]>(INITIAL_EXCEPTIONS);
  const [currentRole, setCurrentRole] = useState<UserRole>("SUPER");
  
  const [loggedHostTeam, setLoggedHostTeam] = useState<string>("A팀");
  const [loggedUsername, setLoggedUsername] = useState<string>("super");
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [showMyProfileModal, setShowMyProfileModal] = useState(false);
  const [myCurrentPw, setMyCurrentPw] = useState("");
  const [myNewPw, setMyNewPw] = useState("");
  const [myConfirmPw, setMyConfirmPw] = useState("");

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

    const parsedNames = teamData.memberNames && teamData.memberNames.length > 0 ? teamData.memberNames : [];
    const newMemberList: Member[] = parsedNames.map((name, idx) => ({
      id: `${teamData.teamName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${idx + 1}`,
      name,
      year: `${22 + (idx % 3)}`,
    }));

    setStudyTeams(prev => {
      // replace if existing or append
      const exists = prev.some(s => s.teamName === teamData.teamName);
      if (exists) return prev.map(s => s.teamName === teamData.teamName ? newStudy : s);
      return [...prev, newStudy];
    });

    setHosts(prev => [newHost, ...prev.filter(h => h.team !== teamData.teamName)]);

    setMembersMap(prev => ({
      ...prev,
      [teamData.teamName]: newMemberList,
    }));

    // initialize attendance keys for the new study team across all weeks
    setAttendance(prev => {
      const updated = { ...prev };
      WEEKS.forEach(w => {
        const k = sessionKey(w.id, "study", teamData.teamName);
        if (!updated[k]) {
          const statuses: Record<string, AttendanceStatus> = {};
          newMemberList.forEach(m => { statuses[m.id] = "present"; });
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
    const ex = exceptions.find(e => e.id === id);
    if (ex) {
      const weekNum = ex.week.replace(/[^0-9]/g, "");
      const wId = `w${weekNum}`;
      const actId = "study";
      const key = sessionKey(wId, actId, ex.team);
      const members = membersMap[ex.team] ?? [];
      const mem = members.find(m => m.name === ex.memberName);
      if (mem && attendance[key]) {
        setAttendance(prev => ({
          ...prev,
          [key]: {
            ...prev[key],
            statuses: { ...prev[key].statuses, [mem.id]: ex.to },
          }
        }));
      }
    }
    setExceptions(prev => prev.filter(e => e.id !== id));
  }

  function rejectException(id: string) {
    setExceptions(prev => prev.filter(e => e.id !== id));
  }

  function handleRequestException(team: string, week: string, memberName: string, from: AttendanceStatus, to: AttendanceStatus, reason: string) {
    setExceptions(prev => [
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

  function handleDirectEdit(w: string, a: string, t: string, memberId: string, to: AttendanceStatus, reason: string) {
    const key = sessionKey(w, a, t);
    setAttendance(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      return {
        ...prev,
        [key]: {
          ...cur,
          statuses: { ...cur.statuses, [memberId]: to },
          memos: { ...(cur.memos ?? {}), [memberId]: `[운영지원팀 수정] ${reason}` },
        }
      };
    });
  }

  function handleConfirmAdmin(w: string, a: string, t: string) {
    const key = sessionKey(w, a, t);
    setAttendance(prev => {
      const cur = prev[key];
      if (!cur) return prev;
      return {
        ...prev,
        [key]: {
          ...cur,
          confirmedByAdmin: true,
        }
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
    setCurrentRole(role);
    if (role === "HOST") {
      setLoggedHostTeam(hostTeam || studyTeams[0]?.teamName || "A팀");
      setLoggedUsername(username || "host_a");
      setActivePage("att-input");
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

  const isRecruiting = activePage.startsWith("recruiting");
  const isEvaluation = activePage.startsWith("evaluation");
  const isContentPage = activePage.startsWith("content");
  const isAttendancePage = activePage.startsWith("att-");

  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      <Sidebar
        activePage={activePage}
        onChange={setActivePage}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentRole={currentRole}
        onToggleRole={handleToggleRole}
        onOpenLogin={() => setLoginModalOpen(true)}
        loggedHostTeam={loggedHostTeam}
        loggedUsername={loggedUsername}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#f8fafc]">
        {/* Topbar */}
        <header className="h-14 shrink-0 flex items-center justify-between px-8 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-900 cursor-pointer p-1 rounded-lg hover:bg-slate-100"><Menu size={18}/></button>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              {isRecruiting && <><span>리크루팅</span><span className="text-slate-300">/</span></>}
              {isEvaluation && <><span>서류 평가</span><span className="text-slate-300">/</span></>}
              {isContentPage && <><span>콘텐츠 관리</span><span className="text-slate-300">/</span></>}
              {isAttendancePage && <><span>출결 관리</span><span className="text-slate-300">/</span></>}
              <span className="text-slate-900 font-bold tracking-tight">{PAGE_LABELS[activePage] || "관리자 콘솔"}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] px-3 py-1 rounded-full font-mono font-semibold hidden sm:inline-block bg-slate-100 text-slate-700 border border-slate-200/80 shadow-2xs">
              {currentRole === "SUPER" ? "차기대표진 (SUPER)" : currentRole === "HOST" ? `HOST (${loggedHostTeam || "A팀"})` : currentRole === "CONTENT_ADMIN" ? "서비스운영팀" : "운영지원팀"}
            </span>
            <button
              onClick={() => setLoginModalOpen(true)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 flex items-center gap-1.5 cursor-pointer shadow-2xs font-semibold transition-colors"
            >
              <LogIn size={12} className="text-slate-500" />
              <span>계정 전환</span>
            </button>
            <button className="relative p-2 text-slate-500 hover:text-slate-900 rounded-xl hover:bg-slate-100 cursor-pointer transition-colors">
              <Bell size={16}/>
              {exceptions.length > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-white"/>
              )}
            </button>
          </div>
        </header>

        {/* Content Main Body */}
        <main className="flex-1 overflow-y-auto px-8 py-7" style={{ scrollbarWidth:"none" }}>
          {/* 1. Recruiting Management */}
          {isRecruiting && (
            <RecruitmentManagePage
              key={activePage}
              initialTab={
                activePage === "recruiting-questions" ? "questions"
                : activePage === "recruiting-preview" ? "preview"
                : activePage === "recruiting-csv" ? "csv"
                : activePage === "recruiting-leads" ? "leads"
                : "posts"
              }
              onTabChange={(pageId) => setActivePage(pageId as ActivePage)}
            />
          )}

          {/* 2. Evaluation Management */}
          {isEvaluation && (
            <EvaluationManagePage
              initialTab={
                activePage === "evaluation-applicants" ? "applicants"
                : activePage === "evaluation-promote" ? "promotions"
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
          {activePage === "att-events" && <EventAttendanceManagePage />}
          {activePage === "att-input" && (
            <InputPage
              attendance={attendance}
              setAttendance={setAttendance}
              onRequestException={handleRequestException}
              currentHostTeam={loggedHostTeam}
              studyTeams={studyTeams}
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
          {activePage === "att-scores" && (
            <ScoresPage
              attendance={attendance}
              studyTeams={studyTeams}
              membersMap={membersMap}
            />
          )}
          {activePage === "att-rules" && <RulesPage />}

          {/* 5. System Section */}
          {(activePage.startsWith("system") || activePage === "system") && (
            <SystemAccountsPage
              initialSubTab={
                activePage === "system-permissions" ? "permissions"
                : activePage === "system-audit" ? "audit"
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
                <h3 className="text-base font-bold text-foreground">내 계정 정보 & 비밀번호 변경</h3>
              </div>
              <button onClick={() => setShowMyProfileModal(false)} className="text-muted-foreground hover:text-foreground cursor-pointer">
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
                <span className="text-purple-300 font-sans font-bold">남민서 (MASTER · 서비스운영팀장)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">소속 트랙 / 기수:</span>
                <span className="text-[#8ba5ff]">ANALYSIS · 28기</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Key size={13} className="text-[#8ba5ff]" />
                <span>비밀번호 변경 (PATCH /api/v1/admin/accounts/{id}/password)</span>
              </p>

              <div>
                <label className="text-muted-foreground block mb-1 font-semibold">
                  현재 비밀번호 (current_password) <span className="text-red-400">*</span>
                </label>
                <input
                  type="password"
                  value={myCurrentPw}
                  onChange={e => setMyCurrentPw(e.target.value)}
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
                  onChange={e => setMyNewPw(e.target.value)}
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
                  onChange={e => setMyConfirmPw(e.target.value)}
                  placeholder="새 비밀번호 다시 입력"
                  className="w-full px-3 py-2 rounded-xl bg-slate-100 border border-slate-200 text-foreground font-mono"
                />
              </div>
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
