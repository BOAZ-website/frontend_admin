import { useMemo, useState } from 'react';
import {
  Activity,
  ChevronRight,
  CircleUserRound,
  Mail,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react';

import {
  filterClubMembers,
  ROLE_LABELS,
  STATUS_LABELS,
  summarizeClubMembers,
  TRACK_LABELS,
  type ClubMember,
  type ClubMemberFilter,
  type ClubMemberRole,
  type ClubMemberStatus,
  type ClubMemberTrack,
} from '../model/memberManagement';

const INITIAL_MEMBERS: ClubMember[] = [
  {
    id: 'm-001',
    name: '김보아',
    email: 'boa.kim@boaz.club',
    phone: '010-2184-1024',
    cohort: 30,
    track: 'ANALYSIS',
    status: 'ACTIVE',
    role: 'PRESIDENT',
    joinedAt: '2026-07-01',
  },
  {
    id: 'm-002',
    name: '박서준',
    email: 'seojun.park@boaz.club',
    phone: '010-3912-8221',
    cohort: 30,
    track: 'ENGINEERING',
    status: 'ACTIVE',
    role: 'OPERATOR',
    joinedAt: '2026-07-01',
  },
  {
    id: 'm-003',
    name: '이하은',
    email: 'haeun.lee@boaz.club',
    phone: '010-8842-1447',
    cohort: 30,
    track: 'VISUALIZATION',
    status: 'ACTIVE',
    role: 'MEMBER',
    joinedAt: '2026-07-01',
  },
  {
    id: 'm-004',
    name: '최민혁',
    email: 'minhyuk.choi@boaz.club',
    phone: '010-6231-5578',
    cohort: 30,
    track: 'ANALYSIS',
    status: 'ACTIVE',
    role: 'MEMBER',
    joinedAt: '2026-07-01',
  },
  {
    id: 'm-005',
    name: '정다은',
    email: 'daeun.jung@boaz.club',
    phone: '010-4527-3098',
    cohort: 29,
    track: 'VISUALIZATION',
    status: 'ALUMNI',
    role: 'MEMBER',
    joinedAt: '2026-01-05',
  },
  {
    id: 'm-006',
    name: '한유진',
    email: 'yujin.han@boaz.club',
    phone: '010-9910-7234',
    cohort: 29,
    track: 'ENGINEERING',
    status: 'ACTIVE',
    role: 'OPERATOR',
    joinedAt: '2026-01-05',
  },
  {
    id: 'm-007',
    name: '오지훈',
    email: 'jihun.oh@boaz.club',
    phone: '010-3315-6210',
    cohort: 29,
    track: 'ANALYSIS',
    status: 'INACTIVE',
    role: 'MEMBER',
    joinedAt: '2026-01-05',
  },
  {
    id: 'm-008',
    name: '윤서연',
    email: 'seoyeon.yoon@boaz.club',
    phone: '010-5108-4492',
    cohort: 28,
    track: 'VISUALIZATION',
    status: 'ALUMNI',
    role: 'MEMBER',
    joinedAt: '2025-07-01',
  },
];

const EMPTY_FORM: Omit<ClubMember, 'id'> = {
  name: '',
  email: '',
  phone: '',
  cohort: 30,
  track: 'ANALYSIS',
  status: 'ACTIVE',
  role: 'MEMBER',
  joinedAt: new Date().toISOString().slice(0, 10),
};

const selectClass =
  'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const inputClass =
  'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function statusStyle(status: ClubMemberStatus) {
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (status === 'ALUMNI') return 'bg-blue-50 text-blue-700 ring-blue-200';
  return 'bg-slate-100 text-slate-600 ring-slate-200';
}

function trackStyle(track: ClubMemberTrack) {
  if (track === 'ANALYSIS') return 'bg-violet-50 text-violet-700';
  if (track === 'VISUALIZATION') return 'bg-amber-50 text-amber-700';
  return 'bg-cyan-50 text-cyan-700';
}

export function MemberManagementPage() {
  const [members, setMembers] = useState<ClubMember[]>(INITIAL_MEMBERS);
  const [filter, setFilter] = useState<ClubMemberFilter>({
    query: '',
    cohort: 'ALL',
    track: 'ALL',
    status: 'ALL',
  });
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [form, setForm] = useState<Omit<ClubMember, 'id'>>(EMPTY_FORM);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filteredMembers = useMemo(() => filterClubMembers(members, filter), [filter, members]);
  const summary = useMemo(() => summarizeClubMembers(members), [members]);
  const cohorts = useMemo(
    () => [...new Set(members.map((member) => member.cohort))].sort((a, b) => b - a),
    [members],
  );

  const openCreate = () => {
    setEditingMember(null);
    setForm(EMPTY_FORM);
    setIsModalOpen(true);
  };

  const openEdit = (member: ClubMember) => {
    setEditingMember(member);
    setForm({
      name: member.name,
      email: member.email,
      phone: member.phone,
      cohort: member.cohort,
      track: member.track,
      status: member.status,
      role: member.role,
      joinedAt: member.joinedAt,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingMember(null);
    setIsModalOpen(false);
  };

  const saveMember = (event: React.FormEvent) => {
    event.preventDefault();
    if (editingMember) {
      setMembers((current) =>
        current.map((member) => (member.id === editingMember.id ? { ...member, ...form } : member)),
      );
    } else {
      setMembers((current) => [...current, { ...form, id: `member-${Date.now()}` }]);
    }
    closeModal();
  };

  return (
    <div className="mx-auto w-full max-w-[1500px] space-y-5">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold text-blue-600">
            <UsersRound size={14} />
            MEMBER DIRECTORY
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950">동아리원 관리</h1>
          <p className="mt-1 text-sm text-slate-500">
            기수와 부문, 활동 상태를 기준으로 동아리원 정보를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300"
        >
          <Plus size={16} /> 동아리원 등록
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="동아리원 현황 요약">
        {[
          {
            label: '전체 동아리원',
            value: summary.total,
            icon: UsersRound,
            tone: 'text-slate-700 bg-slate-100',
          },
          {
            label: '활동 중',
            value: summary.active,
            icon: Activity,
            tone: 'text-emerald-700 bg-emerald-50',
          },
          {
            label: '수료',
            value: summary.alumni,
            icon: UserRoundCheck,
            tone: 'text-blue-700 bg-blue-50',
          },
          {
            label: '운영진·대표진',
            value: summary.operators,
            icon: ShieldCheck,
            tone: 'text-violet-700 bg-violet-50',
          },
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-2xl font-black tabular-nums text-slate-950">{value}</p>
              </div>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}>
                <Icon size={17} />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50/70 p-4 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              aria-label="동아리원 검색"
              value={filter.query}
              onChange={(event) =>
                setFilter((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="이름, 이메일, 연락처 검색"
              className={`${inputClass} pl-9`}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="기수 필터"
              className={selectClass}
              value={filter.cohort}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  cohort: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value),
                }))
              }
            >
              <option value="ALL">전체 기수</option>
              {cohorts.map((cohort) => (
                <option key={cohort} value={cohort}>
                  {cohort}기
                </option>
              ))}
            </select>
            <select
              aria-label="부문 필터"
              className={selectClass}
              value={filter.track}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  track: event.target.value as ClubMemberTrack | 'ALL',
                }))
              }
            >
              <option value="ALL">전체 부문</option>
              {Object.entries(TRACK_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              aria-label="활동 상태 필터"
              className={selectClass}
              value={filter.status}
              onChange={(event) =>
                setFilter((current) => ({
                  ...current,
                  status: event.target.value as ClubMemberStatus | 'ALL',
                }))
              }
            >
              <option value="ALL">전체 상태</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>
            검색 결과 <strong className="text-slate-900">{filteredMembers.length}</strong>명
          </span>
          <span>최근 기수 우선</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left">
            <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">동아리원</th>
                <th className="px-4 py-3">기수·부문</th>
                <th className="px-4 py-3">역할</th>
                <th className="px-4 py-3">활동 상태</th>
                <th className="px-4 py-3">가입일</th>
                <th className="px-5 py-3 text-right">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="group transition hover:bg-blue-50/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 font-black text-slate-600">
                        {member.name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900">{member.name}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                          <Mail size={11} /> {member.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{member.cohort}기</span>
                      <span
                        className={`rounded-md px-2 py-1 text-[11px] font-bold ${trackStyle(member.track)}`}
                      >
                        {TRACK_LABELS[member.track]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-sm font-medium text-slate-600">
                    {ROLE_LABELS[member.role]}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${statusStyle(member.status)}`}
                    >
                      {STATUS_LABELS[member.status]}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm tabular-nums text-slate-500">
                    {member.joinedAt}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(member)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-500 transition hover:bg-white hover:text-blue-700 hover:shadow-xs"
                    >
                      <Pencil size={13} /> 수정 <ChevronRight size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="grid place-items-center px-6 py-16 text-center">
              <CircleUserRound size={34} className="text-slate-300" />
              <p className="mt-3 text-sm font-bold text-slate-700">
                조건에 맞는 동아리원이 없습니다.
              </p>
              <button
                type="button"
                onClick={() => setFilter({ query: '', cohort: 'ALL', track: 'ALL', status: 'ALL' })}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline"
              >
                필터 초기화
              </button>
            </div>
          )}
        </div>
      </section>

      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={saveMember}
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <p className="text-xs font-bold text-blue-600">MEMBER PROFILE</p>
                <h2 className="mt-0.5 text-lg font-black text-slate-950">
                  {editingMember ? '동아리원 정보 수정' : '동아리원 등록'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="닫기"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">이름</span>
                <input
                  required
                  className={inputClass}
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">이메일</span>
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, email: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">연락처</span>
                <input
                  required
                  className={inputClass}
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">가입일</span>
                <input
                  required
                  type="date"
                  className={inputClass}
                  value={form.joinedAt}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, joinedAt: event.target.value }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">기수</span>
                <input
                  required
                  min={1}
                  type="number"
                  className={inputClass}
                  value={form.cohort}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, cohort: Number(event.target.value) }))
                  }
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">부문</span>
                <select
                  className={`${selectClass} w-full`}
                  value={form.track}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      track: event.target.value as ClubMemberTrack,
                    }))
                  }
                >
                  {Object.entries(TRACK_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">역할</span>
                <select
                  className={`${selectClass} w-full`}
                  value={form.role}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      role: event.target.value as ClubMemberRole,
                    }))
                  }
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-bold text-slate-700">활동 상태</span>
                <select
                  className={`${selectClass} w-full`}
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as ClubMemberStatus,
                    }))
                  }
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="submit"
                className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700"
              >
                {editingMember ? '변경사항 저장' : '동아리원 등록'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
