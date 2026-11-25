import { fetchMyAccount } from '@/entities/admin-account/api/adminAccountApi';
import { can } from '@/entities/admin-account/model/can';
import { useLoaded } from '@/shared/lib/useLoaded';

// useLoaded는 참조가 바뀌지 않는 함수를 받아야 해서 모듈 최상위에 둔다.
const loadMyAccount = () => fetchMyAccount();

/**
 * 로그인한 계정이 그 권한을 가졌는지(예: FINAL_DECISION_WRITE, MEMBER_PROMOTION_WRITE). 권한 관리 화면과 같은 /accounts/me 응답을 쓴다.
 * 읽는 중이거나 읽지 못하면 false라서 수정 컨트롤을 막는다. 실제 검사는 서버가 한다.
 */
export function useMyPermission(permission: string): boolean {
  const me = useLoaded('me', loadMyAccount);
  return me.data !== null && can(me.data, permission);
}
