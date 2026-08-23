import { useState, useEffect, useRef } from "react";
import {
  Calendar, Clock, Users, UserCheck, Plus, Edit3, Trash2,
  FileSpreadsheet, QrCode, Search, Filter, CheckCircle2,
  AlertCircle, ChevronRight, X, Copy, ExternalLink, ShieldCheck,
  Tag as TagIcon, Sparkles, Building2, Mail, Phone, Settings,
  Eye, Check, RefreshCw, Layers, Award, Radio, CheckSquare,
  FileText, ArrowRight, CornerDownRight, Download, Link2, Share2,
  HelpCircle, UserPlus, AlertTriangle, Upload, FileUp, CheckCheck,
  Keyboard, ListPlus, ArrowDown, ArrowUp, ChevronDown, ChevronUp, Sparkle, Table, GripVertical
} from "lucide-react";

export type EventType = "SESSION" | "HACKATHON" | "CONFERENCE" | "SEMINAR" | "STUDY" | "ETC";
export type EventStatus = "UPCOMING" | "IN_PROGRESS" | "FINISHED";
export type CheckinMethod = "QR_CODE" | "CODE" | "MANUAL" | "OPEN_LINK";
export type AttendStatus = "present" | "late" | "absent" | "excusedAbsent" | "unexcusedLate" | "unexcusedAbsent" | "unmarked";

export interface CustomFormField {
  id: string;
  label: string;
  type: "TEXT" | "SELECT" | "PHONE" | "EMAIL";
  options?: string[];
  isRequired: boolean;
  target: "ALL" | "INTERNAL_ONLY" | "EXTERNAL_ONLY";
}

export interface FormTemplate {
  id: string;
  title: string;
  type: EventType;
  description: string;
  allowExternal: boolean;
  defaultCheckinMethod: CheckinMethod;
  customFields: CustomFormField[];
  createdAt: string;
}

export interface AttendanceEvent {
  id: string;
  title: string;
  type: EventType;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  allowExternal: boolean;
  checkinMethod: CheckinMethod;
  checkinCode: string;
  customFields: CustomFormField[];
  targetTerms: number[];
  targetTracks: string[];
  totalTargetCount: number;
  internalAttendedCount: number;
  externalAttendedCount: number;
  createdAt: string;
}

export interface AttendeeRecord {
  id: string;
  eventId: string;
  isExternal: boolean;
  name: string;
  affiliation: string;
  term?: number;
  email: string;
  phone: string;
  status: AttendStatus;
  checkedInAt: string;
  customAnswers?: Record<string, string>;
  memo?: string;
}

const EVENT_TYPE_META: Record<EventType, { label: string; short: string; color: string; bg: string; border: string }> = {
  CONFERENCE: { label: "컨퍼런스 (빅콘)", short: "컨퍼런스", color: "#7e22ce", bg: "#faf5ff", border: "#e9d5ff" },
  HACKATHON:  { label: "해커톤 / 데이터톤", short: "해커톤", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  SESSION:    { label: "정기 세션 / 특강", short: "정기세션", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  SEMINAR:    { label: "분과 세미나", short: "세미나", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  STUDY:      { label: "정규 스터디", short: "스터디", color: "#0369a1", bg: "#f0f9ff", border: "#bae6fd" },
  ETC:        { label: "기타 행사", short: "기타", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
};

const STATUS_CFG: Record<EventStatus, { label: string; color: string; bg: string; border: string }> = {
  UPCOMING:    { label: "예정", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  IN_PROGRESS: { label: "진행중", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  FINISHED:    { label: "종료", color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
};

const ATTEND_STATUS_CFG: Record<AttendStatus, { label: string; code: string; color: string; bg: string; border: string; activeBg: string; activeText: string }> = {
  present:         { label: "출석", code: "0", color: "#0f5132", bg: "#def2e6", border: "#b6e3c9", activeBg: "#def2e6", activeText: "#0f5132" },
  late:            { label: "지각", code: "1", color: "#7c4a03", bg: "#fceed2", border: "#f5d5a4", activeBg: "#fceed2", activeText: "#7c4a03" },
  earlyLeave:      { label: "조퇴", code: "1E", color: "#7c4a03", bg: "#fef3c7", border: "#fde68a", activeBg: "#fef3c7", activeText: "#7c4a03" },
  absent:          { label: "결석", code: "2", color: "#8a1c32", bg: "#fce4e6", border: "#f8b4bc", activeBg: "#fce4e6", activeText: "#8a1c32" },
  excusedAbsent:   { label: "인정결석", code: "3", color: "#1e40af", bg: "#eff6ff", border: "#bfdbfe", activeBg: "#eff6ff", activeText: "#1e40af" },
  unexcusedLate:   { label: "무단지각", code: "4", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa", activeBg: "#fff7ed", activeText: "#c2410c" },
  unexcusedAbsent: { label: "무단결석", code: "5", color: "#991b1b", bg: "#fee2e2", border: "#fca5a5", activeBg: "#fee2e2", activeText: "#991b1b" },
  unmarked:        { label: "미체크", code: "-", color: "#334155", bg: "#e9eef4", border: "#cbd5e1", activeBg: "#e9eef4", activeText: "#334155" },
};

const ATTEND_STATUS_STYLES: Record<AttendStatus, { active: string; inactive: string }> = {
  present: {
    active: "bg-[#def2e6] text-[#0f5132] font-bold border border-[#b6e3c9] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#0f5132] hover:bg-white/60 border border-transparent font-medium",
  },
  late: {
    active: "bg-[#fceed2] text-[#7c4a03] font-bold border border-[#f5d5a4] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium",
  },
  earlyLeave: {
    active: "bg-[#fef3c7] text-[#7c4a03] font-bold border border-[#fde68a] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#7c4a03] hover:bg-white/60 border border-transparent font-medium",
  },
  absent: {
    active: "bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#8a1c32] hover:bg-white/60 border border-transparent font-medium",
  },
  excusedAbsent: {
    active: "bg-[#eff6ff] text-[#1e40af] font-bold border border-[#bfdbfe] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#1e40af] hover:bg-white/60 border border-transparent font-medium",
  },
  unexcusedLate: {
    active: "bg-[#fff7ed] text-[#c2410c] font-bold border border-[#fed7aa] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#c2410c] hover:bg-white/60 border border-transparent font-medium",
  },
  unexcusedAbsent: {
    active: "bg-[#fee2e2] text-[#991b1b] font-bold border border-[#fca5a5] shadow-2xs",
    inactive: "text-slate-400 hover:text-[#991b1b] hover:bg-white/60 border border-transparent font-medium",
  },
  unmarked: {
    active: "bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs",
    inactive: "text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium",
  },
};

const BOAZ_MEMBER_POOL = [
  { name: "김서하", term: 28, track: "ANALYSIS", affiliation: "28기 분석", email: "seoha.k@yonsei.ac.kr", phone: "010-5519-8821" },
  { name: "이민준", term: 28, track: "ANALYSIS", affiliation: "28기 분석", email: "minjun.l@snu.ac.kr", phone: "010-3811-9021" },
  { name: "박지훈", term: 28, track: "ANALYSIS", affiliation: "28기 분석", email: "jihoon.p@korea.ac.kr", phone: "010-4491-3829" },
  { name: "정채원", term: 28, track: "ANALYSIS", affiliation: "28기 분석", email: "chaewon.j@hanyang.ac.kr", phone: "010-9920-1182" },
  { name: "오승현", term: 28, track: "ANALYSIS", affiliation: "28기 분석", email: "seunghyun.o@sogang.ac.kr", phone: "010-3378-4912" },
  { name: "이도현", term: 28, track: "ENGINEERING", affiliation: "28기 엔지니어링", email: "dohyun.l@snu.ac.kr", phone: "010-3819-2910" },
  { name: "박성훈", term: 28, track: "ENGINEERING", affiliation: "28기 엔지니어링", email: "sunghoon.p@naver.com", phone: "010-9182-4122" },
  { name: "강태양", term: 28, track: "ENGINEERING", affiliation: "28기 엔지니어링", email: "taeyang.k@snu.ac.kr", phone: "010-1829-4720" },
  { name: "임수진", term: 28, track: "ENGINEERING", affiliation: "28기 엔지니어링", email: "sujin.l@yonsei.ac.kr", phone: "010-8831-2940" },
  { name: "백민혁", term: 28, track: "ENGINEERING", affiliation: "28기 엔지니어링", email: "minhyuk.b@korea.ac.kr", phone: "010-7719-2041" },
  { name: "최민혁", term: 28, track: "VISUALIZATION", affiliation: "28기 시각화", email: "minhyuk.c@yonsei.ac.kr", phone: "010-5512-7019" },
  { name: "한예린", term: 28, track: "VISUALIZATION", affiliation: "28기 시각화", email: "yerin.h@ewha.ac.kr", phone: "010-6629-3810" },
  { name: "윤재혁", term: 28, track: "VISUALIZATION", affiliation: "28기 시각화", email: "jaehyuk.y@skku.edu", phone: "010-4490-1822" },
  { name: "장나연", term: 28, track: "VISUALIZATION", affiliation: "28기 시각화", email: "nayeon.j@hanyang.ac.kr", phone: "010-8812-7091" },
  { name: "고준서", term: 27, track: "ANALYSIS", affiliation: "27기 분석", email: "junseo.k@snu.ac.kr", phone: "010-2281-9930" },
  { name: "남소희", term: 27, track: "ENGINEERING", affiliation: "27기 엔지니어링", email: "sohee.n@yonsei.ac.kr", phone: "010-3391-7721" },
  { name: "문지훈", term: 27, track: "VISUALIZATION", affiliation: "27기 시각화", email: "jihoon.m@korea.ac.kr", phone: "010-4481-9012" },
];

const INITIAL_TEMPLATES: FormTemplate[] = [
  {
    id: "tmpl_conf",
    title: "빅데이터 컨퍼런스 (빅콘) 표준 양식",
    type: "CONFERENCE",
    description: "외부 참가자 대규모 출석 확인 및 소속/기념품 수령 여부 체크 양식",
    allowExternal: true,
    defaultCheckinMethod: "QR_CODE",
    createdAt: "2026-08-01",
    customFields: [],
  },
  {
    id: "tmpl_hack",
    title: "무박 해커톤 / 데이터톤 전용 양식",
    type: "HACKATHON",
    description: "팀별 배정 현황 확인 및 체크인 코드 인증 양식",
    allowExternal: false,
    defaultCheckinMethod: "CODE",
    createdAt: "2026-08-05",
    customFields: [],
  },
  {
    id: "tmpl_session",
    title: "정기 세션 & 특강 출석 양식",
    type: "SESSION",
    description: "정규 부원 과제 제출 여부 확인 및 출결 집계 양식",
    allowExternal: false,
    defaultCheckinMethod: "QR_CODE",
    createdAt: "2026-08-10",
    customFields: [],
  },
];

const INITIAL_EVENTS: AttendanceEvent[] = [
  {
    id: "evt_hack_01",
    title: "2026 하계 LLM & Agentic AI 해커톤",
    type: "HACKATHON",
    status: "IN_PROGRESS",
    date: "2026-08-15",
    startTime: "09:00",
    endTime: "21:00",
    location: "강남 드림플러스 메인홀",
    description: "28기 정회원 및 산학 연계 협력사 멘토와 함께하는 무박 해커톤",
    allowExternal: false,
    checkinMethod: "CODE",
    checkinCode: "9055",
    targetTerms: [28],
    targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
    totalTargetCount: 52,
    internalAttendedCount: 6,
    externalAttendedCount: 0,
    createdAt: "2026-08-15",
    customFields: [],
  },
  {
    id: "evt_conf_28",
    title: "BOAZ 제28기 Big Data Conference (빅콘)",
    type: "CONFERENCE",
    status: "IN_PROGRESS",
    date: "2026-08-08",
    startTime: "13:00",
    endTime: "18:30",
    location: "서울대학교 글로벌공학센터 다목적홀 / YouTube Live",
    description: "BOAZ 28기 부원들의 프로젝트 성과 발표 및 외부 IT 기업 데이터 현직자 초청 컨퍼런스",
    allowExternal: true,
    checkinMethod: "QR_CODE",
    checkinCode: "8220",
    targetTerms: [27, 28],
    targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
    totalTargetCount: 75,
    internalAttendedCount: 5,
    externalAttendedCount: 4,
    createdAt: "2026-08-08",
    customFields: [],
  },
  {
    id: "evt_session_03",
    title: "제28기 3주차 정기 세션 (MLOps 특강)",
    type: "SESSION",
    status: "FINISHED",
    date: "2026-08-01",
    startTime: "14:00",
    endTime: "17:00",
    location: "연세대학교 백양관 101호",
    description: "현업 MLOps 아키텍처 실무 강의 및 트랙별 진행 상황 공유",
    allowExternal: false,
    checkinMethod: "QR_CODE",
    checkinCode: "8150",
    targetTerms: [28],
    targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
    totalTargetCount: 52,
    internalAttendedCount: 6,
    externalAttendedCount: 0,
    createdAt: "2026-08-01",
    customFields: [],
  },
];

const INITIAL_ATTENDEES: AttendeeRecord[] = [
  // 1. LLM 해커톤
  { id: "att_h1", eventId: "evt_hack_01", isExternal: false, name: "김서하", affiliation: "28기 분석", term: 28, email: "seoha.k@yonsei.ac.kr", phone: "010-5519-8821", status: "present", checkedInAt: "08:45", customAnswers: { "배정 팀명": "1조 RAG마스터", f4: "1조 RAG마스터" } },
  { id: "att_h2", eventId: "evt_hack_01", isExternal: false, name: "이민준", affiliation: "28기 분석", term: 28, email: "minjun.l@snu.ac.kr", phone: "010-3811-9021", status: "present", checkedInAt: "08:50", customAnswers: { "배정 팀명": "1조 RAG마스터", f4: "1조 RAG마스터" } },
  { id: "att_h3", eventId: "evt_hack_01", isExternal: false, name: "이도현", affiliation: "28기 엔지니어링", term: 28, email: "dohyun.l@snu.ac.kr", phone: "010-3819-2910", status: "present", checkedInAt: "08:40", customAnswers: { "배정 팀명": "2조 에이전트", f4: "2조 에이전트" } },
  { id: "att_h4", eventId: "evt_hack_01", isExternal: false, name: "박성훈", affiliation: "28기 엔지니어링", term: 28, email: "sunghoon.p@naver.com", phone: "010-9182-4122", status: "late", checkedInAt: "09:15", customAnswers: { "배정 팀명": "2조 에이전트", f4: "2조 에이전트" } },
  { id: "att_h5", eventId: "evt_hack_01", isExternal: false, name: "최민혁", affiliation: "28기 시각화", term: 28, email: "minhyuk.c@yonsei.ac.kr", phone: "010-5512-7019", status: "present", checkedInAt: "08:55", customAnswers: { "배정 팀명": "3조 대시보드", f4: "3조 대시보드" } },
  { id: "att_h6", eventId: "evt_hack_01", isExternal: false, name: "한예린", affiliation: "28기 시각화", term: 28, email: "yerin.h@ewha.ac.kr", phone: "010-6629-3810", status: "present", checkedInAt: "08:35", customAnswers: { "배정 팀명": "3조 대시보드", f4: "3조 대시보드" } },
  { id: "att_h7", eventId: "evt_hack_01", isExternal: false, name: "정채원", affiliation: "28기 분석", term: 28, email: "chaewon.j@hanyang.ac.kr", phone: "010-9920-1182", status: "unmarked", checkedInAt: "-", customAnswers: { "배정 팀명": "4조 파이프라인", f4: "4조 파이프라인" } },
  { id: "att_h8", eventId: "evt_hack_01", isExternal: false, name: "오승현", affiliation: "28기 분석", term: 28, email: "seunghyun.o@sogang.ac.kr", phone: "010-3378-4912", status: "absent", checkedInAt: "-", memo: "사전 불참 통보", customAnswers: { "배정 팀명": "4조 파이프라인", f4: "4조 파이프라인" } },

  // 2. 빅콘 컨퍼런스
  { id: "att_1", eventId: "evt_conf_28", isExternal: false, name: "김서하", affiliation: "28기 분석", term: 28, email: "seoha@yonsei.ac.kr", phone: "010-5519-8821", status: "present", checkedInAt: "12:50", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_2", eventId: "evt_conf_28", isExternal: false, name: "이도현", affiliation: "28기 엔지니어링", term: 28, email: "dohyun@snu.ac.kr", phone: "010-3819-2910", status: "present", checkedInAt: "12:45", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_3", eventId: "evt_conf_28", isExternal: false, name: "최민혁", affiliation: "28기 시각화", term: 28, email: "minhyuk.c@yonsei.ac.kr", phone: "010-5512-7019", status: "late", checkedInAt: "13:18", memo: "지하철 연착", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_4", eventId: "evt_conf_28", isExternal: false, name: "박성훈", affiliation: "28기 엔지니어링", term: 28, email: "sunghoon.p@naver.com", phone: "010-9182-4122", status: "unmarked", checkedInAt: "-", customAnswers: { "기념품 수령": "미수령", f4: "미수령" } },
  { id: "att_5", eventId: "evt_conf_28", isExternal: false, name: "강태양", affiliation: "28기 엔지니어링", term: 28, email: "taeyang.k@snu.ac.kr", phone: "010-1829-4720", status: "present", checkedInAt: "12:58", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_6", eventId: "evt_conf_28", isExternal: false, name: "임수진", affiliation: "28기 엔지니어링", term: 28, email: "sujin.l@yonsei.ac.kr", phone: "010-8831-2940", status: "absent", checkedInAt: "-", memo: "개인 사유", customAnswers: { "기념품 수령": "미수령", f4: "미수령" } },
  { id: "att_7", eventId: "evt_conf_28", isExternal: false, name: "한예린", affiliation: "28기 시각화", term: 28, email: "yerin.h@ewha.ac.kr", phone: "010-6629-3810", status: "present", checkedInAt: "12:40", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_8", eventId: "evt_conf_28", isExternal: false, name: "윤재혁", affiliation: "28기 시각화", term: 28, email: "jaehyuk.y@skku.edu", phone: "010-4490-1822", status: "unmarked", checkedInAt: "-", customAnswers: { "기념품 수령": "미수령", f4: "미수령" } },
  { id: "att_ext_1", eventId: "evt_conf_28", isExternal: true, name: "박지민 (게스트)", affiliation: "카카오 데이터팀", email: "jimin.park@kakao.com", phone: "010-7721-9943", status: "present", checkedInAt: "12:40", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_ext_2", eventId: "evt_conf_28", isExternal: true, name: "정우성 (게스트)", affiliation: "고려대 산경과", email: "ws.jung@korea.ac.kr", phone: "010-4491-1120", status: "present", checkedInAt: "12:55", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_ext_3", eventId: "evt_conf_28", isExternal: true, name: "한소희 (게스트)", affiliation: "네이버 AI Lab", email: "sohee.h@navercorp.com", phone: "010-3388-1290", status: "present", checkedInAt: "13:05", customAnswers: { "기념품 수령": "수령 완료", f4: "수령 완료" } },
  { id: "att_ext_4", eventId: "evt_conf_28", isExternal: true, name: "강동원 (게스트)", affiliation: "성균관대 소프트", email: "dw.kang@skku.edu", phone: "010-8812-4411", status: "unmarked", checkedInAt: "-", customAnswers: { "기념품 수령": "미수령", f4: "미수령" } },

  // 3. MLOps 세션
  { id: "att_s1", eventId: "evt_session_03", isExternal: false, name: "김서하", affiliation: "28기 분석", term: 28, email: "seoha.k@yonsei.ac.kr", phone: "010-5519-8821", status: "present", checkedInAt: "13:55", customAnswers: { "과제 제출": "제출 완료", f4: "제출 완료" } },
  { id: "att_s2", eventId: "evt_session_03", isExternal: false, name: "이도현", affiliation: "28기 엔지니어링", term: 28, email: "dohyun.l@snu.ac.kr", phone: "010-3819-2910", status: "present", checkedInAt: "13:50", customAnswers: { "과제 제출": "제출 완료", f4: "제출 완료" } },
  { id: "att_s3", eventId: "evt_session_03", isExternal: false, name: "최민혁", affiliation: "28기 시각화", term: 28, email: "minhyuk.c@yonsei.ac.kr", phone: "010-5512-7019", status: "present", checkedInAt: "13:58", customAnswers: { "과제 제출": "제출 완료", f4: "제출 완료" } },
  { id: "att_s4", eventId: "evt_session_03", isExternal: false, name: "박성훈", affiliation: "28기 엔지니어링", term: 28, email: "sunghoon.p@naver.com", phone: "010-9182-4122", status: "absent", checkedInAt: "-", memo: "개인 사정", customAnswers: { "과제 제출": "미제출", f4: "미제출" } },
  { id: "att_s5", eventId: "evt_session_03", isExternal: false, name: "강태양", affiliation: "28기 엔지니어링", term: 28, email: "taeyang.k@snu.ac.kr", phone: "010-1829-4720", status: "present", checkedInAt: "13:52", customAnswers: { "과제 제출": "제출 완료", f4: "제출 완료" } },
  { id: "att_s6", eventId: "evt_session_03", isExternal: false, name: "한예린", affiliation: "28기 시각화", term: 28, email: "yerin.h@ewha.ac.kr", phone: "010-6629-3810", status: "late", checkedInAt: "14:12", memo: "12분 지각", customAnswers: { "과제 제출": "제출 완료", f4: "제출 완료" } },
];

// Smart resolver for attendee values based on dynamic column labels
function getAttendeeFieldValue(att: AttendeeRecord, label: string, id: string): string {
  if (att.customAnswers?.[label] !== undefined && att.customAnswers[label] !== "") {
    return att.customAnswers[label];
  }
  if (att.customAnswers?.[id] !== undefined && att.customAnswers[id] !== "") {
    return att.customAnswers[id];
  }

  const clean = label.trim().toLowerCase();

  // 학교 / 대학교 / 출신학교
  if (clean.includes("학교") || clean.includes("대학")) {
    if (att.email.includes("yonsei")) return "연세대학교";
    if (att.email.includes("snu")) return "서울대학교";
    if (att.email.includes("ewha")) return "이화여자대학교";
    if (att.email.includes("hanyang")) return "한양대학교";
    if (att.email.includes("sogang")) return "서강대학교";
    if (att.email.includes("korea")) return "고려대학교";
    if (att.email.includes("skku")) return "성균관대학교";
    if (att.affiliation.includes("대")) return att.affiliation.split(" ")[0];
    return "서울대학교";
  }

  // 소속 / 회사 / 직장 / 기업
  if (clean.includes("소속") || clean.includes("회사") || clean.includes("직장") || clean.includes("기업")) {
    return att.affiliation || (att.isExternal ? "외부 게스트" : "BOAZ 28기");
  }

  // 기수 / 기
  if (clean === "기수" || clean === "기" || clean.includes("기수")) {
    return att.term ? `${att.term}기` : (att.affiliation.match(/\d+기/)?.[0] || "28기");
  }

  // 부문 / 트랙 / 분야 / 세부트랙
  if (clean.includes("부문") || clean.includes("트랙") || clean.includes("분야")) {
    if (att.affiliation.includes("분석")) return "분석 트랙";
    if (att.affiliation.includes("엔지니어링") || att.affiliation.includes("엔지니어")) return "엔지니어링 트랙";
    if (att.affiliation.includes("시각화")) return "시각화 트랙";
    return "분석 트랙";
  }

  // 팀 / 팀명 / 배정팀 / 배정 팀명 / 조
  if (clean.includes("팀") || clean.includes("조") || clean.includes("배정")) {
    return att.customAnswers?.["배정 팀명"] || att.customAnswers?.["팀명"] || (att.id.includes("1") || att.id.includes("2") ? "1조" : "2조");
  }

  // 전화번호 / 연락처 / 핸드폰 / 휴대폰
  if (clean.includes("전화") || clean.includes("연락") || clean.includes("핸드폰") || clean.includes("휴대폰") || clean.includes("phone")) {
    return att.phone;
  }

  // 이메일 / 메일 / email
  if (clean.includes("메일") || clean.includes("email")) {
    return att.email;
  }

  // 구분 / 참가구분 / 신분
  if (clean.includes("구분") || clean.includes("신분")) {
    return att.isExternal ? "외부인" : "정회원";
  }

  // 기념품 / 수령
  if (clean.includes("기념품") || clean.includes("수령")) {
    return att.customAnswers?.["기념품 수령"] || "수령 완료";
  }

  // 과제 / 제출
  if (clean.includes("과제") || clean.includes("제출")) {
    return att.customAnswers?.["과제 제출"] || "제출 완료";
  }

  return "";
}

export function EventAttendanceManagePage() {
  const [subTab, setSubTab] = useState<"events" | "live">("events");
  const [events, setEvents] = useState<AttendanceEvent[]>(INITIAL_EVENTS);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>(INITIAL_ATTENDEES);
  const [templates, setTemplates] = useState<FormTemplate[]>(INITIAL_TEMPLATES);
  const [selectedEventId, setSelectedEventId] = useState<string>("evt_conf_28");

  // Dropdown selector state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isBreadcrumbMenuOpen, setIsBreadcrumbMenuOpen] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [eventFilterType, setEventFilterType] = useState<"ALL" | EventType>("ALL");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const breadcrumbDropdownRef = useRef<HTMLDivElement>(null);

  // Filter & Search
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [termFilter, setTermFilter] = useState<string>("ALL"); // "ALL" | "28" | "27" | "26"
  const [attendeeCategoryFilter, setAttendeeCategoryFilter] = useState<"ALL" | "ANALYSIS" | "VISUALIZATION" | "ENGINEERING" | "EXTERNAL">("ALL");
  const [attendStatusFilter, setAttendStatusFilter] = useState<"ALL" | AttendStatus>("ALL");

  // Fast Keyboard Check-in Mode State
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [isKeyboardModeActive, setIsKeyboardModeActive] = useState(true);

  // Quick Add Drawer
  const [showQuickAddDrawer, setShowQuickAddDrawer] = useState(false);
  const [quickAdd, setQuickAdd] = useState({
    isExternal: false,
    name: "",
    affiliation: "",
    email: "",
    phone: "",
    memo: "",
    status: "present" as AttendStatus,
    customAnswers: {} as Record<string, string>,
  });

  // Modal: Import / Bulk Add Roster
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<"CSV_FILE" | "PASTE" | "BOAZ_POOL">("CSV_FILE");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [pastedText, setPastedText] = useState("");
  const [parsedPreview, setParsedPreview] = useState<{ isExternal: boolean; name: string; affiliation: string; email: string; phone: string; term?: number; customAnswers: Record<string, string> }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal: Event Form Create / Edit (BASIC_INFO: 기본정보, COLUMNS_ONLY: 출석컬럼, CREATE_FULL: 새 행사 전체)
  const [editingEvent, setEditingEvent] = useState<AttendanceEvent | null>(null);
  const [eventModalType, setEventModalType] = useState<"BASIC_INFO" | "COLUMNS_ONLY" | "CREATE_FULL">("CREATE_FULL");
  const [isNewEvent, setIsNewEvent] = useState(false);
  const [newColInputText, setNewColInputText] = useState("");
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
    status: 400,
    memo: 200,
  });

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const resizingCol = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [activeHoverCol, setActiveHoverCol] = useState<string | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);
  const [guidelineX, setGuidelineX] = useState<number | null>(null);
  const activeThRef = useRef<HTMLElement | null>(null);

  const updateGuidelinePos = (targetEl?: HTMLElement | null) => {
    const cell = targetEl ? (targetEl.closest("th") || targetEl.closest("td")) as HTMLElement | null : activeThRef.current;
    if (!cell || !tableContainerRef.current) return;
    activeThRef.current = cell;
    const containerRect = tableContainerRef.current.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const scrollLeft = tableContainerRef.current.scrollLeft;
    const x = cellRect.right - containerRect.left + scrollLeft;
    setGuidelineX(x);
  };

  const handleResizeStart = (e: React.MouseEvent, key: string, minWidth = 50) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = (e.currentTarget.closest("th") || e.currentTarget.closest("td")) as HTMLElement | null;
    activeThRef.current = cell;
    const startX = e.clientX;
    const startWidth = cell ? cell.offsetWidth : (colWidths[key] || minWidth);
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);
    updateGuidelinePos(e.currentTarget);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!resizingCol.current) return;
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - resizingCol.current.startX;
      const targetWidth = Math.max(minWidth, resizingCol.current.startWidth + deltaX);
      const activeKey = resizingCol.current.key;
      setColWidths(prev => ({ ...prev, [activeKey]: targetWidth }));
      if (activeThRef.current) {
        updateGuidelinePos(activeThRef.current);
      }
    };

    const handleMouseUp = () => {
      resizingCol.current = null;
      setResizingColKey(null);
      setGuidelineX(null);
      activeThRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // 최신 활동일자순 (날짜 내림차순 -> 생성일 내림차순) 정렬
  const sortedEvents = [...events].sort((a, b) => {
    const diff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  const fallbackEvent: AttendanceEvent = {
    id: "evt_fallback",
    title: "행사",
    type: "SESSION",
    status: "IN_PROGRESS",
    date: "2026-08-20",
    startTime: "14:00",
    endTime: "18:00",
    location: "-",
    description: "",
    allowExternal: false,
    checkinMethod: "CODE",
    checkinCode: "1234",
    customFields: [],
    targetTerms: [28],
    targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
    totalTargetCount: 0,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: "2026-08-20",
  };

  const selectedEvent = events.find(e => e.id === selectedEventId) || sortedEvents[0] || events[0] || fallbackEvent;
  const currentEventAttendees = attendees.filter(a => a.eventId === (selectedEvent?.id || ""));

  // Close dropdown when clicked outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
      if (breadcrumbDropdownRef.current && !breadcrumbDropdownRef.current.contains(e.target as Node)) {
        setIsBreadcrumbMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredDropdownEvents = sortedEvents.filter(e => {
    if (eventSearchQuery.trim()) {
      const q = eventSearchQuery.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q) || e.date.includes(q);
    }
    return true;
  });

  const filteredAttendees = currentEventAttendees.filter(a => {
    const rawText = [
      a.affiliation || "",
      a.isExternal ? "외부인 외부" : "부원 기수",
      ...Object.values(a.customAnswers || {})
    ].join(" ").toLowerCase();

    // 1. 기수 필터 (Term filter)
    if (termFilter !== "ALL") {
      const termMatch = (a.term && String(a.term) === termFilter) || (a.affiliation && a.affiliation.includes(`${termFilter}기`)) || rawText.includes(`${termFilter}기`);
      if (!termMatch) return false;
    }

    // 2. 트랙 및 구분 필터
    if (attendeeCategoryFilter === "ANALYSIS") {
      if (!rawText.includes("분석")) return false;
    } else if (attendeeCategoryFilter === "VISUALIZATION") {
      if (!rawText.includes("시각화") && !rawText.includes("시각")) return false;
    } else if (attendeeCategoryFilter === "ENGINEERING") {
      if (!rawText.includes("엔지") && !rawText.includes("개발")) return false;
    } else if (attendeeCategoryFilter === "EXTERNAL") {
      if (!a.isExternal && !rawText.includes("외") && !rawText.includes("게스트") && !rawText.includes("기업")) return false;
    }

    if (attendStatusFilter !== "ALL" && a.status !== attendStatusFilter) return false;
    if (attendeeSearch) {
      const q = attendeeSearch.toLowerCase();
      return a.name.toLowerCase().includes(q) || (a.affiliation && a.affiliation.toLowerCase().includes(q)) || (a.email && a.email.toLowerCase().includes(q)) || (a.phone && a.phone.includes(q)) || rawText.includes(q);
    }
    return true;
  });

  // Stats calculation
  const totalRosterCount = currentEventAttendees.length;
  const presentCount = currentEventAttendees.filter(a => a.status === "present").length;
  const lateCount = currentEventAttendees.filter(a => a.status === "late").length;
  const earlyLeaveCount = currentEventAttendees.filter(a => a.status === "earlyLeave").length;
  const absentCount = currentEventAttendees.filter(a => a.status === "absent").length;
  const excusedAbsentCount = currentEventAttendees.filter(a => a.status === "excusedAbsent").length;
  const unexcusedLateCount = currentEventAttendees.filter(a => a.status === "unexcusedLate").length;
  const unexcusedAbsentCount = currentEventAttendees.filter(a => a.status === "unexcusedAbsent").length;
  const unmarkedCount = currentEventAttendees.filter(a => a.status === "unmarked").length;

  const attendanceRate = totalRosterCount > 0 ? Math.round(((presentCount + lateCount + earlyLeaveCount) / totalRosterCount) * 100) : 0;
  const internalPresent = currentEventAttendees.filter(a => !a.isExternal && a.status === "present").length;
  const externalPresent = currentEventAttendees.filter(a => a.isExternal && a.status === "present").length;

  // ─── Keyboard Hotkeys (0: 출석, 1: 지각, 2: 조퇴, 3: 결석, 4: 인정결석, 5: 무단지각, 6: 무단결석, ↑/↓ 이동) ───
  useEffect(() => {
    if (subTab !== "live" || !isKeyboardModeActive || showImportModal || editingEvent || showQuickAddDrawer || isDropdownOpen || editingTemplate) return;

    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;

      if (filteredAttendees.length === 0) return;

      const currentTarget = filteredAttendees[focusedIndex];
      if (!currentTarget) return;

      if (e.key === "0") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "present");
      } else if (e.key === "1") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "late");
      } else if (e.key === "2") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "earlyLeave");
      } else if (e.key === "3") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "absent");
      } else if (e.key === "4") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "excusedAbsent");
      } else if (e.key === "5") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "unexcusedLate");
      } else if (e.key === "6") {
        e.preventDefault();
        changeStatusAndMoveNext(currentTarget.id, "unexcusedAbsent");
      } else if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredAttendees.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [subTab, isKeyboardModeActive, focusedIndex, filteredAttendees, showImportModal, editingEvent, showQuickAddDrawer, isDropdownOpen, editingTemplate]);

  function changeStatusAndMoveNext(attendeeId: string, status: AttendStatus) {
    const timeNow = new Date().toTimeString().slice(0, 5);
    setAttendees(prev => prev.map(a => a.id === attendeeId ? {
      ...a,
      status,
      checkedInAt: status === "present" || status === "late" || status === "unexcusedLate" ? (a.checkedInAt === "-" ? timeNow : a.checkedInAt) : "-"
    } : a));

    setFocusedIndex(prev => Math.min(prev + 1, filteredAttendees.length - 1));
  }

  function parseTextContent(text: string) {
    if (!text.trim()) {
      setParsedPreview([]);
      return;
    }

    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    const rawHeaderTokens = (lines[0].includes("\t") ? lines[0].split("\t") : lines[0].split(","))
      .map(t => t.trim().replace(/^"|"$/g, ""));
    
    const hasHeader = rawHeaderTokens.some(t =>
      t.includes("이름") || t.includes("성명") || t.toLowerCase().includes("name") ||
      t.includes("소속") || t.includes("전화") || t.includes("팀") || t.includes("구분") || t.includes("메일")
    );

    const headerMap: Record<number, string> = {};
    if (hasHeader) {
      rawHeaderTokens.forEach((t, i) => {
        headerMap[i] = t;
      });
    }

    const dataLines = hasHeader ? lines.slice(1) : lines;
    const parsed: {
      isExternal: boolean;
      name: string;
      affiliation: string;
      email: string;
      phone: string;
      term?: number;
      customAnswers: Record<string, string>;
    }[] = [];

    for (const rawLine of dataLines) {
      if (!rawLine.trim()) continue;
      const tokens = (rawLine.includes("\t") ? rawLine.split("\t") : rawLine.split(","))
        .map(t => t.trim().replace(/^"|"$/g, ""));

      if (tokens.length === 0 || !tokens[0]) continue;

      let name = "";
      let affiliation = selectedEvent.allowExternal ? "외부 참가자" : "BOAZ 28기";
      let email = "";
      let phone = "";
      let isExt = false;
      const customAnswers: Record<string, string> = {};

      const eventCols = selectedEvent.customFields || [];

      tokens.forEach((val, idx) => {
        if (!val) return;
        const colHeader = headerMap[idx] || (eventCols[idx] ? eventCols[idx].label : `col_${idx}`);
        
        customAnswers[colHeader] = val;

        const matchedField = eventCols.find(f =>
          f.label.toLowerCase() === colHeader.toLowerCase() || colHeader.includes(f.label) || f.label.includes(colHeader)
        );
        if (matchedField) {
          customAnswers[matchedField.id] = val;
          customAnswers[matchedField.label] = val;
        }

        if (colHeader === "이름" || colHeader.includes("이름") || colHeader.includes("성명") || colHeader.toLowerCase().includes("name")) {
          name = val;
        } else if (colHeader.includes("소속") || colHeader.includes("대학") || colHeader.includes("회사") || colHeader.includes("트랙")) {
          affiliation = val;
        } else if (colHeader.includes("메일") || colHeader.toLowerCase().includes("email")) {
          email = val;
        } else if (colHeader.includes("전화") || colHeader.includes("연락처") || colHeader.toLowerCase().includes("phone")) {
          phone = val;
        } else if (colHeader.includes("구분") || colHeader.includes("타입")) {
          isExt = val.includes("외") || val.toLowerCase().includes("ext");
        }
      });

      if (!name && tokens[0]) {
        name = tokens[0];
      }

      if (name) {
        if (!isExt && selectedEvent.allowExternal) {
          isExt = affiliation.includes("외") || affiliation.includes("카카오") || affiliation.includes("네이버") || affiliation.includes("기업") || !affiliation.includes("기");
        }
        parsed.push({ name, affiliation, email, phone, isExternal: isExt, customAnswers });
      }
    }

    setParsedPreview(parsed);
  }

  function handleCsvFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setPastedText(content);
        parseTextContent(content);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function handleDownloadSampleCsv() {
    const colHeaders = (selectedEvent.customFields || []).map(f => f.label);
    const headers = colHeaders.length > 0 ? colHeaders : ["이름", "소속", "연락처"];
    const sample1 = headers.map(h =>
      h === "이름" ? "홍길동" :
      h.includes("소속") ? "28기 분석" :
      h.includes("구분") ? "외부인" :
      h.includes("전화") || h.includes("연락처") ? "010-1234-5678" :
      h.includes("메일") ? "hong@kakao.com" : "예시데이터1"
    );
    const sample2 = headers.map(h =>
      h === "이름" ? "김철수" :
      h.includes("소속") ? "28기 엔지니어링" :
      h.includes("구분") ? "부원" :
      h.includes("전화") || h.includes("연락처") ? "010-9876-5432" :
      h.includes("메일") ? "cheolsu@snu.ac.kr" : "예시데이터2"
    );

    const sampleContent = "\uFEFF" + [headers.join(","), sample1.join(","), sample2.join(",")].join("\n") + "\n";
    const blob = new Blob([sampleContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `참가자명단_${selectedEvent.title}_샘플양식.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleApplyImportedRoster() {
    if (parsedPreview.length === 0) {
      alert("추가할 명단 데이터가 없습니다.");
      return;
    }

    const newRecords: AttendeeRecord[] = parsedPreview.map((item, idx) => ({
      id: `att_imp_${Date.now()}_${idx}`,
      eventId: selectedEvent.id,
      isExternal: item.isExternal,
      name: item.name,
      affiliation: item.affiliation,
      term: item.term,
      email: item.email,
      phone: item.phone,
      status: "unmarked",
      checkedInAt: "-",
      customAnswers: item.customAnswers || {},
    }));

    setAttendees(prev => [...newRecords, ...prev]);
    setShowImportModal(false);
    setPastedText("");
    setUploadedFileName("");
    setParsedPreview([]);
  }

  function handleImportBoazPool(termFilter?: number, trackFilter?: string) {
    let pool = BOAZ_MEMBER_POOL;
    if (termFilter) pool = pool.filter(m => m.term === termFilter);
    if (trackFilter) pool = pool.filter(m => m.track === trackFilter);

    const existingNames = new Set(currentEventAttendees.map(a => a.name));
    const toAdd = pool.filter(m => !existingNames.has(m.name));

    if (toAdd.length === 0) {
      alert("이미 해당 명단의 모든 부원이 등록되어 있습니다.");
      return;
    }

    const newRecords: AttendeeRecord[] = toAdd.map((m, idx) => ({
      id: `att_pool_${Date.now()}_${idx}`,
      eventId: selectedEvent.id,
      isExternal: false,
      name: m.name,
      affiliation: m.affiliation,
      term: m.term,
      email: m.email,
      phone: m.phone,
      status: "unmarked",
      checkedInAt: "-",
      customAnswers: {},
    }));

    setAttendees(prev => [...newRecords, ...prev]);
    setShowImportModal(false);
  }

  function handleQuickAddSubmit() {
    if (!quickAdd.name.trim()) { alert("이름을 입력하세요."); return; }

    const answers = { ...quickAdd.customAnswers };
    if (quickAdd.affiliation && !answers["소속"]) answers["소속"] = quickAdd.affiliation.trim();
    if (quickAdd.phone && !answers["연락처"]) answers["연락처"] = quickAdd.phone.trim();
    if (quickAdd.email && !answers["이메일"]) answers["이메일"] = quickAdd.email.trim();

    const newRec: AttendeeRecord = {
      id: `att_quick_${Date.now()}`,
      eventId: selectedEvent.id,
      isExternal: quickAdd.isExternal,
      name: quickAdd.name.trim(),
      affiliation: answers["소속"] || quickAdd.affiliation.trim() || (quickAdd.isExternal ? "외부 게스트" : "BOAZ 28기"),
      email: answers["이메일"] || quickAdd.email.trim(),
      phone: answers["연락처"] || quickAdd.phone.trim(),
      status: quickAdd.status,
      checkedInAt: quickAdd.status === "present" || quickAdd.status === "late" ? new Date().toTimeString().slice(0, 5) : "-",
      memo: quickAdd.memo?.trim() || "",
      customAnswers: answers,
    };

    setAttendees(prev => [newRec, ...prev]);
    setQuickAdd({
      isExternal: false,
      name: "",
      affiliation: "",
      email: "",
      phone: "",
      memo: "",
      status: "present",
      customAnswers: {},
    });
    setShowQuickAddDrawer(false);
  }

  function handleBatchSetStatus(status: AttendStatus) {
    const label = ATTEND_STATUS_CFG[status].label;
    if (confirm(`필터된 ${filteredAttendees.length}명을 모두 [${label}] 처리하시겠습니까?`)) {
      const ids = new Set(filteredAttendees.map(a => a.id));
      const timeNow = new Date().toTimeString().slice(0, 5);
      setAttendees(prev => prev.map(a => ids.has(a.id) ? {
        ...a,
        status,
        checkedInAt: status === "present" || status === "late" ? (a.checkedInAt === "-" ? timeNow : a.checkedInAt) : "-"
      } : a));
    }
  }

  // Simple comma-separated column input state (for extra columns)
  function handleAddCustomColumn(name: string) {
    const trimmed = name.trim();
    if (!trimmed || !editingEvent) return;
    if (trimmed === "이름" || trimmed === "출결" || trimmed === "비고" || trimmed === "출석 상태" || trimmed === "출석상태") return;
    const exists = (editingEvent.customFields || []).some(f => f.label === trimmed);
    if (exists) return;
    const newField: CustomFormField = {
      id: `cf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: trimmed,
      type: "TEXT",
      isRequired: false,
      target: "ALL",
    };
    setEditingEvent({
      ...editingEvent,
      customFields: [...(editingEvent.customFields || []), newField],
    });
    setNewColInputText("");
  }

  function handleRemoveCustomColumn(label: string) {
    if (!editingEvent) return;
    setEditingEvent({
      ...editingEvent,
      customFields: (editingEvent.customFields || []).filter(f => f.label !== label),
    });
  }

  function handleColDragStart(e: React.DragEvent, index: number) {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  }

  function handleColDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
      f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태"
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
    setEventModalType("CREATE_FULL");
    setNewColInputText("");
    setEditingEvent({
      id: "evt_" + Date.now(),
      title: "",
      type: "CONFERENCE",
      status: "UPCOMING",
      date: new Date().toISOString().slice(0, 10),
      startTime: "14:00",
      endTime: "18:00",
      location: "",
      description: "",
      allowExternal: true,
      checkinMethod: "QR_CODE",
      checkinCode: String(Math.floor(1000 + Math.random() * 9000)),
      targetTerms: [28],
      targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
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
    setEventModalType("COLUMNS_ONLY");
    setNewColInputText("");
    const extraCols = (e.customFields || []).filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태");
    setEditingEvent({ ...e, customFields: [...extraCols] });
  }

  // 2. 전체 행사 목록 화면 톱니바퀴 -> 행사 기본 정보 수정만 오픈
  function handleOpenBasicInfoSettings(e: AttendanceEvent) {
    setIsNewEvent(false);
    setEventModalType("BASIC_INFO");
    setEditingEvent({ ...e });
  }

  function handleSaveEvent() {
    if (!editingEvent) return;
    if (eventModalType !== "COLUMNS_ONLY" && !editingEvent.title.trim()) {
      alert("행사명을 입력하세요.");
      return;
    }

    if (isNewEvent) {
      setEvents(prev => [editingEvent, ...prev]);
      setSelectedEventId(editingEvent.id);
    } else {
      setEvents(prev => prev.map(e => e.id === editingEvent.id ? editingEvent : e));
    }
    setEditingEvent(null);
  }

  function handleDeleteEvent(evtId: string, title: string) {
    if (confirm(`'${title}' 행사를 삭제하시겠습니까?\n해당 행사의 출석 명단 데이터도 함께 삭제됩니다.`)) {
      setEvents(prev => prev.filter(e => e.id !== evtId));
      setAttendees(prev => prev.filter(a => a.eventId !== evtId));
      if (selectedEventId === evtId) {
        const remaining = events.filter(e => e.id !== evtId);
        if (remaining.length > 0) {
          setSelectedEventId(remaining[0].id);
        }
      }
    }
  }

  function handleExportEventCsv(evt: AttendanceEvent) {
    const evtAttendees = attendees.filter(a => a.eventId === evt.id);
    const extraHeaders = (evt.customFields || [])
      .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
      .map(f => f.label);
    const headers = ["번호", "이름", ...extraHeaders, "출석코드(0,1,2)", "출석상태", "비고"];
    const rows = evtAttendees.map((a, idx) => {
      const extraVals = extraHeaders.map(h =>
        a.customAnswers?.[h] ||
        (h.includes("소속") ? a.affiliation :
         h.includes("구분") ? (a.isExternal ? "외부인" : "부원") :
         h.includes("전화") || h.includes("연락처") ? a.phone :
         h.includes("메일") ? a.email : "") || "-"
      );
      return [
        idx + 1,
        a.name,
        ...extraVals,
        ATTEND_STATUS_CFG[a.status]?.code || "-",
        ATTEND_STATUS_CFG[a.status]?.label || "미체크",
        a.memo || "-",
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
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
      id: "tmpl_" + Date.now(),
      title: "새 출석 양식 템플릿",
      type: "SESSION",
      description: "운영 목적에 맞춘 출석 체크 및 추가 확인 항목 양식",
      allowExternal: false,
      defaultCheckinMethod: "QR_CODE",
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [
        { id: "f_" + Date.now(), label: "과제 제출 여부", type: "SELECT", options: ["제출 완료", "미제출"], isRequired: true, target: "ALL" }
      ],
    });
  }

  function handleSaveTemplate() {
    if (!editingTemplate) return;
    if (!editingTemplate.title.trim()) { alert("양식명을 입력하세요."); return; }

    if (isNewTemplate) {
      setTemplates(prev => [...prev, editingTemplate]);
    } else {
      setTemplates(prev => prev.map(t => t.id === editingTemplate.id ? editingTemplate : t));
    }
    setEditingTemplate(null);
  }

  function handleDeleteTemplate(tmplId: string, title: string) {
    if (confirm(`'${title}' 양식 템플릿을 삭제하시겠습니까?`)) {
      setTemplates(prev => prev.filter(t => t.id !== tmplId));
    }
  }

  function handleCreateEventFromTemplate(tmpl: FormTemplate) {
    setIsNewEvent(true);
    setEditingEvent({
      id: "evt_" + Date.now(),
      title: `${tmpl.title.replace(" 템플릿", "").replace(" 양식", "")} (${new Date().toISOString().slice(5, 10)})`,
      type: tmpl.type,
      status: "UPCOMING",
      date: new Date().toISOString().slice(0, 10),
      startTime: "14:00",
      endTime: "18:00",
      location: "동아리 지정 세미나실",
      description: tmpl.description,
      allowExternal: tmpl.allowExternal,
      checkinMethod: tmpl.defaultCheckinMethod,
      checkinCode: String(Math.floor(1000 + Math.random() * 9000)),
      targetTerms: [28],
      targetTracks: ["ANALYSIS", "ENGINEERING", "VISUALIZATION"],
      totalTargetCount: 50,
      internalAttendedCount: 0,
      externalAttendedCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
      customFields: [...tmpl.customFields],
    });
  }

  const selectedTypeMeta = EVENT_TYPE_META[selectedEvent.type];

  return (
    <div className="space-y-5 w-full" style={{ fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif" }}>
      {/* ─── 1. Top Breadcrumb & Navigation Bar ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
        {/* Breadcrumb Hierarchy - Standardized matching all pages */}
        <div className="flex items-center gap-2.5">
          {subTab === "events" ? (
            <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
              행사 전체 목록
            </h2>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSubTab("events")}
                className="text-slate-500 hover:text-slate-900 font-bold transition-colors cursor-pointer text-lg sm:text-xl tracking-tight"
              >
                행사 전체 목록
              </button>

              <span className="text-slate-300 font-bold text-base">/</span>

              {/* Click-Only Event Switcher Popover */}
              <div className="relative" ref={breadcrumbDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBreadcrumbMenuOpen(prev => !prev)}
                  className="font-black text-slate-950 hover:text-slate-700 flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-lg sm:text-xl tracking-tight group"
                >
                  <span className="max-w-[320px] sm:max-w-[450px] truncate">{selectedEvent.title}</span>
                  <ChevronDown
                    size={16}
                    className={`text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
                      isBreadcrumbMenuOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Popover Dropdown Menu */}
                {isBreadcrumbMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {sortedEvents.map(evt => {
                        const isCur = evt.id === selectedEvent.id;

                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setSelectedEventId(evt.id);
                              setFocusedIndex(0);
                              setIsBreadcrumbMenuOpen(false);
                            }}
                            className={`px-3.5 py-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                              isCur ? "bg-slate-100 font-bold" : "hover:bg-slate-50"
                            }`}
                          >
                            <p className={`text-sm truncate min-w-0 ${isCur ? "text-slate-950 font-bold" : "text-slate-700 font-medium"}`}>
                              {evt.title}
                            </p>
                            <span className="text-[11px] font-mono text-slate-400 shrink-0 font-medium">{evt.date}</span>
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
          {subTab === "live" && (
            <>
              {/* CSV 일괄 등록 버튼 */}
              <button
                type="button"
                onClick={() => setShowImportModal(true)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              >
                <Upload size={13} className="text-slate-500" />
                <span>CSV 일괄 등록</span>
              </button>

              {/* CSV 저장 버튼 */}
              <button
                type="button"
                onClick={handleExportCsv}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
                title="현재 행사 출석부 CSV 다운로드"
              >
                <Download size={13} className="text-slate-500" />
                <span>CSV 저장</span>
              </button>
            </>
          )}

          <button
            onClick={handleOpenNewEvent}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>새 행사 생성하기</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: 현장 출석 체크 ─── */}
      {subTab === "live" && (
        <div className="space-y-4">
          {/* Clean Inline Stats Text */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 py-1 px-1 text-xs text-slate-500 flex-wrap border-b border-slate-100 pb-3 font-medium">
            <div className="flex items-center gap-1">
              <span>총 등록</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{totalRosterCount}명</span>
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
              <span className="font-bold text-slate-900 font-mono text-sm">{earlyLeaveCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{absentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>인정결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{excusedAbsentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>무단지각</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{unexcusedLateCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1">
              <span>무단결석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{unexcusedAbsentCount}명</span>
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
                  onChange={e => {
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
                <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>

              {/* 출결 상태 필터 드롭다운 (기수 바로 옆 배치) */}
              <div className="relative">
                <select
                  value={attendStatusFilter}
                  onChange={e => {
                    setAttendStatusFilter(e.target.value as "ALL" | AttendStatus);
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
                  <option value="unmarked">미체크</option>
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
              </div>

              {/* 트랙 및 구분 필터 캡슐 */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
                {(["ALL", "ANALYSIS", "VISUALIZATION", "ENGINEERING", "EXTERNAL"] as const).map(cat => {
                  const labelMap: Record<string, string> = {
                    ALL: "전체",
                    ANALYSIS: "분석",
                    VISUALIZATION: "시각화",
                    ENGINEERING: "엔지",
                    EXTERNAL: "외부",
                  };
                  return (
                    <button
                      key={cat}
                      onClick={() => { setAttendeeCategoryFilter(cat); setFocusedIndex(0); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                        attendeeCategoryFilter === cat
                          ? "bg-white text-slate-900 shadow-2xs font-semibold"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      {labelMap[cat]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* + 1명 현장 추가 버튼 */}
              <button
                type="button"
                onClick={() => setShowQuickAddDrawer(true)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <UserPlus size={13} className="text-slate-500" />
                <span>+ 1명 현장 추가</span>
              </button>

              {/* 수정 모드 전환 버튼 (고정 너비/높이로 상태 전환 시 크기 완벽 일치) */}
              <button
                type="button"
                onClick={() => {
                  setIsTableEditMode(prev => !prev);
                  setEditingRowId(null);
                }}
                className={`h-8 min-w-[124px] px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  isTableEditMode
                    ? "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                    : "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs"
                }`}
              >
                {isTableEditMode ? (
                  <>
                    <Check size={13} />
                    <span>수정 완료</span>
                  </>
                ) : (
                  <>
                    <Edit3 size={13} className="text-slate-500" />
                    <span>명단/비고 수정</span>
                  </>
                )}
              </button>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={attendeeSearch}
                  onChange={e => { setAttendeeSearch(e.target.value); setFocusedIndex(0); }}
                  placeholder="참가자 검색..."
                  className="h-8 pl-7 pr-3 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none w-40 font-mono shadow-2xs focus:border-slate-400"
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
                  {(selectedEvent.customFields || [])
                    .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
                    .map(cf => (
                      <col key={cf.id} style={{ width: `${colWidths[`custom_${cf.id}`] || 140}px` }} />
                    ))}
                  <col style={{ width: `${colWidths.status || 400}px` }} />
                  <col style={{ width: `${colWidths.memo || 240}px`, minWidth: "220px" }} />
                  <col style={{ width: "80px", minWidth: "80px", maxWidth: "80px" }} />
                </colgroup>
                <thead className="bg-slate-50/80 select-none">
                  <tr className="border-b border-slate-200/70 divide-x divide-slate-200/70 text-slate-700 font-semibold text-[11px] whitespace-nowrap">
                    <th style={{ width: `${colWidths.index || 48}px`, minWidth: "48px" }} className="relative text-center px-2 py-2.5 text-slate-400 font-bold">
                      #
                      <div
                        onMouseDown={e => handleResizeStart(e, "index", 40)}
                        onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("index"); updateGuidelinePos(e.currentTarget); } }}
                        onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                        className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                        title="열 너비 조절"
                      />
                    </th>
                    <th style={{ width: `${colWidths.name || 130}px`, minWidth: "110px" }} className="relative text-center px-2 py-2.5 text-slate-900 font-bold">
                      이름
                      <div
                        onMouseDown={e => handleResizeStart(e, "name", 70)}
                        onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("name"); updateGuidelinePos(e.currentTarget); } }}
                        onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                        className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                        title="열 너비 조절"
                      />
                    </th>
                    {(selectedEvent.customFields || [])
                      .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
                      .map(cf => {
                        const colKey = `custom_${cf.id}`;
                        return (
                          <th
                            key={cf.id}
                            style={{ width: `${colWidths[colKey] || 140}px`, minWidth: "120px" }}
                            className="relative text-center px-2 py-2.5 text-slate-800 font-bold"
                          >
                            {cf.label}
                            <div
                              onMouseDown={e => handleResizeStart(e, colKey, 70)}
                              onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol(colKey); updateGuidelinePos(e.currentTarget); } }}
                              onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                        );
                      })}
                    <th style={{ width: `${colWidths.status || 400}px`, minWidth: "395px" }} className="relative text-center px-2 py-2.5 text-slate-900 font-bold">
                      출결
                      <div
                        onMouseDown={e => handleResizeStart(e, "status", 395)}
                        onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("status"); updateGuidelinePos(e.currentTarget); } }}
                        onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                        className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                        title="열 너비 조절"
                      />
                    </th>
                    <th style={{ width: `${colWidths.memo || 240}px`, minWidth: "220px" }} className="relative text-center px-3 py-2.5 text-slate-700 font-semibold">
                      비고
                    </th>
                    {/* Fixed Sticky Right Action Column */}
                    <th style={{ width: "80px", minWidth: "80px", maxWidth: "80px" }} className="sticky right-0 top-0 bg-slate-50 z-20 px-2 py-3 w-20 min-w-[80px] max-w-[80px] text-center select-none border-l border-slate-200 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]">
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
                      <td colSpan={5 + (selectedEvent.customFields?.length || 0)} className="py-16 text-center text-slate-500 space-y-2">
                        <UserCheck size={32} className="mx-auto text-slate-300 mb-1" />
                        <p className="font-bold text-slate-800 text-sm">해당 조건의 참가자가 없습니다.</p>
                        <p className="text-xs">상단의 <strong>[CSV 일괄 등록]</strong>으로 명단을 등록하거나 검색 조건을 변경하세요.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((att, idx) => {
                      const extraCols = (selectedEvent.customFields || [])
                        .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태");
                      const isRowEditing = isTableEditMode || editingRowId === att.id;

                      return (
                        <tr
                          key={att.id}
                          className={`transition-colors divide-x divide-slate-200/70 ${
                            isRowEditing
                              ? "bg-slate-50/90"
                              : "hover:bg-slate-50/60"
                          }`}
                        >
                          <td className="relative text-center px-3 py-2 h-[50px] text-slate-400 text-xs">
                            <div className="h-8 flex items-center justify-center">{idx + 1}</div>
                            <div
                              onMouseDown={e => handleResizeStart(e, "index", 40)}
                              onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("index"); updateGuidelinePos(e.currentTarget); } }}
                              onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>

                          {/* Default Fixed Column: 이름 */}
                          <td className="relative text-center px-2 py-1.5 h-[50px] text-slate-900 font-sans" onClick={e => e.stopPropagation()}>
                            {isRowEditing ? (
                              <input
                                value={att.name}
                                onChange={e => {
                                  const newVal = e.target.value;
                                  setAttendees(prev => prev.map(a => a.id === att.id ? { ...a, name: newVal } : a));
                                }}
                                placeholder="이름"
                                className="w-full text-center h-8 px-2.5 text-xs font-bold rounded-lg outline-none bg-white border border-slate-400 focus:border-slate-900 text-slate-900 font-sans placeholder:text-slate-400 shadow-2xs"
                              />
                            ) : (
                              <div className="w-full h-8 px-2.5 border border-transparent flex items-center justify-center text-xs font-bold text-slate-900 truncate font-sans">
                                {att.name || "-"}
                              </div>
                            )}
                            <div
                              onMouseDown={e => handleResizeStart(e, "name", 70)}
                              onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("name"); updateGuidelinePos(e.currentTarget); } }}
                              onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>

                          {/* Dynamic Extra User-Defined Columns */}
                          {extraCols.map(cf => {
                            const val = getAttendeeFieldValue(att, cf.label, cf.id);
                            const colKey = `custom_${cf.id}`;

                            return (
                              <td key={cf.id} className="relative text-center px-2 py-1.5 h-[50px] text-slate-700 font-sans" onClick={e => e.stopPropagation()}>
                                {isRowEditing ? (
                                  <input
                                    value={val}
                                    onChange={e => {
                                      const newVal = e.target.value;
                                      setAttendees(prev => prev.map(a => a.id === att.id ? {
                                        ...a,
                                        affiliation: cf.label.includes("소속") ? newVal : a.affiliation,
                                        phone: (cf.label.includes("전화") || cf.label.includes("연락처")) ? newVal : a.phone,
                                        email: cf.label.includes("메일") ? newVal : a.email,
                                        isExternal: cf.label.includes("구분") ? newVal.includes("외") : a.isExternal,
                                        customAnswers: { ...(a.customAnswers || {}), [cf.id]: newVal, [cf.label]: newVal }
                                      } : a));
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
                                  onMouseDown={e => handleResizeStart(e, colKey, 70)}
                                  onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol(colKey); updateGuidelinePos(e.currentTarget); } }}
                                  onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                                  className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                                  title="열 너비 조절"
                                />
                              </td>
                            );
                          })}

                          {/* Action Buttons: 7-Button Capsule Group */}
                          <td className="relative text-center px-2 py-1.5 h-[50px]">
                            <div className="h-8 flex items-center justify-center font-sans">
                              <div className="grid grid-cols-7 w-[390px] shrink-0 p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                {(["present", "late", "earlyLeave", "absent", "excusedAbsent", "unexcusedLate", "unexcusedAbsent"] as AttendStatus[]).map(st => {
                                  const isCurrent = att.status === st;
                                  const label = ATTEND_STATUS_CFG[st]?.label || "";
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
                                          ? styleCfg?.active || ""
                                          : styleCfg?.inactive || ""
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div
                              onMouseDown={e => handleResizeStart(e, "status", 395)}
                              onMouseEnter={e => { if (!resizingColKey) { setActiveHoverCol("status"); updateGuidelinePos(e.currentTarget); } }}
                              onMouseLeave={() => { if (!resizingColKey) { setActiveHoverCol(null); setGuidelineX(null); } }}
                              className="absolute -right-2 top-0 bottom-0 w-4 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </td>

                          {/* Remarks / Memo Input */}
                          <td className="relative text-center px-3 py-2 h-[50px]" onClick={e => e.stopPropagation()}>
                            {isRowEditing ? (
                              <input
                                value={att.memo || ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  setAttendees(prev => prev.map(a => a.id === att.id ? { ...a, memo: val } : a));
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
                          <td className="sticky right-0 bg-white group-hover:bg-slate-50 transition-colors z-10 w-20 min-w-[80px] max-w-[80px] px-2 py-2 h-[50px] font-sans text-center border-l border-slate-200 shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.08)]" onClick={e => e.stopPropagation()}>
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
                                    className="w-7 h-7 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50 flex items-center justify-center transition-colors cursor-pointer"
                                    title="수정"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`[${att.name || "참가자"}] 님을 명단에서 삭제하시겠습니까?`)) {
                                    setAttendees(prev => prev.filter(a => a.id !== att.id));
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
      {subTab === "events" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            행사를 선택하면 해당 행사의 출석 명단과 집계 현황으로 즉시 이동합니다.
          </p>

          <div className="grid grid-cols-1 gap-3.5">
            {sortedEvents.map(evt => {
              const typeMeta = EVENT_TYPE_META[evt.type];
              const statusMeta = STATUS_CFG[evt.status];
              const evtAttendees = attendees.filter(a => a.eventId === evt.id);
              const present = evtAttendees.filter(a => a.status === "present").length;
              const isCurrent = evt.id === selectedEvent.id;

              return (
                <div
                  key={evt.id}
                  onClick={() => {
                    setSelectedEventId(evt.id);
                    setSubTab("live");
                  }}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white hover:border-orange-500 hover:shadow-xs px-6 py-5 transition-all cursor-pointer group"
                >
                  <div className="space-y-1 min-w-0 flex-1 pr-4">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors truncate">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {evt.date}{evt.location ? ` · ${evt.location}` : ""}
                    </p>
                  </div>

                  {/* 액션 아이콘들 (다운로드 -> 톱니바퀴 -> 휴지통) */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* 1. 다운로드 (CSV 저장) */}
                    <button
                      type="button"
                      onClick={() => handleExportEventCsv(evt)}
                      className="p-2.5 rounded-xl text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-all cursor-pointer"
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
                      <Settings size={20} className="group-hover/btn:rotate-45 transition-transform duration-200" />
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
      {subTab === "forms" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">출석 양식 템플릿 관리</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                운영지원팀의 용도에 맞게 출석 양식 템플릿과 추가 수집 항목(커스텀 필드)을 생성, 수정, 삭제합니다.
              </p>
            </div>

            <button
              onClick={handleOpenCreateTemplate}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
            >
              <Plus size={14} />
              <span>+ 새 양식 템플릿 생성</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {templates.map(tmpl => {
              const typeMeta = EVENT_TYPE_META[tmpl.type];
              return (
                <div key={tmpl.id} className="p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-4 flex flex-col justify-between hover:border-slate-300 transition-all">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold border font-mono" style={{ background: typeMeta.bg, color: typeMeta.color, borderColor: typeMeta.border }}>
                          {typeMeta.label}
                        </span>
                        {tmpl.allowExternal ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            외부인 허용
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
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
                              customFields: tmpl.customFields.map(f => ({ ...f, options: f.options ? [...f.options] : [] }))
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
                      <p className="text-xs text-slate-500 leading-relaxed mt-1">{tmpl.description}</p>
                    </div>

                    {/* Custom Fields Summary */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                      <span className="text-[11px] font-bold text-slate-600">추가 입력 항목 ({tmpl.customFields.length}개):</span>
                      {tmpl.customFields.length === 0 ? (
                        <p className="text-[11px] text-slate-400">기본 인적사항만 수집</p>
                      ) : (
                        <div className="space-y-1">
                          {tmpl.customFields.map(f => (
                            <div key={f.id} className="flex items-center justify-between text-[11px] text-slate-700 font-mono">
                              <span>• {f.label}</span>
                              <span className="text-slate-400 text-[10px] font-sans">
                                [{f.type === "SELECT" ? "선택형" : "텍스트"}] {f.isRequired && <strong className="text-red-500">필수</strong>}
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
      {subTab === "stats" && (
        <div className="space-y-5">
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-[0_1px_3px_rgba(0,0,0,0.03)] space-y-5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedEvent.title} 통계</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedEvent.date} · 총 {totalRosterCount}명 등록</p>
              </div>
              <button
                onClick={handleExportCsv}
                className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
              >
                <Download size={13} />
                <span>출석부 CSV 다운로드</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">전체 출석률</p>
                <p className="text-3xl font-bold font-mono text-emerald-600 mt-1">{attendanceRate}%</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{presentCount + lateCount}명 참석 / {totalRosterCount}명</p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">정상 출석 / 지각 / 결석</p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  <span className="text-emerald-600">{presentCount}</span> / <span className="text-amber-600">{lateCount}</span> / <span className="text-red-600">{absentCount}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">미체크 {unmarkedCount}명</p>
              </div>

              <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200">
                <p className="text-slate-500 text-xs font-medium">외부인 참석자 수</p>
                <p className="text-3xl font-bold font-mono text-purple-600 mt-1">{externalPresent}명</p>
                <p className="text-[11px] text-slate-400 mt-0.5">게스트 체크인 완료</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Drawer: + 1명 현장 빠른 추가 ─── */}
      {showQuickAddDrawer && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <UserPlus size={15} className="text-slate-700" />
                <span>현장 1명 추가</span>
                <span className="text-xs font-normal text-slate-400 font-sans">({selectedEvent.title})</span>
              </h3>
              <button onClick={() => setShowQuickAddDrawer(false)} className="text-slate-400 hover:text-slate-700 p-1 rounded-md hover:bg-slate-100 transition-colors cursor-pointer">
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
                      onChange={e => setQuickAdd(prev => ({ ...prev, isExternal: e.target.checked }))}
                      className="w-3.5 h-3.5 rounded text-slate-900 border-slate-300 focus:ring-slate-900 accent-slate-900 cursor-pointer"
                    />
                    <span>외부인 (게스트)</span>
                  </label>
                </div>
                <input
                  value={quickAdd.name}
                  onChange={e => setQuickAdd(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="예: 홍길동"
                  className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-900 font-semibold outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900/10 placeholder:text-slate-400 shadow-2xs"
                />
              </div>

              {/* 현재 표에 설정된 추가 컬럼들에 맞춰 동적으로 입력창 표시 (설정된 컬럼만 정확히 노출) */}
              {(selectedEvent.customFields || [])
                .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
                .map(cf => {
                  const currentVal = quickAdd.customAnswers[cf.label] ?? quickAdd.customAnswers[cf.id] ?? (
                    cf.label.includes("소속") ? quickAdd.affiliation :
                    cf.label.includes("전화") || cf.label.includes("연락처") ? quickAdd.phone :
                    cf.label.includes("메일") ? quickAdd.email : ""
                  );

                  return (
                    <div key={cf.id}>
                      <label className="text-slate-700 block mb-1.5 font-semibold">{cf.label}</label>
                      <input
                        value={currentVal}
                        onChange={e => {
                          const val = e.target.value;
                          setQuickAdd(prev => ({
                            ...prev,
                            affiliation: cf.label.includes("소속") ? val : prev.affiliation,
                            phone: (cf.label.includes("전화") || cf.label.includes("연락처")) ? val : prev.phone,
                            email: cf.label.includes("메일") ? val : prev.email,
                            customAnswers: { ...prev.customAnswers, [cf.label]: val, [cf.id]: val }
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
                  {(["present", "late", "earlyLeave", "absent", "excusedAbsent", "unexcusedLate", "unexcusedAbsent"] as AttendStatus[]).map(st => {
                    const cfg = ATTEND_STATUS_CFG[st];
                    const isSelected = quickAdd.status === st;
                    const styleCfg = ATTEND_STATUS_STYLES[st];

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setQuickAdd(prev => ({ ...prev, status: st }))}
                        className={`h-7.5 w-full flex items-center justify-center rounded-md text-xs transition-all cursor-pointer ${
                          isSelected
                            ? styleCfg.active
                            : styleCfg.inactive
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
                  onChange={e => setQuickAdd(prev => ({ ...prev, memo: e.target.value }))}
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
                className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
              >
                추가 및 출석 처리
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 사전 참가자 명단 CSV 업로드 / 엑셀 붙여넣기 ─── */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Upload size={16} className="text-blue-600" />
                  <span>참가자 명단 넣기</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  대상: <strong className="text-orange-600">{selectedEvent.title}</strong>
                </p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="flex rounded-xl bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setImportTab("CSV_FILE")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${importTab === "CSV_FILE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
              >
                <FileUp size={13} />
                <span>CSV 파일 업로드</span>
              </button>
              <button
                onClick={() => setImportTab("PASTE")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${importTab === "PASTE" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
              >
                <Copy size={13} />
                <span>엑셀 복사-붙여넣기</span>
              </button>
              <button
                onClick={() => setImportTab("BOAZ_POOL")}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${importTab === "BOAZ_POOL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"}`}
              >
                <Users size={13} />
                <span>부원 불러오기</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
              {importTab === "CSV_FILE" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">CSV 명단 파일 첨부</span>
                    <button
                      onClick={handleDownloadSampleCsv}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer font-medium"
                    >
                      <Download size={11} /> 샘플 양식 받기
                    </button>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 hover:border-blue-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-slate-50 hover:bg-blue-50/20 space-y-1.5"
                  >
                    <FileUp size={24} className="mx-auto text-blue-600" />
                    <p className="font-bold text-slate-900 text-xs">
                      {uploadedFileName ? `선택됨: ${uploadedFileName}` : "클릭하여 CSV 파일 선택"}
                    </p>
                    <p className="text-[10px] text-slate-500">열: 이름, 소속, 이메일, 전화번호, 구분</p>
                  </div>
                </div>
              )}

              {importTab === "PASTE" && (
                <div className="space-y-2">
                  <p className="text-slate-500 text-[11px]">엑셀에서 복사한 텍스트를 붙여넣으세요 (Ctrl+V):</p>
                  <textarea
                    rows={5}
                    value={pastedText}
                    onChange={e => {
                      setPastedText(e.target.value);
                      parseTextContent(e.target.value);
                    }}
                    placeholder={`홍길동\t카카오\thong@kakao.com\t010-1234-5678\n김철수\t연세대학교\tcheol@yonsei.ac.kr\t010-9876-5432`}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono text-xs outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {importTab === "BOAZ_POOL" && (
                <div className="space-y-2">
                  <p className="text-slate-500 text-[11px]">동아리 정규 부원 명단을 원클릭으로 추가합니다:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleImportBoazPool(28)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-0.5 cursor-pointer transition-all"
                    >
                      <p className="font-bold text-slate-900 text-xs">제28기 정회원 전체</p>
                      <p className="text-[10px] text-slate-500">분석, 엔지니어링, 시각화</p>
                    </button>

                    <button
                      onClick={() => handleImportBoazPool(27)}
                      className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-0.5 cursor-pointer transition-all"
                    >
                      <p className="font-bold text-slate-900 text-xs">제27기 수료/정회원</p>
                      <p className="text-[10px] text-slate-500">선배 기수 명단</p>
                    </button>
                  </div>
                </div>
              )}

              {parsedPreview.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-100">
                  <p className="font-bold text-emerald-600 text-xs">
                    {parsedPreview.length}명 인식 완료 (미리보기):
                  </p>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 text-[11px]">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-600 bg-slate-100">
                          <th className="text-left px-2 py-1">이름</th>
                          <th className="text-left px-2 py-1">소속</th>
                          <th className="text-left px-2 py-1">연락처</th>
                          {(selectedEvent.customFields || []).map(cf => (
                            <th key={cf.id} className="text-left px-2 py-1 text-orange-800 bg-orange-100/70 font-bold">{cf.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 font-mono">
                        {parsedPreview.map((item, i) => (
                          <tr key={i}>
                            <td className="px-2 py-1 font-bold text-slate-900 font-sans">{item.name}</td>
                            <td className="px-2 py-1 text-slate-600 font-sans">{item.affiliation}</td>
                            <td className="px-2 py-1 text-slate-500">{item.phone || "-"}</td>
                            {(selectedEvent.customFields || []).map(cf => (
                              <td key={cf.id} className="px-2 py-1 text-slate-700 font-sans bg-orange-50/40 font-medium">
                                {item.customAnswers?.[cf.id] || item.customAnswers?.[cf.label] || "-"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 bg-slate-100 cursor-pointer"
              >
                취소
              </button>
              {(importTab === "CSV_FILE" || importTab === "PASTE") && (
                <button
                  onClick={handleApplyImportedRoster}
                  disabled={parsedPreview.length === 0}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs cursor-pointer ${
                    parsedPreview.length > 0 ? "bg-blue-600 hover:bg-blue-700" : "bg-slate-200 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  {parsedPreview.length}명 명단 추가하기
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 새 행사 / 출석 양식 등록 & 수정 (표 형식 / 컬럼 지정 포함) ─── */}
      {editingEvent && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4 overflow-hidden">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {eventModalType === "COLUMNS_ONLY"
                    ? "출석 명단 표 컬럼 설정"
                    : eventModalType === "BASIC_INFO"
                    ? "행사 기본 정보 수정"
                    : "새 행사 등록"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {eventModalType === "COLUMNS_ONLY"
                    ? `대상: ${editingEvent.title || selectedEvent.title}`
                    : eventModalType === "BASIC_INFO"
                    ? "행사명, 일자, 장소 등 기본 정보를 수정합니다."
                    : "새로운 행사의 기본 정보와 출석 명단 컬럼을 설정합니다."}
                </p>
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
              {(eventModalType === "BASIC_INFO" || eventModalType === "CREATE_FULL") && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">행사명 *</label>
                    <input
                      value={editingEvent.title}
                      onChange={e => setEditingEvent(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                      placeholder="예: BOAZ 제28기 Big Data Conference"
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">일자</label>
                      <input
                        type="date"
                        value={editingEvent.date}
                        onChange={e => setEditingEvent(prev => prev ? ({ ...prev, date: e.target.value }) : null)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-700 block mb-1">장소</label>
                      <input
                        value={editingEvent.location}
                        onChange={e => setEditingEvent(prev => prev ? ({ ...prev, location: e.target.value }) : null)}
                        placeholder="예: 서울대학교 글로벌공학센터"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none focus:bg-white focus:border-slate-400 focus:ring-1 focus:ring-slate-200 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. 출석 명단 표 컬럼 설정 섹션 (COLUMNS_ONLY 또는 CREATE_FULL) */}
              {(eventModalType === "COLUMNS_ONLY" || eventModalType === "CREATE_FULL") && (
                <div className="space-y-4 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5">컬럼 추가</label>
                    <div className="flex gap-2">
                      <input
                        value={newColInputText}
                        onChange={e => setNewColInputText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
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
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all cursor-pointer shrink-0 shadow-2xs"
                      >
                        + 추가
                      </button>
                    </div>

                    {/* 현재 추가된 컬럼 태그 목록 (드래그하여 순서 변경 가능) */}
                    {(() => {
                      const validFields = (editingEvent.customFields || []).filter(
                        f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태"
                      );
                      if (validFields.length === 0) return null;

                      return (
                        <div className="space-y-1.5 pt-2.5">
                          <div
                            className="flex flex-wrap items-center gap-1.5 min-h-[38px] p-2 rounded-xl bg-slate-50 border border-slate-200/80"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => {
                              if (dropIndicatorIdx !== null) handleColDrop(e, dropIndicatorIdx);
                            }}
                          >
                            {validFields.map((f, idx) => {
                              const isDragging = draggedColIdx === idx;
                              const showBeforeIndicator = draggedColIdx !== null && dropIndicatorIdx === idx;
                              const showAfterIndicator =
                                draggedColIdx !== null && idx === validFields.length - 1 && dropIndicatorIdx === validFields.length;

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
                                    onDragStart={e => handleColDragStart(e, idx)}
                                    onDragOver={e => handleColDragOver(e, idx)}
                                    onDrop={e => {
                                      e.stopPropagation();
                                      if (dropIndicatorIdx !== null) handleColDrop(e, dropIndicatorIdx);
                                    }}
                                    onDragEnd={handleColDragEnd}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all select-none cursor-grab active:cursor-grabbing ${
                                      isDragging
                                        ? "opacity-25 border-dashed border-slate-400 bg-slate-200"
                                        : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs"
                                    }`}
                                    title="드래그하여 순서를 변경할 수 있습니다"
                                  >
                                    <GripVertical size={13} className="text-slate-400 -ml-0.5 shrink-0" />
                                    <span>{f.label}</span>
                                    <button
                                      type="button"
                                      onClick={e => {
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
                              .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
                              .map(cf => (
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
                              .filter(f => f.label !== "이름" && f.label !== "비고" && f.label !== "출석 상태" && f.label !== "출석상태")
                              .map(cf => (
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
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs transition-all active:scale-[0.98]"
              >
                {isNewEvent
                  ? "행사 생성하기"
                  : eventModalType === "COLUMNS_ONLY"
                  ? "컬럼 설정 저장"
                  : "행사 정보 저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 양식 템플릿 생성 / 수정 ─── */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-slate-900/40 z-60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 bg-white border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {isNewTemplate ? "새 출석 양식 템플릿 생성" : "출석 양식 템플릿 수정"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  행사 특성에 맞추어 외부인 허용 여부와 수집할 추가 질문 항목을 정의합니다.
                </p>
              </div>
              <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">양식명 *</label>
                  <input
                    value={editingTemplate.title}
                    onChange={e => setEditingTemplate(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                    placeholder="예: 28기 빅콘 출석 양식"
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 font-bold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">행사 유형</label>
                  <select
                    value={editingTemplate.type}
                    onChange={e => setEditingTemplate(prev => prev ? ({ ...prev, type: e.target.value as EventType }) : null)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                  >
                    <option value="CONFERENCE">컨퍼런스 (빅콘)</option>
                    <option value="HACKATHON">해커톤 / 데이터톤</option>
                    <option value="SESSION">정기 세션 / 특강</option>
                    <option value="SEMINAR">분과 세미나</option>
                    <option value="STUDY">정규 스터디</option>
                    <option value="ETC">기타 행사</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">양식 설명</label>
                <textarea
                  rows={2}
                  value={editingTemplate.description}
                  onChange={e => setEditingTemplate(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                  placeholder="양식의 사용 목적 및 출결 체크 기준을 입력하세요..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-slate-900"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.allowExternal}
                    onChange={e => setEditingTemplate(prev => prev ? ({ ...prev, allowExternal: e.target.checked }) : null)}
                    className="rounded accent-orange-600 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-900">외부인 (게스트/참관객) 출석 허용</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600">기본 인증 방식:</span>
                  <select
                    value={editingTemplate.defaultCheckinMethod}
                    onChange={e => setEditingTemplate(prev => prev ? ({ ...prev, defaultCheckinMethod: e.target.value as CheckinMethod }) : null)}
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
                        id: "f_" + Date.now(),
                        label: "새 입력 항목",
                        type: "TEXT",
                        isRequired: false,
                        target: "ALL",
                      };
                      setEditingTemplate(prev => prev ? ({ ...prev, customFields: [...prev.customFields, newField] }) : null);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} />
                    <span>+ 필드 추가</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {editingTemplate.customFields.map((field, idx) => (
                    <div key={field.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="text-[11px] font-mono text-slate-400 font-bold">#{idx + 1}</span>
                          <input
                            value={field.label}
                            onChange={e => {
                              const updated = editingTemplate.customFields.map((f, i) => i === idx ? { ...f, label: e.target.value } : f);
                              setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
                            }}
                            placeholder="항목 라벨 (예: 소속 대학, 기념품 수령)"
                            className="flex-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const updated = editingTemplate.customFields.filter((_, i) => i !== idx);
                            setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
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
                            onChange={e => {
                              const newType = e.target.value as any;
                              const updated = editingTemplate.customFields.map((f, i) => i === idx ? {
                                ...f,
                                type: newType,
                                options: newType === "SELECT" ? (f.options || ["옵션1", "옵션2"]) : undefined
                              } : f);
                              setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
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
                            onChange={e => {
                              const updated = editingTemplate.customFields.map((f, i) => i === idx ? { ...f, target: e.target.value as any } : f);
                              setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
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
                              onChange={e => {
                                const updated = editingTemplate.customFields.map((f, i) => i === idx ? { ...f, isRequired: e.target.checked } : f);
                                setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
                              }}
                              className="rounded accent-orange-600"
                            />
                            <span>필수 입력</span>
                          </label>
                        </div>
                      </div>

                      {field.type === "SELECT" && (
                        <div className="pt-1">
                          <label className="text-slate-500 block text-[10px] mb-0.5">선택지 (쉼표로 구분):</label>
                          <input
                            value={field.options?.join(", ") || ""}
                            onChange={e => {
                              const opts = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                              const updated = editingTemplate.customFields.map((f, i) => i === idx ? { ...f, options: opts } : f);
                              setEditingTemplate(prev => prev ? ({ ...prev, customFields: updated }) : null);
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
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 cursor-pointer shadow-xs"
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
