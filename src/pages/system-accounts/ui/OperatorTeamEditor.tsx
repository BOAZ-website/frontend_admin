import { useState } from 'react';

import {
  compareTeamNames,
  SERVICE_OPERATIONS_TEAM,
  TEAMS_WITHOUT_LEAD,
} from '@/entities/admin-account/model/teams';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';

const SELECT_BUTTON = 'h-8 w-full text-left';
/** 팀 드롭다운과 높이를 맞춘 팀장 지정·해제 버튼. */
const LEAD_BUTTON =
  'h-8 shrink-0 cursor-pointer rounded-sm border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900';

/** 대표진·차기대표진은 팀장을 두지 않고, 서비스운영팀 팀장은 서비스운영팀장(MASTER)으로 정해져 있다. */
const hasSeatChoice = (teamName: string): boolean =>
  !TEAMS_WITHOUT_LEAD.includes(teamName) && teamName !== SERVICE_OPERATIONS_TEAM;

interface OperatorTeamEditorProps {
  account: AdminAccount;
  /** 고를 수 있는 운영진 팀(권한 카탈로그의 팀 목록). */
  teamNames: readonly string[];
  /** 운영진 계정 생성·삭제 권한이 있어야 바꾼다. 없으면 지금 값만 보인다. */
  canEdit: boolean;
  /** 팀·팀장 여부를 저장한다. 성공하면 true(목록을 다시 읽어 권한 목록이 새 팀 기준으로 바뀐다). */
  onApply: (account: AdminAccount, teamName: string, isTeamLead: boolean) => Promise<boolean>;
}

/**
 * 인적 사항 표의 소속 운영진 칸. 팀·팀장 드롭다운에서 고르면 확인을 거쳐 바로 저장한다.
 * 팀을 바꾸면 기본 권한이 새 팀 기준으로 바뀐다. 팀장·팀원은 점수 계산과 표시에만 쓴다.
 * 서비스운영팀장(MASTER)도 다른 팀으로 옮길 수 있다. 옮기면 MASTER가 잠시 비고, 다음 지정과 계정 삭제는 DB에서 한다.
 */
export function OperatorTeamEditor({
  account,
  teamNames,
  canEdit,
  onApply,
}: OperatorTeamEditorProps) {
  const [isSaving, setIsSaving] = useState(false);

  if (!canEdit) {
    return (
      <span className="text-slate-800">
        {account.teamName}
        {account.isTeamLead && hasSeatChoice(account.teamName) ? ' 팀장' : ''}
      </span>
    );
  }

  const teamOptions = [...teamNames]
    .filter((name) => name !== SERVICE_OPERATIONS_TEAM || account.teamName === name)
    .sort(compareTeamNames)
    .map((name) => ({ value: name, label: name }));

  const apply = async (teamName: string, isTeamLead: boolean) => {
    const message =
      account.role === 'MASTER'
        ? `서비스운영팀장(MASTER) ${account.name}님을 ${teamName}으로 옮길까요?
${teamName}의 기본 권한으로 바뀌고 서비스운영팀장 자리는 비게 됩니다. 다음 서비스운영팀장은 DB에서 정합니다.`
        : teamName !== account.teamName
          ? `${account.name}님을 ${teamName}으로 옮길까요?\n새 팀의 기본 권한으로 바뀌고, 개별로 더하거나 뺀 권한은 지워집니다.`
          : `${account.name}님을 ${teamName}의 ${isTeamLead ? '팀장' : '팀원'}으로 바꿀까요?\n팀장은 점수 계산과 표시에만 쓰이고 권한은 바뀌지 않습니다.${isTeamLead ? ' 지금 팀장은 팀원이 됩니다.' : ''}`;
    if (!window.confirm(message)) return;
    setIsSaving(true);
    try {
      await onApply(account, teamName, isTeamLead);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex items-center gap-1 ${isSaving ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="min-w-0 flex-1">
        <SelectDropdown
          ariaLabel={`${account.name} 운영진 팀`}
          value={account.teamName}
          options={teamOptions}
          // 팀을 옮기면 팀원으로 들어간다. 팀장은 옮긴 뒤 옆 버튼으로 정한다.
          onChange={(teamName) => {
            if (teamName !== account.teamName) void apply(teamName, false);
          }}
          buttonClassName={SELECT_BUTTON}
        />
      </div>
      {/* 팀장은 팀 안에서 팀장인지만 가른다(점수 계산·표시용). 권한은 바뀌지 않는다. */}
      {hasSeatChoice(account.teamName) && (
        <button
          type="button"
          className={LEAD_BUTTON}
          aria-pressed={account.isTeamLead}
          aria-label={`${account.name} ${account.isTeamLead ? '팀장 해제' : '팀장 지정'}`}
          onClick={() => void apply(account.teamName, !account.isTeamLead)}
        >
          {account.isTeamLead ? '팀장 해제' : '팀장 지정'}
        </button>
      )}
    </div>
  );
}
