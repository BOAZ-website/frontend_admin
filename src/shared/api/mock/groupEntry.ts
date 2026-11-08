/**
 * 출결 입력 탭(ADV·스터디, 리더 전용)의 담당 그룹 판정. 백엔드 HOST 계정·그룹 리더 설계문서(2026-11-06판)
 * 5.3 ScopeGuard.checkGroupEntry의 판정 순서를 임시 API로 옮겼다.
 *  1. 모든 그룹 권한이 있으면 통과(담당 그룹·마감·시작 주차 제한 없음)
 *  2. 담당 그룹 권한(_OWN_GROUP_)이 없으면 403. 계정 예외로 회수한 경우도 여기서 막힌다
 *  3. 이 그룹의 현재 팀장이 아니면 403
 *  4. 진행 중인 그룹이 아니면(시작 전·종료) 403
 *  5. (쓰기) 마감된 주차면 409 WEEK_CLOSED
 *  6. (쓰기, ADV) 팀장 입력 시작 주차 전이면 409 LEADER_ENTRY_NOT_OPEN
 * 임시 API는 출결 관리 화면과 출결 입력 탭이 같은 주차 쓰기 경로를 쓰므로, 1단계는 출결 관리 쓰기 권한도 받는다.
 */
import type { Database } from 'sql.js';

import type { SemesterWeekDto } from '@/entities/cohort/model/dto';
import type { TeamDto } from '@/entities/study-team/model/dto';

import { groupStates } from './groupState';
import { resolveSemester } from './queries';
import { ApiError } from './router';
import { actorOf, hasPermission } from './routes/adminAccountRoutes';

export type EntryAction = 'READ' | 'WRITE';
type EntryGroup = 'ADV' | 'STUDY';

const ENTRY_PERMISSIONS: Record<
  EntryGroup,
  Record<'allGroups' | 'ownGroup' | 'manage', Record<EntryAction, string>>
> = {
  ADV: {
    allGroups: { READ: 'ATTENDANCE_ADV_ENTRY_READ', WRITE: 'ATTENDANCE_ADV_ENTRY_WRITE' },
    ownGroup: {
      READ: 'ATTENDANCE_ADV_ENTRY_OWN_GROUP_READ',
      WRITE: 'ATTENDANCE_ADV_ENTRY_OWN_GROUP_WRITE',
    },
    manage: { READ: 'ATTENDANCE_ADV_READ', WRITE: 'ATTENDANCE_ADV_WRITE' },
  },
  STUDY: {
    allGroups: { READ: 'ATTENDANCE_STUDY_ENTRY_READ', WRITE: 'ATTENDANCE_STUDY_ENTRY_WRITE' },
    ownGroup: {
      READ: 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_READ',
      WRITE: 'ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE',
    },
    manage: { READ: 'ATTENDANCE_STUDY_READ', WRITE: 'ATTENDANCE_STUDY_WRITE' },
  },
};

const accessDenied = (message: string) => new ApiError(403, 'ACCESS_DENIED', message);

/**
 * 출결 입력 탭의 그룹 목록에 보일 팀인지 고르는 함수(설계 5.5).
 * 모든 그룹 조회 권한이 있으면 전부, 담당 그룹 조회 권한만 있으면 본인이 현재 팀장인 진행 중 그룹만이다.
 */
export function entryTeamFilter(db: Database, group: EntryGroup): (team: TeamDto) => boolean {
  const actor = actorOf(db);
  const keys = ENTRY_PERMISSIONS[group];
  if (hasPermission(db, actor, keys.allGroups.READ)) return () => true;
  if (!hasPermission(db, actor, keys.ownGroup.READ)) {
    throw accessDenied('출결 입력 탭을 조회할 권한이 없습니다.');
  }
  const states = groupStates(db);
  return (team) => team.leaderId === actor.user_id && states.get(team.id) === 'IN_PROGRESS';
}

/** 팀 한 곳의 주차 출결 쓰기 판정(설계 5.3). 통과하지 못하면 403 또는 409를 던진다. */
export function checkGroupEntryWrite(
  db: Database,
  team: TeamDto,
  group: EntryGroup,
  week: SemesterWeekDto,
): void {
  const actor = actorOf(db);
  const keys = ENTRY_PERMISSIONS[group];
  // 1. 모든 그룹 권한. 운영진이 동시에 팀장이어도 여기서 통과한다.
  if ([keys.allGroups.WRITE, keys.manage.WRITE].some((key) => hasPermission(db, actor, key))) {
    return;
  }
  // 2. 담당 그룹 권한. _OWN_GROUP_ 권한은 "팀장인 진행 중 그룹이 하나 이상 있다"만 뜻하므로 3·4단계가 더 필요하다.
  if (!hasPermission(db, actor, keys.ownGroup.WRITE)) {
    throw accessDenied('출결을 입력할 권한이 없습니다.');
  }
  // 3. 이 그룹의 현재 팀장인가
  if (team.leaderId !== actor.user_id) {
    throw accessDenied('담당 그룹이 아니라 출결을 입력할 수 없습니다.');
  }
  // 4. 진행 중인 그룹인가
  if (groupStates(db).get(team.id) !== 'IN_PROGRESS') {
    throw accessDenied('진행 중인 그룹이 아니라 출결을 입력할 수 없습니다.');
  }
  // 5. 마감 전 주차인가. 임시 API는 시각 대신 반기 관리에서 정한 주차 상태(종료)로 판정한다.
  if (week.status === 'CLOSED') {
    throw new ApiError(
      409,
      'WEEK_CLOSED',
      `${week.label}는 마감되어 수정할 수 없습니다. 정정은 운영지원팀에 요청해 주세요.`,
    );
  }
  // 6. ADV는 팀장 입력 시작 주차부터
  if (group === 'ADV') {
    const from = team.semester ? resolveSemester(db, team.semester).advLeaderEntryFromWeek : null;
    if (from === null || week.weekNum < from) {
      throw new ApiError(
        409,
        'LEADER_ENTRY_NOT_OPEN',
        from === null
          ? '팀의 반기가 정해지지 않아 팀장 출결 입력이 열리지 않았습니다. 운영지원팀에 문의해 주세요.'
          : `${from}주차 전 출결은 운영지원팀이 입력합니다.`,
      );
    }
  }
}
