import { useState } from 'react';

import type { Season } from '@/entities/cohort/model/season';
import { useScoreRuleSets } from '@/entities/cohort/model/useScoreRuleSets';
import { SelectDropdown } from '@/shared/ui/SelectDropdown';
import {
  FIELD_INPUT,
  FIELD_TEXT_BTN,
  MODAL_CANCEL_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

import { commonWeeksOfForm, SEMESTER_HALF_OPTIONS, voidWeekOptionsOf } from '../model/scheduleForm';
import { MAX_VOID_WEEKS, useExistingSemester } from '../model/useExistingSemester';
import { RosterSection } from './RosterSection';
import { ScheduleSections } from './ScheduleSections';
import { SemesterCalendar } from './SemesterCalendar';
import { SemesterSummaryTable } from './SemesterSummaryTable';
import { LabeledRow, READONLY_VALUE, SectionBox } from './SectionBox';
import { VoidWeekPicker } from './VoidWeekPicker';

/** 상태는 출결 화면의 "제출 완료"처럼 배지 없이 글자로만 보여 준다. 진행 중인 반기만 진하게. */
const STATUS_TEXT: Record<Season['status'], { label: string; className: string }> = {
  DRAFT: { label: '진행 예정', className: 'text-sm font-normal text-slate-700' },
  ACTIVE: { label: '진행 중', className: 'text-sm font-semibold text-slate-900' },
  ARCHIVED: { label: '종료', className: 'text-sm font-normal text-slate-500' },
};
/** ADV 팀장 입력 시작 주차를 비우는 선택지. 그때는 팀장 입력을 열지 않는다. */
const ENTRY_CLOSED = 'closed';
const ERROR_BOX = 'rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600';

interface ExistingSemesterPanelProps {
  season: Season;
  /** 상태·일정·명단을 바꾼 뒤 부른다. */
  onChanged: () => void;
  /** 진행 예정 반기를 활성화한다. 진행 예정 반기에만 준다. */
  onActivate?: () => void;
  isActivating?: boolean;
}

/** 등록된 반기 한 개. 상태·일정·명단을 보여 주고, 처리는 useExistingSemester가 맡는다. */
export function ExistingSemesterPanel(props: ExistingSemesterPanelProps) {
  const { season, onActivate, isActivating = false } = props;
  const view = useExistingSemester(props);
  const status = STATUS_TEXT[season.status];
  const ruleSets = useScoreRuleSets();
  const { basics } = view;
  // 휴강 주차를 고르면 달력이 그 주차의 달로 옮겨 간다. seq는 같은 달을 다시 골라도 달력을 그 달로 되돌리기 위한 값이다.
  const [calendarFocus, setCalendarFocus] = useState<{ month: string; seq: number } | null>(null);
  const handleChangeVoidWeek = (weekNo: number, isVoid: boolean) => {
    const week = view.form && commonWeeksOfForm(view.form).find((item) => item.weekNo === weekNo);
    if (week) {
      setCalendarFocus((prev) => ({
        month: week.startDate.slice(0, 7),
        seq: (prev?.seq ?? 0) + 1,
      }));
    }
    view.handleChangeVoidWeek(weekNo, isVoid);
  };

  return (
    <div className="space-y-4">
      {/* 반기 이름은 패널 제목으로만 보인다. 고칠 수 없는 반기는 기수·일정을 표 하나로 보인다(상태 글자는 두지 않는다). */}
      {view.isScheduleLocked ? (
        <>
          {/* 아래 구역 제목(「휴강 주차」·「명단」)과 같은 글자 모양으로 둔다. */}
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h4 className="text-base font-semibold text-slate-900">점수 규칙</h4>
            {view.appliedRule ? (
              // 규칙 이름을 누르면 출결 규정 관리 화면으로 간다(주소 해시로 화면을 바꾼다).
              <a
                href="#att-rules"
                className="text-sm tabular-nums text-slate-500 underline underline-offset-2 hover:text-slate-900"
              >
                {view.appliedRule.name}
              </a>
            ) : (
              <span className="text-sm text-slate-500">
                {view.appliedRuleError ? '점수 규칙을 불러오지 못했습니다.' : '불러오는 중'}
              </span>
            )}
          </div>
          {/* 요약 표 옆에 달력을 두어 스크롤하지 않고 함께 보이게 한다. 좁은 폭에서는 위아래로 쌓는다.
              화면 폭이 아니라 이 패널 폭으로 나눈다: 사이드바·반기 목록 때문에 화면이 넓어도 패널은 좁을 수 있다. */}
          <div className="@container">
            <div className="grid items-start gap-6 @min-[42rem]:grid-cols-[minmax(0,1fr)_auto]">
              <div className="min-w-0 space-y-6">
                <SemesterSummaryTable
                  season={season}
                  form={view.form}
                  // 휴강 주차를 체크하면 확인 창을 거쳐 바로 저장한다(ATT-09).
                  renderVoidCell={
                    view.form
                      ? (periodType) => (
                          <VoidWeekPicker
                            weeks={voidWeekOptionsOf(view.form!)}
                            limit={MAX_VOID_WEEKS}
                            isReadOnly={view.isVoidReadOnly}
                            onChange={handleChangeVoidWeek}
                            periodType={periodType}
                          />
                        )
                      : undefined
                  }
                />
              </div>
              {view.form && (
                <SemesterCalendar
                  key={calendarFocus?.seq ?? 0}
                  form={view.form}
                  focusMonth={calendarFocus?.month}
                />
              )}
            </div>
          </div>
        </>
      ) : (
        <>
          <SectionBox title="기본">
            <div>
              <LabeledRow label="상태">
                <span className={`${READONLY_VALUE} ${status.className}`}>{status.label}</span>
                {onActivate && (
                  // 저장하지 않은 일정·명단이 있으면 먼저 저장하게 한다(활성화는 저장된 명단으로 한다).
                  // 저장된 명단이 비었으면 끈다. 진행 반기를 종료한 뒤에야 활성화가 409 ROSTER_EMPTY로 실패하기 때문이다.
                  <button
                    type="button"
                    className={`${MODAL_CONFIRM_BTN} ml-auto`}
                    disabled={
                      isActivating ||
                      view.isDirty ||
                      view.pending !== null ||
                      !view.savedMembers?.length
                    }
                    onClick={onActivate}
                  >
                    {isActivating ? '활성화하는 중' : '활성화'}
                  </button>
                )}
              </LabeledRow>
              {basics && (
                <>
                  <LabeledRow label="반기" error={view.basicsErrors.name}>
                    <input
                      value={basics.name}
                      onChange={(event) =>
                        view.handleChangeBasics({ name: event.target.value.trim() })
                      }
                      aria-label="반기 이름"
                      maxLength={5}
                      disabled={view.pending !== null}
                      className={`${FIELD_INPUT} ${view.basicsErrors.name ? 'border-red-400' : ''}`}
                    />
                  </LabeledRow>
                  <LabeledRow label="상·하반기" error={view.basicsErrors.half}>
                    <SelectDropdown
                      ariaLabel="상반기·하반기"
                      value={basics.half}
                      options={SEMESTER_HALF_OPTIONS}
                      buttonClassName="h-10 w-40 text-left"
                      onChange={(half) => view.handleChangeBasics({ half })}
                    />
                  </LabeledRow>
                  <LabeledRow label="점수 규칙">
                    <SelectDropdown
                      ariaLabel="점수 규칙 버전"
                      value={String(basics.scoreRuleSetId ?? '')}
                      options={(ruleSets.data ?? []).map((rule) => ({
                        value: String(rule.id),
                        label: rule.name,
                      }))}
                      buttonClassName="h-10 w-40 text-left"
                      onChange={(id) => view.handleChangeBasics({ scoreRuleSetId: Number(id) })}
                    />
                    {ruleSets.error && (
                      <span role="status" className="text-xs text-red-600">
                        점수 규칙을 불러오지 못했습니다.{' '}
                        <button type="button" className={FIELD_TEXT_BTN} onClick={ruleSets.reload}>
                          다시 불러오기
                        </button>
                      </span>
                    )}
                  </LabeledRow>
                  <LabeledRow label="ADV 팀장 입력">
                    <SelectDropdown
                      ariaLabel="ADV 팀장 입력 시작 주차"
                      value={String(basics.advLeaderEntryWeekId ?? ENTRY_CLOSED)}
                      options={[
                        ...view.advEntryWeekOptions.map((week) => ({
                          value: String(week.weekId),
                          label: week.label,
                        })),
                        { value: ENTRY_CLOSED, label: '열지 않음' },
                      ]}
                      buttonClassName="h-10 w-56 text-left"
                      onChange={(value) =>
                        view.handleChangeBasics({
                          advLeaderEntryWeekId: value === ENTRY_CLOSED ? null : Number(value),
                        })
                      }
                    />
                  </LabeledRow>
                </>
              )}
            </div>
          </SectionBox>

          <SectionBox title="기수 지정">
            {/* BASE·ADV를 한 줄에 나란히 둔다. */}
            <div className="flex flex-wrap gap-x-8">
              {(
                [
                  ['BASE', season.baseTerm],
                  ['ADV', season.advTerm],
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
            onChangeVoidWeek={view.handleChangeVoidWeek}
            isVoidReadOnly={view.isVoidReadOnly}
            errors={view.scheduleErrors}
            onBlurField={view.handleBlurScheduleField}
            showVoidWeeks={!view.isScheduleLocked}
            voidWeekLimit={MAX_VOID_WEEKS}
          />
          {/* 기간·시작일은 진행 예정 반기만 고친다. 휴강은 고를 때 바로 저장하므로 이 버튼과 관계없다. */}
          {!view.isScheduleLocked && (
            <div className="flex items-center justify-end gap-3">
              {/* 오류가 있으면 누를 때 오류 칸을 보이고 첫 오류 칸으로 포커스를 옮긴다. */}
              <button
                type="button"
                className={MODAL_CONFIRM_BTN}
                disabled={!view.isScheduleDirty || view.pending !== null}
                onClick={view.handleSaveSchedule}
              >
                {view.pending === 'schedule' ? '저장 중' : '저장'}
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
          parallelDrafts={view.parallelDrafts}
          onChangeParallel={view.handleChangeParallel}
          onChangeAdded={view.handleChangeAdded}
          onSave={view.handleSaveRoster}
          action={
            view.canStartRosterEdit ? (
              <button
                type="button"
                className={MODAL_CANCEL_BTN}
                disabled={view.pending !== null}
                onClick={view.handleStartRosterEdit}
              >
                수정
              </button>
            ) : view.isRosterEditing ? (
              <button
                type="button"
                className={MODAL_CANCEL_BTN}
                disabled={view.pending === 'roster'}
                onClick={view.handleCancelRosterEdit}
              >
                취소
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
