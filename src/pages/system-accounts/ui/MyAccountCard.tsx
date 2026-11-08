import { KeyRound } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { TABLE_BOX } from '@/shared/ui/systemStyles';

import { PermissionChips } from './PermissionChips';

interface MyAccountCardProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  /** 본인 비밀번호 변경 권한이 있을 때만 버튼을 보인다. 이름·기수·부문은 동아리원 관리에서 고친다. */
  canEditSelf: boolean;
  onChangePassword: () => void;
}

const SECONDARY_BTN =
  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50';

/** 운영진 계정 목록 조회 권한이 없는 계정이 보는 본인 정보(GET /api/v1/admin/accounts/me). */
export function MyAccountCard({ catalog, me, canEditSelf, onChangePassword }: MyAccountCardProps) {
  const items = [
    { label: '소속', value: me.teamName },
    { label: '부문', value: me.track },
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

        {canEditSelf && (
          <button type="button" onClick={onChangePassword} className={SECONDARY_BTN}>
            <KeyRound size={14} aria-hidden="true" />
            <span>비밀번호 변경</span>
          </button>
        )}
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
