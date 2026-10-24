import { Info } from 'lucide-react';

import type { PermissionDef } from '@/entities/admin-account/model/permissions';
import { Tooltip } from '@/shared/ui/Tooltip';

/** 설명이 필요한 곳에만 두는 ⓘ 말풍선. 화면에는 아이콘만 보인다. */
export function InfoTip({ label, align = 'center' }: { label: string; align?: 'center' | 'end' }) {
  return (
    <Tooltip label={label} align={align}>
      <span
        tabIndex={0}
        aria-label={label}
        className="inline-flex cursor-help text-slate-300 outline-none hover:text-slate-600 focus-visible:text-slate-600"
      >
        <Info size={12} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}

/** 권한 이름. 이름만으로 알 수 없는 조건은 ⓘ 말풍선으로 둔다. */
export function PermissionLabel({ permission }: { permission: PermissionDef }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
      {permission.label}
      {permission.note && <InfoTip label={permission.note} />}
    </span>
  );
}
