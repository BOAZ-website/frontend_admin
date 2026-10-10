/**
 * 행사 출결 방식별 화면 설정. 운영지원팀이 행사 종류마다 다른 양식의 명단 파일로 출결을 관리하므로,
 * 새 행사를 만들 때 방식을 골라 그에 맞는 명단 파일을 받는다.
 */
import type { AttendStatus, EventAttendanceFormat } from '@/entities/event/model/types';

export type { EventAttendanceFormat };

/**
 * 컨퍼런스 명단 시트. 운영지원팀은 한 파일 안에서 참석자 구분마다 시트를 나눠 관리한다.
 * 시트는 따로 저장하지 않고 참가자 정보로 정한다: 외부 참석자 → EXTERNAL,
 * 기수가 행사 대상 기수(현재 활동기수)에 들면 → CURRENT, 그 밖의 BOAZ 회원 → OTHER_MEMBERS.
 */
export type ConferenceSheet = 'CURRENT' | 'OTHER_MEMBERS' | 'EXTERNAL';

export const CONFERENCE_SHEETS: readonly { value: ConferenceSheet; label: string }[] = [
  { value: 'CURRENT', label: '현재 활동기수' },
  { value: 'OTHER_MEMBERS', label: '현재 활동기수 외 BOAZ 회원' },
  { value: 'EXTERNAL', label: '외부 참석자' },
];

export function conferenceSheetOf(
  attendee: { isExternal: boolean; term?: number },
  activeTerms: readonly number[],
): ConferenceSheet {
  if (attendee.isExternal) {
    return 'EXTERNAL';
  }
  return attendee.term !== undefined && activeTerms.includes(attendee.term)
    ? 'CURRENT'
    : 'OTHER_MEMBERS';
}

/**
 * 출석 표에서 고를 수 있는 출결 값. code는 운영지원팀 명단 파일에 적는 값이고, 같은 키로 입력할 수 있다.
 * 문서에 코드가 없는 값은 code가 빈 문자열이다(화면에 코드를 붙이지 않고, 키로도 고를 수 없다).
 */
export interface AttendStatusOption {
  value: AttendStatus;
  code: string;
  label: string;
}

/** 아직 입력하지 않은 상태. 모든 방식에 있고 '-' 키로 고른다. */
const UNMARKED_OPTION: AttendStatusOption = { value: 'unmarked', code: '-', label: '미정' };

/** 방식별 출결 값(「관리자 시스템 관련 현행 운영 방식」 문서의 출결 코드). */
const STATUS_OPTIONS_BY_FORMAT: Record<EventAttendanceFormat, readonly AttendStatusOption[]> = {
  // 출석 O / X. 지각·조퇴·인정결석은 문서에 코드가 없고(특이사항에 적는다) 특칙 감점이 따로 있어 함께 고른다.
  NEWCOMER: [
    { value: 'present', code: 'O', label: '출석' },
    { value: 'late', code: '', label: '지각' },
    { value: 'earlyLeave', code: '', label: '조퇴' },
    { value: 'absent', code: 'X', label: '결석' },
    { value: 'excusedAbsent', code: '', label: '인정결석' },
    UNMARKED_OPTION,
  ],
  // 1차·2차 각각: 0 불참 · 1 참석 · 2 조퇴 · 3 지각(문서의 코드 순서 그대로)
  CONFERENCE: [
    { value: 'absent', code: '0', label: '불참' },
    { value: 'present', code: '1', label: '참석' },
    { value: 'earlyLeave', code: '2', label: '조퇴' },
    { value: 'late', code: '3', label: '지각' },
    UNMARKED_OPTION,
  ],
  // 1 출석 · 2 지각 · 3 조퇴 · 4 결석 · 5 인정결석 · 0 무단지각 · X 무단결석
  GENERAL: [
    { value: 'present', code: '1', label: '출석' },
    { value: 'late', code: '2', label: '지각' },
    { value: 'earlyLeave', code: '3', label: '조퇴' },
    { value: 'absent', code: '4', label: '결석' },
    { value: 'excusedAbsent', code: '5', label: '인정결석' },
    { value: 'unexcusedLate', code: '0', label: '무단지각' },
    { value: 'unexcusedAbsent', code: 'X', label: '무단결석' },
    UNMARKED_OPTION,
  ],
  // 기타: 출결 버튼이 없다. 출결은 명단 파일의 열에 글자로 직접 입력한다.
  OTHER: [],
};

export function statusOptionsOf(
  format: EventAttendanceFormat | undefined,
): readonly AttendStatusOption[] {
  return STATUS_OPTIONS_BY_FORMAT[format ?? 'GENERAL'];
}

/** 누른 키에 해당하는 출결 값. 대소문자는 가리지 않는다. */
export function statusOfKey(
  format: EventAttendanceFormat | undefined,
  key: string,
): AttendStatus | undefined {
  const pressed = key.toUpperCase();
  return statusOptionsOf(format).find((option) => option.code !== '' && option.code === pressed)
    ?.value;
}

/** 출결 값을 그 방식의 코드로 적는다(명단 내보내기용). 코드가 없는 값은 이름으로, 방식에 없는 값은 '-'로 적는다. */
export function statusCodeOf(
  format: EventAttendanceFormat | undefined,
  status: AttendStatus,
): string {
  const option = statusOptionsOf(format).find((item) => item.value === status);
  return option ? option.code || option.label : '-';
}

export function statusLabelOf(
  format: EventAttendanceFormat | undefined,
  status: AttendStatus,
): string {
  return statusOptionsOf(format).find((option) => option.value === status)?.label ?? '미정';
}

/** 명단 파일을 올리는 칸. 컨퍼런스는 참석자 구분마다 시트를 따로 받는다. */
export type RosterSlotId = 'MAIN' | 'CURRENT_COHORT' | 'OTHER_MEMBERS' | 'EXTERNAL';

export interface RosterSlot {
  id: RosterSlotId;
  label: string;
  /** 이 칸에서 읽은 참가자를 외부 참가자로 등록하는지. */
  isExternal: boolean;
}

export interface EventFormatOption {
  value: EventAttendanceFormat;
  label: string;
  /** 첫 칸의 머리글로 출석 표 컬럼을 만든다. */
  slots: readonly RosterSlot[];
}

export const EVENT_FORMAT_OPTIONS: readonly EventFormatOption[] = [
  {
    value: 'NEWCOMER',
    label: '신입 특칙형',
    slots: [
      {
        id: 'MAIN',
        label: '참여자 명단',
        isExternal: false,
      },
    ],
  },
  {
    value: 'CONFERENCE',
    label: '컨퍼런스 1/2차형',
    slots: [
      {
        id: 'CURRENT_COHORT',
        label: '현재 활동기수',
        isExternal: false,
      },
      {
        id: 'OTHER_MEMBERS',
        label: '현재 활동기수 외 BOAZ 회원',
        isExternal: false,
      },
      {
        id: 'EXTERNAL',
        label: '외부 참석자',
        isExternal: true,
      },
    ],
  },
  {
    value: 'GENERAL',
    label: '일반 행사형',
    slots: [
      {
        id: 'MAIN',
        label: '참여자 명단',
        isExternal: false,
      },
    ],
  },
];

/**
 * 출결 버튼 없이 명단 파일의 열을 그대로 쓰는 방식인지(기타).
 * 새 행사는 기타 방식으로 만들 수 없고, 이미 있는 기타 방식 행사를 보여 줄 때만 쓴다.
 */
export function usesFreeformColumns(format: EventAttendanceFormat | undefined): boolean {
  return format === 'OTHER';
}

export const DEFAULT_EVENT_FORMAT: EventAttendanceFormat = 'GENERAL';

/** 명단 파일에서 비고로 받는 열(별도 컬럼으로 만들지 않는다). */
export const MEMO_LABELS: readonly string[] = ['비고', '출결 특이사항'];

const NAME_LABELS: readonly string[] = ['이름', '성명'];

/**
 * 일반 행사형 명단 파일의 행사 열. 운영지원팀 시트처럼 이름 뒤에 오는 열(MT, 해커톤 …)이 행사별 출결 열이다.
 * 이름 열이 없으면 행사 열도 없다.
 */
export function sessionLabelsFromHeader(headers: readonly string[]): string[] {
  const nameAt = headers.findIndex((header) => NAME_LABELS.includes(header));
  if (nameAt < 0) {
    return [];
  }
  return headers
    .slice(nameAt + 1)
    .filter(
      (header, idx, all) =>
        header !== '' && !MEMO_LABELS.includes(header) && all.indexOf(header) === idx,
    );
}

/** 명단 파일의 열 중 O / X로 고르는 열. 출석 표에서 글자 입력 대신 O·X 버튼으로 고른다. */
export const OX_COLUMN_LABELS: readonly string[] = ['뒤풀이 비용'];
export const OX_OPTIONS: readonly string[] = ['O', 'X'];

export function eventFormatOptionOf(format: EventAttendanceFormat): EventFormatOption {
  return EVENT_FORMAT_OPTIONS.find((option) => option.value === format) ?? EVENT_FORMAT_OPTIONS[0];
}

/**
 * 명단 파일에서 출결을 적는 열(운영지원팀 양식). 이 열은 표의 글자 컬럼으로 만들지 않고 출결 값으로 읽는다.
 * 일반 행사형은 이름 뒤의 행사 열이 출결 열이다(sessionLabelsFromHeader). 기타는 열을 그대로 둔다.
 */
export const STATUS_HEADERS_BY_FORMAT: Record<EventAttendanceFormat, readonly string[]> = {
  NEWCOMER: ['출석'],
  CONFERENCE: ['1차 출석 확인', '2차 출석 확인', '출석'],
  GENERAL: [],
  OTHER: [],
};

/** 명단 파일의 출결 열에서 읽은 출결. 값이 없거나 그 방식에 없는 코드면 그 칸은 비어 있다. */
export interface ImportedStatuses {
  status?: AttendStatus;
  secondStatus?: AttendStatus;
}

/**
 * 명단 파일 한 줄의 출결 열 값을 출결로 바꾼다(코드는 「관리자 시스템 관련 현행 운영 방식」 문서 기준).
 * 신입 특칙형: 출석 O/X. 컨퍼런스: 1차·2차 출석 확인 0~3, 외부 참석자는 출석 1 또는 공란.
 */
export function importedStatusesOf(
  format: EventAttendanceFormat,
  answers: Readonly<Record<string, string>>,
): ImportedStatuses {
  const read = (header: string) => statusOfKey(format, (answers[header] ?? '').trim());
  if (format === 'NEWCOMER') {
    return { status: read('출석') };
  }
  if (format === 'CONFERENCE') {
    return { status: read('1차 출석 확인') ?? read('출석'), secondStatus: read('2차 출석 확인') };
  }
  return {};
}
