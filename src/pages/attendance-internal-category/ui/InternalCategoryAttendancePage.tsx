import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  Edit3,
  GripVertical,
  Maximize2,
  Minimize2,
  Plus,
  Rocket,
  RotateCcw,
  Settings,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
  ZoomIn,
} from "lucide-react";

import type { ScoreRule } from "@/entities/score-rule/model/types";

export type InternalCategory = "SESSION" | "STUDY" | "ADV";
export type EventStatus = "UPCOMING" | "IN_PROGRESS" | "FINISHED";
export type CheckinMethod = "QR_CODE" | "CODE" | "MANUAL";
export type AttendStatus =
  | "present"
  | "late"
  | "earlyLeave"
  | "absent"
  | "excusedAbsent"
  | "remote"
  | "unexcusedLate"
  | "unexcusedAbsent"
  | "unmarked";

export interface TeamMeta {
  id: string;
  name: string;
  leader: string;
  description: string;
  memberCount: number;
  track?: "분석" | "시각화" | "엔지니어링" | string;
}

export interface InternalEvent {
  id: string;
  category: InternalCategory;
  teamId?: string;
  title: string;
  status: EventStatus;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string;
  checkinMethod: CheckinMethod;
  checkinCode: string;
  createdAt: string;
  imageUrl?: string;
}

export interface InternalAttendee {
  id: string;
  originalId?: string;
  eventId: string;
  teamId: string;
  teamName: string;
  name: string;
  term: number;
  track: string;
  status: AttendStatus;
  checkedInAt: string;
  memo?: string;
  weekNum?: number;
  weekLabel?: string;
}

const CATEGORY_CONFIG: Record<
  InternalCategory,
  {
    title: string;
    subTitle: string;
    icon: any;
    themeColor: string;
    badgeBg: string;
    badgeBorder: string;
    teamLabel: string;
    teams: TeamMeta[];
    initialEvents: InternalEvent[];
    initialAttendees: InternalAttendee[];
  }
> = {
  SESSION: {
    title: "BASE Term 출결 관리",
    subTitle: "분석, 시각화, 엔지니어링 3개 트랙별 BASE 출석 현황을 실시간으로 관리합니다.",
    icon: Calendar,
    themeColor: "#1d4ed8",
    badgeBg: "#eff6ff",
    badgeBorder: "#bfdbfe",
    teamLabel: "트랙",
    teams: [
      {
        id: "base_analysis",
        name: "분석",
        leader: "김서하",
        description: "데이터 분석 & 머신러닝",
        memberCount: 6,
      },
      {
        id: "base_vis",
        name: "시각화",
        leader: "최민혁",
        description: "데이터 시각화 & 대시보드",
        memberCount: 5,
      },
      {
        id: "base_eng",
        name: "엔지니어링",
        leader: "강태양",
        description: "데이터 엔지니어링 & MLOps",
        memberCount: 5,
      },
    ],
    initialEvents: [
      {
        id: "evt_sess_03",
        category: "SESSION",
        title: "제28기 3주차 BASE 세션",
        status: "IN_PROGRESS",
        date: "2026-08-15",
        startTime: "14:00",
        endTime: "18:00",
        location: "연세대학교 백양관 101호",
        description: "28기 BASE 전체 출결 및 트랙별 과제 발표",
        checkinMethod: "CODE",
        checkinCode: "9055",
        createdAt: "2026-08-15",
      },
      {
        id: "evt_sess_02",
        category: "SESSION",
        title: "제28기 2주차 BASE 세션",
        status: "FINISHED",
        date: "2026-08-08",
        startTime: "14:00",
        endTime: "18:00",
        location: "연세대학교 백양관 101호",
        description: "트랙별 기초 과제 발표 및 피드백 세션",
        checkinMethod: "CODE",
        checkinCode: "4312",
        createdAt: "2026-08-08",
      },
      {
        id: "evt_sess_01",
        category: "SESSION",
        title: "제28기 1주차 BASE 세션 (OT & 킥오프)",
        status: "FINISHED",
        date: "2026-08-01",
        startTime: "13:00",
        endTime: "17:00",
        location: "서울대학교 글로벌공학관",
        description: "신입 기수 오리엔테이션 및 활동 로드맵 안내",
        checkinMethod: "QR_CODE",
        checkinCode: "1024",
        createdAt: "2026-08-01",
      },
    ],
    initialAttendees: [
      {
        id: "att_s_1",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "김서하",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "13:50",
      },
      {
        id: "att_s_2",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "정채원",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "13:54",
      },
      {
        id: "att_s_3",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "박지훈",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "13:58",
      },
      {
        id: "att_s_4",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "이민준",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "13:48",
      },
      {
        id: "att_s_5",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "고준서",
        term: 27,
        track: "분석",
        status: "present",
        checkedInAt: "13:52",
      },
      {
        id: "att_s_6",
        eventId: "evt_sess_03",
        teamId: "base_analysis",
        teamName: "분석",
        name: "오승현",
        term: 28,
        track: "분석",
        status: "absent",
        checkedInAt: "-",
        memo: "사전 공결 신청 승인",
      },

      {
        id: "att_s_7",
        eventId: "evt_sess_03",
        teamId: "base_vis",
        teamName: "시각화",
        name: "최민혁",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "13:47",
      },
      {
        id: "att_s_8",
        eventId: "evt_sess_03",
        teamId: "base_vis",
        teamName: "시각화",
        name: "한예린",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "13:51",
      },
      {
        id: "att_s_9",
        eventId: "evt_sess_03",
        teamId: "base_vis",
        teamName: "시각화",
        name: "윤재혁",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "13:53",
      },
      {
        id: "att_s_10",
        eventId: "evt_sess_03",
        teamId: "base_vis",
        teamName: "시각화",
        name: "문지훈",
        term: 27,
        track: "시각화",
        status: "present",
        checkedInAt: "13:56",
      },
      {
        id: "att_s_11",
        eventId: "evt_sess_03",
        teamId: "base_vis",
        teamName: "시각화",
        name: "장나연",
        term: 28,
        track: "시각화",
        status: "late",
        checkedInAt: "14:10",
        memo: "10분 지각",
      },

      {
        id: "att_s_12",
        eventId: "evt_sess_03",
        teamId: "base_eng",
        teamName: "엔지니어링",
        name: "강태양",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "13:42",
      },
      {
        id: "att_s_13",
        eventId: "evt_sess_03",
        teamId: "base_eng",
        teamName: "엔지니어링",
        name: "이도현",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "13:45",
      },
      {
        id: "att_s_14",
        eventId: "evt_sess_03",
        teamId: "base_eng",
        teamName: "엔지니어링",
        name: "임수진",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "13:56",
      },
      {
        id: "att_s_15",
        eventId: "evt_sess_03",
        teamId: "base_eng",
        teamName: "엔지니어링",
        name: "백민혁",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "13:59",
      },
      {
        id: "att_s_16",
        eventId: "evt_sess_03",
        teamId: "base_eng",
        teamName: "엔지니어링",
        name: "남소희",
        term: 27,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "13:40",
      },
    ],
  },
  STUDY: {
    title: "스터디 출결 관리",
    subTitle: "A~D팀 정규/방학 스터디별 주차별 출석 및 인증 내역을 관리합니다.",
    icon: BookOpen,
    themeColor: "#0369a1",
    badgeBg: "#f0f9ff",
    badgeBorder: "#bae6fd",
    teamLabel: "스터디 팀",
    teams: [
      {
        id: "study_a",
        name: "A팀 (머신러닝 & 딥러닝 실전)",
        leader: "이민준",
        description: "논문 리뷰 및 캐글 경진대회 베이스라인 구축",
        memberCount: 4,
      },
      {
        id: "study_b",
        name: "B팀 (대용량 분산 데이터 파이프라인)",
        leader: "강태양",
        description: "Kafka & Spark 기반 실시간 ETL 파이프라인",
        memberCount: 4,
      },
      {
        id: "study_c",
        name: "C팀 (Tableau & D3.js 대시보드)",
        leader: "문지훈",
        description: "인터랙티브 웹 데이터 시각화 & 대시보드",
        memberCount: 4,
      },
      {
        id: "study_d",
        name: "D팀 (LLM Agent & RAG 시스템)",
        leader: "고준서",
        description: "LangChain & LlamaIndex 기반 프로덕션 RAG",
        memberCount: 4,
      },
    ],
    initialEvents: [
      {
        id: "evt_std_03",
        category: "STUDY",
        title: "2026 하계 스터디 3주차 통합 세션",
        status: "IN_PROGRESS",
        date: "2026-08-18",
        startTime: "19:00",
        endTime: "22:00",
        location: "강남 드림플러스 & 온라인 Zoom",
        description: "각 스터디 팀별 3주차 발표 및 실습 결과 공유",
        checkinMethod: "CODE",
        checkinCode: "3319",
        imageUrl:
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80",
        createdAt: "2026-08-18",
      },
      {
        id: "evt_std_02",
        category: "STUDY",
        title: "2026 하계 스터디 2주차 통합 세션",
        status: "FINISHED",
        date: "2026-08-11",
        startTime: "19:00",
        endTime: "22:00",
        location: "강남 드림플러스 & 온라인 Zoom",
        description: "각 스터디 팀별 2주차 진도 발표 및 코드 리뷰",
        checkinMethod: "CODE",
        checkinCode: "2201",
        createdAt: "2026-08-11",
      },
      {
        id: "evt_std_01",
        category: "STUDY",
        title: "2026 하계 스터디 1주차 통합 킥오프",
        status: "FINISHED",
        date: "2026-08-04",
        startTime: "19:00",
        endTime: "21:30",
        location: "강남 드림플러스",
        description: "스터디 커리큘럼 확정 및 1회차 리딩 발표",
        checkinMethod: "CODE",
        checkinCode: "1190",
        createdAt: "2026-08-04",
      },
      {
        id: "evt_std_04",
        category: "STUDY",
        title: "2026 하계 스터디 4주차 통합 세션",
        status: "UPCOMING",
        date: "2026-08-25",
        startTime: "19:00",
        endTime: "22:00",
        location: "강남 드림플러스 & 온라인 Zoom",
        description: "스터디 최종 산출물 정리 및 발표",
        checkinMethod: "CODE",
        checkinCode: "4412",
        createdAt: "2026-08-19",
      },
    ],
    initialAttendees: [
      {
        id: "att_st_a1",
        eventId: "evt_std_03",
        teamId: "study_a",
        teamName: "A팀 (머신러닝 & 딥러닝 실전)",
        name: "이민준",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "18:50",
      },
      {
        id: "att_st_a2",
        eventId: "evt_std_03",
        teamId: "study_a",
        teamName: "A팀 (머신러닝 & 딥러닝 실전)",
        name: "김서하",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "18:55",
      },
      {
        id: "att_st_a3",
        eventId: "evt_std_03",
        teamId: "study_a",
        teamName: "A팀 (머신러닝 & 딥러닝 실전)",
        name: "정채원",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "18:58",
      },
      {
        id: "att_st_a4",
        eventId: "evt_std_03",
        teamId: "study_a",
        teamName: "A팀 (머신러닝 & 딥러닝 실전)",
        name: "오승현",
        term: 28,
        track: "분석",
        status: "absent",
        checkedInAt: "-",
        memo: "개인 일정 불참",
      },

      {
        id: "att_st_b1",
        eventId: "evt_std_03",
        teamId: "study_b",
        teamName: "B팀 (대용량 분산 데이터 파이프라인)",
        name: "강태양",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "18:45",
      },
      {
        id: "att_st_b2",
        eventId: "evt_std_03",
        teamId: "study_b",
        teamName: "B팀 (대용량 분산 데이터 파이프라인)",
        name: "이도현",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "18:48",
      },
      {
        id: "att_st_b3",
        eventId: "evt_std_03",
        teamId: "study_b",
        teamName: "B팀 (대용량 분산 데이터 파이프라인)",
        name: "임수진",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "18:52",
      },
      {
        id: "att_st_b4",
        eventId: "evt_std_03",
        teamId: "study_b",
        teamName: "B팀 (대용량 분산 데이터 파이프라인)",
        name: "백민혁",
        term: 28,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "18:59",
      },

      {
        id: "att_st_c1",
        eventId: "evt_std_03",
        teamId: "study_c",
        teamName: "C팀 (Tableau & D3.js 대시보드)",
        name: "문지훈",
        term: 27,
        track: "시각화",
        status: "present",
        checkedInAt: "18:50",
      },
      {
        id: "att_st_c2",
        eventId: "evt_std_03",
        teamId: "study_c",
        teamName: "C팀 (Tableau & D3.js 대시보드)",
        name: "최민혁",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "18:53",
      },
      {
        id: "att_st_c3",
        eventId: "evt_std_03",
        teamId: "study_c",
        teamName: "C팀 (Tableau & D3.js 대시보드)",
        name: "한예린",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "18:56",
      },
      {
        id: "att_st_c4",
        eventId: "evt_std_03",
        teamId: "study_c",
        teamName: "C팀 (Tableau & D3.js 대시보드)",
        name: "윤재혁",
        term: 28,
        track: "시각화",
        status: "absent",
        checkedInAt: "-",
        memo: "교통 지연 결석",
      },

      {
        id: "att_st_d1",
        eventId: "evt_std_03",
        teamId: "study_d",
        teamName: "D팀 (LLM Agent & RAG 시스템)",
        name: "고준서",
        term: 27,
        track: "분석",
        status: "present",
        checkedInAt: "18:40",
      },
      {
        id: "att_st_d2",
        eventId: "evt_std_03",
        teamId: "study_d",
        teamName: "D팀 (LLM Agent & RAG 시스템)",
        name: "남소희",
        term: 27,
        track: "엔지니어링",
        status: "present",
        checkedInAt: "18:46",
      },
      {
        id: "att_st_d3",
        eventId: "evt_std_03",
        teamId: "study_d",
        teamName: "D팀 (LLM Agent & RAG 시스템)",
        name: "박지훈",
        term: 28,
        track: "분석",
        status: "present",
        checkedInAt: "18:51",
      },
      {
        id: "att_st_d4",
        eventId: "evt_std_03",
        teamId: "study_d",
        teamName: "D팀 (LLM Agent & RAG 시스템)",
        name: "장나연",
        term: 28,
        track: "시각화",
        status: "present",
        checkedInAt: "18:54",
      },
    ],
  },
  ADV: {
    title: "ADV Term 출결 관리",
    subTitle: "산학 연계 및 실무 프로젝트 어드브 팀별 마일스톤 및 멘토링 출결을 관리합니다.",
    icon: Rocket,
    themeColor: "#7e22ce",
    badgeBg: "#faf5ff",
    badgeBorder: "#e9d5ff",
    teamLabel: "프로젝트 팀",
    teams: [
      {
        id: "adv_t1",
        track: "분석",
        name: "1팀 (LLM Agentic 워크플로우)",
        leader: "고준서",
        description: "LangGraph 기반 다중 에이전트 협업 시스템 구축",
        memberCount: 4,
      },
      {
        id: "adv_t2",
        track: "분석",
        name: "2팀 (시계열 예측 솔루션)",
        leader: "김서하",
        description: "금융 및 이상탐지 시계열 파운데이션 모델링",
        memberCount: 4,
      },
      {
        id: "adv_t3",
        track: "분석",
        name: "3팀 (금융 FDS 이상거래 탐지 AI)",
        leader: "박성준",
        description: "그래프 신경망 기반 금융 사기 및 이상 거래 실시간 탐지",
        memberCount: 4,
      },

      {
        id: "adv_t4",
        track: "시각화",
        name: "1팀 (인터랙티브 웹 시각화 대시보드)",
        leader: "최민혁",
        description: "Next.js & D3.js 기반 엔터프라이즈 데이터 시각화",
        memberCount: 4,
      },
      {
        id: "adv_t5",
        track: "시각화",
        name: "2팀 (지리공간 맵핑 & 인포그래픽)",
        leader: "문지훈",
        description: "Mapbox & Deck.gl 기반 공간 데이터 시각화",
        memberCount: 4,
      },
      {
        id: "adv_t6",
        track: "시각화",
        name: "3팀 (3D 바이오 메디컬 시각화)",
        leader: "한예린",
        description: "Three.js 기반 인체 장기 3D 렌더링 및 헬스케어 차트",
        memberCount: 4,
      },

      {
        id: "adv_t7",
        track: "엔지니어링",
        name: "1팀 (실시간 분산 스트리밍 추천)",
        leader: "강태양",
        description: "Kafka & Redis 기반 초개인화 실시간 추천 엔진",
        memberCount: 4,
      },
      {
        id: "adv_t8",
        track: "엔지니어링",
        name: "2팀 (멀티모달 헬스케어 AI 솔루션)",
        leader: "이도현",
        description: "의료 영상 및 EMR 텍스트 통합 분석 솔루션",
        memberCount: 4,
      },
      {
        id: "adv_t9",
        track: "엔지니어링",
        name: "3팀 (엔터프라이즈 RAG MLOps 파이프라인)",
        leader: "백민혁",
        description: "vLLM 및 Ray 기반 고성능 분산 서빙 인프라 구축",
        memberCount: 4,
      },
    ],
    initialEvents: [
      {
        id: "evt_adv_02",
        category: "ADV",
        title: "2026 하계 어드브 2차 중간 점검 & 현직 멘토링",
        status: "IN_PROGRESS",
        date: "2026-08-20",
        startTime: "13:30",
        endTime: "17:30",
        location: "서울대학교 글로벌공학센터 다목적홀",
        description: "프로젝트 중간 아키텍처 다이어그램 발표 및 현직 멘토 피드백",
        checkinMethod: "QR_CODE",
        checkinCode: "8220",
        imageUrl:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&auto=format&fit=crop&q=80",
        createdAt: "2026-08-15",
      },
      {
        id: "evt_adv_01",
        category: "ADV",
        title: "2026 하계 어드브 1차 기획 및 아키텍처 발표회",
        status: "FINISHED",
        date: "2026-08-10",
        startTime: "14:00",
        endTime: "18:00",
        location: "강남 드림플러스 메인홀",
        description: "팀별 프로젝트 주제 선정 및 데이터 파이프라인 기획 발표",
        checkinMethod: "CODE",
        checkinCode: "9102",
        createdAt: "2026-08-10",
      },
      {
        id: "evt_adv_03",
        category: "ADV",
        title: "2026 하계 어드브 3차 최종 성과 공유회 (데모데이)",
        status: "UPCOMING",
        date: "2026-08-29",
        startTime: "13:00",
        endTime: "18:30",
        location: "서울대학교 글로벌공학센터 대강당",
        description: "어드밴스드 프로젝트 최종 배포 결과 시연 및 우수팀 시상",
        checkinMethod: "QR_CODE",
        checkinCode: "9981",
        createdAt: "2026-08-18",
      },
    ],
    initialAttendees: [
      {
        id: "att_adv_1_1",
        eventId: "evt_adv_02",
        teamId: "adv_t1",
        teamName: "1팀 (LLM Agentic 워크플로우)",
        name: "고준서",
        term: 27,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_1_2",
        eventId: "evt_adv_02",
        teamId: "adv_t1",
        teamName: "1팀 (LLM Agentic 워크플로우)",
        name: "김서하",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_1_3",
        eventId: "evt_adv_02",
        teamId: "adv_t1",
        teamName: "1팀 (LLM Agentic 워크플로우)",
        name: "이민준",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_1_4",
        eventId: "evt_adv_02",
        teamId: "adv_t1",
        teamName: "1팀 (LLM Agentic 워크플로우)",
        name: "정채원",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_2_1",
        eventId: "evt_adv_02",
        teamId: "adv_t2",
        teamName: "2팀 (시계열 예측 솔루션)",
        name: "박지훈",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_2_2",
        eventId: "evt_adv_02",
        teamId: "adv_t2",
        teamName: "2팀 (시계열 예측 솔루션)",
        name: "오승현",
        term: 28,
        track: "분석",
        status: "absent",
        checkedInAt: "-",
        memo: "사전 공결 승인",
      },
      {
        id: "att_adv_2_3",
        eventId: "evt_adv_02",
        teamId: "adv_t2",
        teamName: "2팀 (시계열 예측 솔루션)",
        name: "도현진",
        term: 27,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_2_4",
        eventId: "evt_adv_02",
        teamId: "adv_t2",
        teamName: "2팀 (시계열 예측 솔루션)",
        name: "마지원",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_3_1",
        eventId: "evt_adv_02",
        teamId: "adv_t3",
        teamName: "3팀 (금융 FDS 이상거래 탐지 AI)",
        name: "박성준",
        term: 27,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_3_2",
        eventId: "evt_adv_02",
        teamId: "adv_t3",
        teamName: "3팀 (금융 FDS 이상거래 탐지 AI)",
        name: "신유진",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_3_3",
        eventId: "evt_adv_02",
        teamId: "adv_t3",
        teamName: "3팀 (금융 FDS 이상거래 탐지 AI)",
        name: "안서연",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_3_4",
        eventId: "evt_adv_02",
        teamId: "adv_t3",
        teamName: "3팀 (금융 FDS 이상거래 탐지 AI)",
        name: "조민규",
        term: 28,
        track: "분석",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_4_1",
        eventId: "evt_adv_02",
        teamId: "adv_t4",
        teamName: "1팀 (인터랙티브 웹 시각화 대시보드)",
        name: "최민혁",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_4_2",
        eventId: "evt_adv_02",
        teamId: "adv_t4",
        teamName: "1팀 (인터랙티브 웹 시각화 대시보드)",
        name: "한예린",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_4_3",
        eventId: "evt_adv_02",
        teamId: "adv_t4",
        teamName: "1팀 (인터랙티브 웹 시각화 대시보드)",
        name: "문지훈",
        term: 27,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_4_4",
        eventId: "evt_adv_02",
        teamId: "adv_t4",
        teamName: "1팀 (인터랙티브 웹 시각화 대시보드)",
        name: "장나연",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_5_1",
        eventId: "evt_adv_02",
        teamId: "adv_t5",
        teamName: "2팀 (지리공간 맵핑 & 인포그래픽)",
        name: "윤재혁",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_5_2",
        eventId: "evt_adv_02",
        teamId: "adv_t5",
        teamName: "2팀 (지리공간 맵핑 & 인포그래픽)",
        name: "송하늘",
        term: 27,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_5_3",
        eventId: "evt_adv_02",
        teamId: "adv_t5",
        teamName: "2팀 (지리공간 맵핑 & 인포그래픽)",
        name: "노유진",
        term: 27,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_5_4",
        eventId: "evt_adv_02",
        teamId: "adv_t5",
        teamName: "2팀 (지리공간 맵핑 & 인포그래픽)",
        name: "원승민",
        term: 28,
        track: "시각화",
        status: "absent",
        checkedInAt: "-",
        memo: "개인 사정 결석",
      },

      {
        id: "att_adv_6_1",
        eventId: "evt_adv_02",
        teamId: "adv_t6",
        teamName: "3팀 (3D 바이오 메디컬 시각화)",
        name: "배준호",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_6_2",
        eventId: "evt_adv_02",
        teamId: "adv_t6",
        teamName: "3팀 (3D 바이오 메디컬 시각화)",
        name: "권나현",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_6_3",
        eventId: "evt_adv_02",
        teamId: "adv_t6",
        teamName: "3팀 (3D 바이오 메디컬 시각화)",
        name: "서진우",
        term: 27,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_6_4",
        eventId: "evt_adv_02",
        teamId: "adv_t6",
        teamName: "3팀 (3D 바이오 메디컬 시각화)",
        name: "하예원",
        term: 28,
        track: "시각화",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_7_1",
        eventId: "evt_adv_02",
        teamId: "adv_t7",
        teamName: "1팀 (실시간 분산 스트리밍 추천)",
        name: "강태양",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_7_2",
        eventId: "evt_adv_02",
        teamId: "adv_t7",
        teamName: "1팀 (실시간 분산 스트리밍 추천)",
        name: "이도현",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_7_3",
        eventId: "evt_adv_02",
        teamId: "adv_t7",
        teamName: "1팀 (실시간 분산 스트리밍 추천)",
        name: "임수진",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_7_4",
        eventId: "evt_adv_02",
        teamId: "adv_t7",
        teamName: "1팀 (실시간 분산 스트리밍 추천)",
        name: "남소희",
        term: 27,
        track: "엔지니어링",
        status: "absent",
        checkedInAt: "-",
        memo: "개인 일정 결석",
      },

      {
        id: "att_adv_8_1",
        eventId: "evt_adv_02",
        teamId: "adv_t8",
        teamName: "2팀 (멀티모달 헬스케어 AI 솔루션)",
        name: "박성훈",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_8_2",
        eventId: "evt_adv_02",
        teamId: "adv_t8",
        teamName: "2팀 (멀티모달 헬스케어 AI 솔루션)",
        name: "백민혁",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_8_3",
        eventId: "evt_adv_02",
        teamId: "adv_t8",
        teamName: "2팀 (멀티모달 헬스케어 AI 솔루션)",
        name: "류현우",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_8_4",
        eventId: "evt_adv_02",
        teamId: "adv_t8",
        teamName: "2팀 (멀티모달 헬스케어 AI 솔루션)",
        name: "조영준",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },

      {
        id: "att_adv_9_1",
        eventId: "evt_adv_02",
        teamId: "adv_t9",
        teamName: "3팀 (엔터프라이즈 RAG MLOps 파이프라인)",
        name: "황지수",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_9_2",
        eventId: "evt_adv_02",
        teamId: "adv_t9",
        teamName: "3팀 (엔터프라이즈 RAG MLOps 파이프라인)",
        name: "김동현",
        term: 27,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_9_3",
        eventId: "evt_adv_02",
        teamId: "adv_t9",
        teamName: "3팀 (엔터프라이즈 RAG MLOps 파이프라인)",
        name: "문가영",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
      {
        id: "att_adv_9_4",
        eventId: "evt_adv_02",
        teamId: "adv_t9",
        teamName: "3팀 (엔터프라이즈 RAG MLOps 파이프라인)",
        name: "유재성",
        term: 28,
        track: "엔지니어링",
        status: "unmarked",
        checkedInAt: "-",
      },
    ],
  },
};

const ATTEND_STATUS_CFG: Record<
  AttendStatus,
  { label: string; code: string; color: string; bg: string; border: string }
> = {
  present: { label: "출석", code: "0", color: "#0f5132", bg: "#def2e6", border: "#b6e3c9" },
  late: { label: "지각", code: "1", color: "#7c4a03", bg: "#fceed2", border: "#f5d5a4" },
  earlyLeave: { label: "조퇴", code: "1E", color: "#7c4a03", bg: "#fef3c7", border: "#fde68a" },
  absent: { label: "결석", code: "2", color: "#8a1c32", bg: "#fce4e6", border: "#f8b4bc" },
  excusedAbsent: {
    label: "인정결석",
    code: "3",
    color: "#1e40af",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  remote: { label: "비대면", code: "ON", color: "#4338ca", bg: "#eef2ff", border: "#c7d2fe" },
  unexcusedLate: {
    label: "무단지각",
    code: "4",
    color: "#c2410c",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  unexcusedAbsent: {
    label: "무단결석",
    code: "5",
    color: "#991b1b",
    bg: "#fee2e2",
    border: "#fca5a5",
  },
  unmarked: { label: "미정", code: "-", color: "#334155", bg: "#e9eef4", border: "#cbd5e1" },
};

const ATTEND_STATUS_STYLES: Record<AttendStatus, { active: string; inactive: string }> = {
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

// CSV 추출 및 미리보기용 출결 상태 코드 매핑 (출석:1, 지각:2, 조퇴:3, 결석:4, 인정결석:5, 비대면:6, 무단지각:0, 무단결석:X)
export const EXPORT_ATTEND_STATUS_CODE: Record<AttendStatus, string> = {
  present: "1",
  late: "2",
  earlyLeave: "3",
  absent: "4",
  excusedAbsent: "5",
  remote: "6",
  unexcusedLate: "0",
  unexcusedAbsent: "X",
  unmarked: "-",
};

export const EXPORT_ATTEND_STATUS_STYLE: Record<AttendStatus, string> = {
  present: "text-slate-800 font-medium",
  late: "text-slate-800 font-medium",
  earlyLeave: "text-slate-800 font-medium",
  absent: "text-slate-800 font-medium",
  excusedAbsent: "text-slate-800 font-medium",
  remote: "text-slate-800 font-medium",
  unexcusedLate: "text-slate-800 font-medium",
  unexcusedAbsent: "text-slate-800 font-medium",
  unmarked: "text-slate-300 font-normal",
};

export interface ExportColumnConfig {
  id:
    | "term"
    | "name"
    | "week"
    | "absence"
    | "unexcusedAbsence"
    | "lateEarlyLeave"
    | "remote"
    | "totalScore"
    | "track"
    | "teamName"
    | "status"
    | "checkedInAt"
    | "memo";
  label: string;
  enabled: boolean;
}

export interface ModalColItem {
  id: string;
  label: string;
  subLabel?: string;
  renderCell: (row: any) => React.ReactNode;
  exportValue: (row: any) => string;
}

const DEFAULT_EXPORT_COLUMNS: ExportColumnConfig[] = [
  { id: "term", label: "기수", enabled: true },
  { id: "name", label: "이름", enabled: true },
  { id: "week", label: "날짜", enabled: true },
  { id: "absence", label: "결석", enabled: true },
  { id: "unexcusedAbsence", label: "무단결석", enabled: true },
  { id: "lateEarlyLeave", label: "지각조퇴", enabled: true },
  { id: "remote", label: "비대면 횟수", enabled: true },
  { id: "totalScore", label: "총점", enabled: true },
];

const DEFAULT_WEEK_DATE_MAPPING: Record<number, string> = {
  1: "2026-01-26",
  2: "2026-07-13",
  3: "2026-07-20",
  4: "2026-07-27",
  5: "2026-08-03",
  6: "2026-08-10",
  7: "2026-08-17",
  8: "2026-08-24",
  9: "2026-09-07",
  10: "2026-09-14",
  11: "2026-09-21",
  12: "2026-09-28",
  13: "2026-10-05",
  14: "2026-10-12",
  15: "2026-10-19",
  16: "2026-10-26",
};

const VACATION_WEEKS_8 = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 1}`,
  weekNum: i + 1,
  label: `${i + 1}주차`,
}));

const SEMESTER_WEEKS_8 = Array.from({ length: 8 }, (_, i) => ({
  id: `w${i + 9}`,
  weekNum: i + 9,
  label: `${i + 9}주차`,
}));

const WEEK_SAMPLE_PHOTOS: Record<number, string> = {
  1: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80",
  2: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1000&auto=format&fit=crop&q=80",
  3: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&auto=format&fit=crop&q=80",
  9: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1000&auto=format&fit=crop&q=80",
  10: "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1000&auto=format&fit=crop&q=80",
  11: "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&auto=format&fit=crop&q=80",
};

export interface InternalCategoryAttendancePageProps {
  category: InternalCategory;
  activeScoreRule?: ScoreRule;
}

export function InternalCategoryAttendancePage({
  category,
  activeScoreRule,
}: InternalCategoryAttendancePageProps) {
  const config = CATEGORY_CONFIG[category];

  const [syncedScoreRule, setSyncedScoreRule] = useState<ScoreRule | undefined>(activeScoreRule);

  useEffect(() => {
    if (activeScoreRule) {
      setSyncedScoreRule(activeScoreRule);
    }
  }, [activeScoreRule]);

  useEffect(() => {
    const handleRulesChange = () => {
      try {
        const saved = localStorage.getItem("boaz_score_rules");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const active = parsed.find((r: ScoreRule) => r.status === "ACTIVE");
            if (active) {
              setSyncedScoreRule(active);
            }
          }
        }
      } catch {
        // ignore malformed localStorage data, fall back to defaults
      }
    };
    window.addEventListener("boaz_score_rules_changed", handleRulesChange);
    return () => window.removeEventListener("boaz_score_rules_changed", handleRulesChange);
  }, []);

  const currentScoreRule: ScoreRule =
    syncedScoreRule ||
    activeScoreRule ||
    (() => {
      try {
        const saved = localStorage.getItem("boaz_score_rules");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const active = parsed.find((r: ScoreRule) => r.status === "ACTIVE");
            if (active) {
              return active;
            }
          }
        }
      } catch {
        // ignore malformed localStorage data, fall back to defaults
      }
      return {
        version: 3,
        status: "ACTIVE" as const,
        activatedAt: "2026-08-01",
        createdBy: "차기대표진",
        absentPenalty: -3,
        unexcusedAbsentPenalty: -4,
        latePenalty: -1,
        unexcusedLatePenalty: -2,
        presentScore: 0,
      };
    })();

  // Selected Team & Event & Week & Term Period (방학: 1~8주차 / 학기: 9~16주차)
  const [termPeriod, setTermPeriod] = useState<"VACATION" | "SEMESTER">("VACATION");
  const weekList = termPeriod === "VACATION" ? VACATION_WEEKS_8 : SEMESTER_WEEKS_8;
  const [selectedTeamId, setSelectedTeamId] = useState<string>(
    category === "ADV" || category === "STUDY" ? "ALL" : config.teams[0]?.id || ""
  );
  const [selectedEventId, setSelectedEventId] = useState<string>(config.initialEvents[0]?.id || "");

  // 방학과 학기 주차 선택을 완전히 분리하여 독립 관리 (기본값: 전체 주차 0)
  const [selectedWeekVacation, setSelectedWeekVacation] = useState<number>(0);
  const [selectedWeekSemester, setSelectedWeekSemester] = useState<number>(0);
  const selectedWeek = termPeriod === "VACATION" ? selectedWeekVacation : selectedWeekSemester;
  const setSelectedWeek = (week: number) => {
    if (week !== 0) {
      setIsTableEditMode(false);
    }
    if (termPeriod === "VACATION") {
      setSelectedWeekVacation(week);
    } else {
      setSelectedWeekSemester(week);
    }
  };

  const [isPeekOpen, setIsPeekOpen] = useState(true);
  const [isFullScreen, setIsFullScreen] = useState(false);

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
  }, [category, weekList]);

  const handleScrollWeeks = (direction: "left" | "right") => {
    if (weekScrollRef.current) {
      const offset = direction === "left" ? -240 : 240;
      weekScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
      setTimeout(checkWeekScroll, 300);
    }
  };

  // Draggable Split Pane State
  const [splitRatio, setSplitRatio] = useState<number>(23); // 23% left, 77% right
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Events and Attendees
  const [events, setEvents] = useState<InternalEvent[]>(config.initialEvents);
  const [attendees, setAttendees] = useState<InternalAttendee[]>(config.initialAttendees);

  // Controls in Peek
  const [attendeeSearch] = useState("");
  const [attendStatusFilter] = useState<"ALL" | AttendStatus>("ALL");
  const [isTableEditMode, setIsTableEditMode] = useState(false);
  const [activeStudyEditCell, setActiveStudyEditCell] = useState<{
    rowId: string;
    weekNum: number;
  } | null>(null);

  // User interactive status & memo overrides keyed by: `${category}_${termPeriod}_${selectedWeek}_${attendeeId}`
  const [attendanceOverrides, setAttendanceOverrides] = useState<
    Record<string, { status: AttendStatus; memo?: string; checkedInAt?: string }>
  >({});

  // Modals
  const [showNewEventModal, setShowNewEventModal] = useState(false);
  const [showImageZoom, setShowImageZoom] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Track Filter State
  const TRACK_FILTER_OPTIONS = [
    { id: "ALL", label: "전체" },
    { id: "분석", label: "분석" },
    { id: "시각화", label: "시각화" },
    { id: "엔지니어링", label: "엔지" },
  ];
  const [selectedTrackFilter, setSelectedTrackFilter] = useState<string>("ALL");
  const [studySortMode, setStudySortMode] = useState<"TERM" | "TEAM">("TERM"); // "TERM" (기수별 기본) | "TEAM" (팀별)
  const [termFilter] = useState<string>("ALL"); // "ALL" | "28" | "27" | "26"
  const [sortOption] = useState<"DEFAULT" | "TERM_ASC" | "TERM_DESC" | "NAME_ASC">("TERM_ASC");

  // Settings: Committed/Saved State vs Modal Draft State
  const [savedWeekDateMapping, setSavedWeekDateMapping] =
    useState<Record<number, string>>(DEFAULT_WEEK_DATE_MAPPING);
  const [savedExportColumns, setSavedExportColumns] =
    useState<ExportColumnConfig[]>(DEFAULT_EXPORT_COLUMNS);
  const [savedCustomColOrder, setSavedCustomColOrder] = useState<string[] | null>(null);

  const [weekDateMapping, setWeekDateMapping] =
    useState<Record<number, string>>(DEFAULT_WEEK_DATE_MAPPING);
  const [exportColumns, setExportColumns] = useState<ExportColumnConfig[]>(DEFAULT_EXPORT_COLUMNS);
  const [customColOrder, setCustomColOrder] = useState<string[] | null>(null);

  const handleOpenSettingsModal = () => {
    setWeekDateMapping({ ...savedWeekDateMapping });
    setExportColumns(savedExportColumns.map((c) => ({ ...c })));
    setCustomColOrder(savedCustomColOrder ? [...savedCustomColOrder] : null);
    setDraggedColIdx(null);
    setDropTarget(null);
    setShowSettingsModal(true);
  };

  const handleCloseOrCancelSettings = () => {
    setWeekDateMapping({ ...savedWeekDateMapping });
    setExportColumns(savedExportColumns.map((c) => ({ ...c })));
    setCustomColOrder(savedCustomColOrder ? [...savedCustomColOrder] : null);
    setDraggedColIdx(null);
    setDropTarget(null);
    setShowSettingsModal(false);
  };

  const [isSavedFeedback, setIsSavedFeedback] = useState(false);

  const handleSaveSettings = () => {
    setSavedWeekDateMapping({ ...weekDateMapping });
    setSavedExportColumns(exportColumns.map((c) => ({ ...c })));
    setSavedCustomColOrder(customColOrder ? [...customColOrder] : null);
    setIsSavedFeedback(true);
    setTimeout(() => setIsSavedFeedback(false), 2000);
  };

  const handleSaveAndExportCsv = () => {
    setSavedWeekDateMapping({ ...weekDateMapping });
    setSavedExportColumns(exportColumns.map((c) => ({ ...c })));
    setSavedCustomColOrder(customColOrder ? [...customColOrder] : null);
    handleExportCsv();
    setShowSettingsModal(false);
  };

  // Table Column Resizing State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    week: 80,
    track: 80,
    teamName: 160,
    name: 100,
    term: 70,
    status: 445,
    memo: 240,
    matrix_index: 42,
    matrix_term: 52,
    matrix_name: 80,
    matrix_track: 65,
    matrix_team: 100,
    matrix_w_1: 72,
    matrix_w_2: 72,
    matrix_w_3: 72,
    matrix_w_4: 72,
    matrix_w_5: 72,
    matrix_w_6: 72,
    matrix_w_7: 72,
    matrix_w_8: 72,
    matrix_w_9: 72,
    matrix_w_10: 72,
    matrix_w_11: 72,
    matrix_w_12: 72,
    matrix_w_13: 72,
    matrix_w_14: 72,
    matrix_w_15: 72,
    matrix_w_16: 72,
    matrix_absence: 55,
    matrix_unexcusedAbsence: 65,
    matrix_late: 65,
    matrix_remote: 68,
    matrix_total: 70,
  });

  useEffect(() => {
    setColWidths((prev) => ({
      ...prev,
      status: category === "SESSION" ? 360 : 110,
    }));
  }, [category]);

  const tableContainerRef = useRef<HTMLDivElement | null>(null);
  const resizingCol = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const [activeHoverCol, setActiveHoverCol] = useState<string | null>(null);
  const [resizingColKey, setResizingColKey] = useState<string | null>(null);
  const [guidelineX, setGuidelineX] = useState<number | null>(null);
  const activeThRef = useRef<HTMLElement | null>(null);

  const updateGuidelinePos = (targetEl?: HTMLElement | null) => {
    const cell = targetEl
      ? ((targetEl.closest("th") || targetEl.closest("td")) as HTMLElement | null)
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
    const cell = (e.currentTarget.closest("th") ||
      e.currentTarget.closest("td")) as HTMLElement | null;
    activeThRef.current = cell;
    const startX = e.clientX;
    const startWidth = cell ? cell.offsetWidth : colWidths[key] || minWidth;
    resizingCol.current = { key, startX, startWidth };
    setResizingColKey(key);
    updateGuidelinePos(e.currentTarget);

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

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
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Column Drag & Drop State with | indicator between columns
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    index: number;
    position: "left" | "right";
  } | null>(null);

  const handleColDragStart = (e: React.DragEvent, index: number) => {
    setDraggedColIdx(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleColDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColIdx === null) {
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const position: "left" | "right" = mouseX < rect.width / 2 ? "left" : "right";
    setDropTarget({ index, position });
  };

  const handleColDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedColIdx === null || dropTarget === null) {
      setDraggedColIdx(null);
      setDropTarget(null);
      return;
    }

    let insertIndex = dropTarget.position === "left" ? dropTarget.index : dropTarget.index + 1;
    if (draggedColIdx < insertIndex) {
      insertIndex--;
    }

    if (draggedColIdx !== insertIndex && insertIndex >= 0 && insertIndex < activeModalCols.length) {
      const newCols = [...activeModalCols];
      const [removed] = newCols.splice(draggedColIdx, 1);
      newCols.splice(insertIndex, 0, removed);
      setCustomColOrder(newCols.map((c) => c.id));
    }

    setDraggedColIdx(null);
    setDropTarget(null);
  };

  const handleColDragEnd = () => {
    setDraggedColIdx(null);
    setDropTarget(null);
  };

  // New Event Form
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventDate, setNewEventDate] = useState(new Date().toISOString().slice(0, 10));
  const [newEventStart] = useState("14:00");
  const [newEventEnd] = useState("18:00");
  const [newEventLoc, setNewEventLoc] = useState("연세대학교 백양관 101호");
  const [newEventDesc] = useState("");
  const [newEventMethod, setNewEventMethod] = useState<CheckinMethod>("CODE");
  const [newEventCode, setNewEventCode] = useState(String(Math.floor(1000 + Math.random() * 9000)));

  // Keep state synced when switching category prop
  useEffect(() => {
    setEvents(config.initialEvents);
    setAttendees(config.initialAttendees);
    setSelectedTeamId(
      category === "ADV" || category === "STUDY" ? "ALL" : config.teams[0]?.id || ""
    );
    setSelectedEventId(config.initialEvents[0]?.id || "");
    setIsPeekOpen(true);
    setIsFullScreen(false);
  }, [category]);

  // Drag handler
  useEffect(() => {
    if (!isDragging) {
      return;
    }

    function handleMouseMove(e: MouseEvent) {
      if (!containerRef.current) {
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      const rawRatio = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedRatio = Math.min(Math.max(rawRatio, 16), 55);
      setSplitRatio(clampedRatio);
    }

    function handleMouseUp() {
      setIsDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging]);

  function handleDividerMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  const selectedEvent = events.find((e) => e.id === selectedEventId) ||
    events[0] || {
      id: "evt_fallback",
      category,
      title: `${config.title} 세션`,
      status: "IN_PROGRESS" as EventStatus,
      date: "2026-08-20",
      startTime: "14:00",
      endTime: "18:00",
      location: "-",
      description: "",
      checkinMethod: "CODE" as CheckinMethod,
      checkinCode: "1234",
      createdAt: "2026-08-20",
    };
  const isAllSelected = selectedTeamId === "ALL";
  const selectedTeam: TeamMeta = isAllSelected
    ? {
        id: "ALL",
        name: "전체 통합 출결 현황",
        leader: "",
        description: "전체 트랙 및 소속 팀 통합 명단",
        memberCount: attendees.filter((a) => a.eventId === (selectedEvent?.id || "")).length,
      }
    : config.teams.find((t) => t.id === selectedTeamId) ||
      config.teams[0] || {
        id: "",
        name: "선택된 팀",
        leader: "",
        description: "",
        memberCount: 0,
      };

  // Current Attendees for Live View (filter by Event & selected Team & selectedWeek & termPeriod)
  const isWeekSubmitted =
    selectedWeek === 0 ||
    (termPeriod === "VACATION" ? selectedWeek <= 3 : selectedWeek >= 9 && selectedWeek <= 11);

  const baseAttendees = isAllSelected
    ? attendees
    : attendees.filter((a) => a.teamId === (selectedTeam?.id || ""));

  const activeSubmittedWeeks =
    termPeriod === "VACATION"
      ? VACATION_WEEKS_8.filter((w) => w.weekNum <= 3)
      : SEMESTER_WEEKS_8.filter((w) => w.weekNum <= 11);

  const currentTeamAttendees: InternalAttendee[] =
    selectedWeek === 0
      ? activeSubmittedWeeks.flatMap((w) =>
          baseAttendees.map((a) => {
            const currentWeekNum = w.weekNum;
            const overrideKey = `${category}_${termPeriod}_${currentWeekNum}_${a.id}`;
            const override = attendanceOverrides[overrideKey];
            if (override && override.status) {
              return {
                ...a,
                id: `${a.id}_w${currentWeekNum}`,
                originalId: a.id,
                weekNum: currentWeekNum,
                weekLabel: w.label,
                status: override.status,
                checkedInAt:
                  override.checkedInAt ||
                  (override.status === "present" || override.status === "late" ? "14:00" : "-"),
                memo: override.memo !== undefined ? override.memo : a.memo,
              };
            }

            if (termPeriod === "VACATION") {
              const isAbsentThisWeek =
                (a.name === "오승현" &&
                  (currentWeekNum === 2 || currentWeekNum === 3 || currentWeekNum === 7)) ||
                (a.name === "원승민" && (currentWeekNum === 3 || currentWeekNum === 5)) ||
                (a.name === "남소희" && (currentWeekNum === 3 || currentWeekNum === 6));

              const isLateThisWeek =
                category === "SESSION" &&
                ((a.name === "장나연" && currentWeekNum === 3) ||
                  (a.name === "문지훈" && currentWeekNum === 2));

              const status: AttendStatus = isLateThisWeek
                ? "late"
                : isAbsentThisWeek
                  ? "absent"
                  : "unmarked";

              return {
                ...a,
                id: `${a.id}_w${currentWeekNum}`,
                originalId: a.id,
                weekNum: currentWeekNum,
                weekLabel: w.label,
                status,
                checkedInAt: status === "late" ? "14:15" : "-",
                memo: isAbsentThisWeek
                  ? "방학 개인 사정 (사전 공결 신청 승인)"
                  : status === "late"
                    ? "15분 지각"
                    : a.memo || "",
              };
            } else {
              const isAbsentThisWeek =
                (a.name === "장나연" && (currentWeekNum === 11 || currentWeekNum === 15)) ||
                (a.name === "박성준" && currentWeekNum === 10) ||
                (a.name === "이도현" && currentWeekNum === 11);

              const isLateThisWeek =
                (a.name === "김서하" && currentWeekNum === 11) ||
                (a.name === "한예린" && currentWeekNum === 10) ||
                (a.name === "고준서" && currentWeekNum === 12);

              const status: AttendStatus = isLateThisWeek
                ? "late"
                : isAbsentThisWeek
                  ? "absent"
                  : "unmarked";

              return {
                ...a,
                id: `${a.id}_w${currentWeekNum}`,
                originalId: a.id,
                weekNum: currentWeekNum,
                weekLabel: w.label,
                status,
                checkedInAt: status === "late" ? "14:15" : "-",
                memo: isAbsentThisWeek
                  ? "학기 과제/시험 일정 결석"
                  : status === "late"
                    ? "수업 종료 후 15분 지각"
                    : a.memo || "",
              };
            }
          })
        )
      : baseAttendees.map((a) => {
          const overrideKey = `${category}_${termPeriod}_${selectedWeek}_${a.id}`;
          const override = attendanceOverrides[overrideKey];
          if (override && override.status) {
            return {
              ...a,
              originalId: a.id,
              weekNum: selectedWeek,
              weekLabel: `${selectedWeek}주차`,
              status: override.status,
              checkedInAt:
                override.checkedInAt ||
                (override.status === "present" || override.status === "late" ? "14:00" : "-"),
              memo: override.memo !== undefined ? override.memo : a.memo,
            };
          }

          // If week is not yet submitted by team leader
          if (!isWeekSubmitted && category !== "SESSION") {
            return {
              ...a,
              originalId: a.id,
              weekNum: selectedWeek,
              weekLabel: `${selectedWeek}주차`,
              status: "unmarked" as AttendStatus,
              checkedInAt: "-",
              memo: undefined,
            };
          }

          if (termPeriod === "VACATION") {
            const isAbsentThisWeek =
              (a.name === "오승현" &&
                (selectedWeek === 2 || selectedWeek === 3 || selectedWeek === 7)) ||
              (a.name === "원승민" && (selectedWeek === 3 || selectedWeek === 5)) ||
              (a.name === "남소희" && (selectedWeek === 3 || selectedWeek === 6));

            const isLateThisWeek =
              category === "SESSION" &&
              ((a.name === "장나연" && selectedWeek === 3) ||
                (a.name === "문지훈" && selectedWeek === 2));

            const status: AttendStatus = isLateThisWeek
              ? "late"
              : isAbsentThisWeek
                ? "absent"
                : "unmarked";

            return {
              ...a,
              originalId: a.id,
              weekNum: selectedWeek,
              weekLabel: `${selectedWeek}주차`,
              status,
              checkedInAt: status === "late" ? "14:15" : "-",
              memo: isAbsentThisWeek
                ? "방학 개인 사정 (사전 공결 신청 승인)"
                : status === "late"
                  ? "15분 지각"
                  : a.memo || "",
            };
          } else {
            const isAbsentThisWeek =
              (a.name === "장나연" && (selectedWeek === 11 || selectedWeek === 15)) ||
              (a.name === "박성준" && selectedWeek === 10) ||
              (a.name === "이도현" && selectedWeek === 11);

            const isLateThisWeek =
              (a.name === "김서하" && selectedWeek === 11) ||
              (a.name === "한예린" && selectedWeek === 10) ||
              (a.name === "고준서" && selectedWeek === 12);

            const status: AttendStatus = isLateThisWeek
              ? "late"
              : isAbsentThisWeek
                ? "absent"
                : "unmarked";

            return {
              ...a,
              originalId: a.id,
              weekNum: selectedWeek,
              weekLabel: `${selectedWeek}주차`,
              status,
              checkedInAt: status === "late" ? "14:15" : "-",
              memo: isAbsentThisWeek
                ? "학기 과제/시험 일정 결석"
                : status === "late"
                  ? "수업 종료 후 15분 지각"
                  : a.memo || "",
            };
          }
        });

  const filteredAttendees = useMemo(() => {
    let list = currentTeamAttendees.filter((a) => {
      if (selectedTrackFilter !== "ALL") {
        const matchesTrack = (t: string) => {
          if (selectedTrackFilter === "엔지니어링" || selectedTrackFilter === "엔지") {
            return t === "엔지니어링" || t === "엔지" || t.includes("엔지");
          }
          return t === selectedTrackFilter;
        };
        if (!matchesTrack(a.track || "")) {
          return false;
        }
      }
      if (termFilter !== "ALL") {
        if (`${a.term}` !== termFilter) {
          return false;
        }
      }
      if (attendStatusFilter !== "ALL" && a.status !== attendStatusFilter) {
        return false;
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const matchName = (a.name || "").toLowerCase().includes(q);
        const matchMemo = (a.memo || "").toLowerCase().includes(q);
        const matchTrack = (a.track || "").toLowerCase().includes(q);
        const matchTeam = (a.teamName || "").toLowerCase().includes(q);
        if (!matchName && !matchMemo && !matchTrack && !matchTeam) {
          return false;
        }
      }
      return true;
    });

    if (sortOption === "TERM_ASC") {
      list = [...list].sort(
        (a, b) => (a.term || 0) - (b.term || 0) || a.name.localeCompare(b.name, "ko")
      );
    } else if (sortOption === "TERM_DESC") {
      list = [...list].sort(
        (a, b) => (b.term || 0) - (a.term || 0) || a.name.localeCompare(b.name, "ko")
      );
    } else if (sortOption === "NAME_ASC") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    }

    return list;
  }, [
    currentTeamAttendees,
    selectedTrackFilter,
    termFilter,
    attendStatusFilter,
    attendeeSearch,
    sortOption,
  ]);

  // ADV Overall Matrix Rows calculation & BASE Term (전체 주차) Matrix calculation
  const isMatrixMode =
    (category === "ADV" && isAllSelected) || (category === "SESSION" && selectedWeek === 0);

  const distinctMembers = useMemo(() => {
    const map = new Map<string, InternalAttendee>();
    baseAttendees.forEach((a) => {
      const safeId = String(a.id || "");
      const baseId = a.originalId || (safeId.includes("_w") ? safeId.split("_w")[0] : safeId);
      if (!map.has(baseId)) {
        map.set(baseId, { ...a, id: baseId, originalId: baseId });
      }
    });
    return Array.from(map.values());
  }, [baseAttendees]);

  const currentTermWeeks = termPeriod === "VACATION" ? VACATION_WEEKS_8 : SEMESTER_WEEKS_8;

  // 주차 선택 시 매트릭스 표에서 해당 주차 컬럼만 필터링 (0주차는 전체 8주차 표시)
  const displayedMatrixWeeks = useMemo(() => {
    if (selectedWeek === 0) {
      return currentTermWeeks;
    }
    return currentTermWeeks.filter((w) => w.weekNum === selectedWeek);
  }, [currentTermWeeks, selectedWeek]);

  // 1~3주차(방학)만 직접 출결 선택 가능 (9주차 이상은 4주차 등과 동일하게 일반 상태 표시)
  const isWeekDirectEditable = (weekNum: number) => {
    return termPeriod === "VACATION" && weekNum >= 1 && weekNum <= 3;
  };

  // 매트릭스 표 최소 너비 계산 (각 컬럼이 찌그러지지 않도록 합산)
  const matrixTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.matrix_index || 42) +
      (colWidths.matrix_term || 52) +
      (colWidths.matrix_name || 80) +
      (category !== "SESSION" && selectedTrackFilter === "ALL" ? colWidths.matrix_track || 65 : 0) +
      (colWidths.matrix_total || 75);

    if (selectedWeek === 0) {
      sum +=
        (colWidths.matrix_absence || 60) +
        (colWidths.matrix_unexcusedAbsence || 68) +
        (colWidths.matrix_late || 68) +
        (category === "ADV" ? colWidths.matrix_remote || 75 : 0);
    }

    displayedMatrixWeeks.forEach((w) => {
      const isEditable = isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
      const colKey = `matrix_w_${w.weekNum}`;
      const minColWidth = isEditable ? 435 : 55;
      const defaultColWidth = isEditable ? 445 : 72;
      const effectiveWidth = Math.max(colWidths[colKey] || defaultColWidth, minColWidth);
      sum += effectiveWidth;
    });

    return Math.max(
      sum,
      selectedWeek === 0
        ? selectedTrackFilter === "ALL"
          ? 850
          : 750
        : selectedTrackFilter === "ALL"
          ? 550
          : 490
    );
  }, [category, colWidths, displayedMatrixWeeks, selectedWeek, selectedTrackFilter, termPeriod]);

  // 단일 팀 표 최소 너비 계산
  const singleTeamTableMinWidth = useMemo(() => {
    const isSingleTeamEditable =
      category === "SESSION" ||
      (category === "ADV" && isWeekDirectEditable(selectedWeek) && selectedWeek !== 0);
    const statusMinWidth = isSingleTeamEditable ? 435 : 70;
    const statusDefaultWidth = isSingleTeamEditable ? 445 : 75;
    const statusEffectiveWidth = isSingleTeamEditable
      ? Math.max(colWidths.status || statusDefaultWidth, statusMinWidth)
      : (colWidths.status && colWidths.status < 200 ? colWidths.status : statusDefaultWidth);

    let sum =
      (colWidths.name || 70) +
      (colWidths.term || 50) +
      statusEffectiveWidth +
      (colWidths.memo || 240);
    if (selectedWeek === 0) {
      sum += colWidths.week || 60;
    }
    if (category !== "SESSION" && isAllSelected) {
      sum += colWidths.track || 60;
    }
    if (isAllSelected && category !== "SESSION") {
      sum += colWidths.teamName || 90;
    }
    if (category !== "SESSION" && !isAllSelected) {
      sum += colWidths.track || 60;
    }
    if (isTableEditMode) {
      sum += 40;
    }
    return Math.max(sum, 690);
  }, [category, selectedWeek, isAllSelected, isTableEditMode, colWidths, termPeriod]);

  // 전체 스터디 표 최소 너비 계산 (각 컬럼이 정확히 합산되어 테이블 우측 여백이 남지 않도록)
  const studyAllTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.study_all_index || 42) +
      (colWidths.study_all_term || 55) +
      (colWidths.study_all_track || 65) +
      (colWidths.study_all_name || 80) +
      (colWidths.study_all_score || 70);

    config.teams.forEach((team) => {
      const colKey = `study_all_col_${team.id}`;
      const defaultWidth = 160;
      const minWidth = 100;
      sum += Math.max(colWidths[colKey] || defaultWidth, minWidth);
    });

    return Math.max(sum, 780);
  }, [colWidths, config.teams]);

  // 각 스터디별 표 최소 너비 계산 (각 컬럼이 정확히 합산되어 테이블 우측 여백이 남지 않도록)
  const studyTeamTableMinWidth = useMemo(() => {
    let sum =
      (colWidths.study_team_index || 42) +
      (colWidths.study_team_term || 55) +
      (colWidths.study_team_name || 80) +
      (colWidths.study_team_attended || 85) +
      (colWidths.study_team_leader || 85) +
      (colWidths.study_team_score || 80);

    displayedMatrixWeeks.forEach((w) => {
      const colKey = `study_w_${w.weekNum}`;
      const minColWidth = 55;
      const defaultColWidth = 72;
      sum += Math.max(colWidths[colKey] || defaultColWidth, minColWidth);
    });

    return Math.max(sum, 720);
  }, [colWidths, displayedMatrixWeeks]);

  const matrixRows = useMemo(() => {
    return distinctMembers.map((member) => {
      const weekData: Record<
        number,
        { status: AttendStatus; memo?: string; checkedInAt?: string }
      > = {};
      let absenceCount = 0;
      let unexcusedAbsenceCount = 0;
      let lateEarlyLeaveCount = 0;
      let remoteCount = 0;

      currentTermWeeks.forEach((w) => {
        const currentWeekNum = w.weekNum;
        const overrideKey = `${category}_${termPeriod}_${currentWeekNum}_${member.id}`;
        const override = attendanceOverrides[overrideKey];

        let status: AttendStatus = "unmarked";
        let memo: string | undefined = member.memo;
        let checkedInAt: string | undefined = "-";

        if (override && override.status) {
          status = override.status;
          memo = override.memo;
          checkedInAt = override.checkedInAt;
        } else {
          if (termPeriod === "VACATION") {
            if (currentWeekNum > 3 && category !== "SESSION") {
              status = "unmarked";
              checkedInAt = "-";
              memo = undefined;
            } else {
              const isAbsentThisWeek =
                (member.name === "오승현" &&
                  (currentWeekNum === 2 || currentWeekNum === 3 || currentWeekNum === 7)) ||
                (member.name === "원승민" && (currentWeekNum === 3 || currentWeekNum === 5)) ||
                (member.name === "남소희" && (currentWeekNum === 3 || currentWeekNum === 6));
              const isLateThisWeek =
                category === "SESSION" &&
                ((member.name === "장나연" && currentWeekNum === 3) ||
                  (member.name === "문지훈" && currentWeekNum === 2));
              const isRemoteThisWeek =
                (member.name === "안서연" && currentWeekNum === 2) ||
                (member.name === "조민규" && (currentWeekNum === 1 || currentWeekNum === 3)) ||
                (member.name === "도현진" && currentWeekNum === 2);

              if (isAbsentThisWeek) {
                status = "absent";
                memo = "방학 개인 사정 (사전 공결 신청 승인)";
                checkedInAt = "-";
              } else if (isLateThisWeek) {
                status = "late";
                memo = "15분 지각";
                checkedInAt = "14:15";
              } else if (isRemoteThisWeek) {
                status = "remote";
                memo = "비대면 참여 승인";
                checkedInAt = "14:00 (온라인)";
              } else {
                status = "unmarked";
                checkedInAt = "-";
              }
            }
          } else {
            if (currentWeekNum > 11 && category !== "SESSION") {
              status = "unmarked";
              checkedInAt = "-";
              memo = undefined;
            } else {
              const isAbsentThisWeek =
                (member.name === "장나연" && (currentWeekNum === 11 || currentWeekNum === 15)) ||
                (member.name === "박성준" && currentWeekNum === 10) ||
                (member.name === "이도현" && currentWeekNum === 11);
              const isLateThisWeek =
                (member.name === "김서하" && currentWeekNum === 11) ||
                (member.name === "한예린" && currentWeekNum === 10) ||
                (member.name === "고준서" && currentWeekNum === 12);
              const isRemoteThisWeek =
                (member.name === "한예린" && currentWeekNum === 11) ||
                (member.name === "안서연" && currentWeekNum === 10);

              if (isAbsentThisWeek) {
                status = "absent";
                memo = "학기 과제/시험 일정 결석";
                checkedInAt = "-";
              } else if (isLateThisWeek) {
                status = "late";
                memo = "수업 종료 후 15분 지각";
                checkedInAt = "14:15";
              } else if (isRemoteThisWeek) {
                status = "remote";
                memo = "비대면 참여 승인";
                checkedInAt = "14:00 (온라인)";
              } else {
                status = "unmarked";
                checkedInAt = "-";
              }
            }
          }
        }

        weekData[currentWeekNum] = { status, memo, checkedInAt };

        if (status === "absent") {
          absenceCount++;
        } else if (status === "unexcusedAbsent") {
          unexcusedAbsenceCount++;
        } else if (status === "late" || status === "earlyLeave" || status === "unexcusedLate") {
          lateEarlyLeaveCount++;
        } else if (
          status === "remote" ||
          (memo?.includes("비대면") ?? false) ||
          (memo?.includes("온라인") ?? false)
        ) {
          remoteCount++;
        }
      });

      let totalScore = 0;
      let attendedCount = 0;

      if (category === "STUDY") {
        currentTermWeeks.forEach((w) => {
          if (weekData[w.weekNum]?.status === "present") {
            attendedCount++;
          }
        });
        const isLeader = config.teams.some(
          (t) => t.id === member.teamId && t.leader === member.name
        );
        const failPenalty = currentScoreRule.studyFailPenalty ?? -5;
        const passBonus = currentScoreRule.studyPassBonus ?? 1;
        const perfectBonus = currentScoreRule.studyPerfectBonus ?? 3;
        const leaderBonus = currentScoreRule.studyLeaderBonus ?? 1;

        // 70% 미만 (4회 이하) -> -5, 70%~100%미만 (5~6회) -> +1, 100% (7회 이상) -> +3
        const baseScore =
          attendedCount <= 4 ? failPenalty : attendedCount < 7 ? passBonus : perfectBonus;
        totalScore = baseScore + (isLeader ? leaderBonus : 0);
      } else {
        const absentPenalty = currentScoreRule.absentPenalty ?? -3;
        const unexcusedAbsentPenalty = currentScoreRule.unexcusedAbsentPenalty ?? -4;
        const latePenalty = currentScoreRule.latePenalty ?? -1;
        totalScore =
          absenceCount * absentPenalty +
          unexcusedAbsenceCount * unexcusedAbsentPenalty +
          lateEarlyLeaveCount * latePenalty;
      }

      return {
        id: member.id,
        name: member.name,
        term: member.term,
        track: member.track,
        teamId: member.teamId || "",
        teamName: member.teamName || "",
        weekData,
        absenceCount,
        unexcusedAbsenceCount,
        lateEarlyLeaveCount,
        remoteCount,
        totalScore,
      };
    });
  }, [
    category,
    termPeriod,
    distinctMembers,
    currentTermWeeks,
    attendanceOverrides,
    currentScoreRule,
    config.teams,
  ]);

  const filteredMatrixRows = useMemo(() => {
    let rows = matrixRows.filter((row) => {
      if (category !== "STUDY" && selectedTrackFilter !== "ALL") {
        const matchesTrack = (t: string) => {
          if (selectedTrackFilter === "엔지니어링" || selectedTrackFilter === "엔지") {
            return t === "엔지니어링" || t === "엔지" || t.includes("엔지");
          }
          return t === selectedTrackFilter;
        };
        if (!matchesTrack(row.track || "")) {
          return false;
        }
      }
      if (termFilter !== "ALL") {
        if (`${row.term}` !== termFilter) {
          return false;
        }
      }
      if (attendeeSearch.trim()) {
        const q = attendeeSearch.toLowerCase();
        const match =
          (row.name || "").toLowerCase().includes(q) ||
          (row.track || "").toLowerCase().includes(q) ||
          (row.teamName || "").toLowerCase().includes(q) ||
          `${row.term || ""}`.includes(q);
        if (!match) {
          return false;
        }
      }
      if (attendStatusFilter !== "ALL") {
        const hasStatus = displayedMatrixWeeks.some(
          (w) => row.weekData[w.weekNum]?.status === attendStatusFilter
        );
        if (!hasStatus) {
          return false;
        }
      }
      return true;
    });

    if (category === "STUDY") {
      if (studySortMode === "TEAM") {
        const teamOrderMap = new Map<string, number>();
        config.teams.forEach((t, i) => teamOrderMap.set(t.id, i));
        rows = [...rows].sort((a, b) => {
          const teamA = teamOrderMap.get(a.teamId) ?? 999;
          const teamB = teamOrderMap.get(b.teamId) ?? 999;
          if (teamA !== teamB) {
            return teamA - teamB;
          }
          return a.name.localeCompare(b.name, "ko");
        });
      } else {
        rows = [...rows].sort((a, b) => {
          if ((a.term || 0) !== (b.term || 0)) {
            return (a.term || 0) - (b.term || 0);
          }
          return a.name.localeCompare(b.name, "ko");
        });
      }
    } else {
      if (sortOption === "TERM_ASC") {
        rows = [...rows].sort(
          (a, b) => (a.term || 0) - (b.term || 0) || a.name.localeCompare(b.name, "ko")
        );
      } else if (sortOption === "TERM_DESC") {
        rows = [...rows].sort(
          (a, b) => (b.term || 0) - (a.term || 0) || a.name.localeCompare(b.name, "ko")
        );
      } else if (sortOption === "NAME_ASC") {
        rows = [...rows].sort((a, b) => a.name.localeCompare(b.name, "ko"));
      }
    }

    return rows;
  }, [
    category,
    matrixRows,
    config.teams,
    studySortMode,
    selectedTrackFilter,
    termFilter,
    attendeeSearch,
    attendStatusFilter,
    displayedMatrixWeeks,
    sortOption,
  ]);

  const studyTeamRows = useMemo(() => {
    if (category !== "STUDY") {
      return [];
    }
    if (isAllSelected) {
      return filteredMatrixRows;
    }
    const teamMembers = filteredMatrixRows.filter((r) => r.teamId === (selectedTeam?.id || ""));
    return [...teamMembers].sort((a, b) => {
      if ((a.term || 0) !== (b.term || 0)) {
        return (a.term || 0) - (b.term || 0);
      }
      return a.name.localeCompare(b.name, "ko");
    });
  }, [category, isAllSelected, filteredMatrixRows, selectedTeam]);

  function handleStatusChange(attendeeId: string, newStatus: AttendStatus, targetWeekNum?: number) {
    const rawId = attendeeId.includes("_w") ? attendeeId.split("_w")[0] : attendeeId;
    const nowTime = new Date().toTimeString().slice(0, 5);
    const targetWeek =
      targetWeekNum || (selectedWeek === 0 ? (termPeriod === "VACATION" ? 3 : 11) : selectedWeek);
    const key = `${category}_${termPeriod}_${targetWeek}_${rawId}`;
    setAttendanceOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        status: newStatus,
        checkedInAt:
          newStatus === "present" ||
          newStatus === "late" ||
          newStatus === "earlyLeave" ||
          newStatus === "unexcusedLate"
            ? nowTime
            : "-",
      },
    }));
  }

  function handleMemoChange(attendeeId: string, memo: string, targetWeekNum?: number) {
    const targetWeek =
      targetWeekNum || (selectedWeek === 0 ? (termPeriod === "VACATION" ? 3 : 11) : selectedWeek);
    const key = `${category}_${termPeriod}_${targetWeek}_${attendeeId}`;
    setAttendanceOverrides((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        status: prev[key]?.status || "present",
        memo,
      },
    }));
  }

  function handleDeleteAttendee(attendeeId: string) {
    if (!window.confirm("정말 이 부원을 명단에서 제외하시겠습니까?")) {
      return;
    }
    setAttendees((prev) => prev.filter((a) => a.id !== attendeeId));
  }

  function handleCreateNewEvent() {
    if (!newEventTitle.trim()) {
      alert("세션/활동 명칭을 입력해 주세요.");
      return;
    }
    const newId = `evt_${category.toLowerCase()}_${Date.now()}`;
    const created: InternalEvent = {
      id: newId,
      category,
      title: newEventTitle.trim(),
      status: "IN_PROGRESS",
      date: newEventDate,
      startTime: newEventStart,
      endTime: newEventEnd,
      location: newEventLoc.trim(),
      description: newEventDesc.trim(),
      checkinMethod: newEventMethod,
      checkinCode: newEventCode,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const baseAttendees = attendees.filter((a) => a.eventId === events[0]?.id);
    const newRoster: InternalAttendee[] = baseAttendees.map((a, idx) => ({
      ...a,
      id: `att_${newId}_${idx}`,
      eventId: newId,
      status: "unmarked",
      checkedInAt: "-",
      memo: undefined,
    }));

    setEvents((prev) => [created, ...prev]);
    setAttendees((prev) => [...newRoster, ...prev]);
    setSelectedEventId(newId);
    setShowNewEventModal(false);
    alert(`새 세션 "${created.title}"이(가) 등록되었습니다.`);
  }

  const { defaultModalCols, previewRows, defaultExportFilename } = useMemo(() => {
    const periodLabel = termPeriod === "VACATION" ? "방학" : "학기";

    if (category === "STUDY") {
      if (!isAllSelected) {
        const teamNameClean = (selectedTeam?.name || "개별스터디").replace(/[^\w가-힣]/g, "_");
        const cols: ModalColItem[] = [
          {
            id: "term",
            label: "기수",
            renderCell: (row) => (
              <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.term ?? 28}기
              </span>
            ),
            exportValue: (row) => `${row?.term ?? 28}기`,
          },
          {
            id: "name",
            label: "이름",
            renderCell: (row) => (
              <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
                {row?.name ?? ""}
              </span>
            ),
            exportValue: (row) => row?.name ?? "",
          },
          ...displayedMatrixWeeks.map((w) => {
            const rawDate = (
              weekDateMapping[w.weekNum] ||
              savedWeekDateMapping[w.weekNum] ||
              ""
            )?.trim();
            const hasDate = Boolean(rawDate && rawDate !== "-");
            return {
              id: `w_${w.weekNum}`,
              label: hasDate ? rawDate : w.label,
              renderCell: (row: any) => {
                const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
                const st: AttendStatus = cell?.status || "unmarked";
                const code = EXPORT_ATTEND_STATUS_CODE[st] || "-";
                const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || "text-slate-300";
                return (
                  <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>
                    {code}
                  </span>
                );
              },
              exportValue: (row: any) => {
                const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || "unmarked";
                return EXPORT_ATTEND_STATUS_CODE[st] || "-";
              },
            };
          }),
          {
            id: "attendedCount",
            label: "참여 횟수",
            renderCell: (row) => (
              <span className="font-mono text-xs text-slate-800 font-bold whitespace-nowrap">
                {row?.attendedCount ?? 0}회
              </span>
            ),
            exportValue: (row) => `${row?.attendedCount ?? 0}회`,
          },
          {
            id: "isLeader",
            label: "스터디장",
            renderCell: (row) => {
              const isLeader = row?.isLeader || row?.name === selectedTeam?.leader;
              return (
                <span
                  className={`text-xs font-bold font-mono whitespace-nowrap ${isLeader ? "text-slate-900" : "text-slate-300 font-normal"}`}
                >
                  {isLeader ? "1" : "-"}
                </span>
              );
            },
            exportValue: (row) => {
              const isLeader = row?.isLeader || row?.name === selectedTeam?.leader;
              return isLeader ? "1" : "-";
            },
          },
          {
            id: "totalScore",
            label: "점수",
            renderCell: (row) => {
              const score = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    score === 0
                      ? "text-slate-400 font-medium"
                      : score < 0
                        ? "text-rose-600"
                        : "text-emerald-700"
                  }`}
                >
                  {score}
                </span>
              );
            },
            exportValue: (row) => String(row?.totalScore ?? 0),
          },
        ];
        return {
          defaultModalCols: cols,
          previewRows: studyTeamRows || [],
          defaultExportFilename: `BOAZ_스터디_${teamNameClean}_출결_${periodLabel}.csv`,
        };
      } else {
        const cols: ModalColItem[] = [
          {
            id: "term",
            label: "기수",
            renderCell: (row) => (
              <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.term ?? 28}기
              </span>
            ),
            exportValue: (row) => `${row?.term ?? 28}기`,
          },
          {
            id: "track",
            label: "부문",
            renderCell: (row) => (
              <span className="text-slate-600 text-xs px-3 whitespace-nowrap">
                {row?.track ?? ""}
              </span>
            ),
            exportValue: (row) => row?.track ?? "",
          },
          {
            id: "name",
            label: "이름",
            renderCell: (row) => (
              <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
                {row?.name ?? ""}
              </span>
            ),
            exportValue: (row) => row?.name ?? "",
          },
          ...(config.teams || []).map((team) => ({
            id: `team_${team.id}`,
            label: team.name,
            renderCell: (row: any) => {
              const isMember = row?.teamId === team.id;
              if (!isMember) {
                return <span className="text-slate-300 whitespace-nowrap">-</span>;
              }
              const sc = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    sc === 0
                      ? "text-slate-400 font-medium"
                      : sc < 0
                        ? "text-rose-600"
                        : "text-emerald-700"
                  }`}
                >
                  {sc}
                </span>
              );
            },
            exportValue: (row: any) => {
              const isMember = row?.teamId === team.id;
              if (!isMember) {
                return "-";
              }
              return String(row?.totalScore ?? 0);
            },
          })),
          {
            id: "totalScore",
            label: "총점",
            renderCell: (row) => {
              const score = row?.totalScore ?? 0;
              return (
                <span
                  className={`font-bold font-mono whitespace-nowrap ${
                    score === 0
                      ? "text-slate-400 font-medium"
                      : score < 0
                        ? "text-rose-600"
                        : "text-emerald-700"
                  }`}
                >
                  {score}
                </span>
              );
            },
            exportValue: (row) => String(row?.totalScore ?? 0),
          },
        ];
        return {
          defaultModalCols: cols,
          previewRows: filteredMatrixRows || [],
          defaultExportFilename: `BOAZ_스터디_전체통합_출결_${periodLabel}.csv`,
        };
      }
    } else if (category === "ADV") {
      const cols: ModalColItem[] = [
        {
          id: "term",
          label: "기수",
          renderCell: (row) => (
            <span className="font-mono text-slate-600 text-xs px-2 whitespace-nowrap">
              {row?.term ?? 28}기
            </span>
          ),
          exportValue: (row) => `${row?.term ?? 28}기`,
        },
        {
          id: "name",
          label: "이름",
          renderCell: (row) => (
            <span className="font-bold text-slate-900 text-xs px-3 whitespace-nowrap">
              {row?.name ?? ""}
            </span>
          ),
          exportValue: (row) => row?.name ?? "",
        },
        {
          id: "track",
          label: "부문",
          renderCell: (row) => (
            <span className="text-slate-600 text-xs px-2.5 whitespace-nowrap">
              {row?.track ?? ""}
            </span>
          ),
          exportValue: (row) => row?.track ?? "",
        },
        ...displayedMatrixWeeks.map((w) => {
          const rawDate = (
            weekDateMapping[w.weekNum] ||
            savedWeekDateMapping[w.weekNum] ||
            ""
          )?.trim();
          const hasDate = Boolean(rawDate && rawDate !== "-");
          return {
            id: `w_${w.weekNum}`,
            label: hasDate ? rawDate : w.label,
            renderCell: (row: any) => {
              const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
              const st: AttendStatus = cell?.status || "unmarked";
              const code = EXPORT_ATTEND_STATUS_CODE[st] || "-";
              const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || "text-slate-300";
              return (
                <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>{code}</span>
              );
            },
            exportValue: (row: any) => {
              const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || "unmarked";
              return EXPORT_ATTEND_STATUS_CODE[st] || "-";
            },
          };
        }),
        {
          id: "absence",
          label: "결석",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.absenceCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.absenceCount ?? 0),
        },
        {
          id: "unexcusedAbsence",
          label: "무단결석",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.unexcusedAbsenceCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.unexcusedAbsenceCount ?? 0),
        },
        {
          id: "lateEarlyLeave",
          label: "지각조퇴",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.lateEarlyLeaveCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.lateEarlyLeaveCount ?? 0),
        },
        {
          id: "remote",
          label: "비대면 횟수",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.remoteCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.remoteCount ?? 0),
        },
        {
          id: "totalScore",
          label: "총점",
          renderCell: (row) => {
            const score = row?.totalScore ?? 0;
            return (
              <span
                className={`font-bold font-mono whitespace-nowrap ${
                  score === 0
                    ? "text-slate-400 font-medium"
                    : score < 0
                      ? "text-rose-600"
                      : "text-emerald-700"
                }`}
              >
                {score}
              </span>
            );
          },
          exportValue: (row) => String(row?.totalScore ?? 0),
        },
      ];
      return {
        defaultModalCols: cols,
        previewRows: filteredMatrixRows || [],
        defaultExportFilename: `BOAZ_ADV_출결통합집계_${periodLabel}.csv`,
      };
    } else {
      const trackNameClean = (selectedTeam?.name || "분석").replace(/[^\w가-힣]/g, "_");
      const cols: ModalColItem[] = [
        {
          id: "term",
          label: "기수",
          renderCell: (row) => (
            <span className="font-mono text-slate-600 text-xs px-3 whitespace-nowrap">
              {row?.term ?? 28}기
            </span>
          ),
          exportValue: (row) => `${row?.term ?? 28}기`,
        },
        {
          id: "name",
          label: "이름",
          renderCell: (row) => (
            <span className="font-bold text-slate-900 text-xs px-4 whitespace-nowrap">
              {row?.name ?? ""}
            </span>
          ),
          exportValue: (row) => row?.name ?? "",
        },
        ...displayedMatrixWeeks.map((w) => {
          const rawDate = (
            weekDateMapping[w.weekNum] ||
            savedWeekDateMapping[w.weekNum] ||
            ""
          )?.trim();
          const hasDate = Boolean(rawDate && rawDate !== "-");
          return {
            id: `w_${w.weekNum}`,
            label: hasDate ? rawDate : w.label,
            renderCell: (row: any) => {
              const cell = row?.weekData ? row.weekData[w.weekNum] : undefined;
              const st: AttendStatus = cell?.status || "unmarked";
              const code = EXPORT_ATTEND_STATUS_CODE[st] || "-";
              const styleClass = EXPORT_ATTEND_STATUS_STYLE[st] || "text-slate-300";
              return (
                <span className={`font-mono text-xs whitespace-nowrap ${styleClass}`}>{code}</span>
              );
            },
            exportValue: (row: any) => {
              const st: AttendStatus = row?.weekData?.[w.weekNum]?.status || "unmarked";
              return EXPORT_ATTEND_STATUS_CODE[st] || "-";
            },
          };
        }),
        {
          id: "absence",
          label: "결석",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">{row?.absenceCount ?? 0}</span>
          ),
          exportValue: (row) => String(row?.absenceCount ?? 0),
        },
        {
          id: "unexcusedAbsence",
          label: "무단결석",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.unexcusedAbsenceCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.unexcusedAbsenceCount ?? 0),
        },
        {
          id: "lateEarlyLeave",
          label: "지각조퇴",
          renderCell: (row) => (
            <span className="font-mono text-xs whitespace-nowrap">
              {row?.lateEarlyLeaveCount ?? 0}
            </span>
          ),
          exportValue: (row) => String(row?.lateEarlyLeaveCount ?? 0),
        },
        {
          id: "totalScore",
          label: "총점",
          renderCell: (row) => {
            const score = row?.totalScore ?? 0;
            return (
              <span
                className={`font-bold font-mono whitespace-nowrap ${
                  score === 0
                    ? "text-slate-400 font-medium"
                    : score < 0
                      ? "text-rose-600"
                      : "text-emerald-700"
                }`}
              >
                {score}
              </span>
            );
          },
          exportValue: (row) => String(row?.totalScore ?? 0),
        },
      ];
      return {
        defaultModalCols: cols,
        previewRows: filteredMatrixRows || [],
        defaultExportFilename: `BOAZ_BASE_${trackNameClean}_출결집계_${periodLabel}.csv`,
      };
    }
  }, [
    category,
    isAllSelected,
    displayedMatrixWeeks,
    weekDateMapping,
    savedWeekDateMapping,
    studyTeamRows,
    filteredMatrixRows,
    selectedTeam,
    termPeriod,
    config.teams,
  ]);

  const activeModalCols = useMemo(() => {
    if (!customColOrder) {
      return defaultModalCols;
    }
    const map = new Map(defaultModalCols.map((c) => [c.id, c]));
    const ordered: ModalColItem[] = [];
    customColOrder.forEach((id) => {
      const item = map.get(id);
      if (item) {
        ordered.push(item);
        map.delete(id);
      }
    });
    map.forEach((item) => ordered.push(item));
    return ordered;
  }, [defaultModalCols, customColOrder]);

  function handleExportCsv() {
    const headers = activeModalCols.map((col) => col.label);
    const exportData = previewRows.map((row) => activeModalCols.map((col) => col.exportValue(row)));
    const csvContent =
      "\uFEFF" +
      [
        headers.join(","),
        ...exportData.map((row) => row.map((c) => `"${(c ?? "").replace(/"/g, '""')}"`).join(",")),
      ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", defaultExportFilename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleUploadCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) {
        return;
      }

      const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
      if (lines.length <= 1) {
        alert("유효한 CSV 데이터가 없습니다.");
        return;
      }

      // Parse header row
      const rawHeaderCols = lines[0].split(",").map((c) =>
        c
          .replace(/^["']|["']$/g, "")
          .trim()
          .toLowerCase()
      );
      const hasHeader = rawHeaderCols.some(
        (h) =>
          h.includes("이름") ||
          h.includes("성명") ||
          h.includes("트랙") ||
          h.includes("부문") ||
          h.includes("팀") ||
          h.includes("기수")
      );

      const nameIdx = rawHeaderCols.findIndex(
        (h) => h.includes("이름") || h.includes("성명") || h.includes("부원") || h === "name"
      );
      const trackIdx = rawHeaderCols.findIndex(
        (h) => h.includes("트랙") || h.includes("부문") || h.includes("분야") || h === "track"
      );
      const teamIdx = rawHeaderCols.findIndex(
        (h) => h.includes("팀") || h.includes("소속") || h === "team"
      );
      const termIdx = rawHeaderCols.findIndex(
        (h) => h.includes("기수") || h.includes("기") || h === "term"
      );
      const statusIdx = rawHeaderCols.findIndex(
        (h) => h.includes("출결") || h.includes("상태") || h.includes("출석") || h === "status"
      );
      const memoIdx = rawHeaderCols.findIndex(
        (h) => h.includes("비고") || h.includes("메모") || h.includes("사유") || h === "memo"
      );

      const dataRows = hasHeader ? lines.slice(1) : lines;
      const newAttendeesList: InternalAttendee[] = [];
      const trackCountMap: Record<string, number> = {};

      dataRows.forEach((row, idx) => {
        const cols = row.split(",").map((c) => c.replace(/^["']|["']$/g, "").trim());
        if (cols.length === 0 || cols.every((c) => c === "")) {
          return;
        }

        // Fallback index assignment if not recognized by header
        let trackRaw = (trackIdx >= 0 ? cols[trackIdx] : "") || "";
        let teamRaw = (teamIdx >= 0 ? cols[teamIdx] : "") || "";
        let nameRaw = (nameIdx >= 0 ? cols[nameIdx] : "") || "";
        let termRaw = (termIdx >= 0 ? cols[termIdx] : "") || "";
        let statusRaw = (statusIdx >= 0 ? cols[statusIdx] : "") || "";
        let memoRaw = (memoIdx >= 0 ? cols[memoIdx] : "") || "";

        if (!hasHeader) {
          if (cols.length >= 6) {
            // [트랙, 소속팀, 이름, 기수, 출결, 비고]
            trackRaw = cols[0];
            teamRaw = cols[1];
            nameRaw = cols[2];
            termRaw = cols[3];
            statusRaw = cols[4];
            memoRaw = cols[5];
          } else if (cols.length >= 4) {
            nameRaw = cols[0];
            termRaw = cols[1];
            trackRaw = cols[2];
            statusRaw = cols[3];
            memoRaw = cols[4] || "";
          }
        }

        const name = nameRaw || `부원_${idx + 1}`;
        const term = parseInt(termRaw.replace(/[^0-9]/g, ""), 10) || 28;

        // 1. Normalize track (부문)
        const normalizedTrack = trackRaw.includes("분석")
          ? "분석"
          : trackRaw.includes("시각")
            ? "시각화"
            : trackRaw.includes("엔지")
              ? "엔지니어링"
              : trackRaw || selectedTeam.track || "분석";

        // 2. Intelligently match team in config.teams by track and team name / number
        let matchedTeam = config.teams.find((t) => {
          if (t.track && t.track !== normalizedTrack) {
            return false;
          }
          if (t.id.toLowerCase() === teamRaw.toLowerCase()) {
            return true;
          }

          const cleanTeamName = t.name.replace(/\s+/g, "");
          const cleanTeamRaw = teamRaw.replace(/\s+/g, "");
          if (
            cleanTeamName &&
            cleanTeamRaw &&
            (cleanTeamName.includes(cleanTeamRaw) || cleanTeamRaw.includes(cleanTeamName))
          ) {
            return true;
          }

          const numT = t.name.match(/(\d+)팀/);
          const numRaw = teamRaw.match(/(\d+)팀/);
          if (numT && numRaw && numT[1] === numRaw[1]) {
            return true;
          }
          return false;
        });

        // If no track-filtered team matched, try matching by team name across all teams
        if (!matchedTeam && teamRaw) {
          matchedTeam = config.teams.find((t) => {
            const cleanTeamName = t.name.replace(/\s+/g, "");
            const cleanTeamRaw = teamRaw.replace(/\s+/g, "");
            return cleanTeamName.includes(cleanTeamRaw) || cleanTeamRaw.includes(cleanTeamName);
          });
        }

        // Fallback: use first team of normalized track or selected team
        if (!matchedTeam) {
          matchedTeam =
            config.teams.find((t) => t.track === normalizedTrack) ||
            config.teams[0] ||
            selectedTeam;
        }

        // 3. Determine status
        const stLower = statusRaw.toLowerCase();
        const status: AttendStatus =
          stLower.includes("지각") || stLower === "late"
            ? category === "SESSION"
              ? "late"
              : "present"
            : stLower.includes("결석") || stLower === "absent"
              ? "absent"
              : "present";

        const resolvedTeamId = matchedTeam.id;
        const resolvedTeamName = matchedTeam.name;

        newAttendeesList.push({
          id: `att_csv_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          eventId: selectedEvent.id,
          teamId: resolvedTeamId,
          teamName: resolvedTeamName,
          name,
          term,
          track: normalizedTrack,
          status,
          checkedInAt: status === "present" || status === "late" ? "14:00" : "-",
          memo: memoRaw || undefined,
        });

        trackCountMap[normalizedTrack] = (trackCountMap[normalizedTrack] || 0) + 1;
      });

      if (newAttendeesList.length > 0) {
        if (isAllSelected) {
          // Replace all attendees for current event
          setAttendees((prev) => [
            ...newAttendeesList,
            ...prev.filter((a) => a.eventId !== selectedEvent.id),
          ]);
        } else {
          // Replace only selected team/track attendees
          setAttendees((prev) => [
            ...newAttendeesList,
            ...prev.filter(
              (a) => !(a.eventId === selectedEvent.id && a.teamId === selectedTeam.id)
            ),
          ]);
        }

        const summaryText = Object.entries(trackCountMap)
          .map(([track, count]) => `${track} ${count}명`)
          .join(", ");

        alert(
          `✅ CSV 업로드 완료!\n총 ${newAttendeesList.length}명의 출석 데이터를 팀/부문별로 자동 분류하여 등록했습니다.\n(${summaryText})`
        );
      } else {
        alert("업로드할 수 있는 유효한 데이터 행이 없습니다.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  return (
    <div
      className="flex flex-col flex-1 h-full min-h-0 space-y-3 w-full"
      style={{
        fontFamily:
          "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif",
      }}
    >
      {/* ─── 1. Top Header & Global Actions ─── */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3.5">
          <h2 className="text-slate-950 font-black text-lg sm:text-xl tracking-tight">
            {config.title}
          </h2>

          {/* 방학 / 학기 토글 버튼 (Segmented Control) */}
          <div className="flex items-center p-0.5 rounded-xl bg-slate-100/90 border border-slate-200/80 text-xs font-semibold select-none">
            <button
              type="button"
              onClick={() => {
                setTermPeriod("VACATION");
                setSelectedWeekVacation(0);
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === "VACATION"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              방학
            </button>
            <button
              type="button"
              onClick={() => {
                setTermPeriod("SEMESTER");
                setSelectedWeekSemester(0);
              }}
              className={`px-3 py-1 rounded-lg transition-all cursor-pointer font-bold ${
                termPeriod === "SEMESTER"
                  ? "bg-white text-slate-900 shadow-2xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              학기
            </button>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2">
          {category === "SESSION" && (
            <label className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.98]">
              <Upload size={13} />
              <span>CSV 업로드</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleUploadCsv}
              />
            </label>
          )}
        </div>
      </div>

      {/* ─── 2. 주차 선택 토글 바 (수평 스크롤 & 위치 완전 고정) ─── */}
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
          <button
            type="button"
            onClick={() => setSelectedWeek(0)}
            className={`w-[74px] h-[34px] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0 select-none ${
              selectedWeek === 0
                ? "bg-slate-900 text-white border border-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 bg-white border border-slate-200/90 shadow-2xs"
            }`}
          >
            <span>전체 주차</span>
          </button>
          {weekList.map((w) => {
            const isActive = selectedWeek === w.weekNum;
            return (
              <button
                key={w.id}
                type="button"
                onClick={() => setSelectedWeek(w.weekNum)}
                className={`w-[58px] h-[34px] rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center shrink-0 select-none ${
                  isActive
                    ? "bg-slate-900 text-white border border-slate-900 shadow-xs"
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

      {/* ─── 3. Team-Centric Notion Split View ─── */}
      <div
        ref={containerRef}
        className={`relative w-full flex-1 min-h-0 transition-all ${
          isPeekOpen
            ? isFullScreen
              ? "block h-full"
              : "flex flex-col lg:flex-row gap-0 h-full"
            : "block h-full"
        }`}
      >
        {/* ─── LEFT PANE: 팀별 목록 (Team List) ─── */}
        {(!isFullScreen || !isPeekOpen) && (
          <div
            style={{
              width: isPeekOpen ? `${splitRatio}%` : "100%",
              minWidth: isPeekOpen ? "220px" : undefined,
            }}
            className={`space-y-2.5 shrink-0 h-full overflow-y-auto ${isPeekOpen ? "lg:pr-3" : "w-full"}`}
          >
            {/* Master '전체' 통합 Card (ADV / STUDY 전용) */}
            {(category === "ADV" || category === "STUDY") && (
              <div
                onClick={() => {
                  setSelectedTeamId("ALL");
                  setIsPeekOpen(true);
                }}
                className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                  isAllSelected && isPeekOpen
                    ? category === "ADV"
                      ? "bg-purple-50/70 border-purple-500 shadow-xs ring-1 ring-purple-500/20"
                      : "bg-sky-50/70 border-sky-500 shadow-xs ring-1 ring-sky-500/20"
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <h4
                      className={`text-sm font-bold truncate ${
                        isAllSelected && isPeekOpen
                          ? category === "ADV"
                            ? "text-purple-950 font-black"
                            : "text-sky-950 font-black"
                          : "text-slate-900 group-hover:text-slate-800"
                      }`}
                    >
                      {category === "STUDY" ? "전체 스터디" : "전체"}
                    </h4>
                  </div>

                  <ChevronRight
                    size={16}
                    className={`shrink-0 transition-transform ${
                      isAllSelected && isPeekOpen
                        ? category === "ADV"
                          ? "text-purple-600 translate-x-0.5"
                          : "text-sky-600 translate-x-0.5"
                        : "text-slate-300 group-hover:text-slate-500"
                    }`}
                  />
                </div>
              </div>
            )}

            {/* Team Cards List */}
            {category === "ADV" ? (
              <div className="space-y-4">
                {(["분석", "시각화", "엔지니어링"] as const).map((trackName) => {
                  const trackTeams = config.teams.filter((t) => t.track === trackName);
                  if (trackTeams.length === 0) {
                    return null;
                  }

                  return (
                    <div key={trackName} className="space-y-2">
                      <div className="px-1 pt-1">
                        <span className="text-xs font-semibold text-slate-500">{trackName}</span>
                      </div>

                      <div className="space-y-2">
                        {trackTeams.map((team) => {
                          const isSelected = selectedTeamId === team.id && isPeekOpen;

                          return (
                            <div
                              key={team.id}
                              onClick={() => {
                                setSelectedTeamId(team.id);
                                setIsPeekOpen(true);
                              }}
                              className={`relative rounded-2xl border transition-all cursor-pointer p-3.5 group select-none ${
                                isSelected
                                  ? "bg-purple-50/50 border-purple-500 shadow-xs ring-1 ring-purple-500/20"
                                  : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="space-y-1 min-w-0 flex-1">
                                  <h4
                                    className={`text-sm font-bold truncate ${
                                      isSelected
                                        ? "text-purple-950 font-black"
                                        : "text-slate-900 group-hover:text-purple-600"
                                    }`}
                                  >
                                    {team.name}
                                  </h4>

                                  {team.leader && (
                                    <p className="text-[11px] text-slate-500 font-medium">
                                      팀장: {team.leader}
                                    </p>
                                  )}
                                </div>

                                <ChevronRight
                                  size={16}
                                  className={`shrink-0 transition-transform ${
                                    isSelected
                                      ? "text-purple-600 translate-x-0.5"
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
                {category === "STUDY" && (
                  <div className="px-1 pt-1 text-[11px] font-bold text-slate-400 select-none">
                    개별 스터디
                  </div>
                )}
                {config.teams.map((team) => {
                  const isSelected = selectedTeamId === team.id && isPeekOpen;

                  return (
                    <div
                      key={team.id}
                      onClick={() => {
                        setSelectedTeamId(team.id);
                        setIsPeekOpen(true);
                      }}
                      className={`relative rounded-2xl border transition-all cursor-pointer p-4 group select-none ${
                        isSelected
                          ? "bg-blue-50/50 border-blue-500 shadow-xs ring-1 ring-blue-500/20"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="space-y-1 min-w-0 flex-1">
                          <h4
                            className={`text-sm font-bold truncate ${
                              isSelected
                                ? "text-blue-950 font-black"
                                : "text-slate-900 group-hover:text-blue-600"
                            }`}
                          >
                            {team.name}
                          </h4>

                          {category !== "SESSION" && team.leader && (
                            <p className="text-[11px] text-slate-500 font-medium">
                              {category === "STUDY" ? "스터디장" : "팀장"}: {team.leader}
                            </p>
                          )}
                        </div>

                        <ChevronRight
                          size={16}
                          className={`shrink-0 transition-transform ${
                            isSelected
                              ? "text-blue-600 translate-x-0.5"
                              : "text-slate-300 group-hover:text-slate-500"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── RESIZABLE DRAGGER / DIVIDER BAR ─── */}
        {isPeekOpen && !isFullScreen && (
          <div
            onMouseDown={handleDividerMouseDown}
            className={`hidden lg:flex w-4 shrink-0 -mx-1 items-center justify-center cursor-col-resize group self-stretch z-20 select-none py-12 transition-colors ${
              isDragging ? "bg-blue-100/50" : "hover:bg-slate-100/80"
            }`}
            title="마우스로 드래그하여 패널 너비 조절"
          >
            <div
              className={`w-1 h-14 rounded-full transition-all flex flex-col items-center justify-center ${
                isDragging
                  ? "bg-blue-500 h-20"
                  : "bg-slate-300 group-hover:bg-blue-400 group-hover:h-16"
              }`}
            >
              <GripVertical
                size={10}
                className="text-white opacity-0 group-hover:opacity-100 transition-opacity"
              />
            </div>
          </div>
        )}

        {/* ─── RIGHT PANE: 인원 목록 & 활동 사진 (Side Peek Detail) ─── */}
        {isPeekOpen && (
          <div
            style={{
              width: isFullScreen ? "100%" : `${100 - splitRatio}%`,
              minWidth: isFullScreen ? undefined : "340px",
            }}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 lg:p-7 shadow-sm space-y-4 animate-in slide-in-from-right duration-150 min-w-0 flex-1 h-full overflow-y-auto"
          >
            {/* Peek Detail Header */}
            <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <h3 className="text-xl sm:text-2xl font-black text-slate-950 tracking-tight leading-snug truncate">
                  {selectedTeam.name}
                </h3>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer hidden sm:flex items-center gap-0.5 text-xs font-semibold"
                  title={isFullScreen ? "분할 뷰로 축소" : "전체 화면으로 확장"}
                >
                  {isFullScreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPeekOpen(false);
                    setIsFullScreen(false);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-0.5 text-xs font-semibold"
                  title="사이드 패널 닫기"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            </div>

            {/* Photo Section: 원래처럼 사진만 깔끔하게 노출 */}
            {!isAllSelected &&
              category !== "SESSION" &&
              (WEEK_SAMPLE_PHOTOS[selectedWeek] || (selectedWeek === 0 && WEEK_SAMPLE_PHOTOS[3]) ? (
                <div className="flex justify-center w-full py-1">
                  <div
                    onClick={() => setShowImageZoom(true)}
                    className="relative group w-fit max-w-[480px] sm:max-w-[540px] rounded-lg overflow-hidden border border-slate-200 bg-white shadow-2xs cursor-zoom-in select-none"
                    title="클릭하여 원본 사진 크게 보기"
                  >
                    <img
                      src={WEEK_SAMPLE_PHOTOS[selectedWeek] || WEEK_SAMPLE_PHOTOS[3]}
                      alt={`${selectedTeam.name} ${selectedWeek === 0 ? "활동" : `${selectedWeek}주차`} 사진`}
                      className="w-full h-auto max-h-56 sm:max-h-64 object-contain block hover:opacity-95 transition-opacity"
                    />
                    <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1 backdrop-blur-xs">
                      <ZoomIn size={15} /> 원본 확대 보기
                    </div>
                  </div>
                </div>
              ) : null)}

            {/* Table Header Summary: 자연스러운 여백 및 트랙 필터 / 기수 필터 / 정렬 / CSV 추출 버튼 */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1.5 pb-1 px-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-bold text-slate-900 tracking-tight whitespace-nowrap">
                  {category === "STUDY"
                    ? isAllSelected
                      ? termPeriod === "VACATION"
                        ? selectedWeek === 0
                          ? "방학 전체 스터디 명단"
                          : `방학 ${selectedWeek}주차 스터디 명단`
                        : selectedWeek === 0
                          ? "학기 전체 스터디 명단"
                          : `학기 ${selectedWeek}주차 스터디 명단`
                      : `${selectedTeam?.name || "스터디"} (${
                          termPeriod === "VACATION"
                            ? selectedWeek === 0
                              ? "방학 전체"
                              : `방학 ${selectedWeek}주차`
                            : selectedWeek === 0
                              ? "학기 전체"
                              : `학기 ${selectedWeek}주차`
                        }) 출결 명단`
                    : termPeriod === "VACATION"
                      ? selectedWeek === 0
                        ? "방학 전체 (1~8주차)"
                        : `방학 ${selectedWeek}주차`
                      : selectedWeek === 0
                        ? "학기 전체 (9~16주차)"
                        : `학기 ${selectedWeek}주차`}{" "}
                  {category !== "STUDY" && "출결 명단"}
                </h4>

                {/* Track Filter Pill Buttons (스터디 및 BASE 출결에서는 숨김) */}
                {category !== "STUDY" && category !== "SESSION" && (
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold select-none shadow-2xs">
                    {TRACK_FILTER_OPTIONS.map((tf) => {
                      const isSelected = selectedTrackFilter === tf.id;
                      return (
                        <button
                          key={tf.id}
                          type="button"
                          onClick={() => setSelectedTrackFilter(tf.id)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            isSelected
                              ? "bg-white text-slate-950 shadow-xs border border-slate-200/60"
                              : "text-slate-500 hover:text-slate-800"
                          }`}
                        >
                          {tf.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* 전체 스터디 정렬 기준 토글: 기수별(기본) vs 팀별 */}
                {category === "STUDY" && isAllSelected && (
                  <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-semibold select-none shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setStudySortMode("TERM")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        studySortMode === "TERM"
                          ? "bg-white text-slate-950 shadow-xs border border-slate-200/60"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      기수별
                    </button>
                    <button
                      type="button"
                      onClick={() => setStudySortMode("TEAM")}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        studySortMode === "TEAM"
                          ? "bg-white text-slate-950 shadow-xs border border-slate-200/60"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      팀별
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* 수정 버튼: ADV 팀별 탭 & 스터디 개별 탭에서 전체 주차일 때 표시 */}
                {!isAllSelected &&
                  selectedWeek === 0 &&
                  (category === "ADV" || category === "STUDY") && (
                    <button
                      type="button"
                      onClick={() => setIsTableEditMode((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        isTableEditMode
                          ? "bg-blue-600 hover:bg-blue-700 text-white border border-blue-600 shadow-xs"
                          : "text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300"
                      }`}
                      title={isTableEditMode ? "출결 수정 완료" : "출결 수정 모드 활성화"}
                    >
                      {isTableEditMode ? (
                        <>
                          <Check size={12} className="text-white" />
                          <span>수정 완료</span>
                        </>
                      ) : (
                        <>
                          <Edit3 size={12} className="text-slate-500" />
                          <span>수정</span>
                        </>
                      )}
                    </button>
                  )}

                {/* CSV 추출 버튼: 전체 주차일 때 표시 (단, ADV 팀별 탭은 제외) */}
                {selectedWeek === 0 && !(category === "ADV" && !isAllSelected) && (
                  <button
                    type="button"
                    onClick={handleOpenSettingsModal}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                    title="출결 CSV 날짜 매핑 및 추출 설정"
                  >
                    <Settings size={12} className="text-slate-500" />
                    <span>CSV 추출</span>
                  </button>
                )}
              </div>
            </div>

            {/* Table Container: 상단 모서리 깨짐 없는 깔끔한 솔리드 라운드 박스 */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
              <div ref={tableContainerRef} className="overflow-x-auto select-none relative">
                {category === "STUDY" ? (
                  isAllSelected ? (
                    /* ─── 전체 스터디 테이블 ─── */
                    /* 컬럼: 기수, 부문, 이름, 각 스터디명 컬럼들 (누적 점수 표시), 총점 */
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={{ minWidth: `${studyAllTableMinWidth}px` }}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          <th
                            style={{ width: `${colWidths.study_all_index || 42}px` }}
                            className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">#</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_all_index", 35)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_all_index");
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
                            style={{ width: `${colWidths.study_all_term || 55}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_all_term", 45)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_all_term");
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
                            style={{ width: `${colWidths.study_all_track || 65}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">부문</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_all_track", 55)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_all_track");
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
                            style={{ width: `${colWidths.study_all_name || 80}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_all_name", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_all_name");
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
                          {config.teams.map((team) => {
                            const colKey = `study_all_col_${team.id}`;
                            const defaultWidth = 160;
                            const minWidth = 100;
                            const effectiveWidth = Math.max(
                              colWidths[colKey] || defaultWidth,
                              minWidth
                            );

                            return (
                              <th
                                key={team.id}
                                style={{ width: `${effectiveWidth}px` }}
                                className="relative text-center px-2 py-1 text-slate-800 font-bold bg-slate-50/80"
                              >
                                <div className="h-9 flex flex-col items-center justify-center px-1">
                                  <span
                                    className="font-bold text-xs truncate max-w-full"
                                    title={team.name}
                                  >
                                    {team.name}
                                  </span>
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, colKey, minWidth)}
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
                          })}
                          <th
                            style={{ width: `${colWidths.study_all_score || 70}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center font-bold text-xs">
                              총점
                            </div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_all_score", 55)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_all_score");
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filteredMatrixRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5 + config.teams.length}
                              className="py-12 text-center text-slate-400 space-y-1 font-sans"
                            >
                              <Users size={28} className="mx-auto text-slate-300 mb-1" />
                              <p className="font-bold text-slate-700 text-xs">
                                해당 조건의 인원이 없습니다.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          filteredMatrixRows.map((row, idx) => (
                            <tr
                              key={row.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                            >
                              <td className="relative px-1 py-1.5 text-center text-slate-400 text-[11px]">
                                <div className="h-8 flex items-center justify-center">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs">
                                <div className="h-8 flex items-center justify-center">
                                  {row.term}기
                                </div>
                              </td>
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans font-medium">
                                <div className="h-8 flex items-center justify-center">
                                  {row.track}
                                </div>
                              </td>
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans">
                                <div className="h-8 flex items-center justify-center">
                                  {row.name}
                                </div>
                              </td>
                              {config.teams.map((team) => {
                                const isMember = row.teamId === team.id;

                                return (
                                  <td
                                    key={team.id}
                                    className="relative text-center px-1.5 py-1.5 font-mono bg-white"
                                  >
                                    <div className="h-8 flex items-center justify-center">
                                      {isMember ? (
                                        <span
                                          className={`text-xs font-bold ${
                                            row.totalScore === 0
                                              ? "text-slate-400 font-medium"
                                              : row.totalScore < 0
                                                ? "text-rose-600 font-bold"
                                                : "text-emerald-700 font-bold"
                                          }`}
                                        >
                                          {row.totalScore > 0
                                            ? `+${row.totalScore}점`
                                            : `${row.totalScore}점`}
                                        </span>
                                      ) : (
                                        <span className="text-slate-200 font-mono">-</span>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td className="relative text-center px-2 py-1.5 font-bold font-mono bg-slate-50/60">
                                <div className="h-8 flex items-center justify-center">
                                  <span
                                    className={`text-xs font-bold ${
                                      row.totalScore === 0
                                        ? "text-slate-400 font-medium"
                                        : row.totalScore < 0
                                          ? "text-rose-600 font-bold"
                                          : "text-emerald-700 font-bold"
                                    }`}
                                  >
                                    {row.totalScore > 0
                                      ? `+${row.totalScore}점`
                                      : `${row.totalScore}점`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    /* ─── 각 스터디별 테이블 ─── */
                    /* 컬럼: 기수, 이름, 1주차~8주차, 참여 횟수, 스터디장, 점수 */
                    <table
                      className="w-full text-xs table-fixed border-collapse"
                      style={{ minWidth: `${studyTeamTableMinWidth}px` }}
                    >
                      <thead className="bg-slate-50/80 select-none">
                        <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                          <th
                            style={{ width: `${colWidths.study_team_index || 42}px` }}
                            className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">#</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_index", 35)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_index");
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
                            style={{ width: `${colWidths.study_team_term || 55}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">기수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_term", 45)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_term");
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
                            style={{ width: `${colWidths.study_team_name || 80}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">이름</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_name", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_name");
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
                          {displayedMatrixWeeks.map((w) => {
                            const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                            const hasDate = Boolean(rawDate && rawDate !== "-");
                            const colKey = `study_w_${w.weekNum}`;
                            const minColWidth = 55;
                            const defaultColWidth = 72;
                            const effectiveColWidth = Math.max(
                              colWidths[colKey] || defaultColWidth,
                              minColWidth
                            );
                            return (
                              <th
                                key={w.id}
                                style={{ width: `${effectiveColWidth}px` }}
                                className="relative text-center px-1.5 py-1 text-slate-900 font-bold bg-slate-50/80"
                              >
                                <div className="h-9 flex flex-col items-center justify-center">
                                  {hasDate ? (
                                    <>
                                      <div className="font-mono font-bold text-slate-900 text-xs leading-none">
                                        {rawDate}
                                      </div>
                                      <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                        {w.label}
                                      </div>
                                    </>
                                  ) : (
                                    <div className="font-bold text-slate-900 text-xs leading-none">
                                      {w.label}
                                    </div>
                                  )}
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, colKey, minColWidth)}
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
                          })}
                          <th
                            style={{ width: `${colWidths.study_team_attended || 85}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-semibold bg-slate-50/80"
                          >
                            <div className="h-9 flex items-center justify-center">참여 횟수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_attended", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_attended");
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
                            style={{ width: `${colWidths.study_team_leader || 85}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-semibold bg-slate-50/80"
                          >
                            <div className="h-9 flex items-center justify-center">스터디장</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_leader", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_leader");
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
                            style={{ width: `${colWidths.study_team_score || 80}px` }}
                            className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">점수</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "study_team_score", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("study_team_score");
                                  updateGuidelinePos(e.currentTarget);
                                }
                              }}
                              onMouseLeave={() => {
                                if (!resizingColKey) {
                                  setActiveHoverCol(null);
                                  setGuidelineX(null);
                                }
                              }}
                              className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                              title="열 너비 조절"
                            />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {studyTeamRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={3 + displayedMatrixWeeks.length + 3}
                              className="py-12 text-center text-slate-400 space-y-1 font-sans"
                            >
                              <Users size={28} className="mx-auto text-slate-300 mb-1" />
                              <p className="font-bold text-slate-700 text-xs">
                                해당 스터디 팀에 등록된 인원이 없습니다.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          studyTeamRows.map((row, idx) => {
                            const isLeader = row.name === selectedTeam?.leader;
                            const attendedCount = currentTermWeeks.filter(
                              (w) => row.weekData[w.weekNum]?.status === "present"
                            ).length;
                            const effectiveScore = (() => {
                              if (selectedWeek === 0) {
                                return row.totalScore;
                              }
                              const currentStatus = row.weekData[selectedWeek]?.status;
                              if (currentStatus === "absent") {
                                return currentScoreRule.absentPenalty ?? -3;
                              }
                              if (currentStatus === "unexcusedAbsent") {
                                return currentScoreRule.unexcusedAbsentPenalty ?? -4;
                              }
                              if (
                                currentStatus === "late" ||
                                currentStatus === "earlyLeave" ||
                                currentStatus === "unexcusedLate"
                              ) {
                                return currentScoreRule.latePenalty ?? -1;
                              }
                              return 0;
                            })();

                            return (
                              <tr
                                key={row.id}
                                className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                              >
                                <td className="relative px-1 py-1.5 text-center text-slate-400 text-[11px]">
                                  <div className="h-8 flex items-center justify-center">
                                    {idx + 1}
                                  </div>
                                </td>
                                <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs">
                                  <div className="h-8 flex items-center justify-center">
                                    {row.term}기
                                  </div>
                                </td>
                                <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans">
                                  <div className="h-8 flex items-center justify-center">
                                    {row.name}
                                  </div>
                                </td>
                                {displayedMatrixWeeks.map((w) => {
                                  const cell = row.weekData[w.weekNum];
                                  const st = cell?.status || "unmarked";
                                  const cfg = ATTEND_STATUS_CFG[st] || ATTEND_STATUS_CFG.unmarked;
                                  const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                                  const hasDate = Boolean(rawDate && rawDate !== "-");

                                  return (
                                    <td
                                      key={w.id}
                                      className="relative text-center px-1 py-1.5 font-sans"
                                    >
                                      <div className="h-8 flex items-center justify-center w-full">
                                        {isTableEditMode && st !== "unmarked" ? (
                                          (() => {
                                            const isOpen =
                                              activeStudyEditCell?.rowId === row.id &&
                                              activeStudyEditCell?.weekNum === w.weekNum;
                                            const isRightEdge = w.weekNum >= 7;
                                            const isLastRow = idx >= studyTeamRows.length - 1;
                                            const isFirstRow = idx === 0;
                                            const vAlignClass = isLastRow
                                              ? "bottom-0"
                                              : isFirstRow
                                                ? "top-0"
                                                : "top-1/2 -translate-y-1/2";

                                            return (
                                              <div className="relative flex items-center justify-center">
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setActiveStudyEditCell(
                                                      isOpen
                                                        ? null
                                                        : { rowId: row.id, weekNum: w.weekNum }
                                                    )
                                                  }
                                                  className={`w-[56px] h-[26px] rounded-md text-[11px] font-bold transition-all cursor-pointer shadow-2xs flex items-center justify-between px-1.5 border ${
                                                    isOpen
                                                      ? "bg-white border-blue-500 ring-2 ring-blue-100 shadow-xs"
                                                      : "bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                                                  }`}
                                                >
                                                  <span
                                                    className={
                                                      st === "present"
                                                        ? "text-emerald-700"
                                                        : "text-rose-600"
                                                    }
                                                  >
                                                    {st === "present" ? "출석" : "결석"}
                                                  </span>
                                                  <ChevronRight
                                                    size={10}
                                                    className={`text-slate-400 transition-transform duration-150 ${isOpen ? "text-blue-600" : ""}`}
                                                  />
                                                </button>

                                                {isOpen && (
                                                  <>
                                                    {/* Backdrop to close on click outside */}
                                                    <div
                                                      className="fixed inset-0 z-40"
                                                      onClick={() => setActiveStudyEditCell(null)}
                                                    />
                                                    {/* Modern Compact Popover Dropdown (Right-aligned) */}
                                                    <div
                                                      className={`absolute ${isRightEdge ? "right-full mr-1" : "left-full ml-1"} ${vAlignClass} w-[78px] bg-white rounded-lg shadow-lg border border-slate-200 p-0.5 z-50 animate-in fade-in zoom-in-95 duration-100 font-sans`}
                                                    >
                                                      <div className="space-y-0.5">
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            handleStatusChange(
                                                              row.id,
                                                              "present",
                                                              w.weekNum
                                                            );
                                                            setActiveStudyEditCell(null);
                                                          }}
                                                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                                            st === "present"
                                                              ? "bg-emerald-50 text-emerald-700 font-bold"
                                                              : "text-slate-700 font-medium hover:bg-slate-50 hover:text-emerald-700"
                                                          }`}
                                                        >
                                                          <span>출석</span>
                                                          {st === "present" && (
                                                            <Check
                                                              size={11}
                                                              className="text-emerald-600 stroke-[2.5]"
                                                            />
                                                          )}
                                                        </button>

                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            handleStatusChange(
                                                              row.id,
                                                              "absent",
                                                              w.weekNum
                                                            );
                                                            setActiveStudyEditCell(null);
                                                          }}
                                                          className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-[11px] transition-colors cursor-pointer ${
                                                            st === "absent"
                                                              ? "bg-rose-50 text-rose-600 font-bold"
                                                              : "text-slate-700 font-medium hover:bg-slate-50 hover:text-rose-600"
                                                          }`}
                                                        >
                                                          <span>결석</span>
                                                          {st === "absent" && (
                                                            <Check
                                                              size={11}
                                                              className="text-rose-600 stroke-[2.5]"
                                                            />
                                                          )}
                                                        </button>
                                                      </div>
                                                    </div>
                                                  </>
                                                )}
                                              </div>
                                            );
                                          })()
                                        ) : (
                                          <div className="relative w-[66px] h-[30px] flex items-center justify-center">
                                            <span
                                              title={`${row.name} - ${w.label}${hasDate ? ` (${rawDate})` : ""}: ${cfg.label}${cell?.memo ? `\n비고: ${cell.memo}` : ""}`}
                                              className={`text-xs whitespace-nowrap select-none font-bold ${
                                                st === "present"
                                                  ? "text-emerald-700"
                                                  : st === "late" || st === "earlyLeave"
                                                    ? "text-amber-700"
                                                    : st === "absent"
                                                      ? "text-rose-600"
                                                      : st === "excusedAbsent"
                                                        ? "text-blue-700"
                                                        : st === "remote"
                                                          ? "text-indigo-700"
                                                          : st === "unexcusedLate"
                                                            ? "text-orange-700"
                                                            : st === "unexcusedAbsent"
                                                              ? "text-red-700"
                                                              : "text-slate-400 font-medium"
                                              }`}
                                            >
                                              {cfg.label}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })}
                                <td className="relative px-2 py-1.5 text-center text-xs font-sans font-bold text-slate-800">
                                  <div className="h-8 flex items-center justify-center font-mono">
                                    {attendedCount}회
                                  </div>
                                </td>
                                <td className="relative px-2 py-1.5 text-center text-xs font-sans">
                                  <div className="h-8 flex items-center justify-center font-mono">
                                    {isLeader ? (
                                      <span className="text-xs font-bold text-slate-900">O</span>
                                    ) : (
                                      <span className="text-slate-200">-</span>
                                    )}
                                  </div>
                                </td>
                                <td className="relative text-center px-1.5 py-1.5 font-mono bg-slate-50/60">
                                  <div className="h-8 flex items-center justify-center">
                                    <span
                                      className={`text-xs font-bold ${
                                        effectiveScore === 0
                                          ? "text-slate-400 font-medium"
                                          : effectiveScore < 0
                                            ? "text-rose-600 font-bold"
                                            : "text-emerald-700 font-bold"
                                      }`}
                                    >
                                      {effectiveScore > 0
                                        ? `+${effectiveScore}점`
                                        : `${effectiveScore}점`}
                                    </span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  )
                ) : isMatrixMode ? (
                  <table
                    className="w-full text-xs table-fixed border-collapse"
                    style={{ minWidth: `${matrixTableMinWidth}px` }}
                  >
                    <thead className="bg-slate-50/80 select-none">
                      <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                        <th
                          style={{ width: `${colWidths.matrix_index || 42}px` }}
                          className="relative text-center px-1 py-1 text-slate-500 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">#</div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "matrix_index", 35)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("matrix_index");
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
                          style={{ width: `${colWidths.matrix_term || 52}px` }}
                          className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">기수</div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "matrix_term", 45)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("matrix_term");
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
                          style={{ width: `${colWidths.matrix_name || 80}px` }}
                          className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">이름</div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "matrix_name", 60)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("matrix_name");
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
                        {category !== "SESSION" && selectedTrackFilter === "ALL" && (
                          <th
                            style={{ width: `${colWidths.matrix_track || 65}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">부문</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "matrix_track", 50)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("matrix_track");
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
                        )}
                        {displayedMatrixWeeks.map((w) => {
                          const isEditable = isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
                          const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                          const hasDate = Boolean(rawDate && rawDate !== "-");
                          const colKey = `matrix_w_${w.weekNum}`;
                          const minColWidth = isEditable ? 435 : 55;
                          const defaultColWidth = isEditable ? 445 : 72;
                          const effectiveColWidth = Math.max(
                            colWidths[colKey] || defaultColWidth,
                            minColWidth
                          );
                          return (
                            <th
                              key={w.id}
                              style={{ width: `${effectiveColWidth}px` }}
                              className="relative text-center px-1.5 py-1 text-slate-900 font-bold"
                            >
                              <div className="h-9 flex flex-col items-center justify-center">
                                {hasDate ? (
                                  <>
                                    <div className="font-mono font-bold text-slate-900 text-xs leading-none">
                                      {rawDate}
                                    </div>
                                    <div className="text-[10px] text-slate-400 font-normal leading-tight mt-0.5">
                                      {w.label}
                                    </div>
                                  </>
                                ) : (
                                  <div className="font-bold text-slate-900 text-xs leading-none">
                                    {w.label}
                                  </div>
                                )}
                              </div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, colKey, minColWidth)}
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
                        })}
                        {selectedWeek === 0 && (
                          <>
                            <th
                              style={{ width: `${colWidths.matrix_absence || 60}px` }}
                              className="relative text-center px-2 py-1 text-slate-800 font-bold bg-pink-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">결석</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, "matrix_absence", 45)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("matrix_absence");
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
                              style={{ width: `${colWidths.matrix_unexcusedAbsence || 68}px` }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-red-200/90"
                            >
                              <div className="h-9 flex items-center justify-center">무단결석</div>
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(e, "matrix_unexcusedAbsence", 50)
                                }
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("matrix_unexcusedAbsence");
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
                              style={{ width: `${colWidths.matrix_late || 68}px` }}
                              className="relative text-center px-2 py-1 text-slate-800 font-bold bg-amber-100"
                            >
                              <div className="h-9 flex items-center justify-center">지각조퇴</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, "matrix_late", 50)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("matrix_late");
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
                            {category === "ADV" && (
                              <th
                                style={{ width: `${colWidths.matrix_remote || 75}px` }}
                                className="relative text-center px-2 py-1 text-slate-800 font-bold bg-indigo-100"
                              >
                                <div className="h-9 flex items-center justify-center">
                                  비대면 횟수
                                </div>
                                <div
                                  onMouseDown={(e) => handleResizeStart(e, "matrix_remote", 55)}
                                  onMouseEnter={(e) => {
                                    if (!resizingColKey) {
                                      setActiveHoverCol("matrix_remote");
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
                            )}
                          </>
                        )}
                        <th
                          style={{ width: `${colWidths.matrix_total || 75}px` }}
                          className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">
                            {selectedWeek === 0 ? "총점" : "점수"}
                          </div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "matrix_total", 55)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("matrix_total");
                                updateGuidelinePos(e.currentTarget);
                              }
                            }}
                            onMouseLeave={() => {
                              if (!resizingColKey) {
                                setActiveHoverCol(null);
                                setGuidelineX(null);
                              }
                            }}
                            className="absolute right-0 top-0 bottom-0 w-3 cursor-col-resize select-none touch-none z-20"
                            title="열 너비 조절"
                          />
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredMatrixRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={
                              (category !== "SESSION" && selectedTrackFilter === "ALL" ? 4 : 3) +
                              displayedMatrixWeeks.length +
                              (selectedWeek === 0 ? (category === "ADV" ? 4 : 3) : 0) +
                              1
                            }
                            className="py-12 text-center text-slate-400 space-y-1 font-sans"
                          >
                            <Users size={28} className="mx-auto text-slate-300 mb-1" />
                            <p className="font-bold text-slate-700 text-xs">
                              해당 조건의 인원이 없습니다.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredMatrixRows.map((row, idx) => {
                          const availableStatuses: AttendStatus[] = [
                            "present",
                            "late",
                            "earlyLeave",
                            "absent",
                            "excusedAbsent",
                            "unexcusedLate",
                            "unexcusedAbsent",
                            "unmarked",
                          ];

                          const editDropdownStatuses: AttendStatus[] = [
                            "present",
                            "late",
                            "earlyLeave",
                            "absent",
                            "excusedAbsent",
                            "remote",
                            "unexcusedLate",
                            "unexcusedAbsent",
                            "unmarked",
                          ];

                          const effectiveScore = (() => {
                            if (selectedWeek === 0) {
                              return row.totalScore;
                            }
                            const currentStatus = row.weekData[selectedWeek]?.status;
                            if (currentStatus === "absent") {
                              return currentScoreRule.absentPenalty ?? -3;
                            }
                            if (currentStatus === "unexcusedAbsent") {
                              return currentScoreRule.unexcusedAbsentPenalty ?? -4;
                            }
                            if (
                              currentStatus === "late" ||
                              currentStatus === "earlyLeave" ||
                              currentStatus === "unexcusedLate"
                            ) {
                              return currentScoreRule.latePenalty ?? -1;
                            }
                            return 0;
                          })();

                          return (
                            <tr
                              key={row.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[46px]"
                            >
                              <td className="relative px-1 py-1.5 text-center text-slate-400 text-[11px]">
                                <div className="h-8 flex items-center justify-center">
                                  {idx + 1}
                                </div>
                              </td>
                              <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs">
                                <div className="h-8 flex items-center justify-center">
                                  {row.term}기
                                </div>
                              </td>
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans">
                                <div className="h-8 flex items-center justify-center">
                                  {row.name}
                                </div>
                              </td>
                              {category !== "SESSION" && selectedTrackFilter === "ALL" && (
                                <td className="relative px-1.5 py-1.5 text-center text-slate-600 text-xs font-sans">
                                  <div className="h-8 flex items-center justify-center font-medium">
                                    {row.track}
                                  </div>
                                </td>
                              )}
                              {displayedMatrixWeeks.map((w) => {
                                const isEditableDirect =
                                  isWeekDirectEditable(w.weekNum) && selectedWeek !== 0;
                                const cell = row.weekData[w.weekNum];
                                const st = cell?.status || "unmarked";
                                const cfg = ATTEND_STATUS_CFG[st] || ATTEND_STATUS_CFG.unmarked;
                                const rawDate = savedWeekDateMapping[w.weekNum]?.trim();
                                const hasDate = Boolean(rawDate && rawDate !== "-");

                                if (isEditableDirect && !isTableEditMode) {
                                  return (
                                    <td key={w.id} className="relative px-2 py-1.5 text-center">
                                      <div className="flex items-center justify-center w-full px-1">
                                        <div className="grid grid-cols-8 w-full max-w-[445px] min-w-[425px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                          {availableStatuses.map((s) => {
                                            const active = st === s;
                                            return (
                                              <button
                                                key={s}
                                                type="button"
                                                onClick={() =>
                                                  handleStatusChange(row.id, s, w.weekNum)
                                                }
                                                className={`py-1 text-[10.5px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 ${
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
                                  );
                                }

                                return (
                                  <td
                                    key={w.id}
                                    className={`relative text-center px-1 py-1.5 font-sans transition-colors ${isTableEditMode ? "bg-blue-50/15" : ""}`}
                                  >
                                    <div className="h-8 flex items-center justify-center w-full">
                                      {isTableEditMode ? (
                                        <div className="relative w-[66px] h-[30px] flex items-center justify-center">
                                          <select
                                            value={st}
                                            onChange={(e) =>
                                              handleStatusChange(
                                                row.id,
                                                e.target.value as AttendStatus,
                                                w.weekNum
                                              )
                                            }
                                            className="w-full h-full appearance-none text-center text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg outline-none cursor-pointer px-1.5 shadow-2xs transition-colors"
                                          >
                                            {editDropdownStatuses.map((s) => (
                                              <option
                                                key={s}
                                                value={s}
                                                className="text-slate-900 font-medium"
                                              >
                                                {ATTEND_STATUS_CFG[s]?.label || s}
                                              </option>
                                            ))}
                                          </select>
                                          <ChevronDown
                                            size={11}
                                            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                                          />
                                        </div>
                                      ) : (
                                        <div className="relative w-[66px] h-[30px] flex items-center justify-center">
                                          <span
                                            title={`${row.name} - ${w.label}${hasDate ? ` (${rawDate})` : ""}: ${cfg.label}${cell?.memo ? `\n비고: ${cell.memo}` : ""}`}
                                            className={`text-xs whitespace-nowrap select-none font-bold ${
                                              st === "present"
                                                ? "text-emerald-700"
                                                : st === "late" || st === "earlyLeave"
                                                  ? "text-amber-700"
                                                  : st === "absent"
                                                    ? "text-rose-600"
                                                    : st === "excusedAbsent"
                                                      ? "text-blue-700"
                                                      : st === "remote"
                                                        ? "text-indigo-700"
                                                        : st === "unexcusedLate"
                                                          ? "text-orange-700"
                                                          : st === "unexcusedAbsent"
                                                            ? "text-red-700"
                                                            : "text-slate-400 font-medium"
                                            }`}
                                          >
                                            {cfg.label}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {selectedWeek === 0 && (
                                <>
                                  {/* 결석 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-pink-50/80">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.absenceCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.absenceCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 무단결석 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-red-100/70">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.unexcusedAbsenceCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.unexcusedAbsenceCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 지각조퇴 카운트 */}
                                  <td className="relative text-center px-1.5 py-1.5 font-mono bg-amber-50/80">
                                    <div className="h-8 flex items-center justify-center">
                                      {row.lateEarlyLeaveCount > 0 ? (
                                        <span className="text-xs font-bold text-slate-800">
                                          {row.lateEarlyLeaveCount}
                                        </span>
                                      ) : (
                                        <span className="text-slate-300 font-medium">0</span>
                                      )}
                                    </div>
                                  </td>
                                  {/* 비대면 카운트 (ADV 전용) */}
                                  {category === "ADV" && (
                                    <td className="relative text-center px-1.5 py-1.5 font-mono bg-indigo-50/80">
                                      <div className="h-8 flex items-center justify-center">
                                        {row.remoteCount > 0 ? (
                                          <span className="text-xs font-bold text-slate-800">
                                            {row.remoteCount}
                                          </span>
                                        ) : (
                                          <span className="text-slate-300 font-medium">0</span>
                                        )}
                                      </div>
                                    </td>
                                  )}
                                </>
                              )}
                              {/* 총점/점수 집계 */}
                              <td className="relative text-center px-1.5 py-1.5 font-mono bg-slate-50/60">
                                <div className="h-8 flex items-center justify-center">
                                  <span
                                    className={`text-xs font-bold ${
                                      effectiveScore === 0
                                        ? "text-slate-400 font-medium"
                                        : effectiveScore < 0
                                          ? "text-rose-600 font-bold"
                                          : "text-emerald-700 font-bold"
                                    }`}
                                  >
                                    {effectiveScore > 0
                                      ? `+${effectiveScore}점`
                                      : `${effectiveScore}점`}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                ) : (
                  <table
                    className="w-full text-xs table-fixed border-collapse"
                    style={{ minWidth: `${singleTeamTableMinWidth}px` }}
                  >
                    <thead className="bg-slate-50/80 select-none">
                      <tr className="border-b border-slate-200 divide-x divide-slate-200 text-slate-700 font-semibold text-[11px] whitespace-nowrap h-11">
                        {selectedWeek === 0 && (
                          <th
                            style={{ width: `${colWidths.week}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">주차</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "week", 60)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("week");
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
                        )}
                        {category !== "SESSION" &&
                          isAllSelected &&
                          selectedTrackFilter === "ALL" && (
                            <th
                              style={{ width: `${colWidths.track}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">부문</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, "track", 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("track");
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
                          )}
                        {isAllSelected && category !== "SESSION" && (
                          <th
                            style={{ width: `${colWidths.teamName}px` }}
                            className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                          >
                            <div className="h-9 flex items-center justify-center">소속 팀</div>
                            <div
                              onMouseDown={(e) => handleResizeStart(e, "teamName", 90)}
                              onMouseEnter={(e) => {
                                if (!resizingColKey) {
                                  setActiveHoverCol("teamName");
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
                        )}
                        <th
                          style={{ width: `${colWidths.name}px` }}
                          className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">이름</div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "name", 70)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("name");
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
                          style={{ width: `${colWidths.term}px` }}
                          className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                        >
                          <div className="h-9 flex items-center justify-center">기수</div>
                          <div
                            onMouseDown={(e) => handleResizeStart(e, "term", 50)}
                            onMouseEnter={(e) => {
                              if (!resizingColKey) {
                                setActiveHoverCol("term");
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
                        {category !== "SESSION" &&
                          !isAllSelected &&
                          selectedTrackFilter === "ALL" && (
                            <th
                              style={{ width: `${colWidths.track}px` }}
                              className="relative text-center px-2 py-1 text-slate-700 font-bold bg-slate-100/90"
                            >
                              <div className="h-9 flex items-center justify-center">부문</div>
                              <div
                                onMouseDown={(e) => handleResizeStart(e, "track", 60)}
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("track");
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
                          )}
                        {(() => {
                          const isSingleTeamEditable =
                            category === "SESSION" ||
                            (category === "ADV" &&
                              isWeekDirectEditable(selectedWeek) &&
                              selectedWeek !== 0);
                          const statusMinWidth = isSingleTeamEditable ? 435 : 70;
                          const statusDefaultWidth = isSingleTeamEditable ? 445 : 75;
                          const effectiveStatusWidth = isSingleTeamEditable
                            ? Math.max(colWidths.status || statusDefaultWidth, statusMinWidth)
                            : (colWidths.status && colWidths.status < 200 ? colWidths.status : statusDefaultWidth);

                          return (
                            <th
                              style={{
                                width: `${effectiveStatusWidth}px`,
                                minWidth: `${statusMinWidth}px`,
                              }}
                              className="relative text-center px-2 py-1 text-slate-900 font-bold bg-slate-50/80"
                            >
                              <div className="h-9 flex items-center justify-center">출결</div>
                              <div
                                onMouseDown={(e) =>
                                  handleResizeStart(
                                    e,
                                    "status",
                                    statusMinWidth
                                  )
                                }
                                onMouseEnter={(e) => {
                                  if (!resizingColKey) {
                                    setActiveHoverCol("status");
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
                        })()}
                        <th
                          style={{ width: `${colWidths.memo || 240}px`, minWidth: "220px" }}
                          className="relative text-center px-3 py-1 text-slate-700 font-semibold"
                        >
                          <div className="h-9 flex items-center justify-center">비고</div>
                        </th>
                        {isTableEditMode && (
                          <th
                            style={{ width: "40px" }}
                            className="text-center px-1 py-1 text-slate-400 font-semibold w-10"
                          >
                            <div className="h-9 flex items-center justify-center">관리</div>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {filteredAttendees.length === 0 ? (
                        <tr>
                          <td
                            colSpan={
                              (selectedWeek === 0 ? 1 : 0) +
                              (category !== "SESSION" && selectedTrackFilter === "ALL" ? 1 : 0) +
                              (isAllSelected && category !== "SESSION" ? 1 : 0) +
                              3 +
                              (isTableEditMode ? 1 : 0)
                            }
                            className="py-12 text-center text-slate-400 space-y-1"
                          >
                            <UserCheck size={24} className="mx-auto text-slate-300 mb-1" />
                            <p className="font-bold text-slate-700 text-xs">
                              해당 조건의 인원이 없습니다.
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredAttendees.map((att) => {
                          const availableStatuses: AttendStatus[] = [
                            "present",
                            "late",
                            "earlyLeave",
                            "absent",
                            "excusedAbsent",
                            "unexcusedLate",
                            "unexcusedAbsent",
                            "unmarked",
                          ];

                          const editDropdownStatuses: AttendStatus[] =
                            category === "ADV"
                              ? [
                                  "present",
                                  "late",
                                  "earlyLeave",
                                  "absent",
                                  "excusedAbsent",
                                  "remote",
                                  "unexcusedLate",
                                  "unexcusedAbsent",
                                  "unmarked",
                                ]
                              : [
                                  "present",
                                  "late",
                                  "earlyLeave",
                                  "absent",
                                  "excusedAbsent",
                                  "unexcusedLate",
                                  "unexcusedAbsent",
                                  "unmarked",
                                ];

                          const isDirectEditable =
                            category === "SESSION" ||
                            (category === "ADV" &&
                              isWeekDirectEditable(selectedWeek) &&
                              selectedWeek !== 0);

                          return (
                            <tr
                              key={att.id}
                              className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-200 h-[42px]"
                            >
                              {selectedWeek === 0 && (
                                <td className="relative text-center px-2 py-1.5 whitespace-nowrap">
                                  <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                    {att.weekLabel || `${att.weekNum}주차`}
                                  </span>
                                </td>
                              )}
                              {category !== "SESSION" &&
                                isAllSelected &&
                                selectedTrackFilter === "ALL" && (
                                  <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap">
                                    {att.track || "-"}
                                  </td>
                                )}
                              {isAllSelected && category !== "SESSION" && (
                                <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans truncate whitespace-nowrap">
                                  {att.teamName || "-"}
                                </td>
                              )}
                              <td className="relative px-2 py-1.5 text-center font-bold text-slate-900 text-xs font-sans whitespace-nowrap">
                                {att.name}
                              </td>
                              <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs whitespace-nowrap">
                                {att.term}기
                              </td>
                              {category !== "SESSION" &&
                                !isAllSelected &&
                                selectedTrackFilter === "ALL" && (
                                  <td className="relative px-2 py-1.5 text-center text-slate-600 text-xs font-sans whitespace-nowrap">
                                    {att.track || "-"}
                                  </td>
                                )}

                              {isDirectEditable && !isTableEditMode ? (
                                <td className="relative px-2 py-1.5 text-center">
                                  <div className="flex items-center justify-center w-full px-1">
                                    <div className="grid grid-cols-8 w-full max-w-[445px] min-w-[425px] p-0.5 rounded-lg bg-slate-100/90 border border-slate-200/60 font-sans select-none gap-0.5 shadow-2xs">
                                      {availableStatuses.map((s) => {
                                        const active = att.status === s;
                                        return (
                                          <button
                                            key={s}
                                            type="button"
                                            onClick={() =>
                                              handleStatusChange(
                                                att.originalId || att.id,
                                                s,
                                                att.weekNum
                                              )
                                            }
                                            className={`py-1 text-[10.5px] font-semibold rounded transition-all cursor-pointer text-center whitespace-nowrap px-0.5 ${
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
                              ) : isTableEditMode ? (
                                <td className="relative px-2 py-1.5 text-center whitespace-nowrap bg-blue-50/15">
                                  <div className="flex items-center justify-center w-full">
                                    <div className="relative w-[70px] h-[30px] flex items-center justify-center">
                                      <select
                                        value={att.status || "unmarked"}
                                        onChange={(e) =>
                                          handleStatusChange(
                                            att.originalId || att.id,
                                            e.target.value as AttendStatus,
                                            att.weekNum
                                          )
                                        }
                                        className="w-full h-full appearance-none text-center text-xs font-semibold text-slate-900 bg-white border border-slate-300 hover:border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-lg outline-none cursor-pointer px-1.5 shadow-2xs transition-colors"
                                      >
                                        {editDropdownStatuses.map((s) => (
                                          <option
                                            key={s}
                                            value={s}
                                            className="text-slate-900 font-medium"
                                          >
                                            {ATTEND_STATUS_CFG[s]?.label || s}
                                          </option>
                                        ))}
                                      </select>
                                      <ChevronDown
                                        size={11}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400"
                                      />
                                    </div>
                                  </div>
                                </td>
                              ) : (
                                <td className="relative px-2 py-1.5 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center w-full">
                                    <div className="relative w-[70px] h-[30px] flex items-center justify-center">
                                      <span
                                        className={`text-xs font-bold font-sans ${
                                          att.status === "present"
                                            ? "text-emerald-700 font-bold"
                                            : att.status === "late" || att.status === "earlyLeave"
                                              ? "text-amber-700 font-bold"
                                              : att.status === "absent"
                                                ? "text-rose-700 font-bold"
                                                : att.status === "excusedAbsent"
                                                  ? "text-blue-700 font-bold"
                                                  : att.status === "remote"
                                                    ? "text-indigo-700 font-bold"
                                                    : att.status === "unexcusedLate"
                                                      ? "text-orange-700 font-bold"
                                                      : att.status === "unexcusedAbsent"
                                                        ? "text-red-700 font-bold"
                                                        : "text-slate-300 font-normal font-mono"
                                        }`}
                                      >
                                        {att.status === "unmarked"
                                          ? "—"
                                          : ATTEND_STATUS_CFG[att.status]?.label || att.status}
                                      </span>
                                    </div>
                                  </div>
                                </td>
                              )}

                              {category === "SESSION" ||
                              (category === "ADV" &&
                                isWeekDirectEditable(selectedWeek) &&
                                selectedWeek !== 0) ? (
                                <td className="relative px-3 py-2 text-center">
                                  <div className="h-8 flex items-center justify-center">
                                    <input
                                      type="text"
                                      value={att.memo || ""}
                                      onChange={(e) =>
                                        handleMemoChange(
                                          att.originalId || att.id,
                                          e.target.value,
                                          att.weekNum
                                        )
                                      }
                                      placeholder="—"
                                      className="w-full h-8 text-center px-3 text-xs font-sans text-slate-700 placeholder:text-slate-300 placeholder:font-mono rounded-lg bg-white border border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all shadow-2xs"
                                    />
                                  </div>
                                </td>
                              ) : (
                                <td
                                  className="relative px-3 py-2 text-center text-slate-600 text-xs font-sans truncate"
                                  title={att.memo}
                                >
                                  <div className="h-8 flex items-center justify-center">
                                    {att.memo || (
                                      <span className="text-slate-300 font-mono">-</span>
                                    )}
                                  </div>
                                </td>
                              )}
                              {isTableEditMode && (
                                <td className="px-2 py-1.5 text-center">
                                  <button
                                    onClick={() => handleDeleteAttendee(att.id)}
                                    className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="명단에서 삭제"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

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
      </div>

      {/* ─── Modal: 새 회차 생성 ─── */}
      {showNewEventModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl overflow-hidden p-6 space-y-4 bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Plus size={16} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  새 {config.title.split(" ")[0]} 회차 생성
                </h3>
              </div>
              <button
                onClick={() => setShowNewEventModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 font-bold block mb-1.5">회차 명칭</label>
                <input
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder={`예: 2026 하계 ${config.title.split(" ")[0]} 4주차`}
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
                    placeholder="예: 연세대 백양관, 드림플러스"
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
                onClick={handleCreateNewEvent}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer shadow-xs"
              >
                회차 생성
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 활동/스터디 사진 크게 보기 (Zoom Modal) ─── */}
      {showImageZoom && (
        <div
          onClick={() => setShowImageZoom(false)}
          className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-white/10 p-2"
          >
            <button
              onClick={() => setShowImageZoom(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
            <img
              src={
                selectedEvent.imageUrl ||
                (category === "STUDY"
                  ? "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&auto=format&fit=crop&q=80"
                  : category === "ADV"
                    ? "https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&auto=format&fit=crop&q=80"
                    : "https://images.unsplash.com/photo-1531482615713-2afd69097998?w=1200&auto=format&fit=crop&q=80")
              }
              alt={selectedTeam.name}
              className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
            />
            <div className="p-3 text-white flex items-center justify-between text-xs font-medium">
              <span className="font-bold">{selectedTeam.name}</span>
              <span className="text-slate-400">
                {selectedEvent.title} ({selectedEvent.date})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: 주차 매핑 및 CSV 열 순서 드래그 설정 (Settings Modal) ─── */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings size={18} className="text-slate-700" />
                  <span>CSV 추출 및 열 순서 설정</span>
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseOrCancelSettings}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="닫기"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 min-h-0 text-xs">
              {/* 1. 상단 날짜 입력 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    주차별 날짜 입력 ({termPeriod === "VACATION" ? "방학 1~8주차" : "학기 9~16주차"}
                    )
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {(termPeriod === "VACATION" ? VACATION_WEEKS_8 : SEMESTER_WEEKS_8).map((w) => {
                    const raw = weekDateMapping[w.weekNum];
                    const displayVal = !raw || raw === "-" ? "" : raw;

                    return (
                      <div
                        key={w.id}
                        className="group flex flex-col bg-slate-50/90 border border-slate-200/90 rounded-xl p-2 gap-1.5 transition-all hover:border-slate-300 hover:bg-slate-100/60 focus-within:bg-blue-50/40 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/15"
                      >
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[11px] font-bold text-slate-700">{w.label}</span>
                          <Edit3
                            size={11}
                            className="text-slate-400 group-hover:text-blue-500 transition-colors"
                          />
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={displayVal}
                            onChange={(e) => {
                              const val = e.target.value;
                              setWeekDateMapping((prev) => ({ ...prev, [w.weekNum]: val }));
                            }}
                            placeholder="YYYY-MM-DD"
                            className="w-full text-center text-[11px] sm:text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 rounded-lg py-1.5 px-1 shadow-2xs outline-none transition-all placeholder:text-slate-300 placeholder:font-normal hover:border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. 하단 표 구성 미리보기 */}
              <div className="space-y-2.5 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">표 구성 미리보기</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCustomColOrder(null);
                      setExportColumns(DEFAULT_EXPORT_COLUMNS);
                    }}
                    className="text-xs text-slate-500 hover:text-blue-600 flex items-center gap-1 font-medium cursor-pointer transition-colors"
                  >
                    <RotateCcw size={12} />
                    <span>순서 초기화</span>
                  </button>
                </div>

                {/* Status Mapping Legend */}
                <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-500 px-0.5">
                  <span>
                    출석 <strong className="text-slate-900 font-bold font-mono">1</strong>
                  </span>
                  <span>
                    지각 <strong className="text-slate-900 font-bold font-mono">2</strong>
                  </span>
                  <span>
                    조퇴 <strong className="text-slate-900 font-bold font-mono">3</strong>
                  </span>
                  <span>
                    결석 <strong className="text-slate-900 font-bold font-mono">4</strong>
                  </span>
                  <span>
                    인정결석 <strong className="text-slate-900 font-bold font-mono">5</strong>
                  </span>
                  <span>
                    비대면 <strong className="text-slate-900 font-bold font-mono">6</strong>
                  </span>
                  <span className="text-slate-300 font-normal">|</span>
                  <span>
                    무단지각 <strong className="text-slate-900 font-bold font-mono">0</strong>
                  </span>
                  <span>
                    무단결석 <strong className="text-slate-900 font-bold font-mono">X</strong>
                  </span>
                </div>

                {/* Table Container with Horizontal Scroll and min-width */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-2xs">
                  <table
                    className="w-full text-xs border-collapse table-auto whitespace-nowrap"
                    style={{ minWidth: "1150px" }}
                  >
                    <thead className="select-none divide-x divide-slate-200 border-b border-slate-200">
                      <tr className="h-10">
                        <th className="w-10 text-center py-2 px-1 text-slate-400 font-mono font-medium bg-slate-50">
                          #
                        </th>
                        {activeModalCols.map((col, idx) => {
                          const isBeingDragged = draggedColIdx === idx;
                          const isDropLeft =
                            dropTarget?.index === idx && dropTarget?.position === "left";
                          const isDropRight =
                            dropTarget?.index === idx && dropTarget?.position === "right";

                          const headerBg =
                            col.id === "absence"
                              ? "bg-pink-100/90 text-slate-800"
                              : col.id === "unexcusedAbsence"
                                ? "bg-red-200/90 text-slate-900"
                                : col.id === "lateEarlyLeave"
                                  ? "bg-amber-100 text-slate-800"
                                  : col.id === "remote"
                                    ? "bg-indigo-100 text-slate-800"
                                    : col.id === "totalScore"
                                      ? "bg-slate-100/90 text-slate-900"
                                      : "bg-slate-50 text-slate-800";

                          return (
                            <th
                              key={col.id}
                              draggable={true}
                              onDragStart={(e) => handleColDragStart(e, idx)}
                              onDragOver={(e) => handleColDragOver(e, idx)}
                              onDrop={handleColDrop}
                              onDragEnd={handleColDragEnd}
                              className={`relative px-2.5 py-2 text-center text-xs font-bold transition-all select-none cursor-grab active:cursor-grabbing ${headerBg} ${
                                isBeingDragged ? "opacity-20 bg-slate-200" : "hover:brightness-95"
                              }`}
                              title="마우스로 드래그하여 순서 변경"
                            >
                              {isDropLeft && (
                                <div className="absolute top-0 bottom-0 left-0 w-1 bg-blue-600 z-30 pointer-events-none rounded-full -ml-0.5" />
                              )}
                              {isDropRight && (
                                <div className="absolute top-0 bottom-0 right-0 w-1 bg-blue-600 z-30 pointer-events-none rounded-full -mr-0.5" />
                              )}
                              <div className="flex items-center justify-center">
                                <span className="font-bold text-xs leading-none whitespace-nowrap">
                                  {col.label}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans text-xs">
                      {previewRows.slice(0, 5).map((row: any, rIdx: number) => (
                        <tr
                          key={row.id || rIdx}
                          className="h-9 hover:bg-slate-50/70 transition-colors divide-x divide-slate-100"
                        >
                          <td className="text-center text-slate-400 font-mono text-xs px-1">
                            {rIdx + 1}
                          </td>
                          {activeModalCols.map((col) => (
                            <td
                              key={col.id}
                              className={`text-center px-2.5 py-1.5 whitespace-nowrap ${col.id === "totalScore" ? "bg-slate-50/50 font-bold" : ""}`}
                            >
                              {col.renderCell(row)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3.5 bg-slate-50/80 border-t border-slate-100 shrink-0">
              <span className="text-[11px] text-slate-400 font-medium">
                * 상위 5개 행 데이터 미리보기
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                >
                  {isSavedFeedback ? "저장 완료 ✓" : "설정 저장"}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndExportCsv}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>CSV 다운로드</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
