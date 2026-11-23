/**
 * 반기 관리 화면이 쓰는 반기 모델. 반기 관리 API(model/seasonDto.ts, snake_case)를 api/seasonApi.ts가 이 모양으로 바꾼다.
 * 출결 화면들은 아직 옛 반기 API(model/dto.ts의 SemesterDto)를 쓴다.
 */
import type { UserTrack } from '@/entities/user/model/types';

import type { CommonWeekDto, SemesterActivity, SemesterHalf } from './dto';
import type { SeasonStatusValue, TrackValue } from './seasonDto';

/** 진행 예정(DRAFT)·진행(ACTIVE)·종료(ARCHIVED). */
export type SeasonStatus = SeasonStatusValue;

/** 백엔드 부문 값과 화면 부문 이름. */
export const TRACK_OF_VALUE: Record<TrackValue, UserTrack> = {
  ANALYSIS: '분석',
  VISUALIZATION: '시각화',
  ENGINEERING: '엔지니어링',
};

export const VALUE_OF_TRACK: Record<UserTrack, TrackValue> = {
  분석: 'ANALYSIS',
  시각화: 'VISUALIZATION',
  엔지니어링: 'ENGINEERING',
};

/** 반기 목록의 한 반기(ATT-01). */
export interface Season {
  id: number;
  /** 예: '26-2'. */
  name: string;
  half: SemesterHalf;
  status: SeasonStatus;
  baseTerm: number;
  advTerm: number;
  startDate: string;
  endDate: string;
  /** 진행 예정 반기만 true. */
  isEditable: boolean;
}

/** 공통 주차(ATT-08). 휴강 저장은 weekId로 한다. */
export interface SeasonWeek extends CommonWeekDto {
  weekId: number;
}

/** 반기 상세(ATT-02). */
export interface SeasonInfo extends Season {
  activityStarts: Record<SemesterActivity, string>;
  vacation: { startDate: string; endDate: string } | null;
  term: { startDate: string; endDate: string } | null;
  /** ADV 팀장 입력 시작 주차. 정하지 않았으면 null. activityWeekNo는 ADV 1주차부터 센 번호다. */
  advLeaderEntryWeek: { weekId: number; weekNo: number; activityWeekNo: number } | null;
  scoreRuleSet: { id: number; name: string } | null;
}

/** 반기 확정·미리보기에 보내는 입력(ATT-03·82). 확정만 scoreRuleSetId가 있다. */
export interface SeasonInput {
  name: string;
  half: SemesterHalf;
  baseTerm: number;
  advTerm: number;
  vacation: { startDate: string; endDate: string };
  term: { startDate: string; endDate: string };
  activityStarts: Record<SemesterActivity, string>;
  voidWeekNos: number[];
}

/** 진행 예정 반기 수정(ATT-04). 보낸 칸만 바꾼다. */
export interface SeasonPatch {
  name?: string;
  half?: SemesterHalf;
  vacation?: { startDate: string; endDate: string };
  term?: { startDate: string; endDate: string };
  activityStarts?: Partial<Record<SemesterActivity, string>>;
  /** null이면 팀장 입력을 닫는다. */
  advLeaderEntryWeekId?: number | null;
  scoreRuleSetId?: number;
}

/** 새 반기 미리보기(ATT-82). 저장하지 않은 값이다. */
export interface SeasonPreviewResult {
  isDuplicateName: boolean;
  isDuplicateBaseTerm: boolean;
  totalWeekCount: number;
  rosterSummary: { term: number; kind: 'BASE' | 'ADV'; count: number }[];
  rosterMembers: {
    memberId: string;
    name: string;
    term: number;
    track: UserTrack;
    kind: 'BASE' | 'ADV';
  }[];
}

/** 반기 종료 점검(ATT-10). 활성화 확인 흐름이 쓴다. */
export interface SeasonArchiveReadiness {
  blockReason: 'SEASON_NOT_ACTIVE' | 'SEASON_ARCHIVED' | null;
  canArchive: boolean;
  lastWeek: { weekNo: number; isClosed: boolean } | null;
  blockingItems: {
    reason: 'PENDING' | 'NOT_SUBMITTED';
    groupName: string;
    weekNo: number | null;
    roundNo: number | null;
  }[];
}

/** 점수 규칙 버전 선택지(ATT-12). */
export interface ScoreRuleSetOption {
  id: number;
  name: string;
}
