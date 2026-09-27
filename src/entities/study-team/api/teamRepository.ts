/**
 * 스터디·ADV 팀, 팀원, 주차별 출결을 임시 DB(SQLite)에서 읽고 쓰는 저장소 계층.
 * 화면은 DB를 직접 다루지 않고 이 함수들로만 조회·저장한다. 백엔드가 붙으면 이 파일만 API 호출로 바꾸면 된다.
 */
import type { Database } from 'sql.js';

import { sessionKey } from '@/entities/attendance/model/lib';
import {
  loadCohorts,
  loadWeekDates,
  type CohortWeekDates,
} from '@/entities/cohort/api/cohortRepository';
import { DEFAULT_CURRENT_COHORT } from '@/entities/cohort/model/lib';
import type { AttendanceState, SessionRecord } from '@/entities/attendance/model/types';
import { loadWeeks } from '@/entities/attendance/api/weekRepository';
import type { WeekInfo } from '@/entities/attendance/model/week';
import { listUsers } from '@/entities/user/api/usersRepository';
import type { UserProfile } from '@/entities/user/model/types';
import { execute, inTransaction, queryAll } from '@/shared/db/createDatabase';
import { resolveFileUrl, toFilePath } from '@/shared/lib/file';
import { resolveImageUrl, toImagePath } from '@/shared/lib/imagePath';

import type { Member, StudyTeamInfo } from '../model/types';

export interface TeamDbState {
  users: UserProfile[];
  studyTeams: StudyTeamInfo[];
  advTeams: StudyTeamInfo[];
  /** BASE Term 트랙(기수마다 분석·시각화·엔지니어링). 트랙원과 출결은 members·attendance에 함께 담긴다. */
  baseTeams: StudyTeamInfo[];
  /** 팀 id → 팀원. 스터디와 ADV를 함께 담는다. 팀 이름은 부문이 다르면 겹칠 수 있어 id로 가리킨다. */
  members: Record<string, Member[]>;
  /** sessionKey(주차ID, 'study', 팀 id) → 제출 상태·사진·멤버별 출결 */
  attendance: AttendanceState;
  /** 주차와 그 활성 상태(weeks 테이블). 화면의 주차 활성 여부는 이 값을 따른다. */
  weeks: WeekInfo[];
  /** 활동 기수 목록(큰 기수부터). 가장 큰 기수가 현재 기수다. */
  cohorts: number[];
  /** 기수별 주차 날짜 매핑. 출결 생성 창과 CSV 추출 설정이 같은 값을 쓴다. */
  weekDates: CohortWeekDates;
}

type GroupType = 'STUDY' | 'ADV' | 'BASE';
const VALID_TRACKS = ['분석', '시각화', '엔지니어링'];

interface TeamRow extends Record<string, unknown> {
  id: string;
  group_type: GroupType;
  cohort: number;
  track: string;
  team_name: string;
  study_name: string;
  leader_name: string | null;
  leader_id: string | null;
  schedule: string;
  period: '방학' | '학기';
  kind: 'GENERAL' | 'MENTORING';
  description: string;
  created_at: string;
}

// ───────────────────────────── 조회 ─────────────────────────────

export function loadTeamState(db: Database): TeamDbState {
  const teamRows = queryAll<TeamRow>(
    db,
    `SELECT t.*, u.name AS leader_name
       FROM teams t LEFT JOIN users u ON u.id = t.leader_id
      ORDER BY t.rowid`,
  );
  const toInfo = (row: TeamRow): StudyTeamInfo => ({
    id: row.id,
    ...(row.leader_id ? { leaderId: row.leader_id } : {}),
    teamName: row.team_name,
    studyName: row.study_name,
    leaderName: row.leader_name ?? '',
    category: row.track,
    schedule: row.schedule,
    studyType: row.period === '학기' ? '학기 스터디' : '방학 스터디',
    studyKind: row.kind,
    track: row.track,
    description: row.description,
    createdAt: row.created_at,
    cohort: row.cohort,
  });

  const memberRows = queryAll<{
    id: string;
    team_id: string;
    name: string;
    term: number;
    track: string;
  }>(
    db,
    `SELECT m.id, m.team_id, u.name, u.term, u.track
       FROM team_members m
       JOIN teams t ON t.id = m.team_id
       JOIN users u ON u.id = m.user_id
      ORDER BY t.rowid, m.sort_order`,
  );
  const members: Record<string, Member[]> = {};
  teamRows.forEach((row) => {
    members[row.id] = [];
  });
  memberRows.forEach((row) => {
    members[row.team_id].push({
      id: row.id,
      name: row.name,
      year: String(row.term),
      track: row.track,
    });
  });

  return {
    users: listUsers(db),
    studyTeams: teamRows.filter((row) => row.group_type === 'STUDY').map(toInfo),
    advTeams: teamRows.filter((row) => row.group_type === 'ADV').map(toInfo),
    baseTeams: teamRows.filter((row) => row.group_type === 'BASE').map(toInfo),
    members,
    attendance: loadAttendance(db),
    weeks: loadWeeks(db),
    cohorts: loadCohorts(db),
    weekDates: loadWeekDates(db),
  };
}

function loadAttendance(db: Database): AttendanceState {
  const attendance: AttendanceState = {};

  queryAll<{
    team_id: string;
    week_id: string;
    submitted: number;
    submitted_at: string | null;
    confirmed_by_admin: number;
    path: string | null;
    url: string | null;
    original_name: string | null;
    size_label: string | null;
    pdf_url: string | null;
    pdf_name: string | null;
    pdf_size: string | null;
  }>(
    db,
    `SELECT s.team_id, s.week_id, s.submitted, s.submitted_at, s.confirmed_by_admin,
            s.pdf_url, s.pdf_name, s.pdf_size,
            i.path, i.url, i.original_name, i.size_label
       FROM attendance_sessions s
       LEFT JOIN images i ON i.id = s.image_id`,
  ).forEach((row) => {
    const record: SessionRecord = {
      statuses: {},
      memos: {},
      photo: row.path ? (row.original_name ?? row.path) : null,
      photoUrl: row.path ? resolveImageUrl({ path: row.path, url: row.url }) : null,
      photoName: row.original_name,
      photoSize: row.size_label,
      pdfUrl: row.pdf_url ? resolveFileUrl(row.pdf_url) : null,
      pdfName: row.pdf_name,
      pdfSize: row.pdf_size,
      submitted: row.submitted === 1,
      submittedAt: row.submitted_at,
      confirmedByAdmin: row.confirmed_by_admin === 1,
    };
    attendance[sessionKey(row.week_id, 'study', row.team_id)] = record;
  });

  queryAll<{
    team_id: string;
    week_id: string;
    member_id: string;
    sub_type: string;
    status: SessionRecord['statuses'][string];
    memo: string | null;
  }>(
    db,
    `SELECT r.team_id, r.week_id, r.member_id, r.sub_type, r.status, r.memo
       FROM attendance_records r`,
  ).forEach((row) => {
    const record = attendance[sessionKey(row.week_id, 'study', row.team_id)];
    if (!record) return;
    const memberKey = row.sub_type ? `${row.member_id}:${row.sub_type}` : row.member_id;
    record.statuses[memberKey] = row.status;
    if (row.memo) record.memos = { ...(record.memos ?? {}), [memberKey]: row.memo };
  });

  return attendance;
}

// ───────────────────────────── 저장 ─────────────────────────────
// 화면 상태의 변경(이전 값 → 다음 값)을 받아 달라진 부분만 DB에 반영한다.

export function persistTeams(
  db: Database,
  prev: readonly StudyTeamInfo[],
  next: readonly StudyTeamInfo[],
  group: GroupType,
): void {
  const prevById = new Map(prev.map((team) => [team.id, team]));
  const nextIds = new Set(next.map((team) => team.id));

  inTransaction(db, () => {
    prev
      .filter((team) => !nextIds.has(team.id))
      .forEach((team) => execute(db, 'DELETE FROM teams WHERE id = ?', [team.id]));

    next
      .filter((team) => prevById.get(team.id) !== team)
      .forEach((team) => {
        const leaderId = findUserId(db, team.leaderName);
        execute(
          db,
          `INSERT INTO teams (id, group_type, cohort, track, team_name, study_name, leader_id, schedule,
                              period, kind, description, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             track = excluded.track, team_name = excluded.team_name,
             study_name = excluded.study_name, leader_id = excluded.leader_id,
             schedule = excluded.schedule, period = excluded.period, kind = excluded.kind,
             description = excluded.description`,
          [
            team.id,
            group,
            team.cohort ?? DEFAULT_CURRENT_COHORT,
            team.track ?? team.category,
            team.teamName,
            team.studyName,
            leaderId,
            team.schedule,
            team.studyType === '학기 스터디' ? '학기' : '방학',
            team.studyKind ?? 'GENERAL',
            team.description ?? '',
            team.createdAt,
          ],
        );
      });
  });
}

export function persistMembers(
  db: Database,
  prev: Readonly<Record<string, readonly Member[]>>,
  next: Readonly<Record<string, readonly Member[]>>,
): void {
  inTransaction(db, () => {
    Object.entries(next).forEach(([teamId, list]) => {
      if (prev[teamId] === list) return;
      if (!teamExists(db, teamId)) return; // 팀이 아직 저장되지 않았다면 건너뛴다(팀이 먼저 저장돼야 한다).

      const keepIds = new Set(list.map((member) => member.id));
      queryAll<{ id: string }>(db, 'SELECT id FROM team_members WHERE team_id = ?', [teamId])
        .filter((row) => !keepIds.has(row.id))
        .forEach((row) => execute(db, 'DELETE FROM team_members WHERE id = ?', [row.id]));

      list.forEach((member, index) => {
        const userId = ensureUser(db, member);
        execute(
          db,
          `INSERT INTO team_members (id, team_id, user_id, sort_order) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET sort_order = excluded.sort_order`,
          [member.id, teamId, userId, index],
        );
      });
    });
  });
}

export function persistAttendance(
  db: Database,
  prev: AttendanceState,
  next: AttendanceState,
): void {
  const teamIds = new Set(
    queryAll<{ id: string }>(db, 'SELECT id FROM teams').map((row) => row.id),
  );

  inTransaction(db, () => {
    new Set([...Object.keys(prev), ...Object.keys(next)]).forEach((key) => {
      if (prev[key] === next[key]) return;
      const [weekId, , ...idParts] = key.split('|');
      const teamId = idParts.join('|');
      if (!teamIds.has(teamId)) return;

      const record = next[key];
      if (!record) {
        execute(db, 'DELETE FROM attendance_sessions WHERE team_id = ? AND week_id = ?', [
          teamId,
          weekId,
        ]);
        return;
      }
      writeSession(db, teamId, weekId, prev[key], record);
    });
  });
}

function writeSession(
  db: Database,
  teamId: string,
  weekId: string,
  prevRecord: SessionRecord | undefined,
  record: SessionRecord,
): void {
  const imageId = resolveImageId(db, teamId, weekId, prevRecord, record);
  execute(
    db,
    `INSERT INTO attendance_sessions (team_id, week_id, submitted, submitted_at, confirmed_by_admin,
                                     image_id, pdf_url, pdf_name, pdf_size)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id, week_id) DO UPDATE SET
       submitted = excluded.submitted, submitted_at = excluded.submitted_at,
       confirmed_by_admin = excluded.confirmed_by_admin, image_id = excluded.image_id,
       pdf_url = excluded.pdf_url, pdf_name = excluded.pdf_name, pdf_size = excluded.pdf_size`,
    [
      teamId,
      weekId,
      record.submitted ? 1 : 0,
      record.submittedAt,
      record.confirmedByAdmin ? 1 : 0,
      imageId,
      record.pdfUrl ? toFilePath(record.pdfUrl) : null,
      record.pdfUrl ? (record.pdfName ?? null) : null,
      record.pdfUrl ? (record.pdfSize ?? null) : null,
    ],
  );

  const validMemberIds = new Set(
    queryAll<{ id: string }>(db, 'SELECT id FROM team_members WHERE team_id = ?', [teamId]).map(
      (row) => row.id,
    ),
  );
  execute(db, 'DELETE FROM attendance_records WHERE team_id = ? AND week_id = ?', [teamId, weekId]);
  Object.entries(record.statuses).forEach(([memberKey, status]) => {
    const [memberId, subType = ''] = memberKey.split(':');
    if (!validMemberIds.has(memberId)) return; // 명단에서 빠진 멤버의 기록은 저장하지 않는다.
    execute(
      db,
      `INSERT INTO attendance_records (team_id, week_id, member_id, sub_type, status, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [teamId, weekId, memberId, subType, status, record.memos?.[memberKey] ?? null],
    );
  });
}

/** 사진이 그대로면 기존 images 행을 유지하고, 새 사진이면 새 행을 만든다. 사진이 없으면 NULL. */
function resolveImageId(
  db: Database,
  teamId: string,
  weekId: string,
  prevRecord: SessionRecord | undefined,
  record: SessionRecord,
): number | null {
  if (!record.photoUrl) return null;
  if (prevRecord?.photoUrl === record.photoUrl) {
    const existing = queryAll<{ image_id: number | null }>(
      db,
      'SELECT image_id FROM attendance_sessions WHERE team_id = ? AND week_id = ?',
      [teamId, weekId],
    )[0]?.image_id;
    if (existing) return existing;
  }
  execute(db, 'INSERT INTO images (path, url, original_name, size_label) VALUES (?, NULL, ?, ?)', [
    toImagePath(record.photoUrl),
    record.photoName ?? record.photo ?? null,
    record.photoSize ?? null,
  ]);
  return queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;
}

// ───────────────────────────── 보조 ─────────────────────────────

function teamExists(db: Database, teamId: string): boolean {
  return queryAll(db, 'SELECT 1 FROM teams WHERE id = ?', [teamId]).length > 0;
}

function findUserId(db: Database, name: string): string | null {
  if (!name) return null;
  return (
    queryAll<{ id: string }>(db, 'SELECT id FROM users WHERE name = ? ORDER BY term DESC LIMIT 1', [
      name,
    ])[0]?.id ?? null
  );
}

/** 팀원은 항상 users의 사람을 가리킨다. 이름·기수가 같은 사용자가 없으면 새로 만든다. */
function ensureUser(db: Database, member: Member): string {
  const term = Number(member.year) || 0;
  const existing = queryAll<{ id: string }>(
    db,
    'SELECT id FROM users WHERE name = ? AND term = ?',
    [member.name, term],
  )[0];
  if (existing) return existing.id;

  const id = `u_${term}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const track = VALID_TRACKS.includes(member.track ?? '') ? (member.track as string) : '분석';
  execute(db, 'INSERT INTO users (id, name, term, track) VALUES (?, ?, ?, ?)', [
    id,
    member.name,
    term,
    track,
  ]);
  return id;
}
