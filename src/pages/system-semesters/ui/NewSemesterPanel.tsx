import type {
  PrepareSemesterRequest,
  SemesterDto,
  SemesterRosterDto,
} from '@/entities/cohort/model/dto';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { FIELD_INPUT, MODAL_CANCEL_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { errorIdOf, scheduleFieldId } from '../model/scheduleForm';
import { useNewSemesterForm } from '../model/useNewSemesterForm';
import { RosterSection } from './RosterSection';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

const NAME_ID = scheduleFieldId('name');

interface NewSemesterPanelProps {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  preview: (request: PrepareSemesterRequest) => Promise<SemesterRosterDto>;
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onPrepared: (semester: string) => void;
  onCancel: () => void;
}

/** 새 반기 작성. 명단을 확인(저장하지 않음)하고 예외를 고친 뒤 만들면 준비 반기가 된다. */
export function NewSemesterPanel({ onCancel, ...options }: NewSemesterPanelProps) {
  const form = useNewSemesterForm(options);
  const nameError = form.shownErrors.name;
  const nameErrorId = nameError ? errorIdOf(NAME_ID) : undefined;

  return (
    <div className="space-y-4">
      <SectionBox title="기본">
        <div className="space-y-4">
          <LabeledRow label="반기 이름" error={nameError} errorId={nameErrorId}>
            <input
              id={NAME_ID}
              value={form.draftName}
              onChange={(event) => form.handleChangeName(event.target.value)}
              onBlur={() => form.handleBlurField('name')}
              aria-label="반기 이름"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameErrorId}
              placeholder="26-2"
              maxLength={5}
              disabled={form.isSaving}
              className={`${FIELD_INPUT} ${nameError ? 'border-red-400' : ''}`}
            />
          </LabeledRow>
          <LabeledRow label="상태">
            <span className="text-xs text-slate-500">
              반기 만들기를 누르면 준비 상태의 반기가 만들어집니다.
            </span>
          </LabeledRow>
        </div>
      </SectionBox>

      <SectionBox title="기수 지정">
        <div className="space-y-4">
          <LabeledRow label="BASE 기수">
            <SelectDropdown
              ariaLabel="BASE 기수"
              value={String(form.draftBaseTerm)}
              options={form.baseOptions}
              buttonClassName="h-10 w-40 text-left"
              onChange={(value) => form.handleChangeBaseTerm(Number(value))}
            />
          </LabeledRow>
          <LabeledRow label="ADV 기수">
            <SelectDropdown
              ariaLabel="ADV 기수"
              value={String(form.draftAdvTerm)}
              options={form.advOptions}
              buttonClassName="h-10 w-40 text-left"
              onChange={(value) => form.handleChangeAdvTerm(Number(value))}
            />
          </LabeledRow>
        </div>
      </SectionBox>

      <ScheduleSections
        form={form.draftForm}
        onChange={form.handleChangeSchedule}
        isReadOnly={form.isSaving}
        errors={form.shownErrors}
        onBlurField={form.handleBlurField}
      />

      {form.checkedMembers ? (
        <RosterSection
          saved={form.checkedMembers}
          excludedIds={form.excludedIds}
          added={form.added}
          kindOf={form.kindOf}
          isReadOnly={false}
          isSaving={form.isSaving}
          onToggleExcluded={form.handleToggleExcluded}
          onAdd={form.handleAddMember}
          onRemoveAdded={form.handleRemoveAdded}
        />
      ) : (
        <SectionBox title="명단">
          <div className="flex flex-wrap items-center gap-3">
            <p className="mr-auto text-xs text-slate-500">
              BASE·ADV 기수의 활동 중 회원으로 만들 명단을 먼저 확인합니다. 아직 저장하지 않습니다.
            </p>
            <button
              type="button"
              className={MODAL_CANCEL_BTN}
              disabled={form.isChecking || form.isSaving}
              onClick={form.handleCheckRoster}
            >
              {form.isChecking ? '확인 중' : '명단 확인'}
            </button>
          </div>
          {form.isCheckStale && !form.checkError && (
            <p role="status" className="mt-2 text-xs text-slate-500">
              입력이 바뀌었습니다. 다시 확인하세요
            </p>
          )}
          {form.checkError && (
            <p role="status" className="mt-2 text-xs text-red-600">
              {form.checkError}
            </p>
          )}
        </SectionBox>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {!form.checkedMembers && (
          <p className="mr-auto text-xs text-slate-500">명단 확인 후 만들 수 있습니다</p>
        )}
        <button type="button" className={MODAL_CANCEL_BTN} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className={MODAL_CONFIRM_BTN}
          // 입력 오류는 누르면 칸 아래에 보이고 첫 오류 칸으로 포커스가 옮겨 간다.
          disabled={!form.checkedMembers || form.isSaving}
          onClick={form.handleSave}
        >
          {form.isSaving ? '만드는 중' : '반기 만들기'}
        </button>
      </div>
    </div>
  );
}
