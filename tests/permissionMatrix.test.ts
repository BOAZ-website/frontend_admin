import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_SET_COLUMNS,
  BASE_SET_RULES,
  isValidCombination,
  PERMISSIONS,
  baseSetKeyOf,
  isEffectivelyAllowed,
  isInBaseSet,
  toOverrides,
  PERMISSION_GROUPS,
} from '../src/entities/admin-account/model/permissions';
import { areaLevelIn, permissionSummaryIn } from '../src/entities/admin-account/model/catalog';

const permissionOf = (key: string) => {
  const permission = PERMISSIONS.find((p) => p.key === key);
  assert.ok(permission, `${key} 권한이 있어야 한다`);
  return permission;
};

const baseSetOf = (key: ReturnType<typeof baseSetKeyOf>) =>
  PERMISSIONS.filter((p) => isInBaseSet(p, key))
    .map((p) => p.key)
    .sort();

test('권한은 41개이고, 모두 기본 세트 7개 열에 O·X가 적혀 있으며 이름이 겹치지 않는다', () => {
  assert.equal(PERMISSIONS.length, 41);
  for (const permission of PERMISSIONS) {
    assert.match(permission.base, new RegExp(`^[OX]{${BASE_SET_COLUMNS.length}}$`), permission.key);
  }
  assert.equal(new Set(PERMISSIONS.map((p) => p.key)).size, PERMISSIONS.length);
});

test('명시 키 → TEAM 폴백 → 없음 순서로 기본 세트를 정한다', () => {
  assert.equal(baseSetKeyOf('MASTER', '서비스운영팀'), 'master');
  assert.equal(baseSetKeyOf('SUPER', '대표진'), 'president');
  assert.equal(baseSetKeyOf('SUPER', '차기대표진'), 'nextPresident');
  assert.equal(baseSetKeyOf('TEAM', '서비스운영팀'), 'serviceTeam');
  assert.equal(baseSetKeyOf('TEAM', '운영지원팀'), 'opsTeam');
  assert.equal(baseSetKeyOf('TEAM', '기획팀'), 'otherTeam');
  assert.equal(baseSetKeyOf('HOST', '그룹리더'), 'groupLeader');
});

test('새로 생긴 팀은 따로 정하지 않아도 기타 운영진 권한을 받는다', () => {
  assert.equal(baseSetKeyOf('TEAM', '홍보팀'), 'otherTeam');
});

test('폴백이 없는 역할의 정해지지 않은 조합은 기본 권한이 없다', () => {
  assert.equal(baseSetKeyOf('SUPER', '기획팀'), null);
  assert.equal(baseSetKeyOf('MASTER', '운영지원팀'), null);
  assert.deepEqual(baseSetOf(null), []);
});

test('다른 역할 전용 자리이거나 기본 세트가 없는 조합은 발급·수정에서 받지 않는다', () => {
  assert.equal(isValidCombination(BASE_SET_RULES, 'TEAM', '홍보팀'), true);
  assert.equal(isValidCombination(BASE_SET_RULES, 'TEAM', '서비스운영팀'), true);
  assert.equal(isValidCombination(BASE_SET_RULES, 'SUPER', '차기대표진'), true);
  // TEAM 폴백은 대표진도 받아 주지만, 대표진은 SUPER 전용 자리라 막는다.
  assert.equal(baseSetKeyOf('TEAM', '대표진'), 'otherTeam');
  assert.equal(isValidCombination(BASE_SET_RULES, 'TEAM', '대표진'), false);
  assert.equal(isValidCombination(BASE_SET_RULES, 'SUPER', '기획팀'), false);
  assert.equal(isValidCombination(BASE_SET_RULES, 'MASTER', '운영지원팀'), false);
});

test('기타 운영진과 그룹리더의 기본 세트는 백엔드 설계와 같다', () => {
  assert.deepEqual(baseSetOf('otherTeam'), [
    'ADMIN_ACCOUNT_SELF_WRITE',
    'EVALUATION_OWN_TRACK_WRITE',
    'FINAL_DECISION_READ',
  ]);
  assert.deepEqual(baseSetOf('groupLeader'), ['ADMIN_ACCOUNT_SELF_WRITE']);
});

test('예외는 기본 세트보다 우선하고, 담당 그룹 권한은 맡은 그룹 종류로만 정해진다', () => {
  const csv = permissionOf('APPLICANT_CSV_READ');
  const planner = { role: 'TEAM', teamName: '기획팀', leadership: [], overrides: {} };
  assert.equal(isEffectivelyAllowed(csv, planner), false);
  assert.equal(
    isEffectivelyAllowed(csv, { ...planner, overrides: { APPLICANT_CSV_READ: true } }),
    true,
  );

  const advOwn = permissionOf('ATTENDANCE_ADV_ENTRY_OWN_GROUP_WRITE');
  const studyOwn = permissionOf('ATTENDANCE_STUDY_ENTRY_OWN_GROUP_WRITE');
  const advLeader = { ...planner, leadership: ['ADV'] as const };
  assert.equal(isEffectivelyAllowed(advOwn, advLeader), true);
  assert.equal(isEffectivelyAllowed(studyOwn, advLeader), false);
});

test('체크 상태에서 기본 세트와 다른 항목만 예외로 남기고, 담당 그룹 권한은 넣지 않는다', () => {
  const overrides = toOverrides(
    {
      APPLICANT_CSV_READ: true,
      ADMIN_ACCOUNT_SELF_WRITE: true,
      EVALUATION_OWN_TRACK_WRITE: false,
      ATTENDANCE_ADV_ENTRY_OWN_GROUP_WRITE: true,
    },
    'otherTeam',
  );
  assert.deepEqual(overrides, { APPLICANT_CSV_READ: true, EVALUATION_OWN_TRACK_WRITE: false });
});

test('유효 권한을 영역별 관리·조회로 요약하고, 누구나 가진 권한은 빼고 센다', () => {
  const catalog = {
    groups: [...PERMISSION_GROUPS],
    baseSets: [...BASE_SET_COLUMNS],
    rules: [...BASE_SET_RULES],
    teamNames: [],
  };
  const of = (key: Parameters<typeof isInBaseSet>[1]) =>
    PERMISSIONS.filter((p) => isInBaseSet(p, key)).map((p) => p.key);

  // 기타 운영진: 본인 계정 수정(누구나)은 빠지고 서류 평가만 남는다.
  assert.deepEqual(
    permissionSummaryIn(catalog, of('otherTeam')).map((s) => [s.area, s.level]),
    [['서류 평가', 'manage']],
  );
  // 대표진: 출결은 조회만이라 조회, 점수 규칙 수정이 있는 출결 설정은 관리.
  const president = permissionSummaryIn(catalog, of('president'));
  assert.equal(president.find((s) => s.area === '출결 관리')?.level, 'read');
  assert.equal(president.find((s) => s.area === '출결 설정')?.level, 'manage');
  assert.equal(
    president.find((s) => s.area === '콘텐츠'),
    undefined,
  );
});

test('영역 수준은 관리·일부 관리·조회·맡은 그룹·없음으로 나뉜다', () => {
  const catalog = {
    groups: [...PERMISSION_GROUPS],
    baseSets: [...BASE_SET_COLUMNS],
    rules: [...BASE_SET_RULES],
    teamNames: [],
  };
  const area = (title: string) => PERMISSION_GROUPS.find((g) => g.title === title)!.permissions;

  assert.equal(areaLevelIn(catalog, area('리크루팅'), 'serviceTeam'), 'full');
  assert.equal(areaLevelIn(catalog, area('리크루팅'), 'president'), 'read');
  assert.equal(areaLevelIn(catalog, area('출결 설정'), 'president'), 'partial');
  assert.equal(areaLevelIn(catalog, area('출결 입력'), 'groupLeader'), 'ownGroup');
  assert.equal(areaLevelIn(catalog, area('계정·보안'), 'otherTeam'), 'none');
});
