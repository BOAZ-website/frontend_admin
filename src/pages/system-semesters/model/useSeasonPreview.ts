import { previewSeason } from '@/entities/cohort/api/seasonApi';
import type { RosterEntryDto } from '@/entities/cohort/model/dto';
import type { SeasonInput, SeasonPreviewResult } from '@/entities/cohort/model/season';
import { useLoaded } from '@/shared/lib/useLoaded';

/** 새 반기 명단 확인 창의 상태: 서버가 계산한 자동 명단(ATT-82). 창에서는 고치지 않는다. */
export interface SeasonPreviewState {
  /** 읽는 중이면 null. */
  members: RosterEntryDto[] | null;
  /** 같은 연도·반기나 BASE 기수의 반기가 이미 있으면 그 이유. */
  conflict: string | null;
  error: Error | null;
  reload: () => void;
}

const loadPreview = (key: string): Promise<SeasonPreviewResult> =>
  previewSeason(JSON.parse(key) as SeasonInput);

const conflictOf = (preview: SeasonPreviewResult): string | null =>
  preview.isDuplicateName
    ? '같은 연도·반기의 반기가 이미 있습니다.'
    : preview.isDuplicateBaseTerm
      ? '같은 BASE 기수의 반기가 이미 있습니다.'
      : null;

/** 입력한 반기로 미리보기를 부르고, 자동 명단을 명단 표 모양으로 바꾼다. */
export function useSeasonPreview(input: SeasonInput): SeasonPreviewState {
  const { data, error, reload } = useLoaded(JSON.stringify(input), loadPreview);
  return {
    members:
      data &&
      data.rosterMembers.map((member) => ({
        userId: member.memberId,
        name: member.name,
        term: member.term,
        track: member.track,
        parallelTrack: null,
        kind: member.kind,
        memberStatus: 'ACTIVE',
        menmenJoined: true,
        chinbaJoined: true,
        isParallelCompleted: null,
        note: null,
        groups: [],
      })),
    conflict: data && conflictOf(data),
    error,
    reload,
  };
}
