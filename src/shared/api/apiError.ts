export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** API 오류 응답. HTTP 상태 코드, 오류 코드, 사용자에게 보여줄 문구를 담는다. 실제 서버와 임시 API가 같은 형식을 쓴다. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}
