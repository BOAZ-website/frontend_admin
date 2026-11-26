import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { trackLabelOf } from '@/entities/user/model/trackLabel';
import { TABLE_BOX } from '@/shared/ui/systemStyles';

import { PermissionChips } from './PermissionChips';

interface MyAccountCardProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
}

/**
 * 운영진 계정 목록 조회 권한이 없는 계정이 보는 본인 정보(GET /api/v1/admin/accounts/me).
 * 본인 비밀번호는 여기서 바꾸지 않고 화면 위 내 계정 창에서 바꾼다. 이름·기수·부문은 동아리원 관리에서 고친다.
 */
export function MyAccountCard({ catalog, me }: MyAccountCardProps) {
  const items = [
    { label: '소속', value: me.teamName },
    { label: '부문', value: trackLabelOf(me.track) },
    { label: '기수', value: `${me.term}기` },
  ];

  return (
    <section className={`${TABLE_BOX} max-w-2xl p-4`} aria-labelledby="my-account-name">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2
            id="my-account-name"
            className="flex items-baseline gap-2 text-base font-bold text-slate-900"
          >
            <span>{me.name}</span>
            <span className="text-xs font-normal text-slate-500">{me.role}</span>
          </h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{me.username}</p>
        </div>

        <p className="text-xs text-slate-500">비밀번호는 화면 위 내 계정에서 바꿉니다.</p>
      </div>

      <dl className="grid grid-cols-3 gap-x-6 pt-4 text-xs">
        {items.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-xs font-semibold text-slate-500">{label}</dt>
            <dd className="mt-1 text-xs font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-xs font-semibold text-slate-500">권한</p>
        <PermissionChips catalog={catalog} effectivePermissions={me.effectivePermissions} />
      </div>
    </section>
  );
}
