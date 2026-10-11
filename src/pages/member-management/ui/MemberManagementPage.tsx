import { useMemo, useState } from 'react';
import { Pencil, Search, X } from 'lucide-react';

import {
  FilterDropdown,
  type FilterDropdownOption,
} from '@/pages/attendance-events/ui/FilterDropdown';
import { MODAL_SURFACE } from '@/shared/ui/modalStyles';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { Tooltip } from '@/shared/ui/Tooltip';

import { updateClubMember } from '@/entities/club-member/api/clubMemberApi';
import type { ClubMemberForm } from '@/entities/club-member/model/dto';
import {
  CLUB_MEMBER_TRACKS,
  ROLE_LABELS,
  STATUS_LABELS,
  type ClubMember,
  type ClubMemberRole,
  type ClubMemberStatus,
  type ClubMemberTrack,
} from '@/entities/club-member/model/types';
import { useClubMembers } from '@/entities/club-member/model/useClubMembers';
import { alertApiError } from '@/shared/lib/alertApiError';

import {
  type ClubMemberFilter,
  filterClubMembers,
  summarizeClubMembers,
} from '../model/memberManagement';

/** 수정 팝업의 입력값. 동아리원 행에서 id만 뺀 값이다. */
const toForm = (member: ClubMember): ClubMemberForm => ({
  name: member.name,
  email: member.email,
  phone: member.phone,
  university: member.university,
  major: member.major,
  term: member.term,
  track: member.track,
  status: member.status,
  role: member.role,
});

const EMPTY_FILTER: ClubMemberFilter = { query: '', term: 'ALL', track: 'ALL', status: 'ALL' };
/** 기록이 없는 값(대학교·전공 등)을 표에 보여줄 때 쓰는 표시. */
const EMPTY_CELL = '-';

// ─── 출결 화면(행사 출결·그룹 계정 관리)과 같은 입력칸·표·팝업 스타일 ───
/** 도구 줄의 검색칸. */
const TOOLBAR_FIELD =
  'h-9 rounded-sm border border-slate-200 bg-white text-xs font-semibold text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400';
const TH_CLASS = 'px-4 py-2 text-center font-bold text-slate-700 whitespace-nowrap';
const TD_CLASS = 'px-4 py-2 text-center whitespace-nowrap';
/** 팝업 제목 옆 닫기 버튼. */
const MODAL_CLOSE_BTN =
  'p-1.5 rounded-sm text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer';
/** 팝업 아래쪽 취소·확인 버튼. */
const MODAL_CANCEL_BTN =
  'h-9 rounded-sm px-4 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer';
const MODAL_CONFIRM_BTN =
  'h-9 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40';
/** 팝업 입력 항목의 이름과 입력칸. */
const FIELD_LABEL = 'mb-1.5 block text-[11px] font-semibold text-slate-500';
const FIELD_INPUT =
  'h-10 w-full rounded-sm border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-slate-400';

/** 활동 상태 글자색. 색으로 꾸미지 않고 회색 진하기로만 구분한다(활동 중이 가장 진하다). */
const STATUS_TEXT: Record<ClubMemberStatus, string> = {
  ACTIVE: 'text-slate-900 font-semibold',
  ALUMNI: 'text-slate-500',
  INACTIVE: 'text-slate-400',
};

const labelOptions = <T extends string>(labels: Record<T, string>) =>
  (Object.entries(labels) as [T, string][]).map(([value, label]) => ({ value, label }));

const TRACK_OPTIONS = CLUB_MEMBER_TRACKS.map((track) => ({ value: track, label: track }));
const ROLE_OPTIONS = labelOptions(ROLE_LABELS);
const STATUS_OPTIONS = labelOptions(STATUS_LABELS);

export function MemberManagementPage() {
  // 동아리원 목록은 API(임시 DB users 테이블)에서 읽고, 수정도 API로 한 뒤 다시 읽는다.
  // 동아리원 등록은 이 화면이 아니라 서류 평가의 합격자 승격으로 한다.
  // 기수 필터 선택지도 화면에서 계산하지 않고 users 테이블의 기수 목록 API로 받는다.
  const { members: loadedMembers, terms, error: loadError, reload } = useClubMembers();
  const members = useMemo(() => loadedMembers ?? [], [loadedMembers]);
  const [filter, setFilter] = useState<ClubMemberFilter>(EMPTY_FILTER);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [form, setForm] = useState<ClubMemberForm | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const filteredMembers = useMemo(() => filterClubMembers(members, filter), [filter, members]);
  const summary = useMemo(() => summarizeClubMembers(members), [members]);
  const termOptions = useMemo<readonly FilterDropdownOption<string>[]>(
    () => [
      { value: 'ALL', label: '전체' },
      ...terms.map((term) => ({ value: String(term), label: `${term}기` })),
    ],
    [terms],
  );

  const summaryItems = [
    { label: '전체', value: summary.total },
    { label: '활동 중', value: summary.active },
    { label: '수료', value: summary.alumni },
    { label: '운영진·대표진', value: summary.operators },
  ];

  const canSave =
    !isSaving &&
    form !== null &&
    Boolean(form.name.trim() && form.email.trim() && form.phone.trim() && form.term > 0);

  const openEdit = (member: ClubMember) => {
    setEditingMember(member);
    setForm(toForm(member));
  };

  const closeModal = () => {
    setEditingMember(null);
    setForm(null);
  };

  /** 팝업 입력값 한 항목을 바꾼다. 팝업이 닫혀 있으면 아무것도 하지 않는다. */
  const updateForm = (patch: Partial<ClubMemberForm>) =>
    setForm((current) => (current ? { ...current, ...patch } : current));

  const saveMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || !form || !editingMember) return;
    const request: ClubMemberForm = {
      ...form,
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      university: form.university.trim(),
      major: form.major.trim(),
    };
    setIsSaving(true);
    try {
      await updateClubMember(editingMember.id, request);
      closeModal();
      reload();
    } catch (error) {
      alertApiError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const loadStatus = loadError ? 'error' : loadedMembers ? 'ready' : 'loading';

  return (
    <div className="space-y-6">
      {loadStatus !== 'ready' && (
        <p
          role="status"
          className={`rounded-md border px-4 py-3 text-xs ${
            loadStatus === 'error'
              ? 'border-red-200 bg-red-50 text-red-600'
              : 'border-slate-200 bg-white text-slate-500'
          }`}
        >
          {loadStatus === 'error'
            ? `동아리원 정보를 불러오지 못했습니다. (${loadError?.message ?? '알 수 없는 오류'})`
            : '동아리원 정보를 불러오는 중입니다.'}
        </p>
      )}
      {/* 1. 상단 제목 영역 */}
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">동아리원 관리</h1>
      </div>

      {/* 2. 인원 요약과 검색·필터 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <dl className="flex flex-wrap items-center gap-5 text-xs" aria-label="동아리원 현황 요약">
          {summaryItems.map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1.5">
              <dt className="font-medium text-slate-500">{label}</dt>
              <dd className="text-sm font-bold tabular-nums text-slate-900">{value}명</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-wrap items-center gap-2">
          <FilterDropdown
            ariaLabel="기수 필터"
            title="기수"
            value={filter.term === 'ALL' ? 'ALL' : String(filter.term)}
            options={termOptions}
            onChange={(value) =>
              setFilter((current) => ({
                ...current,
                term: value === 'ALL' ? 'ALL' : Number(value),
              }))
            }
          />
          <FilterDropdown<ClubMemberTrack | 'ALL'>
            ariaLabel="부문 필터"
            title="부문"
            value={filter.track}
            options={[{ value: 'ALL', label: '전체' }, ...TRACK_OPTIONS]}
            onChange={(track) => setFilter((current) => ({ ...current, track }))}
          />
          <FilterDropdown<ClubMemberStatus | 'ALL'>
            ariaLabel="활동 상태 필터"
            title="활동 상태"
            value={filter.status}
            options={[{ value: 'ALL', label: '전체' }, ...STATUS_OPTIONS]}
            onChange={(status) => setFilter((current) => ({ ...current, status }))}
          />
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={filter.query}
              onChange={(event) =>
                setFilter((current) => ({ ...current, query: event.target.value }))
              }
              placeholder="검색"
              aria-label="이름, 이메일, 연락처 검색"
              className={`w-44 pl-8 pr-3 font-medium placeholder:font-normal placeholder:text-slate-400 ${TOOLBAR_FIELD}`}
            />
          </div>
        </div>
      </div>

      {/* 3. 동아리원 표 */}
      <div className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1070px] border-collapse text-xs">
            <thead className="bg-slate-50/80">
              <tr className="h-11 divide-x divide-slate-200 border-b border-slate-200 text-[11px]">
                <th className={`${TH_CLASS} w-[120px] text-slate-900`}>이름</th>
                <th className={`${TH_CLASS} w-[80px]`}>기수</th>
                <th className={`${TH_CLASS} w-[100px]`}>부문</th>
                <th className={`${TH_CLASS} w-[100px]`}>역할</th>
                <th className={`${TH_CLASS} w-[90px]`}>활동 상태</th>
                <th className={TH_CLASS}>이메일</th>
                <th className={`${TH_CLASS} w-[130px]`}>연락처</th>
                <th className={`${TH_CLASS} w-[130px]`}>대학교</th>
                <th className={`${TH_CLASS} w-[130px]`}>전공</th>
                <th className={`${TH_CLASS} w-[64px]`}>관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadStatus !== 'ready' ? null : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <p>검색 조건에 일치하는 동아리원이 없습니다.</p>
                    <button
                      type="button"
                      onClick={() => setFilter(EMPTY_FILTER)}
                      className="mt-2 cursor-pointer text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                    >
                      필터 초기화
                    </button>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => (
                  <tr
                    key={member.id}
                    className="h-[46px] divide-x divide-slate-200 transition-colors hover:bg-slate-50/70"
                  >
                    <td className={`${TD_CLASS} font-bold text-slate-900`}>{member.name}</td>
                    <td className={`${TD_CLASS} tabular-nums text-slate-700`}>{member.term}기</td>
                    <td className={`${TD_CLASS} text-slate-700`}>{member.track}</td>
                    <td className={`${TD_CLASS} text-slate-700`}>{ROLE_LABELS[member.role]}</td>
                    <td className={`${TD_CLASS} ${STATUS_TEXT[member.status]}`}>
                      {STATUS_LABELS[member.status]}
                    </td>
                    <td className={`${TD_CLASS} text-slate-600`}>{member.email || EMPTY_CELL}</td>
                    <td className={`${TD_CLASS} tabular-nums text-slate-600`}>
                      {member.phone || EMPTY_CELL}
                    </td>
                    <td className={`${TD_CLASS} text-slate-600`}>
                      {member.university || EMPTY_CELL}
                    </td>
                    <td className={`${TD_CLASS} text-slate-600`}>{member.major || EMPTY_CELL}</td>
                    <td className="px-2 py-2 text-center">
                      <Tooltip label="정보 수정" align="end">
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          aria-label={`${member.name} 정보 수정`}
                          className="inline-flex size-7 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 동아리원 정보 수정 팝업 */}
      {form && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={saveMember}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-modal-title"
            className={`w-full max-w-xl space-y-4 rounded-lg p-6 animate-in fade-in duration-150 ${MODAL_SURFACE}`}
          >
            <div className="flex items-center justify-between">
              <h3 id="member-modal-title" className="text-base font-bold text-slate-900">
                동아리원 정보 수정
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className={MODAL_CLOSE_BTN}
                aria-label="창 닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-x-4 gap-y-5 text-xs sm:grid-cols-2">
              <div>
                <label htmlFor="member-name" className={FIELD_LABEL}>
                  이름 *
                </label>
                <input
                  id="member-name"
                  required
                  className={FIELD_INPUT}
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-term" className={FIELD_LABEL}>
                  기수 *
                </label>
                <input
                  id="member-term"
                  required
                  min={1}
                  type="number"
                  className={FIELD_INPUT}
                  value={form.term}
                  onChange={(event) => updateForm({ term: Number(event.target.value) })}
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>부문</span>
                <SelectDropdown<ClubMemberTrack>
                  ariaLabel="부문"
                  value={form.track}
                  options={TRACK_OPTIONS}
                  onChange={(track) => updateForm({ track })}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>역할</span>
                <SelectDropdown<ClubMemberRole>
                  ariaLabel="역할"
                  value={form.role}
                  options={ROLE_OPTIONS}
                  onChange={(role) => updateForm({ role })}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <span className={FIELD_LABEL}>활동 상태</span>
                <SelectDropdown<ClubMemberStatus>
                  ariaLabel="활동 상태"
                  value={form.status}
                  options={STATUS_OPTIONS}
                  onChange={(status) => updateForm({ status })}
                  buttonClassName="h-10 w-full"
                />
              </div>
              <div>
                <label htmlFor="member-email" className={FIELD_LABEL}>
                  이메일 *
                </label>
                <input
                  id="member-email"
                  required
                  type="email"
                  className={FIELD_INPUT}
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-phone" className={FIELD_LABEL}>
                  연락처 *
                </label>
                <input
                  id="member-phone"
                  required
                  className={FIELD_INPUT}
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-university" className={FIELD_LABEL}>
                  대학교
                </label>
                <input
                  id="member-university"
                  className={FIELD_INPUT}
                  value={form.university}
                  onChange={(event) => updateForm({ university: event.target.value })}
                />
              </div>
              <div>
                <label htmlFor="member-major" className={FIELD_LABEL}>
                  전공
                </label>
                <input
                  id="member-major"
                  className={FIELD_INPUT}
                  value={form.major}
                  onChange={(event) => updateForm({ major: event.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-3.5">
              <button type="button" onClick={closeModal} className={MODAL_CANCEL_BTN}>
                취소
              </button>
              <button type="submit" disabled={!canSave} className={MODAL_CONFIRM_BTN}>
                저장
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
