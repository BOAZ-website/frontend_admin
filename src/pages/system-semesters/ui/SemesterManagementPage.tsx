import { useState } from 'react';

import { useMyRole } from '@/entities/admin-account/model/useMyRole';
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

/** 목록 묶음: 진행 → 종료 순. */
const GROUPS: readonly { status: SemesterDto['status']; label: string; empty: string }[] = [
  { status: 'ACTIVE', label: '진행', empty: '진행 중인 반기가 없습니다.' },
  { status: 'ENDED', label: '종료', empty: '종료된 반기가 없습니다.' },
];

interface SemesterManagementPageProps {
  /** 반기 상태·일정·명단을 바꾼 뒤 부른다. 출결 공유 데이터를 다시 읽는 데 쓴다. */
  onSemesterChanged: () => void;
}

/**
 * 반기 관리 화면. 반기는 미리 만들지 않는다.
 * "새 반기 시작"에서 명단을 고르고 시작하면 바로 진행 반기가 되고, 이전 진행 반기는 종료된다.
 * 화면에 들어오면 진행 반기를 열어 둔다.
 */
export function SemesterManagementPage({ onSemesterChanged }: SemesterManagementPageProps) {
  const semestersState = useSemesters();
  const myRole = useMyRole();
  const { semesters, error, reload } = semestersState;
  // undefined는 아직 아무것도 고르지 않은 처음 상태다. 이때는 진행 반기를 열어 둔다.
  const [chosen, setSelection] = useState<Selection | undefined>(undefined);
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

  const current = semesters.find((s) => s.status === 'ACTIVE') ?? null;
  const selection: Selection =
    chosen !== undefined ? chosen : current && { kind: 'semester', name: current.semester };
  const selected =
    selection?.kind === 'semester' ? semesters.find((s) => s.semester === selection.name) : null;
  const isOpen = selection?.kind === 'new' || !!selected;

  const list = (
    <div className="space-y-2">
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
                  label={s.semester}
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

  // 제목 줄은 분할 화면 위에 둔다. 분할 화면 높이(100vh - 11rem)가 위 제목 줄을 빼고 계산되어 있다(감사 로그 화면과 같다).
  return (
    <div className="space-y-6">
      <div className={TITLE_ROW_CLASS}>
        {TITLE}
        <CreateButton label="새 반기 시작" onClick={() => handleSelect({ kind: 'new' })} />
      </div>
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
            currentName={current?.semester ?? null}
            start={semestersState.start}
            onCancel={() => handleSelect(null)}
            onStarted={(name) => setSelection({ kind: 'semester', name })}
          />
        )}
        {selected && (
          <ExistingSemesterPanel
            key={selected.semester}
            semester={selected}
            remove={semestersState.remove}
            canEditArchived={myRole === 'MASTER'}
            onChanged={onSemesterChanged}
            onRemoved={() => setSelection(null)}
          />
        )}
      </SplitView>
    </div>
  );
}
