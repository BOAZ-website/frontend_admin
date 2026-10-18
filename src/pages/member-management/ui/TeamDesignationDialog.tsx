import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';

import type { ClubMember } from '@/entities/club-member/model/types';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';

interface TeamDesignationDialogProps {
  members: readonly ClubMember[];
  /** 고를 수 있는 운영진 팀(화면 순서). */
  teams: readonly string[];
  onClose: () => void;
  /** 이 팀 운영진을 체크한 회원들로 맞춘다. 성공하면 true(창을 닫는다), 실패하면 false. */
  onSubmit: (teamName: string, userIds: string[]) => Promise<boolean>;
}

/** 표 머리 칸·본문 칸. 출결 표와 같은 회색 머리 칸에 가운데 정렬이다. */
const TH = 'bg-slate-100 px-2 py-1 text-center font-bold text-slate-700 whitespace-nowrap';
const TD = 'px-2 text-center whitespace-nowrap';

/** 드롭다운을 옆 입력칸과 같은 모양(왼쪽 정렬, 14px 보통 굵기)으로 맞춘다. */
const FIELD_SELECT = 'h-10 w-full text-left pl-3! text-sm! font-normal! text-slate-900!';

/** 그 팀 운영진으로 처음 체크되어 있을 회원. */
const initialCheckedOf = (members: readonly ClubMember[], teamName: string): Set<string> =>
  new Set(members.filter((member) => member.operatorTeam === teamName).map((member) => member.id));

/**
 * 팀별 운영진 일괄 지정 창. 팀을 고르면 그 팀 운영진이 체크된 채로 동아리원 목록이 나오고,
 * 체크를 더하거나 풀어 저장하면 그 팀 운영진이 체크한 사람들로 맞춰진다.
 * - 새로 체크한 사람: 운영진으로 정한다(계정 발급 전 상태). 다른 팀 운영진이면 이 팀으로 옮긴다.
 * - 체크를 푼 사람: 운영진에서 뺀다(로그인 계정이 있으면 함께 삭제되므로 한 번 더 묻는다).
 * 목록은 활동기수 동아리원과 이미 이 팀 운영진인 사람이고, 다른 팀 운영진은 "현재 팀" 칸에 그 팀이 보인다.
 */
export function TeamDesignationDialog({
  members,
  teams,
  onClose,
  onSubmit,
}: TeamDesignationDialogProps) {
  const [teamName, setTeamName] = useState(teams[0] ?? '');
  const [checked, setChecked] = useState<ReadonlySet<string>>(() =>
    initialCheckedOf(members, teams[0] ?? ''),
  );
  const [query, setQuery] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const initial = useMemo(() => initialCheckedOf(members, teamName), [members, teamName]);

  // 원래 이 팀 운영진이 맨 위, 새로 체크한 사람이 그 바로 아래, 나머지가 그 밑이다. 묶음 안의 순서는
  // 서버가 준 순서(부문 → 이름)를 그대로 둔다(sort는 같은 묶음끼리 순서를 바꾸지 않는다). 검색은 이름으로 한다.
  const candidates = useMemo(() => {
    const text = query.trim();
    const rankOf = (member: ClubMember) =>
      initial.has(member.id) ? 0 : checked.has(member.id) ? 1 : 2;
    return members
      .filter((member) => member.status === 'ACTIVE' || member.operatorTeam === teamName)
      .filter((member) => !text || member.name.includes(text))
      .sort((a, b) => rankOf(a) - rankOf(b));
  }, [members, teamName, query, initial, checked]);

  const added = members.filter((m) => checked.has(m.id) && !initial.has(m.id));
  const removed = members.filter((m) => !checked.has(m.id) && initial.has(m.id));
  const isChanged = added.length + removed.length > 0;

  const changeTeam = (next: string) => {
    if (next === teamName) return;
    if (isChanged && !window.confirm('저장하지 않은 체크가 있습니다. 팀을 바꿀까요?')) return;
    setTeamName(next);
    setChecked(initialCheckedOf(members, next));
  };

  const toggle = (memberId: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isChanged || isSaving || !teamName) return;
    if (
      removed.length > 0 &&
      !window.confirm(
        `${removed.map((m) => m.name).join(', ')}님을 ${teamName} 운영진에서 뺍니다. 운영진 로그인 계정이 있으면 함께 삭제됩니다. 저장할까요?`,
      )
    ) {
      return;
    }
    setIsSaving(true);
    try {
      const isSaved = await onSubmit(teamName, [...checked]);
      if (isSaved) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-designation-title"
        className={`w-full max-w-xl space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
      >
        <div className="flex items-center justify-between">
          <h3 id="team-designation-title" className="text-base font-bold text-slate-900">
            운영진 권한 부여
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="cursor-pointer rounded-sm p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-x-4 gap-y-4 text-xs sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">팀</span>
            <SelectDropdown
              ariaLabel="팀"
              value={teamName}
              options={teams.map((team) => ({ value: team, label: team }))}
              onChange={changeTeam}
              buttonClassName={FIELD_SELECT}
            />
          </div>
          <div>
            <label
              htmlFor="team-designation-search"
              className="mb-1.5 block text-[11px] font-semibold text-slate-500"
            >
              이름 검색
            </label>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="team-designation-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-10 w-full rounded-sm border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 outline-none transition-colors hover:border-slate-300 focus:border-slate-400"
              />
            </div>
          </div>
        </div>

        {/* 출결 표와 같은 회색 머리 칸의 표. 머리 칸은 목록을 내려도 위에 붙어 있다. */}
        <div className="max-h-[45vh] overflow-y-auto rounded-md border border-slate-200">
          <table
            className="w-full table-fixed border-collapse text-xs"
            aria-label={`${teamName} 운영진으로 지정할 동아리원`}
          >
            <colgroup>
              <col className="w-[56px]" />
              <col />
              <col className="w-[72px]" />
              <col className="w-[100px]" />
              <col className="w-[120px]" />
            </colgroup>
            <thead className="sticky top-0 z-10 select-none">
              <tr className="h-10 divide-x divide-slate-200 border-b border-slate-200">
                <th scope="col" className={TH}>
                  선택
                </th>
                <th scope="col" className={`${TH} text-slate-900`}>
                  이름
                </th>
                <th scope="col" className={TH}>
                  기수
                </th>
                <th scope="col" className={TH}>
                  부문
                </th>
                <th scope="col" className={TH}>
                  현재 팀
                </th>
              </tr>
            </thead>
            <tbody>
              {candidates.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                    맞는 동아리원이 없습니다.
                  </td>
                </tr>
              ) : (
                candidates.map((member) => {
                  const isChecked = checked.has(member.id);
                  const inputId = `team-designation-${member.id}`;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => toggle(member.id)}
                      className={`h-11 cursor-pointer divide-x divide-slate-200 border-t border-slate-200 first:border-t-0 transition-colors ${
                        isChecked ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <td className="text-center">
                        <SelectCircle
                          id={inputId}
                          checked={isChecked}
                          label={`${member.name} 선택`}
                          onChange={() => toggle(member.id)}
                        />
                      </td>
                      <td className={`${TD} font-bold text-slate-900`}>{member.name}</td>
                      <td className={`${TD} tabular-nums text-slate-600`}>{member.term}기</td>
                      <td className={`${TD} text-slate-600`}>{member.track}</td>
                      <td className={`${TD} text-slate-600`}>{member.operatorTeam ?? '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5">
          <button
            type="button"
            onClick={onClose}
            className="h-9 cursor-pointer rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isChanged || isSaving}
            className="h-9 cursor-pointer rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSaving ? '저장 중…' : '저장'}
          </button>
        </div>
      </form>
    </div>
  );
}

interface SelectCircleProps {
  id: string;
  checked: boolean;
  /** 화면 읽기 프로그램용 이름. 예: '강신욱 선택' */
  label: string;
  onChange: () => void;
}

/**
 * 동그라미 선택 표시. 여러 명을 고르는 체크박스이지만 모양은 라디오 버튼처럼 둥글게 두고,
 * 고르면 가운데에 점이 찬다. 줄 전체를 눌러도 고를 수 있어, 클릭이 줄로 다시 전달되지 않게 막는다.
 */
function SelectCircle({ id, checked, label, onChange }: SelectCircleProps) {
  return (
    <span className="relative inline-flex size-4 align-middle">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        className="peer size-4 cursor-pointer appearance-none rounded-full border border-slate-300 bg-white outline-none transition-colors checked:border-slate-500 hover:border-slate-400 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 m-auto size-2 rounded-full bg-slate-500 opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );
}
