import { useState } from 'react';
import { X } from 'lucide-react';

import type { AdminCredentialsRequest } from '@/entities/admin-account/model/dto';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import {
  byLeadThenTermThenTrack,
  displayTeamOf,
  sortTeamNames,
} from '@/pages/system-accounts/model/teamOrder';
import {
  FIELD_INPUT,
  FIELD_LABEL,
  MODAL_BACKDROP,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/pages/system-accounts/ui/systemStyles';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';

interface CredentialIssueModalProps {
  /** 계정(아이디·비밀번호)을 아직 발급하지 않은 운영진. */
  pendingAccounts: readonly AdminAccount[];
  onClose: () => void;
  /** 발급에 성공하면 true. 실패하면 창을 그대로 둔다. 전달문은 부르는 쪽이 띄운다. */
  onSubmit: (account: AdminAccount, request: AdminCredentialsRequest) => Promise<boolean>;
}

/**
 * 드롭다운 버튼을 옆 입력칸(FIELD_INPUT)과 같은 모양으로 맞춘다: 왼쪽 정렬, 14px 보통 굵기, 같은 안쪽 여백.
 * 공용 드롭다운은 가운데 정렬·굵은 글씨가 기본이라 이 창에서만 덮어쓴다.
 */
const FIELD_SELECT = 'h-10 w-full text-left pl-3! text-sm! font-normal! text-slate-900!';

/**
 * 운영진 계정 발급 창("+ 계정"). 출결의 그룹 계정 발급처럼, 이미 정해진 운영진 중 계정이 없는 사람을 고르고
 * 아이디·초기 비밀번호를 직접 입력한다. 비밀번호 규칙 검사는 서버가 한다.
 */
export function CredentialIssueModal({
  pendingAccounts,
  onClose,
  onSubmit,
}: CredentialIssueModalProps) {
  const teamNames = sortTeamNames(pendingAccounts.map((account) => account.teamName));
  const [teamName, setTeamName] = useState(teamNames[0] ?? '');
  const teamMembers = pendingAccounts
    .filter((account) => displayTeamOf(account.teamName) === teamName)
    .sort(byLeadThenTermThenTrack);
  const [accountId, setAccountId] = useState(String(teamMembers[0]?.id ?? ''));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const target = pendingAccounts.find((account) => String(account.id) === accountId) ?? null;
  const canSave = !isSaving && target !== null && Boolean(username.trim()) && Boolean(password);

  const changeTeam = (nextTeam: string) => {
    setTeamName(nextTeam);
    const first = pendingAccounts
      .filter((account) => displayTeamOf(account.teamName) === nextTeam)
      .sort(byLeadThenTermThenTrack)[0];
    setAccountId(String(first?.id ?? ''));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || !target) return;
    setIsSaving(true);
    const isIssued = await onSubmit(target, { username: username.trim(), password });
    setIsSaving(false);
    if (isIssued) onClose();
  };

  return (
    <div
      className={MODAL_BACKDROP}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credential-issue-title"
        className={`w-full max-w-lg space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between">
          <h3 id="credential-issue-title" className="text-base font-bold text-slate-900">
            운영진 계정 발급
          </h3>
          <button type="button" onClick={onClose} className={MODAL_CLOSE_BTN} aria-label="창 닫기">
            <X size={18} />
          </button>
        </div>

        {pendingAccounts.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            모든 운영진에게 계정을 발급했습니다.
          </p>
        ) : (
          <div className="grid gap-x-4 gap-y-5 text-xs sm:grid-cols-2">
            <div>
              <span className={FIELD_LABEL}>팀</span>
              <SelectDropdown
                ariaLabel="팀"
                value={teamName}
                options={teamNames.map((name) => ({ value: name, label: name }))}
                onChange={changeTeam}
                buttonClassName={FIELD_SELECT}
              />
            </div>
            <div>
              <span className={FIELD_LABEL}>운영진</span>
              <SelectDropdown
                ariaLabel="운영진"
                value={accountId}
                options={teamMembers.map((account) => ({
                  value: String(account.id),
                  label: account.name,
                }))}
                onChange={setAccountId}
                buttonClassName={FIELD_SELECT}
              />
            </div>
            <div>
              <label htmlFor="issue-username" className={FIELD_LABEL}>
                아이디
              </label>
              <input
                id="issue-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="예: boaz_design_4"
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
            <div>
              {/* 본인에게 전달해야 하므로 글자를 그대로 보인다. */}
              <label htmlFor="issue-password" className={FIELD_LABEL}>
                초기 비밀번호
              </label>
              <input
                id="issue-password"
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="초기 비밀번호 직접 입력"
                autoComplete="off"
                spellCheck={false}
                className={`${FIELD_INPUT} font-mono`}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3.5">
          <button type="button" onClick={onClose} className={MODAL_CANCEL_BTN}>
            취소
          </button>
          <button type="submit" disabled={!canSave} className={MODAL_CONFIRM_BTN}>
            발급
          </button>
        </div>
      </form>
    </div>
  );
}
