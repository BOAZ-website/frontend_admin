/**
 * 공통 팝업(Dialog) 안에서 쓰는 클래스 묶음. 출결 화면 생성 팝업(스터디 생성 등)의 값과 같다.
 * 입력칸·라벨은 입력칸 조각(field/)을 만들 때 그쪽으로 옮긴다(docs/05-design-system.md 2절).
 */

/** 바닥글의 보조 버튼(취소·닫기). 글자만 있는 버튼. */
export const DIALOG_CANCEL_BTN =
  'cursor-pointer rounded-sm px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100';

/** 바닥글의 주 버튼(저장·생성·변경). 테두리 버튼. */
export const DIALOG_PRIMARY_BTN =
  'cursor-pointer rounded-sm border border-slate-300 bg-transparent px-4 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50';

/** 팝업 안 입력칸 라벨. 입력칸 위의 작은 회색 글자. */
export const DIALOG_LABEL = 'block text-xs font-medium text-slate-500';

/**
 * 팝업 안 한 줄 입력칸. 상자 없이 밑줄(1px)만 있고, 누르면 밑줄 색만 짙어진다. 로그인 화면 입력칸과 같은 모양이다.
 * 내 계정 창처럼 입력칸이 몇 개뿐인 창에 쓴다.
 */
export const DIALOG_INPUT =
  'w-full border-0 border-b border-slate-300 bg-transparent px-0 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-slate-500';
