import type { StartSemesterRequest, SemesterDto } from '@/entities/cohort/model/dto';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { FIELD_INPUT, MODAL_CANCEL_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { errorIdOf, scheduleFieldId } from '../model/scheduleForm';
import { useNewSemesterForm } from '../model/useNewSemesterForm';
import { RosterSection } from './RosterSection';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

const NAME_ID = scheduleFieldId('name');
/** 새 반기에는 저장된 명단이 없어 뺄 사람도 없다. */
const NO_IDS: ReadonlySet<string> = new Set();

interface NewSemesterPanelProps {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  /** 지금 진행 중인 반기 이름. 시작하면 이 반기가 종료된다. 없으면 null. */
  currentName: string | null;
  start: (request: StartSemesterRequest) => Promise<SemesterDto>;
  onStarted: (semester: string) => void;
  onCancel: () => void;
}

/** 새 반기 작성. 명단에 사람을 고르고 시작하면 바로 진행 반기가 된다(이전 진행 반기는 종료). */
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

      <RosterSection
        saved={[]}
        excludedIds={NO_IDS}
        added={form.members}
        kindOf={form.kindOf}
        isReadOnly={false}
        isSaving={form.isSaving}
        onToggleExcluded={() => undefined}
        onAdd={form.handleAddMembers}
        onRemoveAdded={form.handleRemoveMember}
      />

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {form.members.length === 0 && (
          <p className="mr-auto text-xs text-slate-500">명단에 사람을 더하면 시작할 수 있습니다</p>
        )}
        <button type="button" className={MODAL_CANCEL_BTN} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className={MODAL_CONFIRM_BTN}
          // 입력 오류는 누르면 칸 아래에 보이고 첫 오류 칸으로 포커스가 옮겨 간다.
          disabled={form.isSaving || form.members.length === 0}
          onClick={form.handleSave}
        >
          {form.isSaving ? '시작하는 중' : '반기 시작'}
        </button>
      </div>
    </div>
  );
}
