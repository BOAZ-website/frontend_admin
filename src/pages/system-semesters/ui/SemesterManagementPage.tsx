import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

import type { Season } from '@/entities/cohort/model/season';
import { useSeasons } from '@/entities/cohort/model/useSeasons';
import { PAGE_LABELS } from '@/shared/config/pageLabels';
import { confirmLeave } from '@/shared/lib/leaveGuard';
import { Tooltip } from '@/shared/ui/Tooltip';
import { SplitListItem, SplitView } from '@/shared/ui/SplitView';
import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { confirmAndActivate } from '../model/activateSemester';
import { confirmAndRemovePreparing } from '../model/removeSemester';
import {
  clearSemesterDraft,
  loadSemesterDraft,
  saveSemesterDraft,
  type SemesterDraft,
} from '../model/semesterDraft';
import { emptySemesterDraft } from '../model/useNewSemesterForm';
import { ExistingSemesterPanel } from './ExistingSemesterPanel';
import { NewSemesterPanel } from './NewSemesterPanel';

/** 선택 상태: 예정(임시 저장한 새 반기), 저장된 반기(이름은 바뀔 수 있어 id로 고른다), 또는 없음. */
type Selection = { kind: 'new' } | { kind: 'semester'; id: number } | null;

const TITLE = (
  <h1 className="text-xl font-bold tracking-tight text-slate-900">
    {PAGE_LABELS['system-semesters']}
  </h1>
);
const TITLE_ROW_CLASS =
  'flex min-h-11 items-center justify-between gap-3 border-b border-slate-200/80 pb-2';

/** 목록 묶음: 진행 예정(있을 때만) → 진행 → 종료 순. */
const PREPARING_LABEL = '진행 예정';
/** 목록 묶음 제목. 공용 LIST_SECTION_TITLE(11px)보다 크게 12px·slate-500으로 보인다(R12-7). */
const GROUP_TITLE = 'px-1 text-xs font-semibold text-slate-500 select-none';
const GROUPS: readonly { status: Season['status']; label: string; empty: string }[] = [
  { status: 'ACTIVE', label: '진행', empty: '진행 중인 반기가 없습니다.' },
  { status: 'ARCHIVED', label: '종료', empty: '종료된 반기가 없습니다.' },
];

interface SemesterManagementPageProps {
  /** 반기 상태·일정·명단을 바꾼 뒤 부른다. 출결 공유 데이터를 다시 읽는 데 쓴다. */
  onSemesterChanged: () => void;
}

/**
 * 반기 관리 화면. "새 반기 시작"을 누르면 목록 맨 위 "진행 예정"에 새 반기가 생기고 입력은 이 브라우저에 임시 저장된다.
 * 적용 → 명단 확인을 마치면 진행 예정 반기로 등록된다(진행 반기는 그대로). 그 반기를 열어 활성화하면
 * 진행 반기의 종료 점검 → 종료 → 활성화를 차례로 하고 "진행 예정" 묶음은 사라진다. 화면에 들어오면 진행 반기를 열어 둔다.
 */
export function SemesterManagementPage({ onSemesterChanged }: SemesterManagementPageProps) {
  const seasonsState = useSeasons();
  const { seasons: semesters, error, reload } = seasonsState;
  // undefined는 아직 아무것도 고르지 않은 처음 상태다. 이때는 진행 반기를 열어 둔다.
  const [chosen, setSelection] = useState<Selection | undefined>(undefined);
  // 저장하지 않은 입력이 있는 패널에서 다른 반기로 옮길 때도 확인한다(R12-14).
  const handleSelect = (next: Selection) => {
    if (confirmLeave()) setSelection(next);
  };
  // 임시 저장한 새 반기(목록의 "예정"). 입력이 바뀔 때마다 저장한다.
  const [draft, setDraft] = useState<SemesterDraft | null>(loadSemesterDraft);
  const [isDraftUnsaved, setIsDraftUnsaved] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const handleDraftChange = useCallback((next: SemesterDraft) => {
    setDraft(next);
    setIsDraftUnsaved(!saveSemesterDraft(next));
  }, []);

  if (!semesters) {
    return (
      <PageLoadingState
        header={<div className={TITLE_ROW_CLASS}>{TITLE}</div>}
        error={error}
        loadingMessage="반기 정보를 불러오는 중입니다."
        errorMessage="반기 정보를 불러오지 못했습니다."
        action={
          error && (
            <button
              type="button"
              onClick={reload}
              className="ml-3 cursor-pointer rounded-sm border border-red-200 bg-white px-3 py-1 font-semibold hover:bg-red-100"
            >
              다시 시도
            </button>
          )
        }
      />
    );
  }

  const current = semesters.find((s) => s.status === 'ACTIVE') ?? null;
  const preparing = semesters.filter((s) => s.status === 'DRAFT');
  const handleNew = () => {
    // 진행 예정 반기는 한 번에 하나만 둔다.
    if (preparing.length > 0) {
      window.alert(
        `진행 예정 반기(${preparing[0].name})가 이미 있습니다. 활성화하거나 삭제한 뒤 새 반기를 시작하세요.`,
      );
      return;
    }
    if (!draft)
      handleDraftChange(emptySemesterDraft(Math.max(0, ...semesters.map((s) => s.baseTerm))));
    handleSelect({ kind: 'new' });
  };
  const forgetDraft = () => {
    clearSemesterDraft();
    setDraft(null);
  };
  const handleRemoveDraft = () => {
    if (
      !window.confirm('임시 저장한 새 반기를 지울까요?\n입력한 이름·기수·일정이 모두 지워집니다.')
    )
      return;
    forgetDraft();
    if (selection?.kind === 'new') setSelection(undefined);
  };
  const handleActivate = async (season: Season) => {
    if (isActivating) return;
    setIsActivating(true);
    try {
      // 종료만 되고 활성화가 실패해도 반기 상태가 바뀌었으므로 출결 공유 데이터를 다시 읽는다.
      if (await confirmAndActivate(season, current, seasonsState)) {
        onSemesterChanged();
      }
    } finally {
      setIsActivating(false);
    }
  };
  // 지울 수 있는 반기는 진행 예정 반기뿐이다(진행 중·종료 반기는 조회만).
  const handleRemove = async (season: Season) => {
    // 활성화하는 중에 그 반기를 지우면 진행 반기만 종료되고 활성화가 실패한다.
    if (isActivating) {
      window.alert('활성화가 끝난 뒤 다시 시도하세요.');
      return;
    }
    if (!(await confirmAndRemovePreparing(season, seasonsState.remove))) return;
    onSemesterChanged();
    // 지운 반기를 열어 두고 있었으면 닫는다(처음 상태로 돌아가 진행 반기가 열린다).
    if (selection?.kind === 'semester' && selection.id === season.id) setSelection(undefined);
  };
  const selection: Selection =
    chosen !== undefined ? chosen : current && { kind: 'semester', id: current.id };
  const selected =
    selection?.kind === 'semester' ? semesters.find((s) => s.id === selection.id) : null;
  const isOpen = selection?.kind === 'new' || !!selected;

  const list = (
    <div className="space-y-2">
      {(draft || preparing.length > 0) && (
        <div className="space-y-2">
          <p className={GROUP_TITLE}>{PREPARING_LABEL}</p>
          {preparing.map((s) => (
            <SplitListItem
              key={s.id}
              label={s.name}
              isSelected={selected?.id === s.id}
              onSelect={() => handleSelect({ kind: 'semester', id: s.id })}
              onDelete={() => void handleRemove(s)}
            />
          ))}
          {draft && (
            <SplitListItem
              label={draft.name || '새 반기'}
              isSelected={selection?.kind === 'new'}
              onSelect={() => handleSelect({ kind: 'new' })}
              onDelete={handleRemoveDraft}
            />
          )}
        </div>
      )}
      {GROUPS.map((group) => {
        const items = semesters.filter((s) => s.status === group.status);
        return (
          <div key={group.status} className="space-y-2">
            <p className={GROUP_TITLE}>{group.label}</p>
            {items.length === 0 ? (
              <p className="px-1 text-xs text-slate-500">{group.empty}</p>
            ) : (
              items.map((s) => (
                <SplitListItem
                  key={s.id}
                  label={s.name}
                  isSelected={selected?.id === s.id}
                  onSelect={() => handleSelect({ kind: 'semester', id: s.id })}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );

  // 제목 줄은 분할 화면 위에 둔다. 분할 화면 높이(100vh - 12rem)가 위 제목 줄을 빼고 계산되어 있다(감사 로그 화면과 같다).
  return (
    <div className="space-y-6">
      <div className={TITLE_ROW_CLASS}>
        {TITLE}
        {/* 바탕·테두리 없이 연한 + 만 두고, 무엇을 하는 버튼인지는 말풍선과 화면 낭독기 이름으로 알린다. */}
        <Tooltip label="반기 생성" align="end">
          <button
            type="button"
            onClick={handleNew}
            aria-label="반기 생성"
            className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-sm text-slate-400 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            <Plus size={16} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
      <SplitView
        listLabel="반기 목록"
        list={list}
        isOpen={isOpen}
        panelTitle={selection?.kind === 'new' ? draft?.name || '새 반기' : (selected?.name ?? '')}
        onClose={() => handleSelect(null)}
      >
        {selection?.kind === 'new' && draft && (
          <NewSemesterPanel
            initialDraft={draft}
            onDraftChange={handleDraftChange}
            isDraftUnsaved={isDraftUnsaved}
            existingNames={semesters.map((s) => s.name)}
            create={seasonsState.create}
            onCancel={() => handleSelect(null)}
            onApplied={(id: number) => {
              forgetDraft();
              setSelection({ kind: 'semester', id });
            }}
          />
        )}
        {selected && (
          <ExistingSemesterPanel
            key={selected.id}
            season={selected}
            onChanged={() => {
              reload();
              onSemesterChanged();
            }}
            onActivate={
              selected.status === 'DRAFT' ? () => void handleActivate(selected) : undefined
            }
            isActivating={isActivating}
          />
        )}
      </SplitView>
    </div>
  );
}
