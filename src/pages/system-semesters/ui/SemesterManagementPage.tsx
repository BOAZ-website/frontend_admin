import { useCallback, useState } from 'react';

import { useMyRole } from '@/entities/admin-account/model/useMyRole';
import type { SemesterDto } from '@/entities/cohort/model/dto';
import { useSemesters } from '@/entities/cohort/model/useSemesters';
import { PAGE_LABELS } from '@/shared/config/pageLabels';
import { confirmLeave } from '@/shared/lib/leaveGuard';
import { CreateButton } from '@/shared/ui/CreateButton';
import { SplitListItem, SplitView } from '@/shared/ui/SplitView';
import { LIST_SECTION_TITLE } from '@/shared/ui/systemStyles';
import { PageLoadingState } from '@/widgets/page-loading/ui/PageLoadingState';

import { confirmAndRemoveSemester } from '../model/removeSemester';
import {
  clearSemesterDraft,
  loadSemesterDraft,
  saveSemesterDraft,
  type SemesterDraft,
} from '../model/semesterDraft';
import { emptySemesterDraft } from '../model/useNewSemesterForm';
import { ExistingSemesterPanel } from './ExistingSemesterPanel';
import { NewSemesterPanel } from './NewSemesterPanel';

/** 선택 상태: 예정(임시 저장한 새 반기), 이름이 있는 반기, 또는 없음. */
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
 * 반기 관리 화면. "새 반기 시작"을 누르면 목록 맨 위 "예정"에 새 반기가 생기고 입력은 이 브라우저에 임시 저장된다.
 * 저장 → 명단 확인 → 시작하면 바로 진행 반기가 되고, 이전 진행 반기는 종료된다. 화면에 들어오면 진행 반기를 열어 둔다.
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
  // 임시 저장한 새 반기(목록의 "예정"). 입력이 바뀔 때마다 저장한다.
  const [draft, setDraft] = useState<SemesterDraft | null>(loadSemesterDraft);
  const [isDraftUnsaved, setIsDraftUnsaved] = useState(false);
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
  const handleNew = () => {
    if (!draft)
      handleDraftChange(emptySemesterDraft(Math.max(0, ...semesters.map((s) => s.cohort))));
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
  const canEditArchived = myRole === 'MASTER';
  const handleRemove = async (name: string) => {
    if (!(await confirmAndRemoveSemester(name, semestersState.remove))) return;
    onSemesterChanged();
    // 지운 반기를 열어 두고 있었으면 닫는다(처음 상태로 돌아가 진행 반기가 열린다).
    if (selection?.kind === 'semester' && selection.name === name) setSelection(undefined);
  };
  const selection: Selection =
    chosen !== undefined ? chosen : current && { kind: 'semester', name: current.semester };
  const selected =
    selection?.kind === 'semester' ? semesters.find((s) => s.semester === selection.name) : null;
  const isOpen = selection?.kind === 'new' || !!selected;

  const list = (
    <div className="space-y-2">
      {draft && (
        <div className="space-y-2">
          <p className={LIST_SECTION_TITLE}>예정</p>
          <SplitListItem
            label={draft.name || '새 반기'}
            isSelected={selection?.kind === 'new'}
            onSelect={() => handleSelect({ kind: 'new' })}
            onDelete={handleRemoveDraft}
          />
        </div>
      )}
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
                  // 종료 반기는 서비스운영팀장만 지운다(서버도 409 SEMESTER_ARCHIVED). 진행 반기는 지울 수 없다.
                  onDelete={
                    s.status === 'ENDED' && canEditArchived
                      ? () => void handleRemove(s.semester)
                      : undefined
                  }
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
        <CreateButton label="새 반기 시작" onClick={handleNew} />
      </div>
      <SplitView
        listLabel="반기 목록"
        list={list}
        isOpen={isOpen}
        panelTitle={
          selection?.kind === 'new' ? draft?.name || '새 반기' : (selected?.semester ?? '')
        }
        onClose={() => handleSelect(null)}
      >
        {selection?.kind === 'new' && draft && (
          <NewSemesterPanel
            initialDraft={draft}
            onDraftChange={handleDraftChange}
            isDraftUnsaved={isDraftUnsaved}
            existingNames={semesters.map((s) => s.semester)}
            currentName={current?.semester ?? null}
            start={semestersState.start}
            onCancel={() => handleSelect(null)}
            onStarted={(name) => {
              forgetDraft();
              onSemesterChanged();
              setSelection({ kind: 'semester', name });
            }}
          />
        )}
        {selected && (
          <ExistingSemesterPanel
            key={selected.semester}
            semester={selected}
            canEditArchived={canEditArchived}
            onChanged={onSemesterChanged}
          />
        )}
      </SplitView>
    </div>
  );
}
