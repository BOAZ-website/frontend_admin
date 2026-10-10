import { useRef } from 'react';
import { Check, Folder, Trash2 } from 'lucide-react';
import { Tooltip } from '@/shared/ui/Tooltip';

import {
  EVENT_FORMAT_OPTIONS,
  eventFormatOptionOf,
  type EventAttendanceFormat,
  type RosterSlot,
  type RosterSlotId,
} from '../model/eventFormat';

const FIELD_LABEL = 'mb-1.5 block text-[11px] font-semibold text-slate-500';

export interface RosterUpload {
  fileName: string;
  /** 파일에서 읽은 참가자. 화면에는 인원수, 회원 DB에서 찾은 사람 수, 확인이 필요한 사람만 쓴다. */
  roster: readonly { name: string; member?: unknown; memberCheck?: string }[];
}

interface NewEventRosterSectionProps {
  format: EventAttendanceFormat;
  onChangeFormat: (format: EventAttendanceFormat) => void;
  uploads: Partial<Record<RosterSlotId, RosterUpload>>;
  onSelectFile: (slot: RosterSlot, file: File) => void;
  onClearFile: (slot: RosterSlot) => void;
}

/** 새 행사 등록 창: 출결 방식을 고르고, 방식에 맞는 명단 파일을 올린다. */
export function NewEventRosterSection({
  format,
  onChangeFormat,
  uploads,
  onSelectFile,
  onClearFile,
}: NewEventRosterSectionProps) {
  const option = eventFormatOptionOf(format);

  return (
    <div className="space-y-7">
      <fieldset>
        <legend className={FIELD_LABEL}>출결 방식 *</legend>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {EVENT_FORMAT_OPTIONS.map((item) => (
            <label
              key={item.value}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700 select-none"
            >
              <input
                type="radio"
                name="new-event-attendance-format"
                value={item.value}
                checked={item.value === format}
                onChange={() => onChangeFormat(item.value)}
                className="h-4 w-4 cursor-pointer accent-slate-900"
              />
              <span className={item.value === format ? 'font-semibold text-slate-900' : ''}>
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-3">
        {option.slots.map((slot) => (
          <RosterUploadSlot
            key={slot.id}
            slot={slot}
            upload={uploads[slot.id]}
            onSelectFile={(file) => onSelectFile(slot, file)}
            onClear={() => onClearFile(slot)}
          />
        ))}
      </div>
    </div>
  );
}

interface RosterUploadSlotProps {
  slot: RosterSlot;
  upload: RosterUpload | undefined;
  onSelectFile: (file: File) => void;
  onClear: () => void;
}

function RosterUploadSlot({ slot, upload, onSelectFile, onClear }: RosterUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // 회원 DB에서 찾은 사람 수(이 사람들은 이름·기수·부문을 고칠 수 없다).
  const memberCount = upload?.roster.filter((person) => person.member).length ?? 0;
  // 현재 활동 기수인데 회원 DB에 없는 사람(이름·기수 오타일 수 있다). 이전 기수가 없는 것은 정상이라 알리지 않는다.
  const missingCurrent =
    upload?.roster.filter((person) => person.memberCheck === 'currentNotInDb') ?? [];

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // 같은 파일을 다시 고를 수 있게 비운다.
    e.target.value = '';
    if (file) {
      onSelectFile(file);
    }
  }

  // 멘멘 스터디 파일 업로드(출결 입력 화면)와 같은 모양: 폴더 아이콘 · 파일명 · 초록 체크 · 삭제(회색 아이콘).
  return (
    <div>
      <p className={FIELD_LABEL}>{slot.label}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleChange}
        className="hidden"
      />
      {upload ? (
        <div className="flex h-14 w-full max-w-[360px] items-center gap-3 rounded-sm border border-slate-200 bg-white px-4 shadow-2xs">
          <Folder
            size={20}
            strokeWidth={1.3}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span
            className="min-w-0 flex-1 truncate text-left text-sm text-slate-800"
            title={`${upload.fileName} (${upload.roster.length}명, 회원 ${memberCount}명)`}
          >
            {upload.fileName} · {upload.roster.length}명
            {memberCount > 0 && <span className="text-slate-500"> (회원 {memberCount}명)</span>}
          </span>
          <Check
            size={20}
            strokeWidth={2.4}
            className="shrink-0 text-emerald-500"
            aria-label="업로드 완료"
          />
          <Tooltip label="파일 삭제">
            <button
              type="button"
              onClick={onClear}
              className="shrink-0 cursor-pointer rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              aria-label={`${slot.label} 파일 삭제`}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`${slot.label} 파일 업로드`}
          className="group flex h-14 w-full max-w-[360px] cursor-pointer select-none items-center gap-3 rounded-sm border border-dashed border-slate-300 bg-white px-4 transition-colors hover:border-slate-400 hover:bg-slate-50/60"
        >
          <Folder
            size={20}
            strokeWidth={1.3}
            className="shrink-0 text-slate-400"
            aria-hidden="true"
          />
          <span className="min-w-0 flex-1 truncate text-left text-sm text-slate-500 transition-colors group-hover:text-slate-900 group-hover:underline">
            파일을 업로드해 주세요
          </span>
        </button>
      )}
      {missingCurrent.length > 0 && (
        <p
          className="mt-1.5 max-w-[360px] truncate text-[11px] text-amber-700"
          title={missingCurrent.map((person) => person.name).join(', ')}
        >
          현재 기수인데 회원 DB에 없는 사람 {missingCurrent.length}명:{' '}
          {missingCurrent.map((person) => person.name).join(', ')}
        </p>
      )}
    </div>
  );
}
