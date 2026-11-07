import { alertApiError } from '@/shared/lib/alertApiError';

type RemoveAction = (semester: string) => Promise<unknown>;

/** 진행 예정 반기를 묻고 지운다. 지웠으면 true, 실패는 알리고 false. 진행 중·종료 반기는 지울 수 없다. */
export async function confirmAndRemovePreparing(
  name: string,
  remove: RemoveAction,
): Promise<boolean> {
  if (
    !window.confirm(`진행 예정 반기 ${name}을 삭제할까요?
입력한 일정과 명단이 목록에서 빠집니다.`)
  ) {
    return false;
  }
  try {
    await remove(name);
    return true;
  } catch (error) {
    alertApiError(error);
    return false;
  }
}
