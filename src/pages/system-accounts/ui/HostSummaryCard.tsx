import type { ReactNode } from 'react';

import type { AccountHolder, LeaderGroup } from '@/entities/admin-account/model/types';
import { TABLE_BOX, USERNAME_CHIP } from '@/pages/system-accounts/ui/systemStyles';
import { Tooltip } from '@/shared/ui/Tooltip';

/** 한 줄에 보여 줄 최대 개수. 나머지는 "+N"에 마우스를 올리면 말풍선으로 보인다. */
const VISIBLE_LIMIT = 2;

const groupLabel = (group: LeaderGroup): string => {
  if (group.groupType === 'ADV') return 'ADV';
  return group.studyKind === 'MENTORING' ? '멘멘' : '스터디';
};

interface LineItem {
  key: string;
  /** 말풍선에 넣을 글자. */
  text: string;
  node: ReactNode;
}

/**
 * 항목을 한 줄로만 보여 준다. 맡은 그룹·HOST 계정이 많아도 줄바꿈하지 않아 카드 높이가 그대로다.
 * 앞의 VISIBLE_LIMIT개만 보이고(폭이 모자라면 말줄임), 나머지는 "+N"에 마우스를 올리면 전체 목록이 뜬다.
 */
function OneLineList({ items }: { items: readonly LineItem[] }) {
  const hiddenCount = items.length - VISIBLE_LIMIT;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <ul className="flex min-w-0 gap-1.5 overflow-hidden">
        {items.slice(0, VISIBLE_LIMIT).map((item) => (
          <li key={item.key} className="flex min-w-0 shrink">
            {item.node}
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <Tooltip label={items.map((item) => item.text).join(' · ')} align="end">
          <span
            tabIndex={0}
            aria-label={`전체 ${items.length}개: ${items.map((item) => item.text).join(', ')}`}
            className="inline-flex h-6 shrink-0 cursor-help items-center rounded-sm border border-slate-200 bg-white px-1.5 font-semibold tabular-nums text-slate-600 outline-none hover:border-slate-300 focus-visible:border-slate-400"
          >
            +{hiddenCount}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

/**
 * 고른 사람의 HOST 정보: 이번 반기 맡은 그룹(팀장인 ADV 팀·스터디)과 HOST 로그인 계정.
 * 맡은 그룹은 출결 입력 권한(맡은 그룹에서 자동)이 생기는 근거라 운영 권한 위에 보여 준다.
 * 그룹과 HOST 계정은 출결의 그룹 계정 관리에서 바꾼다.
 */
export function HostSummaryCard({ holder }: { holder: AccountHolder }) {
  const hasHost = holder.hostLogins.length > 0 || holder.leaderGroups.length > 0;

  return (
    <section className={`${TABLE_BOX} px-5 py-4`} aria-label="HOST">
      <div className="flex items-center justify-between gap-3">
        <h2 className="shrink-0 text-sm font-bold text-slate-900">HOST (맡은 그룹)</h2>
        <span className="min-w-0 truncate text-[11px] text-slate-500">
          변경은 출결 › 그룹 계정 관리
        </span>
      </div>

      {!hasHost ? (
        <p className="mt-1.5 text-xs text-slate-500">이번 반기에 맡은 그룹이 없습니다.</p>
      ) : (
        <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-[96px_minmax(0,1fr)]">
          <dt className="font-semibold text-slate-500">맡은 그룹</dt>
          <dd className="min-w-0">
            {holder.leaderGroups.length === 0 ? (
              <span className="text-slate-500">없음</span>
            ) : (
              <OneLineList
                items={holder.leaderGroups.map((group) => ({
                  key: group.teamId,
                  text: `${groupLabel(group)} ${group.name}`,
                  node: (
                    <span className="inline-flex h-6 min-w-0 items-center gap-1.5 rounded-sm border border-slate-200 bg-slate-50 px-2">
                      <span className="shrink-0 text-[11px] font-bold text-slate-500">
                        {groupLabel(group)}
                      </span>
                      <span className="truncate font-semibold text-slate-800">{group.name}</span>
                    </span>
                  ),
                }))}
              />
            )}
          </dd>

          <dt className="font-semibold text-slate-500">HOST 계정</dt>
          <dd className="min-w-0">
            {holder.hostLogins.length === 0 ? (
              <span className="block truncate text-slate-500">
                없음{holder.adminAccount ? ' (운영진 계정으로 출결 입력)' : ''}
              </span>
            ) : (
              <OneLineList
                items={holder.hostLogins.map((login) => ({
                  key: String(login.id),
                  text: login.active ? login.username : `${login.username} (비활성)`,
                  node: (
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <code className={`${USERNAME_CHIP} truncate`}>{login.username}</code>
                      {!login.active && (
                        <span className="shrink-0 text-[11px] text-slate-500">비활성</span>
                      )}
                    </span>
                  ),
                }))}
              />
            )}
          </dd>
        </dl>
      )}
    </section>
  );
}
