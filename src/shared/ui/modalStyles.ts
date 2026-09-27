/**
 * 출결 관리 팝업 공통 스타일 토큰. 크기·패딩·라운딩은 각 팝업에서 따로 지정한다.
 * 주요 색은 표와 같은 slate 계열의 진한 회색(slate-700) 단색이다.
 */

/** 팝업 카드 표면: 아주 옅은 하늘빛 그라데이션 + 겹 그림자 + 상단 하이라이트로 입체감을 준다. */
export const MODAL_SURFACE =
  'bg-linear-to-b from-white to-[#F3F9FD] border border-[#DCEBF5] ring-1 ring-white/70 shadow-[0_24px_48px_-12px_rgba(15,50,80,0.30),0_8px_16px_-8px_rgba(15,50,80,0.16),inset_0_1px_0_rgba(255,255,255,0.95)]';

/** 팝업 주요 버튼: 회색 단색(그림자·그라데이션 없음). 패딩·글자 크기·라운딩은 호출부에서 지정한다. */
export const MODAL_PRIMARY_BTN =
  'text-white bg-slate-700 hover:bg-slate-800 active:bg-slate-900';

/** 선택된 주차 버튼·토글 등 "선택됨" 상태 표시용. 테두리·글자색까지 포함한다. */
export const BRAND_SELECTED =
  'bg-slate-700 border border-slate-700 text-white';
