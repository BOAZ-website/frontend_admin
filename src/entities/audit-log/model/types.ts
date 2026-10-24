/**
 * 보안 감사 로그(SYS-LOG). 관리자가 한 쓰기 작업 하나가 기록 한 줄이다.
 * 저장 항목은 docs/spec/04-evaluation.md §4.5의 공용 감사 테이블을 따른다:
 * 수행자 계정 ID, 발생 일시, 액션, 대상 종류와 대상 ID 목록, 부가 정보(detail), IP.
 * 대상에는 외래 키를 걸지 않는다(대상이 지워져도 기록은 남는다). detail에는 사람의 이름·연락처를 넣지 않는다.
 */

/** 화면에서 묶어 보는 분류. 사이드바 메뉴 묶음과 같고, 화면의 탭 하나가 분류 하나다. */
export type AuditCategory = 'CONTENT' | 'RECRUITING' | 'EVALUATION' | 'ATTENDANCE' | 'SYSTEM';

export const AUDIT_CATEGORIES: readonly { id: AuditCategory; label: string }[] = [
  { id: 'CONTENT', label: '콘텐츠 관리' },
  { id: 'RECRUITING', label: '리크루팅 공고' },
  { id: 'EVALUATION', label: '서류 평가' },
  { id: 'ATTENDANCE', label: '출결 및 점수 시스템' },
  { id: 'SYSTEM', label: '시스템 및 계정' },
];

/**
 * 수행자의 등급. 운영진 계정은 admin.role(MASTER·SUPER·TEAM)이고, HOST는 그룹 계정(출결 입력)이다.
 * 기록할 때의 등급을 남긴다(나중에 등급이 바뀌거나 계정이 지워져도 그대로다).
 */
export const AUDIT_ACTOR_ROLES = ['MASTER', 'SUPER', 'TEAM', 'HOST'] as const;
export type AuditActorRole = (typeof AUDIT_ACTOR_ROLES)[number];

/** 기록 대상의 종류. 대상 ID가 무엇의 ID인지 나타낸다. */
export type AuditTargetType =
  | 'ADMIN'
  | 'USER'
  | 'HOST'
  | 'TEAM'
  | 'EVENT'
  | 'SCORE_RULE'
  | 'SEMESTER'
  | 'CONTENT'
  | 'RECRUITMENT'
  | 'APPLICATION';

/**
 * 액션 목록. 화면 이름과 분류를 함께 둔다.
 * 콘텐츠·리크루팅·평가 화면은 아직 API에 연결되지 않아, 그 액션은 API가 붙은 뒤부터 기록된다.
 */
export const AUDIT_ACTIONS = {
  ADMIN_ACCOUNT_CREATE: { label: '계정 발급', category: 'SYSTEM' },
  ADMIN_ACCOUNT_UPDATE: { label: '계정 수정', category: 'SYSTEM' },
  ADMIN_ID_ISSUE: { label: '아이디 발급', category: 'SYSTEM' },
  ADMIN_PASSWORD_RESET: { label: '비밀번호 재설정', category: 'SYSTEM' },
  ADMIN_ACCOUNT_DELETE: { label: '계정 삭제', category: 'SYSTEM' },
  PERMISSION_CHANGE: { label: '권한 변경', category: 'SYSTEM' },
  OPERATOR_TEAM_SET: { label: '팀 운영진 지정', category: 'SYSTEM' },
  OPERATOR_ASSIGN: { label: '운영진 지정·해제', category: 'SYSTEM' },
  HOST_ACCOUNT_CREATE: { label: 'HOST 계정 생성', category: 'ATTENDANCE' },
  HOST_ACCOUNT_UPDATE: { label: 'HOST 계정 수정', category: 'ATTENDANCE' },
  HOST_ACCOUNT_DELETE: { label: 'HOST 계정 삭제', category: 'ATTENDANCE' },

  MEMBER_CREATE: { label: '동아리원 추가', category: 'SYSTEM' },
  MEMBER_UPDATE: { label: '동아리원 수정', category: 'SYSTEM' },
  /** 행을 지우지 않고 활동 상태를 탈퇴로 바꾼다(DELETE /api/v1/club-members/:memberId). */
  MEMBER_DELETE: { label: '동아리원 탈퇴 처리', category: 'SYSTEM' },

  ATTENDANCE_EDIT: { label: '출결 수정', category: 'ATTENDANCE' },
  ATTENDANCE_SUBMIT: { label: '출결 제출', category: 'ATTENDANCE' },
  EVENT_CREATE: { label: '행사 생성', category: 'ATTENDANCE' },
  EVENT_UPDATE: { label: '행사 수정', category: 'ATTENDANCE' },
  EVENT_DELETE: { label: '행사 삭제', category: 'ATTENDANCE' },
  EVENT_ATTENDEES_UPDATE: { label: '행사 참가자 변경', category: 'ATTENDANCE' },
  SCORE_RULE_CREATE: { label: '점수 규칙 생성', category: 'ATTENDANCE' },
  SCORE_RULE_UPDATE: { label: '점수 규칙 수정', category: 'ATTENDANCE' },
  SCORE_RULE_ACTIVATE: { label: '점수 규칙 적용', category: 'ATTENDANCE' },
  SCORE_RULE_DELETE: { label: '점수 규칙 삭제', category: 'ATTENDANCE' },
  SEMESTER_CREATE: { label: '새 반기 시작', category: 'ATTENDANCE' },
  SEMESTER_UPDATE: { label: '반기 수정', category: 'ATTENDANCE' },
  SEMESTER_MEMBERS_SET: { label: '반기 명단 변경', category: 'ATTENDANCE' },
  SEMESTER_WEEK_UPDATE: { label: '주차 상태 변경', category: 'ATTENDANCE' },
  SEMESTER_WEEK_DATES: { label: '주차 날짜 변경', category: 'ATTENDANCE' },

  TEAM_CREATE: { label: '팀·스터디 생성', category: 'ATTENDANCE' },
  TEAM_UPDATE: { label: '팀·스터디 수정', category: 'ATTENDANCE' },
  TEAM_DELETE: { label: '팀·스터디 삭제', category: 'ATTENDANCE' },
  TEAM_MEMBER_ADD: { label: '팀원 추가', category: 'ATTENDANCE' },
  TEAM_MEMBER_REMOVE: { label: '팀원 제외', category: 'ATTENDANCE' },

  CONTENT_CREATE: { label: '콘텐츠 등록', category: 'CONTENT' },
  CONTENT_UPDATE: { label: '콘텐츠 수정', category: 'CONTENT' },
  CONTENT_DELETE: { label: '콘텐츠 삭제', category: 'CONTENT' },

  RECRUITMENT_CREATE: { label: '모집 공고 등록', category: 'RECRUITING' },
  RECRUITMENT_UPDATE: { label: '모집 공고 수정', category: 'RECRUITING' },
  RECRUITMENT_CLOSE: { label: '모집 마감', category: 'RECRUITING' },

  DECISION_CONFIRM: { label: '합불 확정', category: 'EVALUATION' },
  PROMOTION: { label: '정회원 승격', category: 'EVALUATION' },
  APPLICATION_DELETE: { label: '지원서 삭제', category: 'EVALUATION' },
} as const satisfies Record<string, { label: string; category: AuditCategory }>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export const isAuditAction = (value: string): value is AuditAction => value in AUDIT_ACTIONS;

/** 분류에 속한 액션 목록(목록에 적은 순서). */
export const actionsOf = (category: AuditCategory | null): AuditAction[] =>
  (Object.keys(AUDIT_ACTIONS) as AuditAction[]).filter(
    (action) => category === null || AUDIT_ACTIONS[action].category === category,
  );

/** 권한 안에서 한 일. CUD 권한이면 그 가운데 무엇을 했는지다. */
export type AuditOperation = 'CREATE' | 'UPDATE' | 'DELETE';

export const AUDIT_OPERATION_LABELS: Readonly<Record<AuditOperation, string>> = {
  CREATE: '생성',
  UPDATE: '수정',
  DELETE: '삭제',
};

/** 기록 한 줄이 쓴 권한(권한 매트릭스의 항목). */
export interface AuditUsedPermission {
  key: string;
  label: string;
}

/** 감사 로그 한 줄(GET /api/v1/admin/audit-logs의 항목). */
export interface AuditLogEntry {
  id: number;
  /** 'YYYY-MM-DD HH:MM:SS' */
  occurredAt: string;
  actorId: number | null;
  /** 수행자 회원 id(users.id). 권한 화면으로 옮겨 갈 때 쓴다. 알 수 없으면 null. */
  actorUserId: string | null;
  /** 수행자 이름. 회원이 지워졌으면 null. */
  actorName: string | null;
  /** 수행자 기수(예: 26). */
  actorTerm: number | null;
  /** 수행자 부문. */
  actorTrack: string | null;
  /** 지금 운영진 계정의 팀. 운영진 계정이 없으면 null. */
  actorTeam: string | null;
  /** 기록할 때의 등급. */
  actorRole: AuditActorRole | null;
  /** 지금도 권한이 있는지: 유효 권한이 하나 이상인 운영진 계정이나, 쓰는 중인 HOST 계정이 있다. */
  actorHasPermission: boolean;
  /** 계정·권한 관리에 그 사람이 있는지(운영진 계정이나 HOST 계정이 있다). 없으면 권한 화면으로 옮겨 갈 수 없다. */
  actorHasAccount: boolean;
  action: AuditAction;
  category: AuditCategory;
  targetType: AuditTargetType;
  /** 이 작업에 쓴 권한(권한 매트릭스 항목). 매트릭스에 항목이 없는 작업이면 null. */
  permission: AuditUsedPermission | null;
  /** 생성·수정·삭제 중 무엇을 했는지. */
  operation: AuditOperation;
  /** 호출한 API. API 연결 전 예시 기록이면 null. */
  api: { method: string; path: string } | null;
  /**
   * 요청 본문(API Body). 기록 때 남긴 detail.request 그대로이며, 개인정보 값(이름·연락처·이메일·비밀번호)은 '(비공개)'로 가려져 있다.
   * 보낸 값이 없으면(GET·DELETE, 보낸 값 없는 예시 기록) null.
   * 파일을 올린 요청은 files에 파일 목록이 있다: 문자열이면 이름, { name, url }이면 이름과 올린 주소(사진이 아니면 url null).
   */
  requestBody: Readonly<Record<string, unknown>> | null;
  /** 부가 정보. 식별자와 바꾼 항목 이름만 담는다. */
  detail: Readonly<Record<string, unknown>> | null;
  ip: string | null;
}
