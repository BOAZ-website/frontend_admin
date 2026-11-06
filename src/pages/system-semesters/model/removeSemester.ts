import { ApiError } from '@/shared/api/client';
import { alertApiError } from '@/shared/lib/alertApiError';

const HAS_RECORDS = 'SEMESTER_HAS_RECORDS';

type RemoveAction = (semester: string, isForced?: boolean) => Promise<unknown>;

/**
 * 종료 반기를 묻고 지운다. 기록이 있으면 서버가 건수를 알려 주고(409 SEMESTER_HAS_RECORDS),
 * 그 내용을 보여 주며 한 번 더 물은 뒤 force로 다시 보낸다. 어느 확인에서든 아니오면 지우지 않는다.
 * 지웠으면 true. 실패는 알리고 false.
 */
export async function confirmAndRemoveSemester(
  name: string,
  remove: RemoveAction,
): Promise<boolean> {
  const message = `종료된 ${name}을 삭제할까요?
반기가 목록에서 빠집니다. 그 반기의 팀·출결·행사 기록과 감사 로그는 지워지지 않습니다.`;
  if (!window.confirm(message)) return false;
  try {
    try {
      await remove(name);
    } catch (error) {
      if (!(error instanceof ApiError && error.code === HAS_RECORDS)) throw error;
      if (!window.confirm(`${error.message}\n그래도 삭제할까요?`)) return false;
      await remove(name, true);
    }
    return true;
  } catch (error) {
    alertApiError(error);
    return false;
  }
}
