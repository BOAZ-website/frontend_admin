/**
 * 백엔드 부문 코드(Track enum 이름)의 화면 이름. 운영진 계정 응답(AdminAccountResponse)은 부문을 이 코드로 보낸다.
 * 임시 API는 아직 한글 이름을 보내므로 한글은 그대로 통과시킨다.
 */
const TRACK_LABEL_BY_CODE: Record<string, string> = {
  ALL: '전부문',
  ANALYSIS: '분석',
  VISUALIZATION: '시각화',
  ENGINEERING: '엔지니어링',
};

/** 부문 코드나 이름을 화면 이름으로 바꾼다. 모르는 값은 그대로, 빈 값은 null. */
export const trackLabelOf = (track: string | null | undefined): string | null =>
  track ? (TRACK_LABEL_BY_CODE[track] ?? track) : null;
