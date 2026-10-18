import type { AccountHolder } from '@/entities/admin-account/model/types';
import { ROLE_DESCRIPTIONS } from '@/pages/system-accounts/ui/accountLabels';
import { TABLE_BOX, USERNAME_CHIP } from '@/pages/system-accounts/ui/systemStyles';

/** 고른 사람의 기본 정보: 기수·부문. */
export function HolderInfoCard({ holder }: { holder: AccountHolder }) {
  return (
    <section className={`${TABLE_BOX} px-5 py-4`} aria-label="기본 정보">
      <h2 className="text-sm font-bold text-slate-900">기본 정보</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-[96px_minmax(0,1fr)]">
        <dt className="font-semibold text-slate-500">기수</dt>
        <dd className="text-slate-800">{holder.term ? `${holder.term}기` : '-'}</dd>

        <dt className="font-semibold text-slate-500">부문</dt>
        <dd className="text-slate-800">{holder.track || '-'}</dd>
      </dl>
    </section>
  );
}

/**
 * 고른 사람의 운영진 정보: 운영진 계정의 소속 팀·역할·아이디.
 * 운영진 계정이 없는 사람(HOST 계정만 있는 동아리원)은 "운영진 계정 없음"으로 보여 준다.
 */
export function AdminInfoCard({ holder }: { holder: AccountHolder }) {
  const account = holder.adminAccount;

  return (
    <section className={`${TABLE_BOX} px-5 py-4`} aria-label="운영진 정보">
      <h2 className="text-sm font-bold text-slate-900">운영진 정보</h2>
      {account ? (
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-[96px_minmax(0,1fr)]">
          <dt className="font-semibold text-slate-500">소속 팀</dt>
          <dd className="text-slate-800">{account.teamName}</dd>

          <dt className="font-semibold text-slate-500">역할</dt>
          <dd className="text-slate-800">
            {account.role}
            <span className="ml-1 text-slate-400">({ROLE_DESCRIPTIONS[account.role]})</span>
          </dd>

          <dt className="font-semibold text-slate-500">운영진 아이디</dt>
          <dd>
            <code className={USERNAME_CHIP}>{account.username}</code>
          </dd>
        </dl>
      ) : (
        <p className="mt-3 text-xs text-slate-400">운영진 계정 없음</p>
      )}
    </section>
  );
}
