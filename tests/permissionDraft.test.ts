import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BASE_SET_COLUMNS,
  BASE_SET_RULES,
  PERMISSION_GROUPS,
} from '../src/entities/admin-account/model/permissions';
import type { AdminAccount, PermissionCatalog } from '../src/entities/admin-account/model/types';
import {
  baseCheckedOf,
  changeCountsOf,
  changeMarkOf,
  lockReasonOf,
  resetToBaseChecked,
  saveSummaryOf,
  savedCheckedOf,
  unsavedCountOf,
} from '../src/pages/system-accounts/model/permissionDraft';

const catalog: PermissionCatalog = {
  groups: [...PERMISSION_GROUPS],
  baseSets: [...BASE_SET_COLUMNS],
  rules: [...BASE_SET_RULES],
  teamNames: ['서비스운영팀', '기획팀'],
};

const permissionOf = (key: string) => {
  const permission = PERMISSION_GROUPS.flatMap((group) => group.permissions).find(
    (p) => p.key === key,
  );
  assert.ok(permission, `${key} 권한이 있어야 한다`);
  return permission;
};

/** 기획팀(기타 운영진) 계정. 유효 권한은 기본 세트에 예외를 반영한 값으로 만든다. */
const accountOf = (overrides: Record<string, boolean>, patch: Partial<AdminAccount> = {}) => {
  const base = PERMISSION_GROUPS.flatMap((group) => group.permissions).filter(
    (p) => !p.ownGroup && p.base[5] === 'O',
  );
  const effective = new Set(base.map((p) => p.key));
  Object.entries(overrides).forEach(([key, isGranted]) =>
    isGranted ? effective.add(key) : effective.delete(key),
  );
  return {
    id: 6,
    userId: 'u_28_09',
    username: 'boaz_plan_lead',
    name: '한예린',
    role: 'TEAM',
    track: '분석',
    term: 28,
    teamName: '기획팀',
    isTeamLead: false,
    createdBy: 1,
    createdAt: '2026-07-15 09:10:00',
    updatedAt: '2026-07-15 09:10:00',
    baseSetKey: 'otherTeam',
    leadership: [],
    overrides,
    effectivePermissions: [...effective],
    ...patch,
  } satisfies AdminAccount;
};

test('저장된 체크 상태는 맡은 그룹 권한을 빼고, 기본 권한만 체크하면 추가·제외가 0이다', () => {
  const account = accountOf({});
  const saved = new Set(savedCheckedOf(catalog, account));
  assert.ok(![...saved].some((key) => permissionOf(key).ownGroup));
  assert.deepEqual(changeCountsOf(catalog, account, saved), { added: 0, removed: 0 });
  assert.deepEqual(new Set(baseCheckedOf(catalog, account)), saved);
});

test('기본 권한에 없는 것을 체크하면 추가, 기본 권한을 풀면 제외로 표시한다', () => {
  const account = accountOf({ CONTENT_WRITE: true, FINAL_DECISION_READ: false });
  const checked = new Set(savedCheckedOf(catalog, account));

  assert.equal(changeMarkOf(catalog, account, permissionOf('CONTENT_WRITE'), checked), 'added');
  assert.equal(
    changeMarkOf(catalog, account, permissionOf('FINAL_DECISION_READ'), checked),
    'removed',
  );
  assert.equal(
    changeMarkOf(catalog, account, permissionOf('ADMIN_ACCOUNT_SELF_WRITE'), checked),
    null,
  );
  assert.deepEqual(changeCountsOf(catalog, account, checked), { added: 1, removed: 1 });
});

test('저장된 상태와 다른 권한 수를 센다', () => {
  const saved = ['A', 'B'];
  assert.equal(unsavedCountOf(saved, new Set(['A', 'B'])), 0);
  assert.equal(unsavedCountOf(saved, new Set(['A', 'C'])), 2);
  assert.equal(unsavedCountOf(saved, new Set(['A'])), 1);
});

test('"타 계정 정보 수정" 권한은 본인과 마지막 보유자에게서 풀 수 없다', () => {
  const holder = accountOf({ ADMIN_ACCOUNT_WRITE: true });
  const other = accountOf({ ADMIN_ACCOUNT_WRITE: true }, { id: 7 });
  const write = permissionOf('ADMIN_ACCOUNT_WRITE');

  assert.match(lockReasonOf(write, holder, { id: 6 }, [holder, other]) ?? '', /본인/);
  assert.match(lockReasonOf(write, holder, { id: 1 }, [holder]) ?? '', /마지막/);
  assert.equal(lockReasonOf(write, holder, { id: 1 }, [holder, other]), null);
  assert.equal(lockReasonOf(permissionOf('CONTENT_WRITE'), holder, { id: 6 }, [holder]), null);
});

test('"권한 부여" 권한도 본인과 마지막 보유자에게서 풀 수 없다', () => {
  const holder = accountOf({ ADMIN_PERMISSION_WRITE: true });
  const other = accountOf({ ADMIN_PERMISSION_WRITE: true }, { id: 7 });
  const grant = permissionOf('ADMIN_PERMISSION_WRITE');

  assert.match(lockReasonOf(grant, holder, { id: 6 }, [holder, other]) ?? '', /본인/);
  assert.match(lockReasonOf(grant, holder, { id: 1 }, [holder]) ?? '', /마지막/);
  assert.equal(lockReasonOf(grant, holder, { id: 1 }, [holder, other]), null);
});

test('저장 확인 문구는 더한 권한과 뺀 권한을 카탈로그 순서로 나눠 적는다', () => {
  const saved = ['CONTENT_READ', 'AUDIT_LOG_READ'];

  const text = saveSummaryOf(catalog, saved, new Set(['CONTENT_READ', 'CONTENT_WRITE']));

  assert.ok(text.includes('추가 1개'));
  assert.ok(text.includes('제외 1개'));
  assert.ok(!text.includes('추가 2개'));
});

test('기본 권한으로 되돌려도 잠긴 권한은 켜진 채 남는다', () => {
  const account = accountOf({});
  const locked = permissionOf('ADMIN_ACCOUNT_WRITE');
  // 본인 계정은 "타 계정 정보 수정"을 스스로 뺄 수 없다(잠김).
  const isLocked = lockReasonOf(locked, account, { id: account.id }, [account]) !== null;

  const next = resetToBaseChecked(
    catalog,
    account,
    { id: account.id },
    [account],
    new Set([locked.key]),
  );

  assert.equal(next.has(locked.key), isLocked);
  assert.deepEqual(
    [...next].filter((key) => key !== locked.key).sort(),
    baseCheckedOf(catalog, account)
      .filter((key) => key !== locked.key)
      .sort(),
  );
});
