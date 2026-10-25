import { Fragment, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

import {
  FilterDropdown,
  type FilterDropdownOption,
} from '@/pages/attendance-events/ui/FilterDropdown';
import { SplitListItem, SplitView } from '@/pages/system-accounts/ui/SplitView';
import {
  LIST_SECTION_TITLE,
  TABLE_BOX,
  TD_CLASS,
  TH_CLASS,
} from '@/pages/system-accounts/ui/systemStyles';

import type { AuditLogQuery } from '@/entities/audit-log/model/dto';
import { useAuditFilters } from '@/entities/audit-log/model/useAuditFilters';
import {
  AUDIT_ACTIONS,
  AUDIT_CATEGORIES,
  type AuditCategory,
} from '@/entities/audit-log/model/types';

import { useAuditLogs } from '../model/useAuditLogs';
import { AuditLogDetail } from './AuditLogDetail';
import { DateFilter } from './DateFilter';

/** 왼쪽 목록에서 고르는 단위. 'ALL'은 모든 분류다. 분류는 사이드바 메뉴 묶음과 같다. */
type AuditSheet = AuditCategory | 'ALL';

const AUDIT_HASH = 'system-audit';
const PAGE_SIZE = 7;
const EMPTY_CELL = '-';

const CATEGORY_LABEL = Object.fromEntries(
  AUDIT_CATEGORIES.map((item) => [item.id, item.label]),
) as Record<AuditCategory, string>;

/** 도구 줄의 입력칸(검색). 동아리원 관리의 검색칸과 같은 모양이다. */
const TOOLBAR_FIELD =
  'h-9 rounded-sm border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800 shadow-2xs outline-none transition-colors hover:border-slate-300 focus:border-slate-400';
/** 쪽 넘김의 이전·다음 버튼. */
/** 쪽 번호 버튼. 지금 쪽은 진한 굵은 글자로만 구분한다. */
const PAGE_NUMBER_BTN =
  'inline-flex h-8 min-w-8 cursor-pointer items-center justify-center px-2 text-xs tabular-nums transition-colors';
/** 쪽 번호를 한 번에 몇 개까지 보일지. */
const MAX_PAGE_NUMBERS = 5;

/** 보일 쪽 번호. 지금 쪽이 가운데 오도록 최대 MAX_PAGE_NUMBERS개를 고른다. */
function pageNumbersOf(current: number, last: number): number[] {
  const count = Math.min(MAX_PAGE_NUMBERS, last);
  const start = Math.min(Math.max(1, current - Math.floor(count / 2)), last - count + 1);
  return Array.from({ length: count }, (_, index) => start + index);
}

const PAGER_BTN =
  'inline-flex size-8 cursor-pointer items-center justify-center rounded-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';

/** 상세 보기 버튼. 상세 창을 연 행은 눌린 모양(진한 테두리·회색 바탕)으로 둔다. */
const DETAIL_BTN =
  'inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border px-2 text-xs font-semibold transition-colors';

/** 주소 '#system-audit/<분류>'에서 고른 분류를 읽는다. 없거나 모르는 값이면 전체다. */
function sheetOfHash(): AuditSheet {
  const [page, sheet] = window.location.hash.replace(/^#/, '').split('/');
  if (page !== AUDIT_HASH || !sheet) return 'ALL';
  return AUDIT_CATEGORIES.some((item) => item.id === sheet) ? (sheet as AuditCategory) : 'ALL';
}

interface Filter {
  /** 권한 매트릭스의 권한 이름, 매트릭스에 없는 작업(NONE), 또는 전체(ALL). */
  permission: string;
  /** 'YYYY-MM-DD'. 고르면 그날 기록만 본다. */
  date: string;
  q: string;
}

const EMPTY_FILTER: Filter = { permission: 'ALL', date: '', q: '' };

/** 일시 칸 글자. 'YYYY-MM-DD HH:MM:SS'를 '26-10-12 16:21:03'처럼 연도 두 자리로 줄인다. */
const shortDateTime = (occurredAt: string): string => occurredAt.slice(2);

interface AuditLogPageProps {
  /** 권한 관리 화면에서 수행자의 권한 창을 연다(회원 id). */
  onOpenPermissions: (userId: string) => void;
  /** 수행자를 동아리원 관리에서 찾아 연다(회원 id). */
  onOpenMember: (userId: string) => void;
}

/**
 * 보안 감사 로그(SYS-LOG). 관리자가 한 쓰기 작업을 누가(이름·등급) 언제 무엇을 했는지 보여 준다.
 * 왼쪽에서 분류(사이드바 메뉴 묶음과 같다)를 고르면 오른쪽에 기록이 최신 기록부터 나온다. 기록마다 권한 매트릭스의
 * 어느 권한으로 생성·수정·삭제 중 무엇을 했는지 보인다. 수행자가 지금도 권한이 있는지 함께 보이고,
 * 그 사람의 계정·권한 화면으로 바로 옮겨 갈 수 있다. 거르기·정렬·쪽 나누기는 모두 서버(임시 API)가 한다.
 * 조회에는 "보안 감사 로그 조회" 권한이 필요하다.
 */
export function AuditLogPage({ onOpenPermissions, onOpenMember }: AuditLogPageProps) {
  /** 오른쪽에 연 분류(null이면 패널을 닫았다). 주소에 남겨 새로고침해도 유지한다. */
  const [sheet, setSheet] = useState<AuditSheet | null>(sheetOfHash);
  const [filter, setFilter] = useState<Filter>(EMPTY_FILTER);
  const [page, setPage] = useState(1);
  /** 상세 창을 연 기록. 닫으면 null. */
  const [openEntryId, setOpenEntryId] = useState<number | null>(null);

  useEffect(() => {
    const hash = sheet ? `#${AUDIT_HASH}/${sheet === 'ALL' ? 'all' : sheet}` : `#${AUDIT_HASH}`;
    if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
  }, [sheet]);

  const query = useMemo<AuditLogQuery>(
    () => ({
      category: sheet && sheet !== 'ALL' ? sheet : undefined,
      permission: filter.permission === 'ALL' ? undefined : filter.permission,
      from: filter.date || undefined,
      to: filter.date || undefined,
      q: filter.q.trim() || undefined,
      page,
      size: PAGE_SIZE,
    }),
    [sheet, filter, page],
  );
  const { page: result, isLoading, error } = useAuditLogs(query);
  const { filters, error: filtersError } = useAuditFilters();
  /**
   * 권한 필터 선택지: 서버(GET /api/v1/admin/audit-logs/filters)가 정한 분류별 권한(매트릭스 순서, 매트릭스에 없는
   * 작업이 있으면 맨 끝에 '매트릭스에 없음'). 분류를 고르지 않았으면(전체) 모든 분류의 권한을 순서대로 합치고 겹치는 것은
   * 하나만 남긴다. 읽는 동안에는 '전체'만 두어 필터 자리는 그대로 남긴다.
   */
  const permissionOptions = useMemo<readonly FilterDropdownOption<string>[]>(() => {
    const categories = filters?.categories ?? [];
    const picked =
      sheet && sheet !== 'ALL'
        ? categories.filter((category) => category.key === sheet)
        : categories;
    const seen = new Set<string>();
    const permissions = picked
      .flatMap((category) => category.permissions)
      .filter((permission) => {
        if (seen.has(permission.key)) return false;
        seen.add(permission.key);
        return true;
      });
    return [
      { value: 'ALL', label: '전체' },
      ...permissions.map((permission) => ({ value: permission.key, label: permission.label })),
    ];
  }, [filters, sheet]);

  /** 필터 한 항목을 바꾸고 첫 쪽으로 돌아간다. */
  const updateFilter = (patch: Partial<Filter>) => {
    setFilter((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  /** 분류를 바꾼다. 권한 필터는 분류마다 선택지가 달라 푼다. */
  const changeSheet = (next: AuditSheet) => {
    setSheet(next);
    setFilter((current) => ({ ...current, permission: 'ALL' }));
    setPage(1);
  };

  /** 전체 기록과 탭별 기록은 같은 열을 보인다. */
  const columnCount = 7;
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const lastPage = result ? Math.max(1, Math.ceil(total / result.size)) : 1;
  const openEntry = items.find((entry) => entry.id === openEntryId) ?? null;
  const isFiltered = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-slate-200/80 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">감사 로그</h1>
      </div>

      <SplitView
        listLabel="감사 로그 분류 목록"
        list={
          <div className="space-y-4">
            <section className="space-y-2" aria-labelledby="audit-all-heading">
              <h2 id="audit-all-heading" className={LIST_SECTION_TITLE}>
                전체 기록
              </h2>
              <SplitListItem
                label="전체"
                isSelected={sheet === 'ALL'}
                onSelect={() => changeSheet('ALL')}
              />
            </section>
            <section className="space-y-2" aria-labelledby="audit-category-heading">
              <h2 id="audit-category-heading" className={LIST_SECTION_TITLE}>
                탭별
              </h2>
              <ul className="space-y-2.5">
                {AUDIT_CATEGORIES.map((item) => (
                  <li key={item.id}>
                    <SplitListItem
                      label={item.label}
                      isSelected={sheet === item.id}
                      onSelect={() => changeSheet(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        }
        isOpen={sheet !== null}
        panelTitle={sheet === 'ALL' ? '전체 기록' : sheet ? CATEGORY_LABEL[sheet] : ''}
        onClose={() => setSheet(null)}
      >
        {/* 검색·필터: 날짜, 권한, 검색어 */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DateFilter
            value={filter.date}
            onChange={(date) => updateFilter({ date })}
            ariaLabel="날짜 필터(그날 기록만 보기)"
          />
          <FilterDropdown
            ariaLabel="권한 필터"
            title="권한"
            value={filter.permission}
            options={permissionOptions}
            onChange={(permission) => updateFilter({ permission })}
          />
          {/* 권한 목록을 읽지 못하면 드롭다운은 '전체'만 둔 채 그 옆에 한 줄로 알린다. */}
          {filtersError && (
            <p role="alert" className="text-xs text-red-600">
              권한 목록을 불러오지 못했습니다.
            </p>
          )}
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              value={filter.q}
              onChange={(event) => updateFilter({ q: event.target.value })}
              placeholder="검색"
              aria-label="수행자, 대상, 액션 검색"
              className={`w-44 pl-8 placeholder:font-normal placeholder:text-slate-400 ${TOOLBAR_FIELD}`}
            />
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600"
          >
            감사 로그를 불러오지 못했습니다. ({error.message})
          </p>
        )}

        {/* 기록 표 */}
        <div className={TABLE_BOX}>
          <div className="overflow-x-auto">
            <table
              className={`w-full table-fixed border-collapse text-xs transition-opacity min-w-[880px] ${isLoading && result ? 'opacity-60' : ''}`}
              aria-busy={isLoading}
            >
              <thead className="select-none">
                <tr className="h-10 divide-x divide-slate-200 border-b border-slate-200">
                  {/* 짧은 값(일시·이름·구분 등)은 너비를 고정하고, 긴 글(액션·권한·대상·상세)은 남은 너비를 나눠 쓴다. */}
                  <th className={`${TH_CLASS} w-36`}>일시</th>
                  <th className={`${TH_CLASS} w-20 text-slate-900`}>이름</th>
                  <th className={`${TH_CLASS} w-20`}>구분</th>
                  <th className={`${TH_CLASS} w-18`}>권한 유지</th>
                  <th className={TH_CLASS}>권한명</th>
                  <th className={TH_CLASS}>행동</th>
                  <th className={`${TH_CLASS} w-26`}>상세</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!result ? (
                  <tr>
                    <td colSpan={columnCount} className="py-10 text-center text-slate-500">
                      {error ? EMPTY_CELL : '감사 로그를 불러오는 중입니다.'}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={columnCount} className="py-10 text-center text-slate-500">
                      <p>조건에 맞는 기록이 없습니다.</p>
                      {isFiltered && (
                        <button
                          type="button"
                          onClick={() => updateFilter(EMPTY_FILTER)}
                          className="mt-2 cursor-pointer text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                        >
                          필터 초기화
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  items.map((entry) => {
                    const isOpen = openEntryId === entry.id;
                    const open = () => setOpenEntryId(entry.id);
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className={`h-11 divide-x divide-slate-200 transition-colors ${
                            isOpen ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <td className={`${TD_CLASS} tabular-nums text-slate-600`}>
                            {shortDateTime(entry.occurredAt)}
                          </td>
                          <td
                            className={`${TD_CLASS} truncate`}
                            title={entry.actorName ?? undefined}
                          >
                            {entry.actorName && entry.actorUserId ? (
                              <button
                                type="button"
                                onClick={() => {
                                  if (entry.actorUserId) onOpenMember(entry.actorUserId);
                                }}
                                title="동아리원 명단에서 이 사람 보기"
                                className="max-w-full cursor-pointer truncate align-middle text-xs font-bold text-slate-900 underline-offset-2 hover:underline"
                              >
                                {entry.actorName}
                              </button>
                            ) : entry.actorName ? (
                              <span className="font-bold text-slate-900">{entry.actorName}</span>
                            ) : (
                              <span className="text-slate-500">
                                {entry.actorId === null ? EMPTY_CELL : '삭제된 회원'}
                              </span>
                            )}
                          </td>
                          <td className={`${TD_CLASS} font-mono font-semibold text-slate-700`}>
                            {entry.actorRole ?? EMPTY_CELL}
                          </td>
                          <td
                            className={`${TD_CLASS} font-mono font-bold ${
                              entry.actorHasPermission ? 'text-slate-900' : 'text-red-600'
                            }`}
                            title={
                              entry.actorHasPermission
                                ? '지금도 권한이 있습니다.'
                                : '지금은 권한이 없습니다.'
                            }
                          >
                            {entry.actorHasPermission ? 'O' : 'X'}
                          </td>
                          <td
                            className={`${TD_CLASS} truncate ${
                              entry.permission ? 'text-slate-700' : 'text-slate-500'
                            }`}
                            title={entry.permission?.label}
                          >
                            {entry.permission?.label ?? '매트릭스에 없음'}
                          </td>
                          {/* 실제로 한 행동. 삭제는 되돌릴 수 없어 빨간 글자로 둔다. */}
                          <td
                            className={`${TD_CLASS} truncate font-semibold ${
                              entry.operation === 'DELETE' ? 'text-red-600' : 'text-slate-800'
                            }`}
                            title={AUDIT_ACTIONS[entry.action].label}
                          >
                            {AUDIT_ACTIONS[entry.action].label}
                          </td>
                          <td className={TD_CLASS}>
                            <button
                              type="button"
                              onClick={open}
                              aria-haspopup="dialog"
                              className={`${DETAIL_BTN} ${
                                isOpen
                                  ? 'border-slate-400 bg-slate-100 text-slate-900'
                                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900'
                              }`}
                            >
                              상세 보기
                            </button>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 쪽 넘김: 가운데에 이전 · 쪽 번호 · 다음. 한 쪽뿐이어도 보인다(이전·다음은 꺼진다). */}
        {result && total > 0 && (
          <nav aria-label="쪽 넘김" className="flex justify-center pt-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage(result.page - 1)}
                disabled={result.page <= 1}
                aria-label="이전 쪽"
                className={PAGER_BTN}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              {pageNumbersOf(result.page, lastPage).map((pageNumber) => {
                const isCurrent = pageNumber === result.page;
                return (
                  <button
                    key={pageNumber}
                    type="button"
                    onClick={() => setPage(pageNumber)}
                    aria-label={`${pageNumber}쪽`}
                    aria-current={isCurrent ? 'page' : undefined}
                    className={`${PAGE_NUMBER_BTN} ${
                      isCurrent ? 'font-bold text-slate-900' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {pageNumber}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setPage(result.page + 1)}
                disabled={result.page >= lastPage}
                aria-label="다음 쪽"
                className={PAGER_BTN}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </nav>
        )}
      </SplitView>
      {openEntry && (
        <AuditLogDetail
          entry={openEntry}
          onClose={() => setOpenEntryId(null)}
          onOpenPermissions={onOpenPermissions}
        />
      )}
    </div>
  );
}
