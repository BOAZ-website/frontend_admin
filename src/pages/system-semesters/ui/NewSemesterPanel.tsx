import type { StartSemesterRequest, SemesterDto } from '@/entities/cohort/model/dto';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { FIELD_INPUT, MODAL_CANCEL_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { errorIdOf, scheduleFieldId } from '../model/scheduleForm';
import { useNewSemesterForm } from '../model/useNewSemesterForm';
import type { SemesterDraft } from '../model/semesterDraft';
import { RosterConfirmDialog } from './RosterConfirmDialog';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

const NAME_ID = scheduleFieldId('name');

interface NewSemesterPanelProps {
  /** 임시 저장해 둔 입력. */
  initialDraft: SemesterDraft;
  /** 입력이 바뀔 때마다 부른다(임시 저장). */
  onDraftChange: (draft: SemesterDraft) => void;
  /** 임시 저장에 실패했다(저장소가 꽉 찼거나 쓸 수 없음). 화면을 떠나면 입력이 사라진다. */
  isDraftUnsaved: boolean;
  existingNames: readonly string[];
  /** 지금 진행 중인 반기 이름. 시작하면 이 반기가 종료된다. 없으면 null. */
  currentName: string | null;
  start: (request: StartSemesterRequest) => Promise<SemesterDto>;
  onStarted: (semester: string) => void;
  onCancel: () => void;
}

/** 새 반기 작성(입력은 임시 저장). 저장을 누르면 명단 확인 창이 뜨고, 확인하면 바로 진행 반기가 된다. */
export function NewSemesterPanel({ onCancel, isDraftUnsaved, ...options }: NewSemesterPanelProps) {
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

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        {isDraftUnsaved && (
          <p role="status" className="mr-auto text-xs text-red-600">
            임시 저장하지 못했습니다. 이 화면을 떠나면 입력이 사라집니다
          </p>
        )}
        <button type="button" className={MODAL_CANCEL_BTN} onClick={onCancel}>
          닫기
        </button>
        <button
          type="button"
          className={MODAL_CONFIRM_BTN}
          // 입력 오류는 누르면 칸 아래에 보이고 첫 오류 칸으로 포커스가 옮겨 간다.
          disabled={form.isSaving}
          onClick={form.handleSave}
        >
          저장
        </button>
      </div>

      {form.isRosterOpen && (
        <RosterConfirmDialog
          semesterName={form.draftName}
          terms={form.rosterTerms}
          kindOf={form.kindOf}
          isSaving={form.isSaving}
          onCancel={form.handleCloseRoster}
          onConfirm={form.handleStart}
        />
      )}
    </div>
  );
}
