/**
 * 출결 관리 팝업 공통 스타일 토큰. 크기·패딩·라운딩은 각 팝업에서 따로 지정한다.
 * 주요 색은 표와 같은 slate 계열의 진한 회색(slate-700) 단색이다.
 */

/** 팝업 카드 표면: 출결 화면과 같은 중립적인 slate 톤을 쓴다. */
export const MODAL_SURFACE =
  'bg-white border border-slate-200 shadow-[0_12px_32px_-16px_rgba(15,23,42,0.45)]';

/** 팝업 주요 버튼: 회색 단색(그림자·그라데이션 없음). 패딩·글자 크기·라운딩은 호출부에서 지정한다. */
export const MODAL_PRIMARY_BTN = 'text-white bg-slate-700 hover:bg-slate-800 active:bg-slate-900';

/**
 * 선택된 주차 버튼 등 "선택됨" 상태 표시용. 테두리·글자색까지 포함한다.
 * 여러 주차 중 지금 위치를 한눈에 찾도록 진한 채움을 쓴다.
 */
export const BRAND_SELECTED = 'bg-slate-700 border border-slate-700 text-white';
