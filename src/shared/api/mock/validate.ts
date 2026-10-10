/**
 * 요청 본문·쿼리 검증. 백엔드가 400으로 거절할 입력을 임시 API에서도 똑같이 거절해,
 * 화면이 오류 처리 경로를 미리 갖추도록 한다.
 */
import { ApiError } from './router';

export type Body = Readonly<Record<string, unknown>>;

const badRequest = (message: string) => new ApiError(400, 'BAD_REQUEST', message);

export function readBody(body: unknown): Body {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('요청 본문은 JSON 객체여야 합니다.');
  }
  return body as Body;
}

export function requiredString(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw badRequest(`${key} 값이 필요합니다.`);
  }
  return value.trim();
}

export function optionalString(body: Body, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw badRequest(`${key} 값은 문자열이어야 합니다.`);
  return value.trim();
}

export function optionalNumber(body: Body, key: string): number | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw badRequest(`${key} 값은 양의 정수여야 합니다.`);
  }
  return value;
}

export function optionalBoolean(body: Body, key: string): boolean | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') throw badRequest(`${key} 값은 true 또는 false여야 합니다.`);
  return value;
}

export function stringArray(body: Body, key: string, { required = false } = {}): string[] {
  const value = body[key];
  if (value === undefined || value === null) {
    if (required) throw badRequest(`${key} 값이 필요합니다.`);
    return [];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw badRequest(`${key} 값은 문자열 배열이어야 합니다.`);
  }
  return [...new Set(value as string[])];
}

export function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  key: string,
): T | undefined {
  if (value === undefined) return undefined;
  if (!(allowed as readonly string[]).includes(value)) {
    throw badRequest(`${key} 값은 ${allowed.join(', ')} 중 하나여야 합니다.`);
  }
  return value as T;
}

/** 경로·쿼리의 숫자 값. 없으면 undefined, 숫자가 아니면 400. */
export function parsePositiveInt(
  value: string | null | undefined,
  key: string,
): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0)
    throw badRequest(`${key} 값은 양의 정수여야 합니다.`);
  return parsed;
}

/** 주차별 날짜(주차 번호 → YYYY-MM-DD). */
export function weekDatesOf(body: Body, key = 'weekDates'): Record<number, string> | undefined {
  const value = body[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw badRequest(`${key} 값은 {주차 번호: 'YYYY-MM-DD'} 형태여야 합니다.`);
  }
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([week, date]) => {
      const weekNum = Number(week);
      if (!Number.isInteger(weekNum) || weekNum < 1 || weekNum > 16) {
        throw badRequest(`${key}의 주차 번호는 1~16이어야 합니다.`);
      }
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw badRequest(`${key}의 날짜는 YYYY-MM-DD 형식이어야 합니다.`);
      }
      return [weekNum, date];
    }),
  );
}

export interface FilePayload {
  /** 파일 내용(data URL) 또는 이미 올라가 있는 파일 경로·URL. */
  dataUrl: string;
  name: string;
  size: string | null;
}

/** 첨부 종류별로 받을 수 있는 data URL 머리. */
const DATA_URL_PREFIXES: Readonly<Record<'photo' | 'pdf', string>> = {
  photo: 'data:image/',
  pdf: 'data:application/pdf',
};
/** 이미 올라가 있는 파일의 경로(예: images/study/a.jpg). 스킴(javascript: 등)이 붙은 값은 받지 않는다. */
const RELATIVE_FILE_PATH = /^[\w\-./]+$/;

function isAllowedFileUrl(kind: 'photo' | 'pdf', value: string): boolean {
  if (value.startsWith(DATA_URL_PREFIXES[kind])) return true;
  if (/^https?:\/\//.test(value)) return true;
  return RELATIVE_FILE_PATH.test(value);
}

/**
 * 첨부 파일 본문. 키가 없으면 undefined(변경 없음), null이면 첨부 삭제다.
 * 실제 백엔드는 multipart로 받겠지만, 임시 API는 JSON으로 받기 위해 data URL을 쓴다.
 * 사진은 이미지 data URL, PDF는 PDF data URL이나 http(s) 주소·상대 경로만 받는다.
 */
export function filePayload(body: Body, key: 'photo' | 'pdf'): FilePayload | null | undefined {
  const value = body[key];
  if (value === undefined) return undefined;
  if (value === null) return null;
  const file = readBody(value);
  const dataUrl = requiredString(file, 'dataUrl');
  if (!isAllowedFileUrl(key, dataUrl)) {
    throw badRequest(`${key} 파일 형식이 올바르지 않습니다.`);
  }
  return {
    dataUrl,
    name: requiredString(file, 'name'),
    size: optionalString(file, 'size') ?? null,
  };
}
