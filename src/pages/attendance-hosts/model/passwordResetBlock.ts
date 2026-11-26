import { can } from '@/entities/admin-account/model/can';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import type { LeaderAccount } from '@/entities/host-account/model/types';

/**
 * 그룹 계정 관리 표에서 이 계정의 비밀번호 재설정을 막는 이유. 막지 않으면 null.
 * 임시 API의 판정(adminAccountRoutes.ts requirePasswordWrite)과 같고, 화면은 버튼을 흐리게 두고 이유를 보인다(R11-2).
 *   · 본인 계정: 화면 위 내 계정 창에서 바꾼다
 *   · 서비스운영팀장(MASTER) 계정: 본인만 바꾼다
 *   · "타 계정 정보 수정"이 있으면 모든 계정, "HOST 계정 발급 CUD"만 있으면 HOST 계정만
 * 내 권한(me)을 읽지 못했으면 막지 않는다. 최종 판정은 서버가 한다(R11-1).
 */
export function passwordResetBlockReasonOf(
  me: Pick<AdminAccount, 'id' | 'effectivePermissions'> | null,
  account: LeaderAccount,
): string | null {
  if (!me) return null;
  if (account.id === me.id) return '본인 비밀번호는 화면 위 내 계정에서 바꿔 주세요.';
  if (account.role === 'MASTER') {
    return '서비스운영팀장(MASTER) 계정의 비밀번호는 본인만 바꿀 수 있습니다.';
  }
  if (can(me, 'ADMIN_ACCOUNT_WRITE')) return null;
  if (account.role !== 'HOST') {
    return '운영진 계정의 비밀번호는 "타 계정 정보 수정" 권한이 있어야 재설정할 수 있습니다.';
  }
  return can(me, 'HOST_ACCOUNT_WRITE') ? null : 'HOST 계정 비밀번호를 재설정할 권한이 없습니다.';
}
