import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

import {
  loadTeamState,
  persistAttendance,
  persistMembers,
  persistTeams,
} from '../src/entities/study-team/api/teamRepository';
import { applyAttendanceChange, createStudyRecords } from '../src/entities/study-team/model/db';
import { listUsers } from '../src/entities/user/api/usersRepository';
import { createDatabase, queryAll } from '../src/shared/db/createDatabase';
import { SAMPLE_MENTORING_PDF_PATH } from '../src/shared/lib/file';

const schema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8');

async function freshDb(): Promise<Database> {
  const SQL = await initSqlJs();
  return createDatabase(SQL, schema, seed);
}

/** 화면이 스터디를 만들 때와 같은 순서로 팀 → 팀원 → 출결을 저장한다. */
function createStudy(
  db: Database,
  input: Parameters<typeof createStudyRecords>[0],
): ReturnType<typeof createStudyRecords> {
  const before = loadTeamState(db);
  const created = createStudyRecords(input);
  persistTeams(db, before.studyTeams, [...before.studyTeams, created.team], 'STUDY');
  persistMembers(db, before.members, { ...before.members, [created.team.id]: created.members });
  persistAttendance(db, before.attendance, { ...before.attendance, ...created.attendance });
  return created;
}

test('시드가 스키마의 제약(외래키·CHECK)을 모두 통과해 로드된다', async () => {
  const db = await freshDb();
  assert.equal(queryAll(db, 'PRAGMA foreign_key_check').length, 0);
  assert.ok(listUsers(db).length >= 30);
});

test('부문(분석·시각화·엔지니어링)은 tracks 테이블의 ENUM 값만 쓸 수 있다', async () => {
  const db = await freshDb();
  assert.deepEqual(
    queryAll<{ name: string }>(db, 'SELECT name FROM tracks ORDER BY sort_order').map((r) => r.name),
    ['분석', '시각화', '엔지니어링'],
  );
  assert.throws(() => db.run("UPDATE teams SET track = '기획' WHERE id = 'study_a'"));
  assert.throws(() => db.run("UPDATE users SET track = '기획' WHERE id = 'u_26_01'"));
});

test('저장소가 팀·팀원·출결을 팀 id 기준으로 읽어 온다', async () => {
  const db = await freshDb();
  const state = loadTeamState(db);

  // 현재 기수(27기) 6개 + 지난 기수(26기) 3개
  assert.equal(state.studyTeams.length, 9);
  assert.equal(state.studyTeams.filter((t) => t.cohort === 27).length, 6);
  assert.equal(state.studyTeams.filter((t) => t.cohort === 26).length, 3);
  assert.equal(state.advTeams.length, 9);
  const teamA = state.studyTeams.find((t) => t.id === 'study_a');
  assert.equal(teamA?.teamName, 'A조');
  assert.equal(teamA?.studyKind, 'MENTORING');
  assert.equal(teamA?.track, '분석');
  assert.equal(teamA?.leaderId, 'u_26_01');
  assert.equal(teamA?.leaderName, '남민서');
  assert.equal(state.users.find((user) => user.id === teamA?.leaderId)?.term, 26);
  // 모든 팀이 부문을 가진다
  assert.ok(
    [...state.studyTeams, ...state.advTeams].every((t) =>
      ['분석', '시각화', '엔지니어링'].includes(t.track ?? ''),
    ),
  );

  assert.equal(state.members['study_a'].length, 4);
  assert.equal(state.members['study_a'][0].year, '26');

  const week1 = state.attendance['w1|study|study_a'];
  assert.equal(week1.submitted, true);
  assert.match(week1.photoUrl ?? '', /images\/study\/sample-study-photo\.jpg$/);
  assert.ok('a1:멘멘' in week1.statuses && 'a1:친바' in week1.statuses);
});

test('스터디를 만들면 팀·팀원·전 주차 출결이 DB에 저장되고 다시 읽힌다', async () => {
  const db = await freshDb();
  const { team, members } = createStudy(db, {
    id: 'study_new',
    name: '새 스터디',
    studyKind: 'MENTORING',
    track: '분석',
    isVacation: true,
    leaderName: '남민서',
    members: listUsers(db).slice(0, 2),
  });

  const after = loadTeamState(db);
  assert.equal(after.studyTeams.length, 10);
  assert.equal(after.members[team.id].length, 2);
  assert.equal(after.attendance[`w8|study|${team.id}`].statuses[`${members[0].id}:멘멘`], 'unmarked');
  assert.equal(after.attendance[`w9|study|${team.id}`], undefined);
});

test('부문이 다르면 같은 이름의 스터디를 만들 수 있고, 두 스터디의 출결은 서로 섞이지 않는다', async () => {
  const db = await freshDb();
  const users = listUsers(db);
  const analysis = createStudy(db, {
    id: 'study_tf_a',
    name: '테라폼 스터디', // 시드의 엔지니어링 '테라폼 스터디'와 같은 이름
    studyKind: 'GENERAL',
    track: '분석',
    isVacation: true,
    leaderName: null,
    members: users.slice(0, 2),
  });
  assert.equal(loadTeamState(db).studyTeams.filter((t) => t.teamName === '테라폼 스터디').length, 2);

  // 같은 이름의 두 팀 중 분석 쪽에만 출결을 입력한다.
  const state = loadTeamState(db);
  persistAttendance(
    db,
    state.attendance,
    applyAttendanceChange(state.attendance, {
      teamId: 'study_tf_a',
      weekNum: 1,
      memberKey: analysis.members[0].id,
      status: 'present',
    }),
  );

  const after = loadTeamState(db);
  assert.equal(after.attendance['w1|study|study_tf_a'].statuses[analysis.members[0].id], 'present');
  assert.equal(
    after.attendance['w1|study|study_b'].statuses.b1,
    state.attendance['w1|study|study_b'].statuses.b1,
  );
});

test('같은 부문 안에서는 이름이 겹치면 DB가 거부하고, 실패하면 저장된 것이 없다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const { team } = createStudyRecords({
    id: 'study_dup',
    name: '테라폼 스터디',
    studyKind: 'GENERAL',
    track: '엔지니어링', // 시드의 '테라폼 스터디'와 같은 부문
    isVacation: true,
    leaderName: null,
    members: [],
  });
  assert.throws(
    () => persistTeams(db, before.studyTeams, [...before.studyTeams, team], 'STUDY'),
    /UNIQUE constraint failed: teams\.cohort, teams\.track, teams\.team_name/,
  );
  assert.equal(loadTeamState(db).studyTeams.length, before.studyTeams.length);
});

test('출결 입력은 DB에 반영되고, 조회는 같은 DB에서 바뀐 값을 읽는다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  persistAttendance(
    db,
    before.attendance,
    applyAttendanceChange(before.attendance, {
      teamId: 'study_b',
      weekNum: 3,
      memberKey: 'b1',
      status: 'late',
      memo: '교통 정체',
    }),
  );

  const after = loadTeamState(db);
  assert.equal(after.attendance['w3|study|study_b'].statuses.b1, 'late');
  assert.equal(after.attendance['w3|study|study_b'].memos?.b1, '교통 정체');
  assert.equal(
    after.attendance['w3|study|study_c'].statuses.c1,
    before.attendance['w3|study|study_c'].statuses.c1,
  );
});

test('명단에서 뺀 팀원의 출결 기록은 함께 사라지고 저장 시 오류가 나지 않는다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  persistMembers(db, before.members, {
    ...before.members,
    study_b: before.members['study_b'].filter((m) => m.id !== 'b2'),
  });

  persistAttendance(
    db,
    before.attendance,
    applyAttendanceChange(before.attendance, {
      teamId: 'study_b',
      weekNum: 1,
      memberKey: 'b1',
      status: 'absent',
    }),
  );

  const after = loadTeamState(db);
  assert.equal(after.members['study_b'].length, 3);
  assert.equal('b2' in after.attendance['w1|study|study_b'].statuses, false);
  assert.equal(after.attendance['w1|study|study_b'].statuses.b1, 'absent');
});

test('DB에 없는 이름의 팀원을 추가하면 users에도 함께 등록된다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  persistMembers(db, before.members, {
    ...before.members,
    study_b: [
      ...before.members['study_b'],
      { id: 'b_new', name: '신규회원', year: '29', track: '분석' },
    ],
  });

  assert.ok(listUsers(db).some((u) => u.name === '신규회원' && u.term === 29));
  assert.equal(loadTeamState(db).members['study_b'].length, 5);
});

test('사진을 바꾸면 images에 새 경로가 쌓이고 팀을 지우면 하위 데이터가 함께 지워진다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const record = before.attendance['w4|study|study_a'];
  persistAttendance(db, before.attendance, {
    ...before.attendance,
    'w4|study|study_a': {
      ...record,
      photoUrl: 'blob:http://localhost/abc',
      photoName: 'upload.jpg',
      photoSize: '1 MB',
    },
  });
  assert.equal(loadTeamState(db).attendance['w4|study|study_a'].photoUrl, 'blob:http://localhost/abc');

  persistTeams(db, before.studyTeams, before.studyTeams.filter((t) => t.id !== 'study_a'), 'STUDY');
  const rest = loadTeamState(db);
  assert.equal(rest.studyTeams.length, 8);
  assert.equal('w1|study|study_a' in rest.attendance, false);
  assert.equal(queryAll(db, "SELECT 1 FROM team_members WHERE team_id = 'study_a'").length, 0);
});

test('멘멘 스터디와 일반 스터디는 뷰로 따로 조회된다', async () => {
  const db = await freshDb();
  const mentoring = queryAll<{ team_name: string; track: string }>(
    db,
    'SELECT team_name, track FROM mentoring_studies WHERE cohort = 27',
  );
  const general = queryAll<{ team_name: string }>(
    db,
    'SELECT team_name FROM general_studies WHERE cohort = 27',
  );
  assert.deepEqual(mentoring, [
    { team_name: 'A조', track: '분석' },
    { team_name: 'B조', track: '시각화' },
  ]);
  assert.deepEqual(
    general.map((r) => r.team_name).sort(),
    ['LLM Agent & RAG 스터디', '쿠버네티스 스터디', '태블로 & D3.js 스터디', '테라폼 스터디'].sort(),
  );
});

test('DB 제약: 모든 팀은 부문이 필수이고, ADV 팀은 멘멘일 수 없다', async () => {
  const db = await freshDb();
  const insert = (kind: string, track: string | null, group = 'STUDY', id = 'x') =>
    db.run(
      `INSERT INTO teams (id, group_type, track, team_name, study_name, period, kind, created_at)
       VALUES (?, ?, ?, ?, 's', '방학', ?, '2026-01-01')`,
      [id, group, track, `팀-${id}`, kind],
    );
  assert.throws(() => insert('GENERAL', null, 'STUDY', 'no-track'));
  assert.throws(() => insert('MENTORING', '분석', 'ADV', 'adv-mentoring'));
  assert.doesNotThrow(() => insert('MENTORING', '분석', 'STUDY', 'ok1'));
  assert.doesNotThrow(() => insert('GENERAL', '시각화', 'STUDY', 'ok2'));
});

test('DB 제약: 멘멘/친바 출결 줄은 멘멘 스터디에만 저장할 수 있다', async () => {
  const db = await freshDb();
  const insertRecord = (teamId: string, memberId: string, subType: string) =>
    db.run(
      `INSERT INTO attendance_records (team_id, week_id, member_id, sub_type, status)
       VALUES (?, 'w5', ?, ?, 'unmarked')`,
      [teamId, memberId, subType],
    );
  assert.throws(() => insertRecord('study_b', 'b1', '멘멘'));
  db.run(
    "DELETE FROM attendance_records WHERE team_id = 'study_a' AND week_id = 'w5' AND member_id = 'a1' AND sub_type = '멘멘'",
  );
  assert.doesNotThrow(() => insertRecord('study_a', 'a1', '멘멘'));
});

test('주차 활성 상태는 DB의 weeks 값에서 오고, 값을 바꾸면 그대로 반영된다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db).weeks;
  assert.equal(before.length, 16);
  assert.deepEqual(
    before.filter((w) => w.status === 'OPEN').map((w) => w.weekNum),
    [3],
  );
  // 학기(9~16주차)는 아직 시작 전이라 전부 비활성이고, 출결 세션도 없다.
  assert.ok(before.filter((w) => w.period === '학기').every((w) => w.status === 'UPCOMING'));
  const [{ count }] = queryAll<{ count: number }>(
    db,
    "SELECT COUNT(*) AS count FROM attendance_sessions WHERE week_id IN ('w9','w10','w11','w12','w13','w14','w15','w16')",
  );
  assert.equal(count, 0);

  db.run("UPDATE weeks SET status = 'CLOSED' WHERE id = 'w3'");
  db.run("UPDATE weeks SET status = 'OPEN' WHERE id = 'w4'");
  const after = loadTeamState(db).weeks;
  assert.equal(after.find((w) => w.weekNum === 3)?.status, 'CLOSED');
  assert.equal(after.find((w) => w.weekNum === 4)?.status, 'OPEN');
});

test('DB 제약: 주차 상태는 정해진 값만, 출결 세션은 존재하는 주차만 가리킨다', async () => {
  const db = await freshDb();
  assert.throws(() => db.run("UPDATE weeks SET status = 'ACTIVE' WHERE id = 'w1'"));
  assert.throws(() =>
    db.run("INSERT INTO attendance_sessions (team_id, week_id, submitted) VALUES ('study_a', 'w99', 0)"),
  );
});

test('멘멘 스터디의 PDF 첨부가 저장되고 다시 읽히며, 지우면 NULL이 된다', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  const key = 'w3|study|study_a';
  const withPdf = {
    ...before.attendance,
    [key]: {
      ...before.attendance[key],
      pdfUrl: 'blob:http://localhost/report',
      pdfName: '3주차_논문리뷰.pdf',
      pdfSize: '1.2 MB',
    },
  };
  persistAttendance(db, before.attendance, withPdf);

  const saved = loadTeamState(db).attendance[key];
  assert.equal(saved.pdfUrl, 'blob:http://localhost/report');
  assert.equal(saved.pdfName, '3주차_논문리뷰.pdf');
  assert.equal(saved.pdfSize, '1.2 MB');

  const removed = { ...withPdf, [key]: { ...withPdf[key], pdfUrl: null, pdfName: null, pdfSize: null } };
  persistAttendance(db, withPdf, removed);
  const cleared = loadTeamState(db).attendance[key];
  assert.equal(cleared.pdfUrl, null);
  assert.equal(cleared.pdfName, null);
});

test('시드의 멘멘 스터디 1·2주차에는 샘플 PDF가 붙어 있고, 3주차는 비어 있다', async () => {
  const db = await freshDb();
  const { attendance } = loadTeamState(db);

  for (const key of ['w1|study|study_a', 'w2|study|study_a', 'w1|study|study_m2', 'w2|study|study_m2']) {
    assert.ok(attendance[key].pdfUrl?.endsWith(SAMPLE_MENTORING_PDF_PATH), key);
    assert.equal(attendance[key].pdfName, '6주차_엔지_멘멘_B조.pdf');
  }
  assert.equal(attendance['w3|study|study_a'].pdfUrl, null);
  assert.equal(attendance['w3|study|study_m2'].pdfUrl, null);
  // 일반 스터디에는 PDF가 없다.
  assert.equal(attendance['w1|study|study_b'].pdfUrl, null);
});

test('샘플 PDF 파일이 실제로 public에 있다', () => {
  assert.ok(existsSync(new URL(`../public/${SAMPLE_MENTORING_PDF_PATH}`, import.meta.url)));
});

test('지난 기수(26기) 스터디는 그 기수의 팀·팀원·출결만 가지고 있다', async () => {
  const db = await freshDb();
  const state = loadTeamState(db);
  const past = state.studyTeams.filter((team) => team.cohort === 26);

  assert.deepEqual(past.map((team) => team.id).sort(), ['study_26a', 'study_26b', 'study_26c']);
  past.forEach((team) => {
    assert.ok(state.members[team.id].length >= 3, team.id);
    // 1~8주차가 모두 제출·확인 완료된 기록이다.
    for (let week = 1; week <= 8; week += 1) {
      const record = state.attendance[`w${week}|study|${team.id}`];
      assert.equal(record.submitted, true, `${team.id} w${week}`);
      assert.ok(Object.keys(record.statuses).length > 0);
    }
  });
  // 학기 주차(9~16주차)에는 스터디 출결 데이터가 없다.
  assert.equal(state.attendance['w9|study|study_26a'], undefined);
  // 지난 기수 멘멘 스터디의 PDF 첨부
  assert.ok(state.attendance['w2|study|study_26a'].pdfUrl?.endsWith(SAMPLE_MENTORING_PDF_PATH));
});

test('이름 중복 제한은 기수 안에서만 적용된다(다른 기수의 같은 이름은 허용)', async () => {
  const db = await freshDb();
  const before = loadTeamState(db);
  // 26기에는 분석 'A조'가 이미 있고, 27기에도 분석 'A조'가 있다 → 시드가 통과했다는 것이 곧 증거다.
  assert.equal(before.studyTeams.filter((t) => t.teamName === 'A조' && t.track === '분석').length, 2);

  const sameCohort = createStudyRecords({
    id: 'study_dup27',
    name: 'A조',
    studyKind: 'MENTORING',
    track: '분석',
    isVacation: true,
    leaderName: null,
    members: [],
  });
  assert.throws(
    () => persistTeams(db, before.studyTeams, [...before.studyTeams, sameCohort.team], 'STUDY'),
    /UNIQUE constraint failed/,
  );

  const otherCohort = createStudyRecords({
    id: 'study_new28',
    name: 'A조',
    studyKind: 'MENTORING',
    track: '분석',
    isVacation: true,
    cohort: 28,
    leaderName: null,
    members: [],
  });
  persistTeams(db, before.studyTeams, [...before.studyTeams, otherCohort.team], 'STUDY');
  assert.equal(loadTeamState(db).studyTeams.find((t) => t.id === 'study_new28')?.cohort, 28);
});

test('기수 목록은 DB의 cohorts에서 큰 기수부터 읽고, 20~27기가 들어 있다', async () => {
  const db = await freshDb();
  const { cohorts } = loadTeamState(db);
  assert.deepEqual(cohorts, [27, 26, 25, 24, 23, 22, 21, 20]);
  // 팀이 있는 기수는 모두 목록에 있어야 한다.
  const teamCohorts = new Set(loadTeamState(db).studyTeams.map((team) => team.cohort));
  teamCohorts.forEach((cohort) => assert.ok(cohorts.includes(cohort as number), String(cohort)));
});

test('ADV 팀은 26기까지 만들어져 있고, 27기 ADV 팀은 아직 없다', async () => {
  const db = await freshDb();
  const { advTeams } = loadTeamState(db);
  assert.equal(advTeams.length, 9);
  assert.ok(advTeams.every((team) => team.cohort === 26));
});

test('ADV 1~2주차는 제출 완료, 진행 중인 3주차는 제출 전이다', async () => {
  const state = loadTeamState(await freshDb());
  state.advTeams.forEach((team) => {
    assert.equal(state.attendance[`w1|study|${team.id}`].submitted, true, team.id);
    assert.equal(state.attendance[`w2|study|${team.id}`].submitted, true, team.id);
    assert.equal(state.attendance[`w3|study|${team.id}`].submitted, false, team.id);
  });
});
