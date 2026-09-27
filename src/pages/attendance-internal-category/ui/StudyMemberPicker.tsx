import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

import { fetchUsers } from '@/entities/user/api/usersApi';
import { USER_TRACKS } from '@/entities/user/model/constants';
import {
  addMembers,
  filterUsers,
  findLeader,
  toggleLeader,
  toggleMember,
  type MemberSelection,
} from '@/entities/user/model/lib';
import type { UserProfile, UserTrack } from '@/entities/user/model/types';
import { TermSelect } from './TermSelect';

interface StudyMemberPickerProps {
  value: MemberSelection;
  onChange: (next: MemberSelection) => void;
}

const TAG_BASE =
  'cursor-pointer rounded-sm border px-2 py-1 text-[11px] font-semibold transition-colors';
const TAG_ON = 'border-[#1E6F94] bg-[#1E6F94] text-white';
const TAG_OFF = 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50';
const ROW_GRID = 'grid grid-cols-[0.875rem_minmax(0,1fr)_2.75rem_5rem_3.5rem] items-center gap-x-3 px-3';

function toggle<T>(list: readonly T[], item: T): T[] {
  return list.includes(item) ? list.filter((v) => v !== item) : [...list, item];
}

/**
 * 기수·부문 태그로 회원을 걸러 스터디원을 고르고, 선택된 스터디원 중 1명을 스터디장으로 표시한다.
 * 스터디원 선택과 스터디장 지정을 한 목록에서 처리한다.
 */
export function StudyMemberPicker({ value, onChange }: StudyMemberPickerProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [term, setTerm] = useState<number | null>(null);
  const [tracks, setTracks] = useState<UserTrack[]>([]);
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const availableTerms = useMemo(
    () => [...new Set(users.map((user) => user.term))].sort((a, b) => b - a),
    [users],
  );
  const filtered = useMemo(
    () => filterUsers(users, { terms: term === null ? [] : [term], tracks, keyword }),
    [users, term, tracks, keyword],
  );
  const memberIds = useMemo(() => new Set(value.members.map((m) => m.id)), [value.members]);
  const leader = findLeader(value);
  const orderedMembers = useMemo(
    () => [
      ...value.members.filter((m) => m.id === value.leaderId),
      ...value.members.filter((m) => m.id !== value.leaderId),
    ],
    [value.members, value.leaderId],
  );
  const hasUnselected = filtered.some((user) => !memberIds.has(user.id));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">
          스터디원 <span className="font-medium text-slate-400">{value.members.length}명</span>
        </span>
        <span className="text-xs text-slate-500">
          스터디장: {leader ? <b className="text-slate-800">{leader.name}</b> : '미지정'}
        </span>
      </div>

      <div className="space-y-2 rounded-sm border border-slate-200 bg-slate-50 p-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">기수</span>
            <TermSelect value={term} terms={availableTerms} onChange={setTerm} />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-500">부문</span>
            {USER_TRACKS.map((track) => (
              <button
                key={track}
                type="button"
                aria-pressed={tracks.includes(track)}
                onClick={() => setTracks((prev) => toggle(prev, track))}
                className={`${TAG_BASE} ${tracks.includes(track) ? TAG_ON : TAG_OFF}`}
              >
                {track}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="이름 검색"
            className="min-w-0 flex-1 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none transition-colors focus:border-slate-400"
          />
          <button
            type="button"
            disabled={!hasUnselected}
            onClick={() => onChange(addMembers(value, filtered))}
            className="shrink-0 cursor-pointer rounded-sm border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
          >
            전체 선택
          </button>
        </div>

        <div
          role="table"
          aria-label="스터디원 후보"
          className="max-h-48 overflow-y-auto rounded-sm border border-slate-200 bg-white"
        >
          <div
            role="row"
            className={`${ROW_GRID} sticky top-0 z-[1] border-b border-slate-200 bg-slate-100 py-1.5 text-[11px] font-semibold text-slate-500`}
          >
            <span role="columnheader" aria-label="선택" />
            <span role="columnheader">이름</span>
            <span role="columnheader">기수</span>
            <span role="columnheader">부문</span>
            <span role="columnheader" className="text-center">
              스터디장
            </span>
          </div>

          {status === 'loading' && (
            <p className="px-3 py-3 text-center text-slate-400">회원 목록을 불러오는 중...</p>
          )}
          {status === 'error' && (
            <p className="px-3 py-3 text-center text-red-500">회원 목록을 불러오지 못했습니다.</p>
          )}
          {status === 'ready' && filtered.length === 0 && (
            <p className="px-3 py-3 text-center text-slate-400">조건에 맞는 회원이 없습니다.</p>
          )}
          {filtered.map((user) => {
            const isMember = memberIds.has(user.id);
            const isLeader = value.leaderId === user.id;
            return (
              <div
                key={user.id}
                role="row"
                onClick={() => onChange(toggleMember(value, user))}
                className={`${ROW_GRID} cursor-pointer border-b border-slate-100 py-1.5 transition-colors last:border-b-0 ${
                  isMember ? 'bg-slate-100' : 'hover:bg-slate-50'
                }`}
              >
                <span role="cell">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isMember}
                    aria-label={`${user.name} 선택`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(toggleMember(value, user));
                    }}
                    className={`flex h-3.5 w-3.5 cursor-pointer items-center justify-center rounded-sm border text-[9px] ${
                      isMember
                        ? 'border-slate-400 bg-slate-300 text-slate-800'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isMember ? '✓' : ''}
                  </button>
                </span>
                <span
                  role="cell"
                  className={`truncate ${isMember ? 'font-bold text-slate-900' : 'text-slate-700'}`}
                >
                  {user.name}
                </span>
                <span role="cell" className="text-slate-500">
                  {user.term}기
                </span>
                <span role="cell" className="text-slate-500">
                  {user.track}
                </span>
                <span role="cell" className="flex justify-center">
                  <button
                    type="button"
                    aria-pressed={isLeader}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(toggleLeader(value, user));
                    }}
                    className={`cursor-pointer rounded-sm border px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      isLeader
                        ? TAG_ON
                        : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                  >
                    지정
                  </button>
                </span>
              </div>
            );
          })}
        </div>

        {value.members.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {orderedMembers.map((member) => (
              <span
                key={member.id}
                className="inline-flex items-center gap-1 rounded-sm border border-slate-300 bg-white py-0.5 pl-2 pr-1 text-[11px] font-semibold text-slate-700"
              >
                {member.id === value.leaderId && (
                  <span aria-label="스터디장" className="text-black">
                    ★
                  </span>
                )}
                {member.name}
                <button
                  type="button"
                  onClick={() => onChange(toggleMember(value, member))}
                  className="cursor-pointer rounded-sm p-0.5 opacity-70 hover:opacity-100"
                  aria-label={`${member.name} 제외`}
                >
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
