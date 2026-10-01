/**
 * 출결 관리 대상 기수 조회 API
 */

export interface AttendanceTermsResponse {
  success: boolean;
  terms: string[];
  updatedAt: string;
}

/**
 * 현재 출결 점수 관리 대상 기수 목록 조회
 * (예: 26기, 27기)
 */
export async function fetchActiveAttendanceTerms(): Promise<string[]> {
  try {
    const res = await fetch('/api/attendance/terms');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) return data.map(String);
      if (Array.isArray(data.terms)) return data.terms.map(String);
      if (Array.isArray(data.activeTerms)) return data.activeTerms.map(String);
    }
  } catch {
    // 네트워크 실패 또는 로컬 개발 환경 폴백
  }

  // 현재 출결 점수 관리 기수: 26기, 27기 반환
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(['26', '27']);
    }, 120);
  });
}
