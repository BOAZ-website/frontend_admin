/**
 * 화면을 떠나기 전 확인. 저장하지 않은 수정 내용이 있는 화면이 확인 함수를 등록해 두면,
 * 다른 메뉴로 옮겨 가는 쪽(App의 사이드바 등)이 옮기기 전에 confirmLeave()로 물어본다.
 * 한 번에 한 화면만 등록한다(라우터 없이 화면 하나만 보이는 구조).
 */
type LeaveGuard = () => boolean;

let currentGuard: LeaveGuard | null = null;

/** 확인 함수를 등록한다. 돌려준 함수를 부르면 등록을 푼다(그 사이 다른 화면이 등록했으면 건드리지 않는다). */
export function registerLeaveGuard(guard: LeaveGuard): () => void {
  currentGuard = guard;
  return () => {
    if (currentGuard === guard) currentGuard = null;
  };
}

/** 지금 화면을 떠나도 되는지. 등록된 확인이 없으면 바로 true다. */
export function confirmLeave(): boolean {
  return currentGuard ? currentGuard() : true;
}
