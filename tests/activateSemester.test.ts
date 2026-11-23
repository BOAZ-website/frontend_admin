import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import type { Season, SeasonArchiveReadiness } from '../src/entities/cohort/model/season';
import {
  archiveBlockMessage,
  confirmAndActivate,
} from '../src/pages/system-semesters/model/activateSemester';

const READY: SeasonArchiveReadiness = {
  blockReason: null,
  canArchive: true,
  lastWeek: { weekNo: 27, isClosed: true },
  blockingItems: [],
};

const seasonOf = (name: string, status: Season['status']): Season => ({
  id: name === '26-2' ? 27 : 28,
  name,
  half: name.endsWith('-1') ? 'H1' : 'H2',
  status,
  baseTerm: name === '26-2' ? 27 : 28,
  advTerm: name === '26-2' ? 26 : 27,
  startDate: '',
  endDate: '',
  isEditable: status === 'DRAFT',
});
const NEXT = seasonOf('27-1', 'DRAFT');
const CURRENT = seasonOf('26-2', 'ACTIVE');

let alerts: string[] = [];
let calls: string[] = [];

beforeEach(() => {
  alerts = [];
  calls = [];
  // 확인 창은 늘 확인을 누른 것으로 본다.
  globalThis.window = {
    confirm: () => true,
    alert: (message: string) => alerts.push(message),
  } as unknown as Window & typeof globalThis;
});

/** 호출 순서를 남기는 가짜 API. activateError를 주면 활성화가 그 오류로 실패한다. */
function actionsWith(readiness: SeasonArchiveReadiness, activateError?: Error) {
  return {
    checkArchive: async ({ name }: Season) => {
      calls.push(`check:${name}`);
      return readiness;
    },
    archive: async ({ name }: Season) => {
      calls.push(`archive:${name}`);
    },
    activate: async ({ name }: Season) => {
      calls.push(`activate:${name}`);
      if (activateError) throw activateError;
    },
  };
}

test('진행 반기가 있으면 종료 점검 → 종료 → 활성화 순서로 부른다', async () => {
  const isChanged = await confirmAndActivate(NEXT, CURRENT, actionsWith(READY));

  assert.equal(isChanged, true);
  assert.deepEqual(calls, ['check:26-2', 'archive:26-2', 'activate:27-1']);
});

test('종료 점검에서 막히면 이유를 알리고 종료·활성화를 부르지 않는다', async () => {
  const blocked: SeasonArchiveReadiness = {
    ...READY,
    canArchive: false,
    lastWeek: { weekNo: 27, isClosed: false },
    blockingItems: [{ reason: 'PENDING', groupName: 'ADV 1팀', weekNo: 15, roundNo: null }],
  };

  const isChanged = await confirmAndActivate(NEXT, CURRENT, actionsWith(blocked));

  assert.equal(isChanged, false);
  assert.deepEqual(calls, ['check:26-2']);
  assert.match(alerts[0], /마지막 27주차가 아직 끝나지 않았습니다/);
  assert.match(alerts[0], /ADV 1팀 15주차: 승인 대기/);
});

test('진행 반기가 없으면 점검·종료 없이 활성화만 한다', async () => {
  await confirmAndActivate(NEXT, null, actionsWith(READY));

  assert.deepEqual(calls, ['activate:27-1']);
});

test('화면이 이미 종료한 반기를 진행 반기로 알고 있으면 종료를 건너뛰고 활성화한다', async () => {
  const ended: SeasonArchiveReadiness = {
    ...READY,
    blockReason: 'SEASON_ARCHIVED',
    canArchive: false,
  };

  const isChanged = await confirmAndActivate(NEXT, CURRENT, actionsWith(ended));

  assert.equal(isChanged, true);
  assert.deepEqual(calls, ['check:26-2', 'activate:27-1']);
  assert.deepEqual(alerts, []);
});

test('종료한 뒤 활성화만 실패하면 다시 누르라고 알리고, 반기 상태가 바뀌었으므로 true를 돌려준다', async () => {
  const isChanged = await confirmAndActivate(
    NEXT,
    CURRENT,
    actionsWith(READY, new Error('명단이 비었습니다.')),
  );

  assert.equal(isChanged, true);
  assert.deepEqual(alerts, [
    '명단이 비었습니다.',
    '26-2은 종료되었습니다. 활성화 버튼을 다시 눌러 27-1을 활성화해 주세요.',
  ]);
});

test('종료할 수 있으면 막힘 문구가 없다', () => {
  assert.equal(archiveBlockMessage('26-2', READY), null);
});
