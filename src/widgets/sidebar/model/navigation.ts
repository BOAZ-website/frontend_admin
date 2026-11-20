import { BookOpen, ClipboardList, FileText, Megaphone, Settings } from 'lucide-react';

import type { UserRole } from '@/entities/user/model/types';

const SIDEBAR_NAV = [
  {
    id: 'content',
    label: '콘텐츠 관리',
    icon: BookOpen,
    permission: 'CONTENT_MANAGE',
    groups: [
      {
        title: '아카이브',
        pages: [
          { id: 'content-archive', label: '아카이빙 (프로젝트·블로그·사진)' },
          { id: 'content-reviews', label: '수료자 후기 관리' },
        ],
      },
      {
        title: '소개 및 안내',
        pages: [
          { id: 'content-curriculum', label: '커리큘럼 관리' },
          { id: 'content-faq', label: '자주 묻는 질문 (FAQ)' },
        ],
      },
    ],
  },
  {
    id: 'recruiting',
    label: '리크루팅 공고',
    icon: Megaphone,
    permission: 'RECRUITMENT_MANAGE',
    groups: [
      {
        title: '공고 및 문항',
        pages: [
          { id: 'recruiting-posts', label: '모집 공고 관리' },
          { id: 'recruiting-questions', label: '지원서 문항 설정' },
          { id: 'recruiting-preview', label: '지원자 화면 미리보기' },
        ],
      },
      {
        title: '지원자 데이터',
        pages: [
          { id: 'recruiting-csv', label: '지원서 CSV 추출' },
          { id: 'recruiting-leads', label: '사전 알림 명단' },
        ],
      },
    ],
  },
  {
    id: 'evaluation',
    label: '서류 평가 관리',
    icon: FileText,
    permission: 'EVALUATION',
    groups: [
      // 전체 지원 현황·합격자 부원 등록은 부문과 관계없는 공통 메뉴라 그룹 제목 없이 둔다(빈 제목은 사이드바가 그리지 않는다).
      { title: '', pages: [{ id: 'evaluation-applicants', label: '전체 지원 현황' }] },
      {
        title: '서류 평가',
        pages: [
          { id: 'evaluation-analysis', label: '분석' },
          { id: 'evaluation-visualization', label: '시각화' },
          { id: 'evaluation-engineering', label: '엔지니어링' },
        ],
      },
      { title: '', pages: [{ id: 'evaluation-promote', label: '합격자 부원 등록' }] },
    ],
  },
  {
    id: 'attendance',
    label: '출결 및 점수 시스템',
    icon: ClipboardList,
    permission: 'ATTENDANCE_*',
    groups: [
      {
        title: '출결 관리',
        pages: [
          { id: 'att-session', label: 'BASE Term 출결 관리' },
          { id: 'att-adv', label: 'ADV Term 출결 관리' },
          { id: 'att-study', label: '스터디 출결 관리' },
          { id: 'att-events', label: '행사 출결 관리' },
          { id: 'att-scores', label: '출결 점수 집계' },
        ],
      },
      {
        title: '출결 입력',
        pages: [
          { id: 'att-input-adv', label: 'ADV Term 출결 입력' },
          { id: 'att-input-study', label: '스터디 출결 입력' },
        ],
      },
      {
        title: '설정',
        pages: [
          { id: 'att-hosts', label: '그룹 계정 관리' },
          { id: 'att-rules', label: '출결 규정 관리' },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: '시스템 및 계정',
    icon: Settings,
    permission: 'ACCOUNT_MANAGE',
    groups: [
      {
        title: '계정 및 권한',
        pages: [
          { id: 'system-members', label: '동아리원 명단' },
          { id: 'system-accounts', label: '권한 관리' },
        ],
      },
      {
        title: '운영',
        pages: [{ id: 'system-semesters', label: '반기 관리' }],
      },
      {
        title: '보안',
        pages: [{ id: 'system-audit', label: '감사 로그' }],
      },
    ],
  },
];

export function navigationForRole(currentRole: UserRole) {
  return SIDEBAR_NAV.filter((section) => {
    if (currentRole === 'HOST') {
      return section.id === 'attendance';
    }
    if (currentRole === 'CONTENT_ADMIN') {
      return section.id === 'content';
    }
    return true;
  }).map((section) => {
    if (currentRole === 'HOST' && section.id === 'attendance') {
      return {
        ...section,
        groups: section.groups.filter((g) => g.title === '출결 입력'),
      };
    }
    return section;
  });
}
