/**
 * 운영진 계정 전달문(카카오톡·슬랙으로 본인에게 보내는 안내) 문구.
 *
 * 문구를 바꿀 때는 이 파일의 ACCOUNT_DELIVERY_TEMPLATES만 고친다. 화면 코드는 고치지 않아도 된다.
 * - title: 전달문 창의 제목. body: 복사해 보내는 본문.
 * - {name} 같은 중괄호 자리에는 화면이 값을 채운다. 쓸 수 있는 자리는 각 문구 위 주석에 적었다.
 * - 값이 없는 자리가 든 줄은 통째로 빠진다(예: 팀을 옮기지 않았으면 '• 팀:' 줄이 빠진다).
 * - 문구가 바뀌어도 이미 보낸 전달문은 바뀌지 않는다. 바꾼 뒤에는 다시 배포해야 화면에 반영된다.
 */

interface DeliveryTemplate {
  title: string;
  body: string;
}

export const ACCOUNT_DELIVERY_TEMPLATES = {
  /** 운영진 계정 발급(권한 관리 "+ 계정", 동아리원 정보 수정 팝업). 자리: {name} {username} {password} */
  issue: {
    title: '{name} 계정 발급',
    body: `[BOAZ 운영진 계정 발급 안내]

• 로그인 아이디: {username}
• 초기 비밀번호: {password}

로그인 후 비밀번호를 바꿔 주세요.`,
  },

  /** 다른 운영진의 비밀번호 재설정(권한 관리 표). 자리: {name} {username} {password} */
  passwordReset: {
    title: '{name} 비밀번호 재설정',
    body: `[BOAZ 운영진 계정 비밀번호 재설정 안내]

• 로그인 아이디: {username}
• 새 비밀번호: {password}

로그인 후 새 비밀번호로 접속해 주세요.`,
  },

  /**
   * 이미 운영진인 사람의 아이디·비밀번호를 바꿨을 때, 비밀번호도 새로 정한 경우(권한 관리 "+ 계정").
   * 자리: {name} {fromTeam} {toTeam}(팀을 옮겼을 때만) {username} {password}
   */
  changeWithPassword: {
    title: '{name} 운영진 계정 변경',
    body: `[BOAZ 운영진 계정 변경 안내]

• 팀: {fromTeam} → {toTeam}
• 로그인 아이디: {username}
• 새 비밀번호: {password}

로그인 후 비밀번호를 바꿔 주세요.`,
  },

  /**
   * 이미 운영진인 사람의 아이디만 바꾸고 비밀번호는 그대로 둔 경우(권한 관리 "+ 계정").
   * 자리: {name} {fromTeam} {toTeam}(팀을 옮겼을 때만) {username}
   */
  changeUsernameOnly: {
    title: '{name} 운영진 계정 변경',
    body: `[BOAZ 운영진 계정 변경 안내]

• 팀: {fromTeam} → {toTeam}
• 로그인 아이디: {username}
• 비밀번호: 바꾸지 않았습니다.

바뀐 아이디로 로그인해 주세요.`,
  },

  // ─── 그룹리더(HOST) 계정: 출결 및 점수 시스템 > 그룹 계정 관리 ───

  /**
   * 그룹리더(HOST) 계정 발급. 자리: {name} {generation}(예: 27기) {track} {groupType}(BASE·ADV·STUDY 등)
   * {teamName} {username} {password}
   */
  hostIssue: {
    title: '{generation} {track} {name}',
    body: `[BOAZ 그룹리더 HOST 전용 계정 안내]

안녕하세요, {name}님!
BOAZ {generation} [{track}] 출결 관리를 위한 그룹리더(HOST) 계정이 발급되었습니다.

• 역할(Role): HOST (그룹리더)
• 담당 구분: [{groupType}] {teamName}
• 로그인 아이디: {username}
• 초기 비밀번호: {password}
• 접속 URL: https://attendance.boaz.org/host

[안내 사항]
• 로그인 후 배정된 팀의 출결 입력과 제출을 진행해 주시기 바랍니다.
• 최초 접속 후 본인 계정 정보 및 비밀번호를 안전하게 변경해 주시기 바랍니다.
• 겸직 중인 다른 그룹(ADV/스터디)이 있으신 경우 본 단일 계정으로 통합 관리됩니다.`,
  },

  /**
   * 이미 있는 그룹리더 계정에 다른 그룹 권한(ADV·스터디)을 더했을 때. 아이디·비밀번호는 그대로다.
   * 자리: {name} {generation} {track} {permission}(ADV·스터디) {teamName} {username} {menuName}(출결 입력 메뉴 이름)
   */
  hostPermissionAdd: {
    title: '{generation} {track} {name} {permission} 권한 추가',
    body: `[BOAZ 그룹리더 계정 권한 추가 안내]

안녕하세요, {name}님!
지금 쓰고 계신 계정에 {permission} 출결 접근 권한을 추가해 두었습니다.
새 계정을 따로 만들 필요 없이, 이전에 받으신 아이디와 비밀번호로 그대로 로그인하시면 됩니다.

• 담당 팀: [{permission}] {teamName}
• 로그인 아이디: {username}
• 비밀번호: 이전에 받으신 비밀번호 그대로
• 접속 URL: https://attendance.boaz.org/host

로그인한 뒤 {menuName} 메뉴에서 담당 팀의 출결을 입력해 주세요.`,
  },

  /** 그룹리더 계정 비밀번호 재설정. 자리: {name} {username} {password} */
  hostPasswordReset: {
    title: '{name} 비밀번호 재설정',
    body: `[BOAZ 그룹리더 계정 비밀번호 재설정 안내]

• 로그인 아이디: {username}
• 새 비밀번호: {password}

로그인 후 새 비밀번호로 접속해 주세요.`,
  },
} satisfies Record<string, DeliveryTemplate>;

export type AccountDeliveryKind = keyof typeof ACCOUNT_DELIVERY_TEMPLATES;

/** 자리에 넣을 값. null·undefined면 그 자리가 든 줄을 뺀다. */
export type DeliveryValues = Readonly<Record<string, string | null | undefined>>;

const PLACEHOLDER = /\{(\w+)\}/g;

/** 한 줄의 자리를 채운다. 값이 없는 자리가 있으면 null(그 줄을 뺀다). */
const fillLine = (line: string, values: DeliveryValues): string | null => {
  let isMissing = false;
  const filled = line.replace(PLACEHOLDER, (_match, key: string) => {
    const value = values[key];
    if (value === null || value === undefined) {
      isMissing = true;
      return '';
    }
    return value;
  });
  return isMissing ? null : filled;
};

const fillText = (text: string, values: DeliveryValues): string =>
  text
    .split('\n')
    .map((line) => fillLine(line, values))
    .filter((line): line is string => line !== null)
    .join('\n');

/** 전달문 창에 넘길 제목과 본문을 만든다. */
export function buildAccountDelivery(
  kind: AccountDeliveryKind,
  values: DeliveryValues,
): { title: string; text: string } {
  const template = ACCOUNT_DELIVERY_TEMPLATES[kind];
  return { title: fillText(template.title, values), text: fillText(template.body, values) };
}
