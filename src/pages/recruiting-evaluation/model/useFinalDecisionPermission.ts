import { fetchMyAccount } from '@/entities/admin-account/api/adminAccountApi';
import { can } from '@/entities/admin-account/model/can';
import { useLoaded } from '@/shared/lib/useLoaded';

// useLoaded는 참조가 바뀌지 않는 함수를 받아야 해서 모듈 최상위에 둔다.
const loadMyAccount = () => fetchMyAccount();

/**
 * 로그인한 계정이 최종 판정을 바꿀 수 있는지(FINAL_DECISION_WRITE). 권한 관리 화면과 같은 /accounts/me 응답을 쓴다.
 * 읽는 중이거나 읽지 못하면 false라서 수정 컨트롤을 숨긴다. 실제 검사는 서버(REC-ADMIN-18)가 한다.
 */
export function useFinalDecisionPermission(): boolean {
  const me = useLoaded('me', loadMyAccount);
  return me.data !== null && can(me.data, 'FINAL_DECISION_WRITE');
}
