import type { AdminAccount } from './types';

/** 계정이 그 권한을 가졌는지. 화면은 이 판정으로 메뉴·버튼을 보이거나 숨기고, 최종 판정은 서버가 한다. */
export const can = (account: Pick<AdminAccount, 'effectivePermissions'>, key: string): boolean =>
  account.effectivePermissions.includes(key);
