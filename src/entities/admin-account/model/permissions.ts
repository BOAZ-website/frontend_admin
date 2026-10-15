/**
 * 권한 체계(기본 권한 세트 + 계정별 예외 + 담당 그룹 파생). 정본은 docs/spec/06-system.md §3이다.
 * 백엔드 DefaultPermissions와 같은 구조로 두어, 표가 바뀌면 이 파일과 문서를 함께 고친다.
 *
 * 유효 권한 = 기본 세트(role, teamName) − 뺀 것 + 더한 것 + 담당 그룹 파생
 */

/** 기본 권한 세트 키. 명시 키 6개 + TEAM 폴백 1개. 스터디장·ADV 팀장은 그룹리더 하나로 합친다. */
export type BaseSetKey =
  | 'master'
  | 'president'
  | 'nextPresident'
  | 'serviceTeam'
  | 'opsTeam'
  | 'otherTeam'
  | 'groupLeader';

export interface BaseSetColumn {
  key: BaseSetKey;
  label: string;
  /** 백엔드 키 표기. 예: (TEAM, 운영지원팀) */
  keyLabel: string;
}

export const BASE_SET_COLUMNS: readonly BaseSetColumn[] = [
  { key: 'master', label: '서운팀장', keyLabel: 'MASTER · 서비스운영팀' },
  { key: 'president', label: '대표진', keyLabel: 'SUPER · 대표진' },
  { key: 'nextPresident', label: '차기대표진', keyLabel: 'SUPER · 차기대표진' },
  { key: 'serviceTeam', label: '서비스운영팀', keyLabel: 'TEAM · 서비스운영팀' },
  { key: 'opsTeam', label: '운영지원팀', keyLabel: 'TEAM · 운영지원팀' },
  { key: 'otherTeam', label: '기타 운영진', keyLabel: 'TEAM · 그 외 모든 팀' },
  { key: 'groupLeader', label: '그룹리더', keyLabel: 'HOST · 스터디장·ADV 팀장' },
];

export type LeadershipGroup = 'ADV' | 'STUDY';

export interface PermissionDef {
  /** 백엔드 Permission enum 이름. 계정별 예외 저장에도 이 이름을 쓴다. */
  key: string;
  label: string;
  /** 같은 권한이 묶는 기능 범위처럼, 이름만으로 알 수 없는 조건. */
  note?: string;
  /** BASE_SET_COLUMNS 순서대로 기본 세트에 들어 있으면 O, 아니면 X인 7글자. */
  base: string;
  /** 담당 그룹에서 계산되는 권한(_OWN_GROUP_). 기본 세트에 없고, 화면에서 켜고 끌 수 없다. */
  ownGroup?: LeadershipGroup;
}

export interface PermissionGroup {
  title: string;
  permissions: readonly PermissionDef[];
}

const OWN_GROUP_BASE = 'XXXXXXX';

export const PERMISSION_GROUPS: readonly PermissionGroup[] = [
  {
    title: '계정·보안',
    permissions: [
      { key: 'ADMIN_ACCOUNT_READ', label: '운영진 계정 목록 조회', base: 'OOOOXXX' },
      {
        key: 'ADMIN_ACCOUNT_SELF_WRITE',
        label: '본인 계정 정보 수정 / 비밀번호 변경',
        base: 'OOOOOOO',
      },
      {
        key: 'ADMIN_ACCOUNT_WRITE',
        label: '타 계정 정보 수정 / 비밀번호 변경',
        note: '마지막 보유자와 본인에게서는 회수할 수 없음',
        base: 'OXXXXXX',
      },
      { key: 'ADMIN_ACCOUNT_CREATE_DELETE', label: '운영진 계정 생성 / 삭제', base: 'OXXXXXX' },
      { key: 'ADMIN_PERMISSION_WRITE', label: '운영진 계정 권한 부여(커스텀)', base: 'OXXXXXX' },
      { key: 'AUDIT_LOG_READ', label: '보안 감사 로그 조회', base: 'OXXOXXX' },
    ],
  },
  {
    title: '콘텐츠',
    permissions: [
      {
        key: 'CONTENT_WRITE',
        label: '콘텐츠 CUD',
        note: '아카이빙, FAQ, 수료자 후기, 커리큘럼',
        base: 'OXXOXXX',
      },
      {
        key: 'CONTENT_READ',
        label: '콘텐츠 조회',
        note: '매트릭스에 행이 없어 CUD와 같은 값으로 둠',
        base: 'OXXOXXX',
      },
    ],
  },
  {
    title: '리크루팅',
    permissions: [
      { key: 'RECRUITMENT_NOTICE_WRITE', label: '리크루팅 공고 / 문항 관리 CUD', base: 'OXXOXXX' },
      { key: 'RECRUITMENT_NOTICE_READ', label: '리크루팅 공고 / 문항 관리 조회', base: 'OOOOXXX' },
      { key: 'APPLICANT_CSV_READ', label: '지원자 CSV 추출', base: 'OXXOXXX' },
      { key: 'APPLICATION_DELETE_ALL', label: '지원서 전체 삭제', base: 'OXXOXXX' },
      { key: 'PRE_NOTIFICATION_READ', label: '사전알림명단 조회', base: 'OOOOXXX' },
      { key: 'PRE_NOTIFICATION_DELETE', label: '사전알림명단 전체 삭제', base: 'OXXOXXX' },
      { key: 'MEMBER_PROMOTION_WRITE', label: '합격자 정회원 승격', base: 'OXXOXXX' },
    ],
  },
  {
    title: '출결 관리',
    permissions: [
      { key: 'ATTENDANCE_BASE_WRITE', label: 'BASE Term 출결 관리 CUD', base: 'OXXXOXX' },
      { key: 'ATTENDANCE_BASE_READ', label: 'BASE Term 출결 관리 조회', base: 'OOOXOXX' },
      { key: 'ATTENDANCE_ADV_WRITE', label: 'ADV Term 출결 관리 CUD', base: 'OXXXOXX' },
      { key: 'ATTENDANCE_ADV_READ', label: 'ADV Term 출결 관리 조회', base: 'OOOXOXX' },
      { key: 'ATTENDANCE_STUDY_WRITE', label: '스터디 출결 관리 CUD', base: 'OXXXOXX' },
      { key: 'ATTENDANCE_STUDY_READ', label: '스터디 출결 관리 조회', base: 'OOOXOXX' },
      { key: 'ATTENDANCE_EVENT_WRITE', label: '행사 출결 관리 CUD', base: 'OXXXOXX' },
      { key: 'ATTENDANCE_EVENT_READ', label: '행사 출결 관리 조회', base: 'OOOXOXX' },
      { key: 'ATTENDANCE_SCORE_WRITE', label: '출석 점수 집계 CUD', base: 'OXXXOXX' },
      { key: 'ATTENDANCE_SCORE_READ', label: '출석 점수 집계 조회', base: 'OOOXOXX' },
    ],
  },
  {
    title: '출결 입력',
    permissions: [
      {
        key: 'ATTENDANCE_ADV_ENTRY_WRITE',
        label: 'ADV 출결 입력 (전체)',
        note: '모든 팀 · 입력, 수정(주차 무관), 삭제',
        base: 'OXXXOXX',
      },
      { key: 'ATTENDANCE_ADV_ENTRY_READ', label: 'ADV 출결 입력탭 조회 (전체)', base: 'OOOXOXX' },
      {
        key: 'ATTENDANCE_ADV_ENTRY_OWN_GROUP_WRITE',
        label: 'ADV 출결 입력 (담당 팀)',
        note: '담당 팀만 · 입력, 수정(주차 안 지난 건) · 삭제 불가',
        base: OWN_GROUP_BASE,
        ownGroup: 'ADV',
      },
      {
        key: 'ATTENDANCE_ADV_ENTRY_OWN_GROUP_READ',
        label: 'ADV 출결 입력탭 조회 (담당 팀)',
        base: OWN_GROUP_BASE,
        ownGroup: 'ADV',
      },
      {
        key: 'ATTENDANCE_STUDY_ENTRY_WRITE',
        label: '스터디 출결 입력 (전체)',
        note: '모든 스터디 · 입력, 수정(주차 무관), 삭제',
        base: 'OXXXOXX',
      },
      {
        key: 'ATTENDANCE_STUDY_ENTRY_READ',
        label: '스터디 출결 입력탭 조회 (전체)',
        base: 'OOOXOXX',
      },
      {
        key: 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE',
        label: '스터디 출결 입력 (담당 스터디)',
        note: '담당 스터디만 · 입력, 수정(주차 안 지난 건) · 삭제 불가',
        base: OWN_GROUP_BASE,
        ownGroup: 'STUDY',
      },
      {
        key: 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_READ',
        label: '스터디 출결 입력탭 조회 (담당 스터디)',
        base: OWN_GROUP_BASE,
        ownGroup: 'STUDY',
      },
    ],
  },
  {
    title: '출결 설정',
    permissions: [
      { key: 'HOST_ACCOUNT_WRITE', label: 'HOST 계정 발급 CUD', base: 'OXXXOXX' },
      { key: 'HOST_ACCOUNT_READ', label: 'HOST 계정 발급 조회', base: 'OOOXOXX' },
      { key: 'SCORE_RULE_WRITE', label: '점수 규칙 CUD', base: 'OOOXOXX' },
      { key: 'SCORE_RULE_READ', label: '점수 규칙 조회', base: 'OOOXOXX' },
    ],
  },
  {
    title: '서류 평가·합불',
    permissions: [
      {
        key: 'EVALUATION_OWN_TRACK_WRITE',
        label: '본인 부문 서류 평가',
        base: 'XOOOOOX',
      },
      {
        key: 'EVALUATION_ALL_TRACK_WRITE',
        label: '다른 부문 서류 평가',
        base: 'XXOXXXX',
      },
      { key: 'FINAL_DECISION_WRITE', label: '최종 합불 CUD', base: 'XOOXXXX' },
      { key: 'FINAL_DECISION_READ', label: '최종 합불 조회', base: 'XOOOOOX' },
    ],
  },
];

export const PERMISSIONS: readonly PermissionDef[] = PERMISSION_GROUPS.flatMap(
  (group) => group.permissions,
);

/** 마지막 보유자와 본인에게서 회수할 수 없는 권한(락아웃 방지). */
export const LOCKOUT_GUARDED_PERMISSION = 'ADMIN_ACCOUNT_WRITE';

export const isInBaseSet = (permission: PermissionDef, key: BaseSetKey | null): boolean => {
  if (key === null) return false;
  const index = BASE_SET_COLUMNS.findIndex((column) => column.key === key);
  return permission.base[index] === 'O';
};

/** 기본 권한 세트 규칙 한 줄. teamName이 '*'이면 그 역할의 폴백이다. 백엔드 DefaultPermissions의 키와 같다. */
export interface BaseSetRule {
  role: string;
  teamName: string;
  key: BaseSetKey;
}

/** 명시 키 6개 + TEAM 폴백 1개. 폴백은 TEAM에만 있어, 정해지지 않은 MASTER·SUPER·HOST 조합은 권한이 0이다. */
export const BASE_SET_RULES: readonly BaseSetRule[] = [
  { role: 'MASTER', teamName: '서비스운영팀', key: 'master' },
  { role: 'SUPER', teamName: '대표진', key: 'president' },
  { role: 'SUPER', teamName: '차기대표진', key: 'nextPresident' },
  { role: 'TEAM', teamName: '서비스운영팀', key: 'serviceTeam' },
  { role: 'TEAM', teamName: '운영지원팀', key: 'opsTeam' },
  { role: 'HOST', teamName: '그룹리더', key: 'groupLeader' },
  { role: 'TEAM', teamName: '*', key: 'otherTeam' },
];

/**
 * (role, teamName)의 기본 권한 세트 키. 조회 순서는 명시 키 → 역할 폴백 → 없음(null, 권한 0)이다.
 * 규칙을 인자로 받아, 화면은 API로 받은 규칙으로 같은 계산을 한다.
 */
export const resolveBaseSetKey = (
  rules: readonly BaseSetRule[],
  role: string,
  teamName: string,
): BaseSetKey | null =>
  rules.find((rule) => rule.role === role && rule.teamName === teamName)?.key ??
  rules.find((rule) => rule.role === role && rule.teamName === '*')?.key ??
  null;

export const baseSetKeyOf = (role: string, teamName: string): BaseSetKey | null =>
  resolveBaseSetKey(BASE_SET_RULES, role, teamName);

/**
 * 계정 발급·수정 때 받아 줄 조합인지. 명시 키가 있거나, 역할 폴백이 있으면서 다른 역할 전용 자리(예: TEAM·대표진)가 아니어야 한다.
 * 폴백이 이런 조합을 조용히 받아 주므로 따로 막는다(백엔드 설계 §3.2 trade-off).
 */
export const isValidCombination = (
  rules: readonly BaseSetRule[],
  role: string,
  teamName: string,
): boolean => {
  if (rules.some((rule) => rule.role === role && rule.teamName === teamName)) return true;
  const hasFallback = rules.some((rule) => rule.role === role && rule.teamName === '*');
  const isOtherRoleSeat = rules.some((rule) => rule.role !== role && rule.teamName === teamName);
  return hasFallback && !isOtherRoleSeat;
};

/** 계정별 예외. 권한 이름 → true(기본 세트에 더함) / false(기본 세트에서 뺌). 기본값과 같으면 저장하지 않는다. */
export type PermissionOverrides = Readonly<Record<string, boolean>>;

export interface PermissionSubject {
  role: string;
  teamName: string;
  leadership: readonly LeadershipGroup[];
  overrides: PermissionOverrides;
}

/** 유효 권한. 담당 그룹 권한은 맡은 그룹 종류로만 정해지고 예외로 바꿀 수 없다. */
export const isEffectivelyAllowed = (
  permission: PermissionDef,
  subject: PermissionSubject,
): boolean => {
  if (permission.ownGroup) return subject.leadership.includes(permission.ownGroup);
  const base = isInBaseSet(permission, baseSetKeyOf(subject.role, subject.teamName));
  return subject.overrides[permission.key] ?? base;
};

/**
 * 체크된 최종 집합에서 기본 세트와 다른 항목만 남긴다. 실제 API에서는 최종 집합을 보내고 이 계산은 서버가 한다.
 * 담당 그룹 권한은 예외 대상이 아니라 제외한다.
 */
export const toOverrides = (
  checked: Readonly<Record<string, boolean>>,
  key: BaseSetKey | null,
): PermissionOverrides =>
  Object.fromEntries(
    PERMISSIONS.filter(
      (permission) =>
        !permission.ownGroup &&
        permission.key in checked &&
        checked[permission.key] !== isInBaseSet(permission, key),
    ).map((permission) => [permission.key, checked[permission.key]] as const),
  );

/** 권한 부여 화면의 일괄 동작. 부여·회수는 예외로 저장하고, 기본값으로 되돌리기는 예외를 지운다. */
export type PermissionChange = 'grant' | 'revoke' | 'reset';

/**
 * 고른 권한들을 한 계정의 예외에 반영한 새 예외를 돌려준다. 원래 예외는 바꾸지 않는다.
 * 바꾼 결과가 기본 세트와 같으면 예외를 남기지 않고, 담당 그룹 권한은 대상에서 뺀다.
 */
export const applyPermissionChange = (
  overrides: PermissionOverrides,
  key: BaseSetKey | null,
  permissionKeys: readonly string[],
  change: PermissionChange,
): PermissionOverrides => {
  const targets = PERMISSIONS.filter(
    (permission) => !permission.ownGroup && permissionKeys.includes(permission.key),
  );
  const next: Record<string, boolean> = { ...overrides };
  for (const permission of targets) {
    const desired = change === 'reset' ? null : change === 'grant';
    if (desired === null || desired === isInBaseSet(permission, key)) {
      delete next[permission.key];
    } else {
      next[permission.key] = desired;
    }
  }
  return next;
};
