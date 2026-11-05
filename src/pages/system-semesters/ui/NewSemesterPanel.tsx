import type { PrepareSemesterRequest, SemesterDto } from '@/entities/cohort/model/dto';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import { FIELD_INPUT, MODAL_CANCEL_BTN, MODAL_CONFIRM_BTN } from '@/shared/ui/systemStyles';

import { useNewSemesterForm } from '../model/useNewSemesterForm';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

interface NewSemesterPanelProps {
  /** 지금까지 등록된 반기 중 가장 큰 기수. 새 BASE 기수는 이보다 커야 한다. */
  latestCohort: number;
  existingNames: readonly string[];
  prepare: (request: PrepareSemesterRequest) => Promise<SemesterDto>;
  onPrepared: (semester: string) => void;
  onCancel: () => void;
}

/** 새 반기 작성. 저장하면 준비 반기가 되고, 서버가 BASE·ADV 기수로 명단을 자동으로 만든다. */
export function NewSemesterPanel({ onCancel, ...options }: NewSemesterPanelProps) {
  const form = useNewSemesterForm(options);

  return (
    <div className="space-y-4">
      <SectionBox title="기본">
        <div className="space-y-4">
          <LabeledRow label="반기 이름">
            <input
              value={form.draftName}
              onChange={(event) => form.handleChangeName(event.target.value)}
              aria-label="반기 이름"
              placeholder="26-2"
              maxLength={5}
              disabled={form.isSaving}
              className={FIELD_INPUT}
            />
          </LabeledRow>
          <LabeledRow label="상태">
            <span className="text-xs text-slate-500">저장하면 준비 상태가 됩니다.</span>
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
      />

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-4">
        <p
          role="status"
          className={`mr-auto text-xs ${form.errors.length ? 'text-red-600' : 'text-slate-500'}`}
        >
          {form.errors[0] ??
            '저장하면 BASE·ADV 기수의 활동 중 회원으로 명단을 만듭니다. 명단을 확인한 뒤 활성화하세요.'}
        </p>
        <button type="button" className={MODAL_CANCEL_BTN} onClick={onCancel}>
          취소
        </button>
        <button
          type="button"
          className={MODAL_CONFIRM_BTN}
          disabled={form.errors.length > 0 || form.isSaving}
          onClick={form.handleSave}
        >
          {form.isSaving ? '저장 중' : '저장'}
        </button>
      </div>
    </div>
  );
}
