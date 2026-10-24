import { useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { compareTeamNames } from '@/entities/admin-account/model/teams';
import type { AdminAccount } from '@/entities/admin-account/model/types';
import type { ClubMember } from '@/entities/club-member/model/types';
import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
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

/** 새 운영진의 로그인 아이디·초기 비밀번호. */
export interface IssueCredentials {
  username: string;
  password: string;
}

interface CredentialIssueModalProps {
  /** 운영진 팀 선택지(권한 카탈로그의 팀 목록). */
  teamNames: readonly string[];
  /** 운영진 계정 목록. 이미 운영진인 사람을 고르면 여기서 아이디를 불러온다. */
  accounts: readonly AdminAccount[];
  onClose: () => void;
  /**
   * 고른 동아리원을 teamName 팀의 운영진으로 지정하고 계정을 발급한다. 성공하면 true.
   * 실패하면 창을 그대로 둔다. 전달문은 부르는 쪽이 띄운다.
   */
  onSubmit: (
    member: ClubMember,
    credentials: IssueCredentials,
    teamName: string,
  ) => Promise<boolean>;
  /**
   * 이미 운영진인 사람의 팀·아이디·비밀번호를 바꾼다. teamName이 지금 팀과 같으면 팀은 그대로이고,
   * password가 null이면 비밀번호는 그대로다. 성공하면 true.
   */
  onMove: (
    account: AdminAccount,
    teamName: string,
    change: { username: string; password: string | null },
  ) => Promise<boolean>;
}

/** 팀을 아직 고르지 않은 값. */
const NO_TEAM = '';

/**
 * 드롭다운 버튼을 옆 입력칸(FIELD_INPUT)과 같은 모양으로 맞춘다: 왼쪽 정렬, 14px 보통 굵기, 같은 안쪽 여백.
 * 공용 드롭다운은 가운데 정렬·굵은 글씨가 기본이라 이 창에서만 덮어쓴다.
 */
const FIELD_SELECT = 'h-10 w-full text-left pl-3! text-sm! font-normal! text-slate-900!';
/** 검색 결과 목록. 창 안에서 높이를 고정하고 넘치면 세로로 스크롤한다. */
const RESULT_LIST = 'h-56 overflow-y-auto rounded-md border border-slate-200 bg-white';
const RESULT_NOTICE =
  'flex h-full items-center justify-center px-3 text-center text-xs text-slate-500';
/**
 * 검색 결과의 머리 줄·한 줄: 이름 | 기수 | 부문 | 운영진 네 칸을 세로선으로 나눈다.
 * 이름·부문(가장 긴 값 '엔지니어링')·운영진 팀은 같은 너비, 기수('27기')는 그 절반이다.
 */
const CANDIDATE_GRID =
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] divide-x divide-slate-100';
const CANDIDATE_CELL = 'px-3 py-2 text-center';
/**
 * 고른 줄은 바탕을 한 단계 진한 회색으로 칠하고 글자를 모두 굵고 진하게 한다.
 * 고르지 않은 줄은 보통 굵기이고, 마우스를 올리면 연한 회색으로 바뀐다.
 */
const CANDIDATE_SELECTED = 'bg-slate-100 font-bold text-slate-900';
const CANDIDATE_IDLE = 'hover:bg-slate-50';
/** 고르지 않은 줄의 칸 글자. 이름만 조금 진하게 둔다. */
const CANDIDATE_NAME_IDLE = 'font-medium text-slate-900';
const CANDIDATE_TEXT_IDLE = 'text-slate-600';
/** 운영진 열에서 운영진이 아닌 사람의 칸. */
const NOT_OPERATOR_CELL = '-';
/** 발급할 사람의 이름 | 기수 | 부문 입력 줄. 아래 목록 표와 같은 2:1:2 비율로 칸을 맞춘다. */
const PERSON_ROW = 'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-2';

/** 목록에 보일 사람: 활동기수 동아리원. 기수 큰 순·이름 순이고, 이미 운영진인 사람도 그 자리에 섞어 둔다. */
const candidatesOf = (members: readonly ClubMember[]): ClubMember[] =>
  members
    .filter((member) => member.status === 'ACTIVE')
    .sort((a, b) => b.term - a.term || a.name.localeCompare(b.name, 'ko'));

/** 기수 칸의 글자('27', '27기')를 숫자로 읽는다. 비었으면 null, 숫자가 아니면 NaN. */
const parseTerm = (text: string): number | null => {
  const trimmed = text.trim().replace(/기$/, '');
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
};

/** 이름·기수·부문 칸으로 목록을 거른다. 이름·부문은 글자 일부만 맞아도 되고, 기수는 같아야 한다. 빈 칸은 거르지 않는다. */
const matchesFilter = (
  member: ClubMember,
  filter: { name: string; term: number | null; track: string },
): boolean =>
  member.name.includes(filter.name) &&
  (filter.term === null || member.term === filter.term) &&
  member.track.includes(filter.track);

/** 운영진을 옮길지 묻는다. 팀을 옮기면 그 사람의 개별 권한 예외가 지워진다는 점도 알린다. */
const confirmMove = (member: ClubMember, teamName: string): boolean =>
  window.confirm(
    `${member.name}님을 ${member.operatorTeam}에서 ${teamName}으로 옮길까요?\n팀을 옮기면 개별로 바꾼 권한은 새 팀 기본 권한으로 돌아갑니다.`,
  );

/**
 * 운영진 계정 발급 창("+ 계정"). 맨 위에서 운영진 팀을 고르고, 활동기수 동아리원을 이름·기수·부문으로 찾아 고른다.
 * - 운영진이 아닌 사람: 아이디·초기 비밀번호를 입력해 지정과 발급을 한 번에 한다.
 * - 이미 운영진인 사람: 다른 팀을 고르면 바로 옮길지 묻고, 아이디는 불러와 채우고(고치면 바꾼다), 비밀번호는 입력했을 때만 새로 정한다.
 * 아이디 중복·비밀번호 규칙 검사는 서버가 한다.
 */
export function CredentialIssueModal({
  teamNames,
  accounts,
  onClose,
  onSubmit,
  onMove,
}: CredentialIssueModalProps) {
  const { members, error: membersError } = useClubMembers();
  const candidates = useMemo(() => (members ? candidatesOf(members) : null), [members]);
  const sortedTeamNames = useMemo(() => [...teamNames].sort(compareTeamNames), [teamNames]);
  /** 이름·기수·부문 칸에 쓴 글자. 아래 목록을 거르고, 이름이 한 사람으로 좁혀지면 그 사람으로 정한다. */
  const [nameInput, setNameInput] = useState('');
  const [termInput, setTermInput] = useState('');
  const [trackInput, setTrackInput] = useState('');
  /** 목록에서 고른 사람. 세 칸 중 하나라도 직접 고치면 풀린다. */
  const [pickedId, setPickedId] = useState<string | null>(null);
  /**
   * 목록에서 고르기 직전 세 칸에 쓰여 있던 글자. 고르면 세 칸이 그 사람 값으로 채워지는데, 그 값으로 목록을
   * 다시 거르면 한 줄만 남으므로, 고른 동안에는 이 글자로 거른 목록을 그대로 두고 고른 줄만 표시한다.
   * 고른 뒤 한 칸을 고치면 나머지 두 칸은 이 글자로 되돌린다(자동으로 채운 값은 거르기 조건으로 남기지 않는다).
   */
  const [inputsAtPick, setInputsAtPick] = useState({ name: '', term: '', track: '' });
  const [teamName, setTeamName] = useState(NO_TEAM);
  /** 운영진 옮기기를 확인한 '회원 id|팀'. 같은 조합이면 저장할 때 다시 묻지 않는다. */
  const [confirmedMove, setConfirmedMove] = useState<string | null>(null);
  /** 아이디 칸에 쓴 글자. null이면 아직 고치지 않은 것이고, 운영진을 고른 경우 그 사람의 아이디를 보여 준다. */
  const [username, setUsername] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const typedName = nameInput.trim();
  const typedTerm = parseTerm(termInput);
  const typedTrack = trackInput.trim();
  const isTermInvalid = Number.isNaN(typedTerm);
  /** 세 칸으로 거른 목록. 목록은 창을 열 때 한 번 읽고, 거르기는 화면에서 한다. */
  const filteredCandidates = isTermInvalid
    ? []
    : (candidates ?? []).filter((member) =>
        matchesFilter(member, { name: typedName, term: typedTerm, track: typedTrack }),
      );
  /** 목록에 보일 사람. 목록에서 고른 동안에는 고르기 전 조건으로 거른 목록이다. */
  const pickTerm = parseTerm(inputsAtPick.term);
  const visibleCandidates =
    pickedId !== null
      ? (candidates ?? []).filter((member) =>
          matchesFilter(member, {
            name: inputsAtPick.name.trim(),
            term: Number.isNaN(pickTerm) ? null : pickTerm,
            track: inputsAtPick.track.trim(),
          }),
        )
      : filteredCandidates;
  /** 이름이 똑같고 기수·부문 칸에도 맞는 사람. 한 명이면 그 사람으로 정한다. */
  const exactMatches = filteredCandidates.filter((member) => member.name === typedName);
  const selected =
    candidates?.find((member) => member.id === pickedId) ??
    (exactMatches.length === 1 ? exactMatches[0] : null);
  /** 고른 사람이 이미 운영진이면 그 계정(아이디를 불러온다). */
  const selectedAccount =
    selected?.operatorTeam != null
      ? (accounts.find((account) => account.userId === selected.id) ?? null)
      : null;
  const isMoving = selectedAccount !== null;
  /** 사람을 정하지 못한 까닭. 이름 칸이 비었거나 사람이 정해졌으면 null. */
  const nameProblem = (() => {
    if (isTermInvalid) return '기수는 숫자로 입력해 주세요.';
    if (!typedName || selected || candidates === null) return null;
    if (exactMatches.length > 1) {
      return `${typedName}님이 ${exactMatches.length}명 있습니다. 목록에서 골라 주세요.`;
    }
    if (candidates.some((member) => member.name === typedName)) {
      return '입력한 기수·부문에 맞는 동아리원이 없습니다.';
    }
    const isMember = (members ?? []).some((member) => member.name === typedName);
    return isMember ? '활동기수가 아닌 동아리원입니다.' : '동아리원 명단에 없는 사람입니다.';
  })();

  /** 운영진 선택지. 이미 운영진인 사람을 고르면 지금 팀에 '(현재)'를 붙인다. */
  const teamOptions = [
    { value: NO_TEAM, label: '선택' },
    ...sortedTeamNames.map((name) => ({
      value: name,
      label: isMoving && selected?.operatorTeam === name ? `${name} (현재)` : name,
    })),
  ];

  /** 사람이 바뀌면 이전 사람 기준으로 입력한 아이디·비밀번호를 지운다(운영진이면 아이디를 다시 불러온다). */
  const resetPasswordChoice = () => {
    setUsername(null);
    setPassword('');
  };

  /**
   * 세 칸 중 하나를 고친다. 목록에서 고른 상태였으면 선택을 풀고, 고치지 않은 두 칸은 고르기 전 글자로 되돌린다.
   * 그래서 고른 사람의 기수·부문이 조건으로 남지 않고, 고친 칸 기준으로 목록을 다시 거른다.
   */
  const changeInput = (field: 'name' | 'term' | 'track', value: string) => {
    const next =
      pickedId === null ? { name: nameInput, term: termInput, track: trackInput } : inputsAtPick;
    const updated = { ...next, [field]: value };
    setNameInput(updated.name);
    setTermInput(updated.term);
    setTrackInput(updated.track);
    setPickedId(null);
    resetPasswordChoice();
  };

  /** 운영진인 사람과 다른 팀이 함께 정해지면 바로 옮길지 묻는다. 아니라고 하면 false. */
  const askMove = (member: ClubMember, nextTeam: string): boolean => {
    if (member.operatorTeam === null || nextTeam === NO_TEAM || nextTeam === member.operatorTeam) {
      return true;
    }
    if (!confirmMove(member, nextTeam)) return false;
    setConfirmedMove(`${member.id}|${nextTeam}`);
    return true;
  };

  /** 목록에서 고르면 세 칸을 그 사람 값으로 채운다. 운영진이면 고른 팀으로 옮길지 바로 묻는다. */
  const pickMember = (member: ClubMember) => {
    // 이미 고른 상태에서 다른 줄을 고르면 처음 고르기 전 조건을 그대로 쓴다.
    if (pickedId === null) {
      setInputsAtPick({ name: nameInput, term: termInput, track: trackInput });
    }
    setPickedId(member.id);
    setNameInput(member.name);
    setTermInput(`${member.term}기`);
    setTrackInput(member.track);
    if (member.id !== selected?.id) resetPasswordChoice();
    if (!askMove(member, teamName)) setTeamName(NO_TEAM);
  };

  /** 운영진 팀을 바꾼다. 이미 운영진인 사람을 고른 상태면 바로 옮길지 묻고, 아니라고 하면 바꾸지 않는다. */
  const changeTeam = (nextTeam: string) => {
    if (selected && !askMove(selected, nextTeam)) return;
    setTeamName(nextTeam);
  };

  /** 아이디 칸에 보일 글자: 고친 글자, 안 고쳤으면 운영진의 기존 아이디(운영진이 아니면 빈 칸). */
  const usernameValue = username ?? selectedAccount?.username ?? '';
  const trimmedUsername = usernameValue.trim();
  const isTeamChanged = isMoving && teamName !== selected?.operatorTeam;
  /** 운영진을 고른 경우 바뀌는 것이 하나라도 있는지(팀, 아이디, 비밀번호). */
  const hasOperatorChange =
    isTeamChanged || trimmedUsername !== selectedAccount?.username || Boolean(password);
  const canSave =
    !isSaving &&
    selected !== null &&
    teamName !== NO_TEAM &&
    Boolean(trimmedUsername) &&
    (isMoving ? hasOperatorChange : selected.operatorTeam === null && Boolean(password));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || !selected) return;
    // 이름을 직접 써서 운영진을 정한 경우처럼 아직 묻지 않았으면 여기서 묻는다.
    if (
      isTeamChanged &&
      confirmedMove !== `${selected.id}|${teamName}` &&
      !confirmMove(selected, teamName)
    ) {
      return;
    }
    setIsSaving(true);
    const isDone = selectedAccount
      ? await onMove(selectedAccount, teamName, {
          username: trimmedUsername,
          password: password ? password : null,
        })
      : await onSubmit(selected, { username: trimmedUsername, password }, teamName);
    setIsSaving(false);
    if (isDone) onClose();
  };

  /** 동아리원 목록을 읽기 전이거나 읽지 못했을 때 목록 자리에 보이는 안내. */
  const listNotice = membersError
    ? `동아리원 목록을 불러오지 못했습니다. (${membersError.message})`
    : '동아리원 목록을 불러오는 중입니다.';

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

        {candidates !== null && candidates.length === 0 ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
            활동기수 동아리원이 없습니다.
          </p>
        ) : (
          <div className="space-y-5 text-xs">
            {/* 운영진 팀을 먼저 고른다. 이미 운영진인 사람을 고른 상태에서 다른 팀을 고르면 바로 옮길지 묻는다. */}
            <div>
              <span className={FIELD_LABEL}>운영진</span>
              <SelectDropdown
                ariaLabel="운영진"
                value={teamName}
                options={teamOptions}
                onChange={changeTeam}
                buttonClassName={FIELD_SELECT}
              />
            </div>

            <div>
              {/* 이름·기수·부문을 직접 쓰거나 아래 목록에서 고른다. 고르면 세 칸이 채워진다. */}
              <div className={PERSON_ROW}>
                <div className="min-w-0">
                  <label htmlFor="issue-name" className={FIELD_LABEL}>
                    이름
                  </label>
                  <input
                    id="issue-name"
                    value={nameInput}
                    onChange={(event) => changeInput('name', event.target.value)}
                    placeholder="입력"
                    autoComplete="off"
                    aria-invalid={nameProblem !== null}
                    aria-describedby={
                      nameProblem && visibleCandidates.length === 0 ? 'issue-name-help' : undefined
                    }
                    className={FIELD_INPUT}
                  />
                </div>
                {/* 기수·부문도 직접 써서 목록을 거른다. 이름만으로 사람이 정해져 칸이 비어 있으면
                    그 사람의 값을 안내 글자 자리에 진하게 보여 준다. */}
                <div className="min-w-0">
                  <label htmlFor="issue-term" className={FIELD_LABEL}>
                    기수
                  </label>
                  <input
                    id="issue-term"
                    value={termInput}
                    onChange={(event) => changeInput('term', event.target.value)}
                    placeholder={selected ? `${selected.term}기` : '입력'}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-invalid={isTermInvalid}
                    className={`${FIELD_INPUT} tabular-nums ${selected ? 'placeholder:text-slate-900' : ''}`}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="issue-track" className={FIELD_LABEL}>
                    부문
                  </label>
                  <input
                    id="issue-track"
                    value={trackInput}
                    onChange={(event) => changeInput('track', event.target.value)}
                    placeholder={selected ? selected.track : '입력'}
                    autoComplete="off"
                    className={`${FIELD_INPUT} ${selected ? 'placeholder:text-slate-900' : ''}`}
                  />
                </div>
              </div>
              {/* 동아리원 목록은 처음부터 펼쳐 둔다. 위 세 칸에 쓴 글자로 화면에서 거른다.
                  칸과 목록 사이에 안내 줄을 끼우지 않아 목록 위치가 바뀌지 않는다. */}
              <div id="issue-candidates" className={`mt-4 ${RESULT_LIST}`}>
                {candidates === null ? (
                  <p className={RESULT_NOTICE}>{listNotice}</p>
                ) : visibleCandidates.length === 0 ? (
                  // 맞는 사람이 없으면 그 까닭(명단에 없음, 활동기수 아님 등)을 목록 자리 가운데에 알린다.
                  <p id="issue-name-help" role="status" className={RESULT_NOTICE}>
                    {nameProblem ?? '맞는 동아리원이 없습니다.'}
                  </p>
                ) : (
                  <>
                    {/* 표처럼 이름·기수·부문·운영진을 칸으로 나눈다. 머리 줄은 목록을 내려도 위에 남는다. */}
                    <div
                      aria-hidden="true"
                      className={`sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 ${CANDIDATE_GRID}`}
                    >
                      <span className={CANDIDATE_CELL}>이름</span>
                      <span className={CANDIDATE_CELL}>기수</span>
                      <span className={CANDIDATE_CELL}>부문</span>
                      <span className={CANDIDATE_CELL}>운영진</span>
                    </div>
                    <ul className="divide-y divide-slate-100">
                      {visibleCandidates.map((member) => {
                        const isSelected = member.id === selected?.id;
                        // 고른 줄은 글자색을 줄 전체 스타일에 맡긴다.
                        const nameText = isSelected ? '' : CANDIDATE_NAME_IDLE;
                        const cellText = isSelected ? '' : CANDIDATE_TEXT_IDLE;
                        return (
                          <li key={member.id}>
                            <button
                              type="button"
                              aria-pressed={isSelected}
                              aria-label={`${member.name} ${member.term}기 ${member.track}${
                                member.operatorTeam ? ` ${member.operatorTeam} 운영진` : ''
                              }`}
                              onClick={() => pickMember(member)}
                              className={`w-full cursor-pointer text-xs transition-colors ${CANDIDATE_GRID} ${
                                isSelected ? CANDIDATE_SELECTED : CANDIDATE_IDLE
                              }`}
                            >
                              <span className={`${CANDIDATE_CELL} truncate ${nameText}`}>
                                {member.name}
                              </span>
                              <span className={`${CANDIDATE_CELL} tabular-nums ${cellText}`}>
                                {member.term}기
                              </span>
                              <span className={`${CANDIDATE_CELL} ${cellText}`}>
                                {member.track}
                              </span>
                              <span className={`${CANDIDATE_CELL} truncate ${cellText}`}>
                                {member.operatorTeam ?? NOT_OPERATOR_CELL}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </div>

            {/* 운영진이 아닌 사람은 아이디·초기 비밀번호를 새로 입력한다.
                이미 운영진인 사람은 아이디를 불러와 채우고, 고치면 그 아이디로 바꾼다. 비밀번호는 불러올 수 없어 비워 두면 바꾸지 않고, 입력하면 새로 정한다. */}
            <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
              <div>
                <label htmlFor="issue-username" className={FIELD_LABEL}>
                  아이디
                </label>
                <input
                  id="issue-username"
                  value={usernameValue}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="입력"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD_INPUT} font-mono`}
                />
              </div>
              <div>
                <label htmlFor="issue-password" className={FIELD_LABEL}>
                  {isMoving ? '비밀번호' : '초기 비밀번호'}
                </label>
                {/* 본인에게 전달해야 하므로 글자를 그대로 보인다. */}
                <input
                  id="issue-password"
                  type="text"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="입력"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${FIELD_INPUT} font-mono`}
                />
              </div>
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
