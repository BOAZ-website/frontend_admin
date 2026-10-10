/**
 * 화면이 백엔드 API를 호출할 때 쓰는 클라이언트. 화면은 이 파일의 api·ApiError만 가져다 쓴다.
 *   · VITE_API_BASE_URL이 있으면 그 서버로 fetch 요청을 보낸다.
 *   · 없으면 브라우저 안의 임시 API(mock/, 임시 DB)가 같은 경로로 응답한다.
 * 백엔드 연동이 끝나면 mock/ 폴더와 아래 임시 API 분기만 지우면 되고, 화면 코드는 바꾸지 않는다.
 */
import { ApiError, type HttpMethod } from './apiError';

export { ApiError, type HttpMethod };

const REQUEST_TIMEOUT_MS = 10_000;

interface ApiRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
}

function apiBaseUrl(): string | undefined {
  const value = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  return value ? value.replace(/\/+$/, '') : undefined;
}

/** 서버 오류 응답 본문에서 오류 코드와 문구를 읽는다. 형식이 다르면 상태 코드로 기본 문구를 만든다. */
async function toApiError(response: Response): Promise<ApiError> {
  const fallback = `요청을 처리하지 못했습니다. (${response.status})`;
  try {
    const data = (await response.json()) as { code?: unknown; message?: unknown };
    return new ApiError(
      response.status,
      typeof data.code === 'string' ? data.code : 'HTTP_ERROR',
      typeof data.message === 'string' ? data.message : fallback,
    );
  } catch {
    return new ApiError(response.status, 'HTTP_ERROR', fallback);
  }
}

async function requestServer<T>(baseUrl: string, { method, path, body }: ApiRequest): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  }
  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function apiRequest<T = unknown>(request: ApiRequest): Promise<T> {
  const baseUrl = apiBaseUrl();
  if (baseUrl) return requestServer<T>(baseUrl, request);

  // 임시 API. 서버 주소가 있으면 이 모듈은 불러오지 않는다.
  const { mockRequest } = await import('./mock/mockTransport');
  return mockRequest<T>(request.method, request.path, request.body);
}

/** 경로에 쿼리 문자열을 붙인다. undefined·null·빈 문자열 값은 뺀다. */
export function withQuery(
  path: string,
  params: Readonly<Record<string, string | number | boolean | null | undefined>> = {},
): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

export const api = {
  get: <T>(path: string) => apiRequest<T>({ method: 'GET', path }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>({ method: 'POST', path, body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>({ method: 'PUT', path, body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>({ method: 'PATCH', path, body }),
  delete: <T>(path: string) => apiRequest<T>({ method: 'DELETE', path }),
};
