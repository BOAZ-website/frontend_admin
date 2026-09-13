import { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  Layers,
  Plus,
  Rocket,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react';

export type InternalActivityType = 'SESSION' | 'STUDY' | 'ADV' | 'ETC';
export type EventStatus = 'UPCOMING' | 'IN_PROGRESS' | 'FINISHED';
export type CheckinMethod = 'QR_CODE' | 'CODE' | 'MANUAL' | 'OPEN_LINK';
export type AttendStatus = 'present' | 'late' | 'absent' | 'unmarked';

export interface CustomFormField {
  id: string;
  label: string;
  type: 'TEXT' | 'SELECT' | 'PHONE' | 'EMAIL';
  options?: string[];
  isRequired: boolean;
  target: 'ALL' | 'INTERNAL_ONLY' | 'EXTERNAL_ONLY';
}

export interface AttendanceEvent {
  id: string;
  title: string;
  type: InternalActivityType;
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

const ACTIVITY_TYPE_META: Record<
  InternalActivityType,
  { label: string; short: string; color: string; bg: string; border: string; icon: any }
> = {
  SESSION: {
    label: '정규 세션',
    short: '세션',
    color: '#1d4ed8',
    bg: '#eff6ff',
    border: '#bfdbfe',
    icon: Calendar,
  },
  STUDY: {
    label: '스터디',
    short: '스터디',
    color: '#0369a1',
    bg: '#f0f9ff',
    border: '#bae6fd',
    icon: BookOpen,
  },
  ADV: {
    label: '어드밴스드 (어드브)',
    short: '어드브',
    color: '#7e22ce',
    bg: '#faf5ff',
    border: '#e9d5ff',
    icon: Rocket,
  },
  ETC: {
    label: '기타 내부 활동',
    short: '기타',
    color: '#475569',
    bg: '#f8fafc',
    border: '#e2e8f0',
    icon: Layers,
  },
};

const STATUS_CFG: Record<
  EventStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  UPCOMING: { label: '예정', color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
  IN_PROGRESS: { label: '진행중', color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
  FINISHED: { label: '종료', color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
};

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
  absent: {
    label: '결석',
    code: '2',
    color: '#8a1c32',
    bg: '#fce4e6',
    border: '#f8b4bc',
    activeBg: '#fce4e6',
    activeText: '#8a1c32',
  },
  unmarked: {
    label: '미체크',
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
  absent: {
    active: 'bg-[#fce4e6] text-[#8a1c32] font-bold border border-[#f8b4bc] shadow-2xs',
    inactive:
      'text-slate-400 hover:text-[#8a1c32] hover:bg-white/60 border border-transparent font-medium',
  },
  unmarked: {
    active: 'bg-[#e9eef4] text-slate-800 font-bold border border-slate-300 shadow-2xs',
    inactive:
      'text-slate-400 hover:text-slate-700 hover:bg-white/60 border border-transparent font-medium',
  },
};

const BOAZ_MEMBER_POOL = [
  {
    name: '김서하',
    term: 28,
    track: 'ANALYSIS',
    affiliation: '28기 분석',
    email: 'seoha.k@yonsei.ac.kr',
    phone: '010-5519-8821',
  },
  {
    name: '이민준',
    term: 28,
    track: 'ANALYSIS',
    affiliation: '28기 분석',
    email: 'minjun.l@snu.ac.kr',
    phone: '010-3811-9021',
  },
  {
    name: '박지훈',
    term: 28,
    track: 'ANALYSIS',
    affiliation: '28기 분석',
    email: 'jihoon.p@korea.ac.kr',
    phone: '010-4491-3829',
  },
  {
    name: '정채원',
    term: 28,
    track: 'ANALYSIS',
    affiliation: '28기 분석',
    email: 'chaewon.j@hanyang.ac.kr',
    phone: '010-9920-1182',
  },
  {
    name: '오승현',
    term: 28,
    track: 'ANALYSIS',
    affiliation: '28기 분석',
    email: 'seunghyun.o@sogang.ac.kr',
    phone: '010-3378-4912',
  },
  {
    name: '이도현',
    term: 28,
    track: 'ENGINEERING',
    affiliation: '28기 엔지니어링',
    email: 'dohyun.l@snu.ac.kr',
    phone: '010-3819-2910',
  },
  {
    name: '박성훈',
    term: 28,
    track: 'ENGINEERING',
    affiliation: '28기 엔지니어링',
    email: 'sunghoon.p@naver.com',
    phone: '010-9182-4122',
  },
  {
    name: '강태양',
    term: 28,
    track: 'ENGINEERING',
    affiliation: '28기 엔지니어링',
    email: 'taeyang.k@snu.ac.kr',
    phone: '010-1829-4720',
  },
  {
    name: '임수진',
    term: 28,
    track: 'ENGINEERING',
    affiliation: '28기 엔지니어링',
    email: 'sujin.l@yonsei.ac.kr',
    phone: '010-8831-2940',
  },
  {
    name: '백민혁',
    term: 28,
    track: 'ENGINEERING',
    affiliation: '28기 엔지니어링',
    email: 'minhyuk.b@korea.ac.kr',
    phone: '010-7719-2041',
  },
  {
    name: '최민혁',
    term: 28,
    track: 'VISUALIZATION',
    affiliation: '28기 시각화',
    email: 'minhyuk.c@yonsei.ac.kr',
    phone: '010-5512-7019',
  },
  {
    name: '한예린',
    term: 28,
    track: 'VISUALIZATION',
    affiliation: '28기 시각화',
    email: 'yerin.h@ewha.ac.kr',
    phone: '010-6629-3810',
  },
  {
    name: '윤재혁',
    term: 28,
    track: 'VISUALIZATION',
    affiliation: '28기 시각화',
    email: 'jaehyuk.y@skku.edu',
    phone: '010-4490-1822',
  },
  {
    name: '장나연',
    term: 28,
    track: 'VISUALIZATION',
    affiliation: '28기 시각화',
    email: 'nayeon.j@hanyang.ac.kr',
    phone: '010-8812-7091',
  },
  {
    name: '고준서',
    term: 27,
    track: 'ANALYSIS',
    affiliation: '27기 분석',
    email: 'junseo.k@snu.ac.kr',
    phone: '010-2281-9930',
  },
  {
    name: '남소희',
    term: 27,
    track: 'ENGINEERING',
    affiliation: '27기 엔지니어링',
    email: 'sohee.n@yonsei.ac.kr',
    phone: '010-3391-7721',
  },
  {
    name: '문지훈',
    term: 27,
    track: 'VISUALIZATION',
    affiliation: '27기 시각화',
    email: 'jihoon.m@korea.ac.kr',
    phone: '010-4481-9012',
  },
];

const INITIAL_INTERNAL_EVENTS: AttendanceEvent[] = [
  {
    id: 'evt_sess_03',
    title: '제28기 3주차 정규 세션 (MLOps 특강 & 트랙 발표)',
    type: 'SESSION',
    status: 'IN_PROGRESS',
    date: '2026-08-15',
    startTime: '14:00',
    endTime: '18:00',
    location: '연세대학교 백양관 101호',
    description: '28기 정규 세션 출결 체크 및 분과별 핵심 기술 공유',
    allowExternal: false,
    checkinMethod: 'CODE',
    checkinCode: '9055',
    targetTerms: [28],
    targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
    totalTargetCount: 14,
    internalAttendedCount: 12,
    externalAttendedCount: 0,
    createdAt: '2026-08-15',
    customFields: [],
  },
  {
    id: 'evt_study_ml',
    title: '머신러닝 & 딥러닝 실전 스터디 3회차',
    type: 'STUDY',
    status: 'IN_PROGRESS',
    date: '2026-08-18',
    startTime: '19:00',
    endTime: '21:30',
    location: '강남 드림플러스 세미나실 B',
    description: '논문 리뷰 (Transformer & LoRA 경량화 기법) 및 실전 구현',
    allowExternal: false,
    checkinMethod: 'MANUAL',
    checkinCode: '1124',
    targetTerms: [28, 27],
    targetTracks: ['ANALYSIS'],
    totalTargetCount: 8,
    internalAttendedCount: 7,
    externalAttendedCount: 0,
    createdAt: '2026-08-18',
    customFields: [],
  },
  {
    id: 'evt_adv_mid',
    title: '2026 하계 어드밴스드 1차 프로젝트 중간 점검 & 멘토링',
    type: 'ADV',
    status: 'UPCOMING',
    date: '2026-08-20',
    startTime: '13:30',
    endTime: '17:30',
    location: '서울대학교 글로벌공학센터 다목적홀',
    description: '어드브 팀별 아키텍처 다이어그램 발표 및 현직 멘토 피드백',
    allowExternal: false,
    checkinMethod: 'QR_CODE',
    checkinCode: '8220',
    targetTerms: [27, 28],
    targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
    totalTargetCount: 16,
    internalAttendedCount: 0,
    externalAttendedCount: 0,
    createdAt: '2026-08-10',
    customFields: [],
  },
  {
    id: 'evt_study_pipe',
    title: '대용량 분산 데이터 파이프라인 스터디 3회차',
    type: 'STUDY',
    status: 'FINISHED',
    date: '2026-08-12',
    startTime: '19:30',
    endTime: '22:00',
    location: '온라인 Google Meet',
    description: 'Kafka & Spark Structured Streaming 실시간 ETL 파이프라인 구축',
    allowExternal: false,
    checkinMethod: 'CODE',
    checkinCode: '7721',
    targetTerms: [28],
    targetTracks: ['ENGINEERING'],
    totalTargetCount: 8,
    internalAttendedCount: 8,
    externalAttendedCount: 0,
    createdAt: '2026-08-12',
    customFields: [],
  },
  {
    id: 'evt_sess_02',
    title: '제28기 2주차 정규 세션 (데이터 수집 & 피처 엔지니어링)',
    type: 'SESSION',
    status: 'FINISHED',
    date: '2026-08-08',
    startTime: '14:00',
    endTime: '18:00',
    location: '연세대학교 백양관 101호',
    description: '트랙별 기초 과제 발표 및 피드백 세션',
    allowExternal: false,
    checkinMethod: 'CODE',
    checkinCode: '4312',
    targetTerms: [28],
    targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
    totalTargetCount: 14,
    internalAttendedCount: 13,
    externalAttendedCount: 0,
    createdAt: '2026-08-08',
    customFields: [],
  },
];

const INITIAL_INTERNAL_ATTENDEES: AttendeeRecord[] = [
  // 1. 3주차 정규 세션
  {
    id: 'att_s1_1',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '김서하',
    affiliation: '28기 분석',
    term: 28,
    email: 'seoha.k@yonsei.ac.kr',
    phone: '010-5519-8821',
    status: 'present',
    checkedInAt: '13:50',
  },
  {
    id: 'att_s1_2',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '이민준',
    affiliation: '28기 분석',
    term: 28,
    email: 'minjun.l@snu.ac.kr',
    phone: '010-3811-9021',
    status: 'present',
    checkedInAt: '13:52',
  },
  {
    id: 'att_s1_3',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '박지훈',
    affiliation: '28기 분석',
    term: 28,
    email: 'jihoon.p@korea.ac.kr',
    phone: '010-4491-3829',
    status: 'present',
    checkedInAt: '13:55',
  },
  {
    id: 'att_s1_4',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '정채원',
    affiliation: '28기 분석',
    term: 28,
    email: 'chaewon.j@hanyang.ac.kr',
    phone: '010-9920-1182',
    status: 'present',
    checkedInAt: '13:58',
  },
  {
    id: 'att_s1_5',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '오승현',
    affiliation: '28기 분석',
    term: 28,
    email: 'seunghyun.o@sogang.ac.kr',
    phone: '010-3378-4912',
    status: 'absent',
    checkedInAt: '-',
    memo: '사전 공결 신청 승인',
  },
  {
    id: 'att_s1_6',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '이도현',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'dohyun.l@snu.ac.kr',
    phone: '010-3819-2910',
    status: 'present',
    checkedInAt: '13:45',
  },
  {
    id: 'att_s1_7',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '박성훈',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'sunghoon.p@naver.com',
    phone: '010-9182-4122',
    status: 'late',
    checkedInAt: '14:15',
    memo: '15분 지각',
  },
  {
    id: 'att_s1_8',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '강태양',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'taeyang.k@snu.ac.kr',
    phone: '010-1829-4720',
    status: 'present',
    checkedInAt: '13:50',
  },
  {
    id: 'att_s1_9',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '임수진',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'sujin.l@yonsei.ac.kr',
    phone: '010-8831-2940',
    status: 'present',
    checkedInAt: '13:54',
  },
  {
    id: 'att_s1_10',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '최민혁',
    affiliation: '28기 시각화',
    term: 28,
    email: 'minhyuk.c@yonsei.ac.kr',
    phone: '010-5512-7019',
    status: 'present',
    checkedInAt: '13:48',
  },
  {
    id: 'att_s1_11',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '한예린',
    affiliation: '28기 시각화',
    term: 28,
    email: 'yerin.h@ewha.ac.kr',
    phone: '010-6629-3810',
    status: 'present',
    checkedInAt: '13:51',
  },
  {
    id: 'att_s1_12',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '윤재혁',
    affiliation: '28기 시각화',
    term: 28,
    email: 'jaehyuk.y@skku.edu',
    phone: '010-4490-1822',
    status: 'present',
    checkedInAt: '13:53',
  },
  {
    id: 'att_s1_13',
    eventId: 'evt_sess_03',
    isExternal: false,
    name: '장나연',
    affiliation: '28기 시각화',
    term: 28,
    email: 'nayeon.j@hanyang.ac.kr',
    phone: '010-8812-7091',
    status: 'unmarked',
    checkedInAt: '-',
  },

  // 2. 머신러닝 스터디 3회차
  {
    id: 'att_st_1',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '이민준',
    affiliation: '28기 분석',
    term: 28,
    email: 'minjun.l@snu.ac.kr',
    phone: '010-3811-9021',
    status: 'present',
    checkedInAt: '18:50',
  },
  {
    id: 'att_st_2',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '김서하',
    affiliation: '28기 분석',
    term: 28,
    email: 'seoha.k@yonsei.ac.kr',
    phone: '010-5519-8821',
    status: 'present',
    checkedInAt: '18:55',
  },
  {
    id: 'att_st_3',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '정채원',
    affiliation: '28기 분석',
    term: 28,
    email: 'chaewon.j@hanyang.ac.kr',
    phone: '010-9920-1182',
    status: 'present',
    checkedInAt: '18:58',
  },
  {
    id: 'att_st_4',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '고준서',
    affiliation: '27기 분석',
    term: 27,
    email: 'junseo.k@snu.ac.kr',
    phone: '010-2281-9930',
    status: 'present',
    checkedInAt: '18:45',
  },
  {
    id: 'att_st_5',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '박지훈',
    affiliation: '28기 분석',
    term: 28,
    email: 'jihoon.p@korea.ac.kr',
    phone: '010-4491-3829',
    status: 'present',
    checkedInAt: '19:00',
  },
  {
    id: 'att_st_6',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '오승현',
    affiliation: '28기 분석',
    term: 28,
    email: 'seunghyun.o@sogang.ac.kr',
    phone: '010-3378-4912',
    status: 'absent',
    checkedInAt: '-',
    memo: '개인 일정',
  },
  {
    id: 'att_st_7',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '최민혁',
    affiliation: '28기 시각화',
    term: 28,
    email: 'minhyuk.c@yonsei.ac.kr',
    phone: '010-5512-7019',
    status: 'present',
    checkedInAt: '18:52',
  },
  {
    id: 'att_st_8',
    eventId: 'evt_study_ml',
    isExternal: false,
    name: '한예린',
    affiliation: '28기 시각화',
    term: 28,
    email: 'yerin.h@ewha.ac.kr',
    phone: '010-6629-3810',
    status: 'present',
    checkedInAt: '18:48',
  },

  // 3. 어드밴스드 중간 점검
  {
    id: 'att_adv_1',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '김서하',
    affiliation: '28기 분석',
    term: 28,
    email: 'seoha.k@yonsei.ac.kr',
    phone: '010-5519-8821',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_2',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '이민준',
    affiliation: '28기 분석',
    term: 28,
    email: 'minjun.l@snu.ac.kr',
    phone: '010-3811-9021',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_3',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '이도현',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'dohyun.l@snu.ac.kr',
    phone: '010-3819-2910',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_4',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '강태양',
    affiliation: '28기 엔지니어링',
    term: 28,
    email: 'taeyang.k@snu.ac.kr',
    phone: '010-1829-4720',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_5',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '최민혁',
    affiliation: '28기 시각화',
    term: 28,
    email: 'minhyuk.c@yonsei.ac.kr',
    phone: '010-5512-7019',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_6',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '문지훈',
    affiliation: '27기 시각화',
    term: 27,
    email: 'jihoon.m@korea.ac.kr',
    phone: '010-4481-9012',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_7',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '고준서',
    affiliation: '27기 분석',
    term: 27,
    email: 'junseo.k@snu.ac.kr',
    phone: '010-2281-9930',
    status: 'unmarked',
    checkedInAt: '-',
  },
  {
    id: 'att_adv_8',
    eventId: 'evt_adv_mid',
    isExternal: false,
    name: '남소희',
    affiliation: '27기 엔지니어링',
    term: 27,
    email: 'sohee.n@yonsei.ac.kr',
    phone: '010-3391-7721',
    status: 'unmarked',
    checkedInAt: '-',
  },
];

export function InternalAttendanceManagePage() {
  const [subTab, setSubTab] = useState<'live' | 'events'>('events');
  const [activityCategoryFilter, setActivityCategoryFilter] = useState<
    'ALL' | InternalActivityType
  >('ALL');
  const [statusFilter] = useState<'ALL' | EventStatus>('ALL');
  const [eventSearch, setEventSearch] = useState('');

  const [events, setEvents] = useState<AttendanceEvent[]>(INITIAL_INTERNAL_EVENTS);
  const [attendees, setAttendees] = useState<AttendeeRecord[]>(INITIAL_INTERNAL_ATTENDEES);
  const [selectedEventId, setSelectedEventId] = useState<string>('evt_sess_03');

  const [isBreadcrumbMenuOpen, setIsBreadcrumbMenuOpen] = useState(false);
  const breadcrumbDropdownRef = useRef<HTMLDivElement>(null);

  // Live tab controls
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [trackFilter, setTrackFilter] = useState<string>('ALL');
  const [attendStatusFilter, setAttendStatusFilter] = useState<'ALL' | AttendStatus>('ALL');
  const [isTableEditMode, setIsTableEditMode] = useState(false);

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Form State for new activity
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventType, setNewEventType] = useState<InternalActivityType>('SESSION');
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventStart] = useState('14:00');
  const [newEventEnd] = useState('18:00');
  const [newEventLoc, setNewEventLoc] = useState('연세대학교 백양관 101호');
  const [newEventDesc, setNewEventDesc] = useState('');
  const [newEventMethod, setNewEventMethod] = useState<CheckinMethod>('CODE');
  const [newEventCode, setNewEventCode] = useState(String(Math.floor(1000 + Math.random() * 9000)));

  // Add Member form state
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberTrack, setNewMemberTrack] = useState('ANALYSIS');
  const [newMemberTerm, setNewMemberTerm] = useState('28');

  const selectedEvent = events.find((e) => e.id === selectedEventId) || events[0];

  // Close breadcrumb menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
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

  // Filtered Events
  const filteredEvents = events.filter((e) => {
    if (activityCategoryFilter !== 'ALL' && e.type !== activityCategoryFilter) {
      return false;
    }
    if (statusFilter !== 'ALL' && e.status !== statusFilter) {
      return false;
    }
    if (eventSearch.trim()) {
      const q = eventSearch.toLowerCase();
      return e.title.toLowerCase().includes(q) || e.location.toLowerCase().includes(q);
    }
    return true;
  });

  // Filtered Attendees for current live event
  const currentEventAttendees = attendees.filter((a) => a.eventId === selectedEvent.id);
  const filteredAttendees = currentEventAttendees.filter((a) => {
    if (attendStatusFilter !== 'ALL' && a.status !== attendStatusFilter) {
      return false;
    }
    if (trackFilter !== 'ALL') {
      if (trackFilter === 'ANALYSIS' && !a.affiliation.includes('분석')) {
        return false;
      }
      if (trackFilter === 'ENGINEERING' && !a.affiliation.includes('엔지니어링')) {
        return false;
      }
      if (trackFilter === 'VISUALIZATION' && !a.affiliation.includes('시각화')) {
        return false;
      }
    }
    if (attendeeSearch.trim()) {
      const q = attendeeSearch.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchAffil = a.affiliation.toLowerCase().includes(q);
      const matchMemo = (a.memo || '').toLowerCase().includes(q);
      if (!matchName && !matchAffil && !matchMemo) {
        return false;
      }
    }
    return true;
  });

  const totalRosterCount = currentEventAttendees.length;
  const presentCount = currentEventAttendees.filter((a) => a.status === 'present').length;
  const lateCount = currentEventAttendees.filter((a) => a.status === 'late').length;
  const absentCount = currentEventAttendees.filter((a) => a.status === 'absent').length;
  const unmarkedCount = currentEventAttendees.filter((a) => a.status === 'unmarked').length;
  const attendanceRate =
    totalRosterCount > 0 ? Math.round(((presentCount + lateCount) / totalRosterCount) * 100) : 0;

  function handleStatusChange(attendeeId: string, newStatus: AttendStatus) {
    const nowTime = new Date().toTimeString().slice(0, 5);
    setAttendees((prev) =>
      prev.map((a) => {
        if (a.id === attendeeId) {
          return {
            ...a,
            status: newStatus,
            checkedInAt:
              (newStatus === 'present' || newStatus === 'late') && a.checkedInAt === '-'
                ? nowTime
                : a.checkedInAt,
          };
        }
        return a;
      }),
    );
  }

  function handleMemoChange(attendeeId: string, memo: string) {
    setAttendees((prev) => prev.map((a) => (a.id === attendeeId ? { ...a, memo } : a)));
  }

  function handleDeleteAttendee(attendeeId: string) {
    if (!window.confirm('정말 이 부원을 명단에서 제외하시겠습니까?')) {
      return;
    }
    setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
  }

  function handleAddMemberToRoster() {
    if (!newMemberName.trim()) {
      alert('부원 이름을 입력해 주세요.');
      return;
    }
    const trackLabel =
      newMemberTrack === 'ANALYSIS'
        ? '분석'
        : newMemberTrack === 'ENGINEERING'
          ? '엔지니어링'
          : '시각화';
    const newId = `att_custom_${Date.now()}`;
    const newRecord: AttendeeRecord = {
      id: newId,
      eventId: selectedEvent.id,
      isExternal: false,
      name: newMemberName.trim(),
      affiliation: `${newMemberTerm}기 ${trackLabel}`,
      term: parseInt(newMemberTerm, 10) || 28,
      email: 'member@boaz.org',
      phone: '010-0000-0000',
      status: 'unmarked',
      checkedInAt: '-',
    };

    setAttendees((prev) => [newRecord, ...prev]);
    setNewMemberName('');
    setShowAddMember(false);
  }

  function handleCreateNewActivity() {
    if (!newEventTitle.trim()) {
      alert('활동/세션명을 입력해 주세요.');
      return;
    }
    const newId = `evt_${Date.now()}`;
    const created: AttendanceEvent = {
      id: newId,
      title: newEventTitle.trim(),
      type: newEventType,
      status: 'IN_PROGRESS',
      date: newEventDate,
      startTime: newEventStart,
      endTime: newEventEnd,
      location: newEventLoc.trim(),
      description: newEventDesc.trim(),
      allowExternal: false,
      checkinMethod: newEventMethod,
      checkinCode: newEventCode,
      customFields: [],
      targetTerms: [28],
      targetTracks: ['ANALYSIS', 'ENGINEERING', 'VISUALIZATION'],
      totalTargetCount: BOAZ_MEMBER_POOL.length,
      internalAttendedCount: 0,
      externalAttendedCount: 0,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    // Auto-populate roster from pool
    const newRoster: AttendeeRecord[] = BOAZ_MEMBER_POOL.map((m, idx) => ({
      id: `att_${newId}_${idx}`,
      eventId: newId,
      isExternal: false,
      name: m.name,
      affiliation: m.affiliation,
      term: m.term,
      email: m.email,
      phone: m.phone,
      status: 'unmarked',
      checkedInAt: '-',
    }));

    setEvents((prev) => [created, ...prev]);
    setAttendees((prev) => [...newRoster, ...prev]);
    setSelectedEventId(newId);
    setSubTab('live');
    setShowNewEventModal(false);
    alert(`새 활동 "${created.title}"이(가) 등록되었습니다.`);
  }

  function handleExportCsv() {
    const headers = ['이름', '소속/기수', '출결상태', '체크인시간', '비고'];
    const rows = filteredAttendees.map((a) => [
      a.name,
      a.affiliation,
      ATTEND_STATUS_CFG[a.status].label,
      a.checkedInAt,
      a.memo || '',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BOAZ_${selectedEvent.title}_출석부_${selectedEvent.date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div
      className="space-y-5 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Breadcrumb & Navigation Bar (Exact EventAttendance Layout) ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => setSubTab('events')}
            className="text-slate-700 hover:text-slate-900 font-bold flex items-center gap-1.5 transition-colors cursor-pointer text-sm"
          >
            <Calendar size={16} className="text-slate-500" />
            <span>전체 목록</span>
          </button>

          {subTab === 'live' && (
            <>
              <span className="text-slate-300 font-bold text-sm">/</span>

              {/* Click-Only Dropdown Switcher */}
              <div className="relative" ref={breadcrumbDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsBreadcrumbMenuOpen((prev) => !prev)}
                  className="font-bold text-slate-900 hover:text-slate-700 flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer text-sm group"
                >
                  <span className="max-w-[320px] truncate">{selectedEvent.title}</span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-400 group-hover:text-slate-700 transition-transform duration-200 ${
                      isBreadcrumbMenuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {isBreadcrumbMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 z-50 w-96 rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 text-xs">
                      {events.map((evt) => {
                        const isCur = evt.id === selectedEvent.id;
                        const typeMeta = ACTIVITY_TYPE_META[evt.type];

                        return (
                          <div
                            key={evt.id}
                            onClick={() => {
                              setSelectedEventId(evt.id);
                              setIsBreadcrumbMenuOpen(false);
                            }}
                            className={`px-3.5 py-2.5 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                              isCur ? 'bg-slate-100 font-bold' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 border"
                                style={{
                                  color: typeMeta.color,
                                  background: typeMeta.bg,
                                  borderColor: typeMeta.border,
                                }}
                              >
                                {typeMeta.short}
                              </span>
                              <p
                                className={`text-sm truncate min-w-0 ${isCur ? 'text-slate-950 font-bold' : 'text-slate-700 font-medium'}`}
                              >
                                {evt.title}
                              </p>
                            </div>
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
            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
              title="현재 출석부 CSV 다운로드"
            >
              <Download size={13} className="text-slate-500" />
              <span>CSV 저장</span>
            </button>
          )}

          <button
            onClick={() => setShowNewEventModal(true)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <Plus size={14} />
            <span>새 활동/세션 생성</span>
          </button>
        </div>
      </div>

      {/* ─── TAB 1: 현장 출석 체크 뷰 ─── */}
      {subTab === 'live' && (
        <div className="space-y-4">
          {/* Clean Inline Stats Text */}
          <div className="flex items-center gap-3 sm:gap-5 py-1 px-1 text-xs text-slate-500 flex-wrap border-b border-slate-100 pb-3 font-medium">
            <div className="flex items-center gap-1.5">
              <span>총 등록</span>
              <span className="font-bold text-slate-900 font-mono text-sm">
                {totalRosterCount}명
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>출석</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{presentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>지각</span>
              <span className="font-bold text-amber-700 font-mono text-sm">{lateCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>결석</span>
              <span className="font-bold text-rose-700 font-mono text-sm">{absentCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>미체크</span>
              <span className="font-bold text-slate-400 font-mono text-sm">{unmarkedCount}명</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>출석률</span>
              <span className="font-bold text-slate-900 font-mono text-sm">{attendanceRate}%</span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>구분</span>
              <span
                className="px-2 py-0.5 rounded-md text-xs font-bold border"
                style={{
                  color: ACTIVITY_TYPE_META[selectedEvent.type].color,
                  background: ACTIVITY_TYPE_META[selectedEvent.type].bg,
                  borderColor: ACTIVITY_TYPE_META[selectedEvent.type].border,
                }}
              >
                {ACTIVITY_TYPE_META[selectedEvent.type].label}
              </span>
            </div>

            <span className="text-slate-200 select-none">·</span>

            <div className="flex items-center gap-1.5">
              <span>체크인 방식</span>
              <button
                onClick={() => setShowCheckinModal(true)}
                className="px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>
                  {selectedEvent.checkinMethod === 'CODE'
                    ? `코드 (${selectedEvent.checkinCode})`
                    : selectedEvent.checkinMethod === 'QR_CODE'
                      ? 'QR 코드'
                      : '수기 체크'}
                </span>
                <ExternalLink size={10} className="text-slate-500" />
              </button>
            </div>
          </div>

          {/* Filter & Action Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 분과/트랙 필터 */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
                {[
                  { id: 'ALL', label: '전체 트랙' },
                  { id: 'ANALYSIS', label: '분석' },
                  { id: 'ENGINEERING', label: '엔지니어링' },
                  { id: 'VISUALIZATION', label: '시각화' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTrackFilter(t.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      trackFilter === t.id
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 출결 상태 필터 */}
              <div className="flex rounded-lg bg-slate-100 p-0.5 border border-slate-200/80 text-xs">
                {(['ALL', 'present', 'late', 'absent', 'unmarked'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setAttendStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      attendStatusFilter === st
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ALL' ? '전체 상태' : ATTEND_STATUS_CFG[st].label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* + 1명 부원 추가 */}
              <button
                type="button"
                onClick={() => setShowAddMember((prev) => !prev)}
                className="h-8 px-3 rounded-lg text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 shadow-2xs"
              >
                <UserPlus size={13} className="text-slate-500" />
                <span>+ 1명 부원 추가</span>
              </button>

              {/* 수정 모드 전환 */}
              <button
                type="button"
                onClick={() => setIsTableEditMode((prev) => !prev)}
                className={`h-8 min-w-[124px] px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                  isTableEditMode
                    ? 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs'
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
                  onChange={(e) => setAttendeeSearch(e.target.value)}
                  placeholder="참가자 검색..."
                  className="h-8 pl-7 pr-3 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none w-40 font-mono shadow-2xs focus:border-slate-400"
                />
              </div>
            </div>
          </div>

          {/* Inline Add Member Panel */}
          {showAddMember && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus size={14} className="text-blue-600" />
                  <span>새 출석 대상 부원 등록</span>
                </p>
                <button
                  onClick={() => setShowAddMember(false)}
                  className="text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <input
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="부원 이름 입력 (예: 김보아즈)"
                  className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white border border-slate-300 outline-none focus:border-slate-900 text-slate-900 placeholder:text-slate-400 shadow-2xs"
                />
                <select
                  value={newMemberTrack}
                  onChange={(e) => setNewMemberTrack(e.target.value)}
                  className="px-3 py-2 text-xs rounded-xl bg-white border border-slate-300 outline-none text-slate-900 font-semibold"
                >
                  <option value="ANALYSIS">분석 트랙</option>
                  <option value="ENGINEERING">엔지니어링 트랙</option>
                  <option value="VISUALIZATION">시각화 트랙</option>
                </select>
                <div className="flex items-center gap-1">
                  <input
                    value={newMemberTerm}
                    onChange={(e) => setNewMemberTerm(e.target.value)}
                    className="w-12 px-2 py-2 text-xs text-center rounded-xl bg-white border border-slate-300 outline-none text-slate-900 font-mono"
                  />
                  <span className="text-xs text-slate-500 font-medium">기</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddMemberToRoster}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shadow-xs shrink-0"
                >
                  추가
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[700px] table-fixed">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-600 font-semibold text-xs whitespace-nowrap">
                    <th className="text-center px-3 py-3 w-12 text-slate-400">#</th>
                    <th className="text-left px-3 py-3 text-slate-900 font-bold w-36">
                      <div className="px-2.5 border border-transparent">이름</div>
                    </th>
                    <th className="text-left px-3 py-3 text-slate-800 font-bold w-32">
                      <div className="px-2.5 border border-transparent">기수/소속</div>
                    </th>
                    <th className="text-center px-3 py-3 text-slate-900 font-bold w-56">출결</th>
                    <th className="text-center px-3 py-3 text-slate-700 font-semibold w-24">
                      체크인 시간
                    </th>
                    <th className="text-left px-3 py-3 text-slate-700 font-semibold">
                      <div className="px-2.5 border border-transparent">특이사항 / 비고</div>
                    </th>
                    {isTableEditMode && (
                      <th className="text-center px-3 py-3 w-14 text-slate-400">삭제</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredAttendees.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isTableEditMode ? 7 : 6}
                        className="py-16 text-center text-slate-500 space-y-2"
                      >
                        <UserCheck size={32} className="mx-auto text-slate-300 mb-1" />
                        <p className="font-bold text-slate-800 text-sm">
                          해당 조건의 참가자가 없습니다.
                        </p>
                        <p className="text-xs">
                          상단의 <strong>[+ 1명 부원 추가]</strong>로 등록하거나 검색어를
                          변경하세요.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendees.map((att, idx) => (
                      <tr key={att.id} className="hover:bg-slate-50/70 transition-colors h-[48px]">
                        <td className="text-center px-3 py-2 text-slate-400 font-mono text-[11px] select-none">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px] flex items-center justify-center font-sans shrink-0">
                              {att.name[0]}
                            </span>
                            <span className="font-bold text-slate-900 text-xs font-sans">
                              {att.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-600 font-sans text-xs whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[11px]">
                            {att.affiliation}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center">
                            <div className="grid grid-cols-4 w-[210px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none">
                              {(['present', 'late', 'absent', 'unmarked'] as const).map((s) => {
                                const active = att.status === s;
                                return (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleStatusChange(att.id, s)}
                                    className={`py-1 text-[11px] rounded-md transition-all cursor-pointer text-center ${
                                      active
                                        ? ATTEND_STATUS_STYLES[s].active
                                        : ATTEND_STATUS_STYLES[s].inactive
                                    }`}
                                  >
                                    {ATTEND_STATUS_CFG[s].label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center text-slate-500 font-mono text-xs whitespace-nowrap">
                          {att.checkedInAt}
                        </td>
                        <td className="px-3 py-2">
                          {isTableEditMode ? (
                            <input
                              value={att.memo || ''}
                              onChange={(e) => handleMemoChange(att.id, e.target.value)}
                              placeholder="특이사항 입력 (예: 공결 승인 완료, 10분 조퇴)"
                              className="w-full px-2.5 py-1 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 placeholder:text-slate-400 font-sans outline-none focus:border-slate-900 shadow-2xs"
                            />
                          ) : (
                            <span className="text-slate-600 font-sans text-xs truncate block max-w-md">
                              {att.memo || <span className="text-slate-300 font-mono">—</span>}
                            </span>
                          )}
                        </td>
                        {isTableEditMode && (
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => handleDeleteAttendee(att.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                              title="명단에서 삭제"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: 전체 활동 목록 ─── */}
      {subTab === 'events' && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            활동을 선택하면 해당 활동의 출석 명단과 집계 현황으로 즉시 이동합니다.
          </p>

          {/* Activity Category Tabs */}
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'ALL', label: '전체 활동', count: events.length },
                {
                  id: 'SESSION',
                  label: '정규 세션',
                  count: events.filter((e) => e.type === 'SESSION').length,
                },
                {
                  id: 'STUDY',
                  label: '스터디',
                  count: events.filter((e) => e.type === 'STUDY').length,
                },
                {
                  id: 'ADV',
                  label: '어드밴스드 (어드브)',
                  count: events.filter((e) => e.type === 'ADV').length,
                },
                {
                  id: 'ETC',
                  label: '기타 활동',
                  count: events.filter((e) => e.type === 'ETC').length,
                },
              ].map((cat) => {
                const isActive = activityCategoryFilter === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActivityCategoryFilter(cat.id as any)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                        isActive ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
              <input
                value={eventSearch}
                onChange={(e) => setEventSearch(e.target.value)}
                placeholder="활동명, 장소 검색..."
                className="h-8 pl-7 pr-3 text-xs rounded-lg bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 outline-none w-48 font-mono shadow-2xs focus:border-slate-400"
              />
            </div>
          </div>

          {/* Activity Cards List */}
          <div className="grid grid-cols-1 gap-3">
            {filteredEvents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 space-y-1">
                <Layers size={32} className="mx-auto text-slate-300" />
                <p className="text-sm font-bold text-slate-700">해당 카테고리의 활동이 없습니다.</p>
                <p className="text-xs">
                  상단의 [+ 새 활동/세션 생성] 버튼으로 새로운 세션을 등록하세요.
                </p>
              </div>
            ) : (
              filteredEvents.map((evt) => {
                const typeMeta = ACTIVITY_TYPE_META[evt.type];
                const statusMeta = STATUS_CFG[evt.status];
                const evtAttendees = attendees.filter((a) => a.eventId === evt.id);
                const attended = evtAttendees.filter(
                  (a) => a.status === 'present' || a.status === 'late',
                ).length;
                const total = evtAttendees.length;
                const rate = total > 0 ? Math.round((attended / total) * 100) : 0;

                return (
                  <div
                    key={evt.id}
                    onClick={() => {
                      setSelectedEventId(evt.id);
                      setSubTab('live');
                    }}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white hover:border-slate-400 hover:shadow-xs px-6 py-4.5 transition-all cursor-pointer group"
                  >
                    <div className="space-y-1 min-w-0 flex-1 pr-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="px-2.5 py-0.5 rounded-md text-[11px] font-bold border"
                          style={{
                            color: typeMeta.color,
                            background: typeMeta.bg,
                            borderColor: typeMeta.border,
                          }}
                        >
                          {typeMeta.label}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded-md text-[10px] font-bold border"
                          style={{
                            color: statusMeta.color,
                            background: statusMeta.bg,
                            borderColor: statusMeta.border,
                          }}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                        {evt.title}
                      </h3>
                      <p className="text-xs text-slate-500 flex items-center gap-2">
                        <span>
                          {evt.date} ({evt.startTime} ~ {evt.endTime})
                        </span>
                        <span>·</span>
                        <span>{evt.location}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-bold text-slate-900 font-mono">
                          출석 {attended} / {total}명
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          출석률 {rate}%
                        </p>
                      </div>

                      <ChevronRight
                        size={16}
                        className="text-slate-300 group-hover:text-slate-700 transition-colors"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── Modal: 새 활동/세션 생성 ─── */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">새 내부 출결 활동/세션 생성</h3>
              </div>
              <button
                onClick={() => setShowNewEventModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Category Select */}
              <div>
                <label className="text-slate-600 font-bold block mb-1.5">
                  활동 성격 분류 (필수)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['SESSION', 'STUDY', 'ADV', 'ETC'] as const).map((t) => {
                    const meta = ACTIVITY_TYPE_META[t];
                    const active = newEventType === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewEventType(t)}
                        className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer border text-center ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {meta.short}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1.5">활동/세션 명칭</label>
                <input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="예: 제28기 4주차 정규 세션, LLM Agent 스터디 3회차"
                  className="w-full px-3.5 py-2.5 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1.5">진행 일자</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1.5">진행 장소</label>
                  <input
                    value={newEventLoc}
                    onChange={(e) => setNewEventLoc(e.target.value)}
                    placeholder="예: 연세대 백양관, 온라인 Zoom"
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 font-bold block mb-1.5">체크인 방식</label>
                  <select
                    value={newEventMethod}
                    onChange={(e) => setNewEventMethod(e.target.value as CheckinMethod)}
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-medium"
                  >
                    <option value="CODE">4자리 출석 코드 인증</option>
                    <option value="QR_CODE">현장 QR 코드 스캔</option>
                    <option value="MANUAL">관리자 수기 체크</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-600 font-bold block mb-1.5">출석 인증 코드</label>
                  <input
                    value={newEventCode}
                    onChange={(e) => setNewEventCode(e.target.value)}
                    maxLength={4}
                    className="w-full px-3 py-2 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold tracking-widest text-center"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 font-bold block mb-1.5">
                  세부 설명 / 안건 (선택)
                </label>
                <textarea
                  value={newEventDesc}
                  onChange={(e) => setNewEventDesc(e.target.value)}
                  placeholder="세션 진행 순서나 준비물, 공지사항을 작성하세요"
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl outline-none bg-slate-50 border border-slate-200 text-slate-900 resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewEventModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleCreateNewActivity}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs"
              >
                활동 생성 및 출석부 열기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 체크인 코드 & QR ─── */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 text-left">
              <h3 className="text-sm font-bold text-slate-900">{selectedEvent.title}</h3>
              <button
                onClick={() => setShowCheckinModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="py-2 space-y-3">
              <span className="text-xs text-slate-500 font-semibold">
                부원 현장 출석 체크인 코드
              </span>
              <div className="text-4xl font-black font-mono tracking-widest text-slate-900 bg-slate-100 py-3 rounded-2xl border border-slate-200">
                {selectedEvent.checkinCode}
              </div>
              <p className="text-[11px] text-slate-400 leading-tight">
                부원들이 모바일 출석 체크 페이지에서 위 4자리 코드를 입력하면 실시간 출석
                처리됩니다.
              </p>
            </div>

            <button
              onClick={() => setShowCheckinModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
