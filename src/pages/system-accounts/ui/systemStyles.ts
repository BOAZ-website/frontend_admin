/**
 * 시스템·계정 화면 공통 스타일. 출결 화면(그룹 계정 관리)·동아리원 관리와 같은 입력칸·표·팝업 모양이다.
 */
/** 도구 줄의 검색칸. */
export const TOOLBAR_FIELD =
  'h-9 rounded-sm border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400';
export const TABLE_BOX = 'overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs';
/** 표 머리 칸. 출결 표처럼 칸마다 연한 회색 바탕에 굵은 글자다. 핵심 열은 text-slate-900을 덧붙인다. */
export const TH_CLASS =
  'bg-slate-100/90 px-2 py-1 text-center font-bold text-slate-700 whitespace-nowrap';
/** 표 본문 칸. 출결 표처럼 가운데 정렬 12px이다. */
export const TD_CLASS = 'px-2 py-1.5 text-center text-xs whitespace-nowrap';
/** 아이디 표시(그룹 계정 관리와 같은 회색 코드 칩). */
export const USERNAME_CHIP =
  'rounded border border-slate-200/80 bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-800';
export const ROW_CLASS =
  'h-[46px] divide-x divide-slate-200 transition-colors hover:bg-slate-50/70';
/** 표 행의 아이콘 버튼. 평소에는 연한 회색, 마우스를 올리면 진해지고 연한 배경이 깔린다. */
export const ICON_BTN =
  'inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800';
export const MODAL_BACKDROP =
  'fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs';
export const MODAL_CLOSE_BTN =
  'p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer';
export const MODAL_CANCEL_BTN =
  'h-9 rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer';
export const MODAL_CONFIRM_BTN =
  'h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
export const FIELD_LABEL = 'mb-1.5 block text-[11px] font-semibold text-slate-500';
export const FIELD_INPUT =
  'h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400';
/** 바꿀 수 없는 값을 입력칸 자리에 보여줄 때 쓰는 상자. */
export const FIELD_READONLY =
  'flex h-10 items-center rounded-sm border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500';
/** 입력칸 이름 옆의 작은 글자 버튼(임의 비밀번호 생성 등). */
export const FIELD_TEXT_BTN =
  'inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-slate-500 transition-colors hover:text-slate-900';
