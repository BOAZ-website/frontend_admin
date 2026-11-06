import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import type { RosterKind } from '@/entities/cohort/model/dto';
import { useDialogKeyboard } from '@/shared/lib/useDialogKeyboard';
import {
  FIELD_TEXT_BTN,
  MODAL_CANCEL_BTN,
  MODAL_CLOSE_BTN,
  MODAL_CONFIRM_BTN,
} from '@/shared/ui/systemStyles';

import { useRosterConfirm } from '../model/useRosterConfirm';
import { RosterSection } from './RosterSection';

interface RosterConfirmDialogProps {
  semesterName: string;
  /** 미리 넣을 기수(1주차 시작일을 정한 BASE·ADV 기수). */
  terms: readonly number[];
  kindOf: (term: number) => RosterKind;
  isSaving: boolean;
  onCancel: () => void;
  /** 확인한 명단으로 반기를 시작한다. */
  onConfirm: (userIds: string[]) => void;
}

/** 새 반기 명단 확인 창. 미리 넣은 BASE·ADV 명단을 보고, 빼거나 다른 사람을 찾아 더한 뒤 시작한다. */
export function RosterConfirmDialog({
  semesterName,
  terms,
  kindOf,
  isSaving,
  onCancel,
  onConfirm,
}: RosterConfirmDialogProps) {
  const roster = useRosterConfirm(terms, kindOf);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogKeyboard(panelRef, onCancel);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="roster-confirm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h3 id="roster-confirm-title" className="truncate text-base font-bold text-slate-900">
            {semesterName} 명단 확인
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onCancel}
            aria-label="창 닫기"
            className={`shrink-0 ${MODAL_CLOSE_BTN}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-4">
          {roster.membersError && (
            <p role="status" className="text-xs text-red-600">
              동아리원 목록을 불러오지 못했습니다.{' '}
              <button type="button" className={FIELD_TEXT_BTN} onClick={roster.reloadMembers}>
                다시 불러오기
              </button>
            </p>
          )}
          {roster.autoMembers ? (
            <RosterSection
              saved={roster.autoMembers}
              excludedIds={roster.excludedIds}
              added={roster.added}
              kindOf={kindOf}
              isReadOnly={false}
              isSaving={isSaving}
              onToggleExcluded={roster.handleToggleExcluded}
              onAdd={roster.handleAddMembers}
              onRemoveAdded={roster.handleRemoveAdded}
            />
          ) : (
            !roster.membersError && (
              <p role="status" className="text-xs text-slate-500">
                명단을 불러오는 중입니다.
              </p>
            )
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <span className="mr-auto text-xs text-slate-500">
            <span className="font-semibold tabular-nums text-slate-900">
              {roster.userIds.length}
            </span>
            명으로 시작
          </span>
          <button type="button" className={MODAL_CANCEL_BTN} onClick={onCancel}>
            취소
          </button>
          <button
            type="button"
            className={MODAL_CONFIRM_BTN}
            disabled={isSaving || roster.userIds.length === 0}
            onClick={() => onConfirm(roster.userIds)}
          >
            {isSaving ? '시작하는 중' : '반기 시작'}
          </button>
        </div>
      </div>
    </div>
  );
}
