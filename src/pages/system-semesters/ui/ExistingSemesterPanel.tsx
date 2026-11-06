import type { SemesterDto } from '@/entities/cohort/model/dto';
import {
  FIELD_READONLY,
  FIELD_TEXT_BTN,
  MODAL_CANCEL_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

import { useExistingSemester } from '../model/useExistingSemester';
import { RosterSection } from './RosterSection';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

/** 상태는 출결 화면의 "제출 완료"처럼 배지 없이 글자로만 보여 준다. 진행 중인 반기만 진하게. */
const STATUS_TEXT: Record<SemesterDto['status'], { label: string; className: string }> = {
  PREPARING: { label: '준비', className: 'text-xs font-semibold text-slate-700' },
  ACTIVE: { label: '진행 중', className: 'text-xs font-semibold text-slate-900' },
  ENDED: { label: '종료', className: 'text-xs font-normal text-slate-500' },
};
const ERROR_BOX = 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600';

type SemesterAction = (semester: string) => Promise<SemesterDto>;

interface ExistingSemesterPanelProps {
  semester: SemesterDto;
  /** 지금 진행 중인 반기 이름. 없으면 null. */
  currentName: string | null;
  activate: SemesterAction;
  remove: (semester: string, isForced?: boolean) => Promise<SemesterDto>;
  /** 로그인한 계정이 서비스운영팀장(MASTER)이다. 종료 반기의 편집·삭제를 연다. */
  canEditArchived: boolean;
  /** 상태·일정·명단을 바꾼 뒤 부른다. */
  onChanged: () => void;
  onRemoved: () => void;
}

/** 등록된 반기 한 개. 상태·일정·명단을 보여 주고, 처리는 useExistingSemester가 맡는다. */
export function ExistingSemesterPanel(props: ExistingSemesterPanelProps) {
  const { semester, currentName } = props;
  const view = useExistingSemester(props);
  const isPreparing = semester.status === 'PREPARING';
  const status = STATUS_TEXT[semester.status];

  return (
    <div className="space-y-4">
      <SectionBox title="기본">
        <div className="space-y-4">
          <LabeledRow label="반기 이름">
            <span className="text-sm font-bold text-slate-900">{semester.semester}</span>
          </LabeledRow>
          <LabeledRow label="상태">
            <span className={status.className}>{status.label}</span>
            {isPreparing && (
              <button
                type="button"
                className={`${MODAL_CONFIRM_BTN} ml-auto`}
                disabled={view.pending !== null || view.activateBlock !== null}
                title={view.activateBlock ?? undefined}
                onClick={view.handleActivate}
              >
                활성화
              </button>
            )}
            {view.canRemove && (
              <button
                type="button"
                className={`${MODAL_CANCEL_BTN} ${isPreparing ? '' : 'ml-auto'}`}
                disabled={view.pending !== null}
                onClick={view.handleRemove}
              >
                삭제
              </button>
            )}
          </LabeledRow>
          {isPreparing && view.activateBlock && (
            <div role="status" className="space-y-2">
              <p className="text-xs text-red-600">{view.activateBlock}</p>
              {!view.isDirty && view.openWeeks.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {view.openWeeks.map((week) => (
                    <button
                      key={week.weekNum}
                      type="button"
                      className={MODAL_CONFIRM_BTN}
                      disabled={view.pending !== null}
                      onClick={() => view.handleCloseWeek(week)}
                    >
                      {currentName} {week.label} 마감
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {isPreparing && view.currentWeeksError && (
            <p role="status" className="text-xs text-red-600">
              {currentName}의 주차 상태를 불러오지 못했습니다.{' '}
              <button type="button" className={FIELD_TEXT_BTN} onClick={view.reloadCurrentWeeks}>
                다시 불러오기
              </button>
            </p>
          )}
          {semester.status === 'ACTIVE' && (
            <p className="text-xs text-slate-500">다음 반기를 활성화하면 종료됩니다.</p>
          )}
          {semester.status === 'ENDED' && (
            <p className="text-xs text-slate-500">
              {view.isArchivedEditable
                ? '종료된 반기입니다. 일정·휴강·명단을 고치면 지난 반기 점수 계산에 영향을 줄 수 있습니다.'
                : '종료된 반기는 조회만 됩니다. 수정·삭제는 서비스운영팀장만 할 수 있습니다.'}
            </p>
          )}
        </div>
      </SectionBox>

      <SectionBox title="기수 지정">
        <div className="space-y-4">
          {(
            [
              ['BASE 기수', semester.cohort],
              ['ADV 기수', semester.advTerm],
            ] as const
          ).map(([label, term]) => (
            <LabeledRow key={label} label={label}>
              <span className={`${FIELD_READONLY} w-40`}>{term === null ? '-' : `${term}기`}</span>
            </LabeledRow>
          ))}
        </div>
      </SectionBox>

      {/* 다시 읽기에 실패해도 이전 값은 그대로 보여 주고, 실패했다는 안내를 함께 둔다(R10-5). */}
      {view.scheduleError && (
        <p role="status" className={ERROR_BOX}>
          일정을 불러오지 못했습니다.{' '}
          <button type="button" className={FIELD_TEXT_BTN} onClick={view.reloadSchedule}>
            다시 불러오기
          </button>
        </p>
      )}
      {!view.form ? (
        !view.scheduleError && (
          <p role="status" className="text-xs text-slate-500">
            일정을 불러오는 중입니다.
          </p>
        )
      ) : (
        <>
          <ScheduleSections
            form={view.form}
            onChange={view.handleChangeSchedule}
            isReadOnly={view.isScheduleReadOnly}
          />
          {!view.isScheduleLocked && (
            <div className="flex items-center justify-end gap-3">
              {view.scheduleErrors.length > 0 && (
                <p role="status" className="mr-auto text-xs text-red-600">
                  {view.scheduleErrors[0]}
                </p>
              )}
              <button
                type="button"
                className={MODAL_CONFIRM_BTN}
                disabled={
                  !view.isScheduleDirty || view.scheduleErrors.length > 0 || view.pending !== null
                }
                onClick={view.handleSaveSchedule}
              >
                {view.pending === 'schedule' ? '저장 중' : '일정 저장'}
              </button>
            </div>
          )}
        </>
      )}

      {view.rosterError && (
        <p role="status" className={ERROR_BOX}>
          명단을 불러오지 못했습니다.{' '}
          <button type="button" className={FIELD_TEXT_BTN} onClick={view.reloadRoster}>
            다시 불러오기
          </button>
        </p>
      )}
      {!view.savedMembers ? (
        !view.rosterError && (
          <p role="status" className="text-xs text-slate-500">
            명단을 불러오는 중입니다.
          </p>
        )
      ) : (
        <RosterSection
          saved={view.savedMembers}
          excludedIds={view.excludedIds}
          added={view.added}
          kindOf={view.kindOf}
          isReadOnly={view.isRosterReadOnly}
          isSaving={view.pending === 'roster'}
          onToggleExcluded={view.handleToggleExcluded}
          onAdd={view.handleAddMember}
          onRemoveAdded={view.handleRemoveAdded}
          onSave={view.handleSaveRoster}
        />
      )}
    </div>
  );
}
