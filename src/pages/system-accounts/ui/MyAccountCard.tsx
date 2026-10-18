import { KeyRound } from 'lucide-react';

import type { AdminAccount, PermissionCatalog } from '@/entities/admin-account/model/types';
import { PermissionChips } from '@/pages/system-accounts/ui/PermissionChips';
import { TABLE_BOX } from '@/pages/system-accounts/ui/systemStyles';

interface MyAccountCardProps {
  catalog: PermissionCatalog;
  me: AdminAccount;
  /** 본인 비밀번호 변경 권한이 있을 때만 버튼을 보인다. 이름·기수·부문은 동아리원 관리에서 고친다. */
  canEditSelf: boolean;
  onChangePassword: () => void;
}

const SECONDARY_BTN =
  'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 shadow-2xs transition-colors hover:border-slate-400 hover:bg-slate-50';

/** 운영진 계정 목록 조회 권한이 없는 계정이 보는 본인 정보(GET /api/v1/admin/accounts/me). */
export function MyAccountCard({ catalog, me, canEditSelf, onChangePassword }: MyAccountCardProps) {
  const items = [
    { label: '소속', value: me.teamName },
    { label: '부문', value: me.track },
    { label: '기수', value: `${me.term}기` },
  ];

  return (
    <section className={`${TABLE_BOX} max-w-2xl p-6`} aria-labelledby="my-account-name">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-full bg-slate-100 text-base font-bold text-slate-700">
            {me.name.charAt(0)}
          </div>
          <div>
            <h2
              id="my-account-name"
              className="flex items-center gap-2 text-base font-bold text-slate-900"
            >
              <span>{me.name}</span>
              <span className="rounded-full border border-slate-300 px-2 py-px text-[10px] font-semibold text-slate-600">
                {me.role}
              </span>
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500">{me.username ?? ''}</p>
          </div>
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
            <dt className="text-[11px] font-semibold text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 border-t border-slate-100 pt-4">
        <p className="mb-2 text-[11px] font-semibold text-slate-500">권한</p>
        <PermissionChips catalog={catalog} effectivePermissions={me.effectivePermissions} />
      </div>
    </section>
  );
}
