/** API 요청이 실패했을 때 서버가 돌려준 사유(ApiError.message)를 알림으로 보여준다. */
export function alertApiError(error: unknown): void {
  window.alert(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
}
