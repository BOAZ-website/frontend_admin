import type { ActivePage } from './activePage';

export const PAGE_LABELS: Record<ActivePage, string> = {
  'content-archive': '아카이빙 (프로젝트·블로그·사진)',
  'content-faq': '자주 묻는 질문 (FAQ)',
  'content-curriculum': '커리큘럼 관리',
  'content-reviews': '수료자 후기 관리',
  content: '콘텐츠 관리',
  recruiting: '모집 공고 관리',
  'recruiting-posts': '모집 공고 관리',
  'recruiting-questions': '지원서 문항 설정',
  'recruiting-preview': '지원자 화면 미리보기',
  'recruiting-csv': '지원서 CSV 추출',
  'recruiting-leads': '사전 알림 명단',
  evaluation: '서류 평가 대시보드',
  'evaluation-evals': '서류 평가 대시보드 (SUBMITTED)',
  'evaluation-applicants': '전체 지원자 현황 (DRAFT 포함)',
  'evaluation-promote': '최종 합불 & 정회원 승격',
  'att-session': 'BASE Term 출결 관리',
  'att-adv': 'ADV Term 출결 관리',
  'att-events': '행사 출결 관리',
  'att-study': '스터디 출결 관리',
  'att-input-adv': 'ADV Term 출결 입력',
  'att-input-study': '스터디 출결 입력',
  'att-input': 'ADV Term 출결 입력',
  'att-hosts': '그룹 계정 관리',
  'att-scores': '출결 점수 집계',
  'att-rules': '출결 규정 관리',
  'att-internal': '정규 출결 관리',
  system: '시스템 및 계정',
  'system-members': '동아리원 명단',
  'system-accounts': '권한 관리',
};

/**
 * 주소 해시나 브라우저 저장값이 실제 화면 ID인지 확인한다.
 * PAGE_LABELS는 모든 ActivePage를 빠짐없이 가져야 타입 검사를 통과하므로, 화면 ID 목록을 따로 두지 않고 이 키를 쓴다.
 */
export function isActivePage(value: string): value is ActivePage {
  return Object.hasOwn(PAGE_LABELS, value);
}
