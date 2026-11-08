import type { SemesterDto } from '@/entities/cohort/model/dto';
import { FIELD_TEXT_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { useExistingSemester } from '../model/useExistingSemester';
import { RosterSection } from './RosterSection';
import { ScheduleSections } from './ScheduleSections';
import { SemesterCalendar } from './SemesterCalendar';
import { SemesterSummaryTable } from './SemesterSummaryTable';
import { LabeledRow, READONLY_VALUE, SectionBox } from './SectionBox';

/** 상태는 출결 화면의 "제출 완료"처럼 배지 없이 글자로만 보여 준다. 진행 중인 반기만 진하게. */
const STATUS_TEXT: Record<SemesterDto['status'], { label: string; className: string }> = {
  PREPARING: { label: '진행 예정', className: 'text-sm font-normal text-slate-700' },
  ACTIVE: { label: '진행 중', className: 'text-sm font-semibold text-slate-900' },
  ENDED: { label: '종료', className: 'text-sm font-normal text-slate-500' },
};
const ERROR_BOX = 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600';

interface ExistingSemesterPanelProps {
  semester: SemesterDto;
  /** 상태·일정·명단을 바꾼 뒤 부른다. */
  onChanged: () => void;
  /** 진행 예정 반기를 활성화한다. 진행 예정 반기에만 준다. */
  onActivate?: () => void;
  isActivating?: boolean;
}

/** 등록된 반기 한 개. 상태·일정·명단을 보여 주고, 처리는 useExistingSemester가 맡는다. */
export function ExistingSemesterPanel(props: ExistingSemesterPanelProps) {
  const { semester, onActivate, isActivating = false } = props;
  const view = useExistingSemester(props);
  const status = STATUS_TEXT[semester.status];

  return (
    <div className="space-y-4">
      {/* 반기 이름은 패널 제목으로만 보인다. 고칠 수 없는 반기는 기수·일정을 표 하나로 보인다(상태 글자는 두지 않는다). */}
      {view.isScheduleLocked ? (
        // 요약 표 옆에 달력을 두어 스크롤하지 않고 함께 보이게 한다. 좁은 폭에서는 위아래로 쌓는다.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
          <SemesterSummaryTable semester={semester} form={view.form} />
          {view.form && <SemesterCalendar form={view.form} />}
        </div>
      ) : (
        <>
          <SectionBox title="기본">
            <div>
              <LabeledRow label="상태">
                <span className={`${READONLY_VALUE} ${status.className}`}>{status.label}</span>
                {onActivate && (
                  // 저장하지 않은 일정·명단이 있으면 먼저 저장하게 한다(활성화는 저장된 명단으로 한다).
                  <button
                    type="button"
                    className={`${MODAL_CONFIRM_BTN} ml-auto`}
                    disabled={isActivating || view.isDirty || view.pending !== null}
                    onClick={onActivate}
                  >
                    {isActivating ? '활성화하는 중' : '활성화'}
                  </button>
                )}
              </LabeledRow>
            </div>
          </SectionBox>

          <SectionBox title="기수 지정">
            {/* BASE·ADV를 한 줄에 나란히 둔다. */}
            <div className="flex flex-wrap gap-x-8">
              {(
                [
                  ['BASE', semester.cohort],
                  ['ADV', semester.advTerm],
                ] as const
              )
                // 정해지지 않은 기수(ADV 기수가 없는 반기 등)는 그리지 않는다.
                .filter(([, term]) => term !== null)
                .map(([label, term]) => (
                  <LabeledRow key={label} label={label}>
                    <span className={READONLY_VALUE}>{term === null ? '-' : `${term}기`}</span>
                  </LabeledRow>
                ))}
            </div>
          </SectionBox>
        </>
      )}

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
            isLocked={view.isScheduleLocked}
            errors={view.scheduleErrors}
            onBlurField={view.handleBlurScheduleField}
          />
          {!view.isScheduleLocked && (
            <div className="flex items-center justify-end gap-3">
              {/* 오류가 있으면 누를 때 오류 칸을 보이고 첫 오류 칸으로 포커스를 옮긴다. */}
              <button
                type="button"
                className={MODAL_CONFIRM_BTN}
                disabled={!view.isScheduleDirty || view.pending !== null}
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
          onAdd={view.handleAddMembers}
          onRemoveAdded={view.handleRemoveAdded}
          onSave={view.handleSaveRoster}
        />
      )}
    </div>
  );
}
