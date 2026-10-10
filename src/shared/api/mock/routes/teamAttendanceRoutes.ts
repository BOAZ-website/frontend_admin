/**
 * 팀의 주차 출결 쓰기 API. 스터디·ADV·BASE가 같은 경로 구조를 쓴다.
 *   PUT  .../:teamId/weeks/:weekNum/attendance          출결·비고 저장(제출 전 임시 저장, 운영진의 수정)
 *   POST .../:teamId/weeks/:weekNum/submit              출결 + 활동 사진 + PDF를 한 번에 제출(재제출 가능)
 */
import type { Database } from 'sql.js';

import type { SubmitWeekResponse } from '@/entities/attendance/model/dto';
import type { AttendanceStatus } from '@/entities/attendance/model/types';
import { execute, queryAll } from '@/shared/db/createDatabase';
import { toFilePath } from '@/shared/lib/file';
import { toImagePath } from '@/shared/lib/imagePath';

import {
  ATTENDANCE_STATUSES,
  findTeam,
  findSemesterWeek,
  listMembers,
  loadSessions,
  MENTORING_SUB_TYPES,
  resolveSemester,
  type SubType,
  TEAM_PATHS,
  type TeamDto,
  type TeamGroup,
  weekIdOf,
} from '../queries';
import { ApiError, type MockRequest, type MockRoute } from '../router';
import {
  type Body,
  filePayload,
  type FilePayload,
  oneOf,
  parsePositiveInt,
  readBody,
  requiredString,
} from '../validate';

/** 화면에 보이는 형식(YYYY-MM-DD HH:MM)의 현재 시각. 시드 데이터와 같은 형식이다. */
export function nowStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

interface RecordInput {
  memberId: string;
  subType: SubType;
  status: AttendanceStatus;
  memo: string | null | undefined;
}

interface WeekContext {
  team: TeamDto;
  weekId: string;
  weekNum: number;
}

function resolveWeekContext(db: Database, request: MockRequest, group: TeamGroup): WeekContext {
  const team = findTeam(db, request.params.teamId, group);
  const weekNum = parsePositiveInt(request.params.weekNum, 'weekNum') as number;
  if (!team.semester) {
    throw new ApiError(
      409,
      'TEAM_SEMESTER_NOT_FOUND',
      '이 팀이 출결을 진행할 반기가 등록되어 있지 않습니다.',
    );
  }
  // 주차 진행 상태는 팀이 출결을 진행하는 반기의 값을 따른다.
  const week = findSemesterWeek(db, resolveSemester(db, team.semester).cohort, weekNum);
  if (week.status === 'UPCOMING') {
    throw new ApiError(
      409,
      'WEEK_NOT_OPEN',
      `${week.label}는 아직 열리지 않아 출결을 입력할 수 없습니다.`,
    );
  }
  return { team, weekId: weekIdOf(db, weekNum), weekNum };
}

function parseRecords(db: Database, team: TeamDto, body: Body): RecordInput[] {
  const raw = body.records;
  if (raw === undefined) return [];
  if (!Array.isArray(raw))
    throw new ApiError(400, 'BAD_REQUEST', 'records 값은 배열이어야 합니다.');

  const memberIds = new Set(listMembers(db, team.id).map((member) => member.id));
  const allowedSubTypes: readonly SubType[] =
    team.kind === 'MENTORING' ? ['', ...MENTORING_SUB_TYPES] : [''];
  return raw.map((item) => {
    const record = readBody(item);
    const memberId = requiredString(record, 'memberId');
    if (!memberIds.has(memberId)) {
      throw new ApiError(400, 'MEMBER_NOT_IN_TEAM', `팀원이 아닌 사람의 출결입니다: ${memberId}`);
    }
    const subType = (typeof record.subType === 'string' ? record.subType : '') as SubType;
    if (!allowedSubTypes.includes(subType)) {
      throw new ApiError(
        400,
        'INVALID_SUB_TYPE',
        '멘멘/친바 구분은 멘멘 스터디에서만 쓸 수 있습니다.',
      );
    }
    const memo = record.memo;
    if (memo !== undefined && memo !== null && typeof memo !== 'string') {
      throw new ApiError(400, 'BAD_REQUEST', 'memo 값은 문자열이어야 합니다.');
    }
    return {
      memberId,
      subType,
      status: oneOf(
        requiredString(record, 'status'),
        ATTENDANCE_STATUSES,
        'status',
      ) as AttendanceStatus,
      memo: memo as string | null | undefined,
    };
  });
}

function ensureSession(db: Database, teamId: string, weekId: string): { submitted: boolean } {
  execute(db, 'INSERT OR IGNORE INTO attendance_sessions (team_id, week_id) VALUES (?, ?)', [
    teamId,
    weekId,
  ]);
  const row = queryAll<{ submitted: number }>(
    db,
    'SELECT submitted FROM attendance_sessions WHERE team_id = ? AND week_id = ?',
    [teamId, weekId],
  )[0];
  return { submitted: row.submitted === 1 };
}

/** 보낸 줄만 바꾼다(보내지 않은 팀원의 기록은 그대로). memo를 보내지 않으면 기존 비고를 유지한다. */
function writeRecords(
  db: Database,
  teamId: string,
  weekId: string,
  records: readonly RecordInput[],
): void {
  records.forEach((record) =>
    execute(
      db,
      `INSERT INTO attendance_records (team_id, week_id, member_id, sub_type, status, memo)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(team_id, week_id, member_id, sub_type) DO UPDATE SET
         status = excluded.status,
         memo = CASE WHEN ? THEN excluded.memo ELSE attendance_records.memo END`,
      [
        teamId,
        weekId,
        record.memberId,
        record.subType,
        record.status,
        record.memo?.trim() || null,
        record.memo === undefined ? 0 : 1,
      ],
    ),
  );
}

function writePhoto(db: Database, teamId: string, weekId: string, photo: FilePayload | null): void {
  let imageId: number | null = null;
  if (photo) {
    execute(
      db,
      'INSERT INTO images (path, url, original_name, size_label) VALUES (?, NULL, ?, ?)',
      [toImagePath(photo.dataUrl), photo.name, photo.size],
    );
    imageId = queryAll<{ id: number }>(db, 'SELECT last_insert_rowid() AS id')[0].id;
  }
  execute(db, 'UPDATE attendance_sessions SET image_id = ? WHERE team_id = ? AND week_id = ?', [
    imageId,
    teamId,
    weekId,
  ]);
}

function writePdf(db: Database, team: TeamDto, weekId: string, pdf: FilePayload | null): void {
  if (pdf && team.kind !== 'MENTORING') {
    throw new ApiError(400, 'PDF_NOT_ALLOWED', 'PDF 자료는 멘멘 스터디만 첨부할 수 있습니다.');
  }
  execute(
    db,
    'UPDATE attendance_sessions SET pdf_url = ?, pdf_name = ?, pdf_size = ? WHERE team_id = ? AND week_id = ?',
    [pdf ? toFilePath(pdf.dataUrl) : null, pdf?.name ?? null, pdf?.size ?? null, team.id, weekId],
  );
}

function currentSession(db: Database, context: WeekContext) {
  return loadSessions(db, context.team.id, context.weekNum)[0];
}

function attendanceRoutesFor(group: TeamGroup): MockRoute[] {
  const base = `${TEAM_PATHS[group]}/:teamId/weeks/:weekNum`;

  return [
    {
      method: 'PUT',
      pattern: `${base}/attendance`,
      summary: '주차 출결·비고 저장(제출 전 임시 저장 또는 운영진 수정). 보낸 팀원 줄만 바뀐다',
      handler: (request) => {
        const { db } = request;
        const context = resolveWeekContext(db, request, group);
        const records = parseRecords(db, context.team, readBody(request.body));
        ensureSession(db, context.team.id, context.weekId);
        writeRecords(db, context.team.id, context.weekId, records);
        return currentSession(db, context);
      },
    },
    {
      method: 'POST',
      pattern: `${base}/submit`,
      summary:
        '주차 출결 제출: records·photo·pdf(멘멘 스터디)를 한 요청으로 저장하고 제출 완료로 표시(재제출 가능)',
      handler: (request) => {
        const { db } = request;
        const context = resolveWeekContext(db, request, group);
        const body = readBody(request.body);
        const records = parseRecords(db, context.team, body);
        const photo = filePayload(body, 'photo');
        const pdf = filePayload(body, 'pdf');

        // 이미 제출한 주차도 다시 제출할 수 있다(운영진이 수정한 뒤 재제출). HOST의 수정 제한은 로그인이 붙기 전까지 화면이 맡는다.
        const resubmitted = ensureSession(db, context.team.id, context.weekId).submitted;
        writeRecords(db, context.team.id, context.weekId, records);
        if (photo !== undefined) writePhoto(db, context.team.id, context.weekId, photo);
        if (pdf !== undefined) writePdf(db, context.team, context.weekId, pdf);

        const session = currentSession(db, context);
        if (session.records.length === 0) {
          throw new ApiError(400, 'EMPTY_ATTENDANCE', '제출할 출결 대상이 없습니다.');
        }
        const submittedAt = nowStamp();
        execute(
          db,
          'UPDATE attendance_sessions SET submitted = 1, submitted_at = ? WHERE team_id = ? AND week_id = ?',
          [submittedAt, context.team.id, context.weekId],
        );
        const response: SubmitWeekResponse = {
          submittedAt,
          resubmitted,
          session: currentSession(db, context),
        };
        return response;
      },
    },
  ];
}

export const teamAttendanceRoutes: MockRoute[] = (['STUDY', 'ADV', 'BASE'] as const).flatMap(
  attendanceRoutesFor,
);
