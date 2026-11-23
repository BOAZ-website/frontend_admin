import type { SeasonInput } from '@/entities/cohort/model/season';
import { MAX_VOID_WEEKS_BEFORE_CONFIRM } from '@/entities/cohort/model/schedule';
import { useScoreRuleSets } from '@/entities/cohort/model/useScoreRuleSets';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import {
  FIELD_INPUT,
  FIELD_TEXT_BTN,
  MODAL_CANCEL_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

import { errorIdOf, scheduleFieldId, SEMESTER_HALF_OPTIONS } from '../model/scheduleForm';
import { useNewSemesterForm } from '../model/useNewSemesterForm';
import type { SemesterDraft } from '../model/semesterDraft';
import { RosterConfirmDialog } from './RosterConfirmDialog';
import { ScheduleSections } from './ScheduleSections';
import { LabeledRow, SectionBox } from './SectionBox';

const NAME_ID = scheduleFieldId('name');
const HALF_ID = scheduleFieldId('half');
const RULE_ID = scheduleFieldId('scoreRule');

interface NewSemesterPanelProps {
  /** 임시 저장해 둔 입력. */
  initialDraft: SemesterDraft;
  /** 입력이 바뀔 때마다 부른다(임시 저장). */
  onDraftChange: (draft: SemesterDraft) => void;
  /** 임시 저장에 실패했다(저장소가 꽉 찼거나 쓸 수 없음). 화면을 떠나면 입력이 사라진다. */
  isDraftUnsaved: boolean;
  existingNames: readonly string[];
  create: (input: SeasonInput & { scoreRuleSetId: number }) => Promise<{ id: number }>;
  onApplied: (seasonId: number) => void;
  onCancel: () => void;
}

/** 새 반기 작성(입력은 임시 저장). 적용을 누르면 명단 확인 창이 뜨고, 확인하면 진행 예정 반기가 된다(활성화는 따로). */
export function NewSemesterPanel({ onCancel, isDraftUnsaved, ...options }: NewSemesterPanelProps) {
  const form = useNewSemesterForm(options);
  const nameError = form.shownErrors.name;
  const nameErrorId = nameError ? errorIdOf(NAME_ID) : undefined;
  const halfError = form.shownErrors.half;
  const halfErrorId = halfError ? errorIdOf(HALF_ID) : undefined;
  const ruleError = form.shownErrors.scoreRule;
  const ruleErrorId = ruleError ? errorIdOf(RULE_ID) : undefined;
  const ruleSets = useScoreRuleSets();

  return (
    <div className="space-y-6">
      <SectionBox title="기본">
        <div className="space-y-2">
          <LabeledRow label="반기" error={nameError} errorId={nameErrorId}>
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
          <LabeledRow label="상·하반기" error={halfError} errorId={halfErrorId}>
            {/* 드롭다운은 입력칸이 없어 감싼 칸에 id를 두고, 첫 오류 칸 포커스는 그 안의 버튼으로 간다. */}
            <div id={HALF_ID} aria-describedby={halfErrorId}>
              <SelectDropdown
                ariaLabel="상반기·하반기"
                value={form.draftHalf}
                // 고르기 전에만 「선택」을 둔다. 한 번 고르면 다시 비울 수 없다.
                options={
                  form.draftHalf
                    ? SEMESTER_HALF_OPTIONS
                    : [{ value: '', label: '선택' }, ...SEMESTER_HALF_OPTIONS]
                }
                buttonClassName={`h-10 w-40 text-left ${halfError ? 'border-red-400' : ''}`}
                onChange={(value) => {
                  if (value) form.handleChangeHalf(value);
                  form.handleBlurField('half');
                }}
              />
            </div>
          </LabeledRow>
          <LabeledRow label="점수 규칙" error={ruleError} errorId={ruleErrorId}>
            <div id={RULE_ID} aria-describedby={ruleErrorId}>
              <SelectDropdown
                ariaLabel="점수 규칙 버전"
                value={String(form.draftScoreRuleSetId ?? '')}
                // 고르기 전에만 「선택」을 둔다.
                options={[
                  ...(form.draftScoreRuleSetId === null ? [{ value: '', label: '선택' }] : []),
                  ...(ruleSets.data ?? []).map((rule) => ({
                    value: String(rule.id),
                    label: rule.name,
                  })),
                ]}
                buttonClassName={`h-10 w-40 text-left ${ruleError ? 'border-red-400' : ''}`}
                onChange={(value) => {
                  if (value) form.handleChangeScoreRuleSet(Number(value));
                  form.handleBlurField('scoreRule');
                }}
              />
            </div>
            {ruleSets.error && (
              <span role="status" className="text-xs text-red-600">
                점수 규칙을 불러오지 못했습니다.{' '}
                <button type="button" className={FIELD_TEXT_BTN} onClick={ruleSets.reload}>
                  다시 불러오기
                </button>
              </span>
            )}
          </LabeledRow>
        </div>
      </SectionBox>

      <SectionBox title="기수 지정">
        <div className="space-y-2">
          <LabeledRow label="BASE">
            <SelectDropdown
              ariaLabel="BASE 기수"
              value={String(form.draftBaseTerm)}
              options={form.baseOptions}
              buttonClassName="h-10 w-40 text-left"
              onChange={(value) => form.handleChangeBaseTerm(Number(value))}
            />
          </LabeledRow>
          <LabeledRow label="ADV">
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
        voidWeekLimit={MAX_VOID_WEEKS_BEFORE_CONFIRM}
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
          적용
        </button>
      </div>

      {form.seasonInput && (
        <RosterConfirmDialog
          input={form.seasonInput}
          kindOf={form.kindOf}
          isSaving={form.isSaving}
          onCancel={form.handleCloseRoster}
          onConfirm={form.handleApply}
        />
      )}
    </div>
  );
}
