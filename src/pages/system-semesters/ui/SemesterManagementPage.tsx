import { useState } from 'react';

import type { SemesterDto } from '@/entities/cohort/model/dto';
import { useSemesters } from '@/entities/cohort/model/useSemesters';
import { PAGE_LABELS } from '@/shared/config/pageLabels';
import { confirmLeave } from '@/shared/lib/leaveGuard';
import { CreateButton } from '@/shared/ui/CreateButton';
import { SplitListItem, SplitView } from '@/shared/ui/SplitView';
import { LIST_SECTION_TITLE } from '@/shared/ui/systemStyles';
import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { ExistingSemesterPanel } from './ExistingSemesterPanel';
import { NewSemesterPanel } from './NewSemesterPanel';

/** 선택 상태: 새 반기 작성, 이름이 있는 반기, 또는 없음. */
type Selection = { kind: 'new' } | { kind: 'semester'; name: string } | null;

const TITLE = (
  <h1 className="text-xl font-bold tracking-tight text-slate-900">
    {PAGE_LABELS['system-semesters']}
  </h1>
);
const TITLE_ROW_CLASS =
  'flex min-h-11 items-center justify-between gap-3 border-b border-slate-200/80 pb-2';

/** 목록 묶음: 준비 → 진행 → 종료 순. */
const GROUPS: readonly { status: SemesterDto['status']; label: string; empty: string }[] = [
  { status: 'PREPARING', label: '준비', empty: '준비 중인 반기가 없습니다.' },
  { status: 'ACTIVE', label: '진행', empty: '진행 중인 반기가 없습니다.' },
  { status: 'ENDED', label: '종료', empty: '종료된 반기가 없습니다.' },
];

interface SemesterManagementPageProps {
  /** 반기 상태·일정·명단을 바꾼 뒤 부른다. 출결 공유 데이터를 다시 읽는 데 쓴다. */
  onSemesterChanged: () => void;
}

/**
 * 반기 관리 화면. 반기는 미리 만들지 않는다.
 * "새 반기 시작"에서 저장하면 준비 반기가 되고, 명단을 확인한 뒤 활성화하면 진행 반기가 된다.
 */
export function SemesterManagementPage({ onSemesterChanged }: SemesterManagementPageProps) {
  const semestersState = useSemesters();
  const { semesters, error, reload } = semestersState;
  const [selection, setSelection] = useState<Selection>(null);
  // 저장하지 않은 입력이 있는 패널에서 다른 반기로 옮길 때도 확인한다(R12-14).
  const handleSelect = (next: Selection) => {
    if (confirmLeave()) setSelection(next);
  };

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

  const preparing = semesters.find((s) => s.status === 'PREPARING') ?? null;
  const current = semesters.find((s) => s.status === 'ACTIVE') ?? null;
  const selected =
    selection?.kind === 'semester' ? semesters.find((s) => s.semester === selection.name) : null;
  const isOpen = selection?.kind === 'new' || !!selected;

  const list = (
    <div className="space-y-2">
      <div className={TITLE_ROW_CLASS}>
        {TITLE}
        <CreateButton
          label="새 반기 시작"
          disabled={!!preparing}
          title={
            preparing
              ? `준비 중인 ${preparing.semester}을 활성화하거나 삭제한 뒤 만드세요.`
              : undefined
          }
          className="disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => handleSelect({ kind: 'new' })}
        />
      </div>
      {GROUPS.map((group) => {
        const items = semesters.filter((s) => s.status === group.status);
        return (
          <div key={group.status} className="space-y-2">
            <p className={LIST_SECTION_TITLE}>{group.label}</p>
            {items.length === 0 ? (
              <p className="px-1 text-xs text-slate-500">{group.empty}</p>
            ) : (
              items.map((s) => (
                <SplitListItem
                  key={s.semester}
                  label={`${s.semester}  ${s.startDate} ~ ${s.endDate}`}
                  isSelected={selected?.semester === s.semester}
                  onSelect={() => handleSelect({ kind: 'semester', name: s.semester })}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <SplitView
      listLabel="반기 목록"
      list={list}
      isOpen={isOpen}
      panelTitle={selection?.kind === 'new' ? '새 반기 시작' : (selected?.semester ?? '')}
      onClose={() => handleSelect(null)}
    >
      {selection?.kind === 'new' && (
        <NewSemesterPanel
          latestCohort={Math.max(0, ...semesters.map((s) => s.cohort))}
          existingNames={semesters.map((s) => s.semester)}
          prepare={semestersState.prepare}
          onCancel={() => handleSelect(null)}
          onPrepared={(name) => setSelection({ kind: 'semester', name })}
        />
      )}
      {selected && (
        <ExistingSemesterPanel
          key={selected.semester}
          semester={selected}
          currentName={current?.semester ?? null}
          activate={semestersState.activate}
          remove={semestersState.remove}
          onChanged={onSemesterChanged}
          onRemoved={() => setSelection(null)}
        />
      )}
    </SplitView>
  );
}
