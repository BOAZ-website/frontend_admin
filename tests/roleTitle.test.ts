import assert from 'node:assert/strict';
import test from 'node:test';

import { roleTitleOf } from '../src/entities/admin-account/model/roleTitle';

test('서비스운영팀장(MASTER)은 서비스운영팀이다', () => {
  assert.equal(roleTitleOf({ role: 'MASTER', teamName: '서비스운영팀' }), '서비스운영팀');
});

test('대표진·차기대표진(SUPER)은 팀 이름이다', () => {
  assert.equal(roleTitleOf({ role: 'SUPER', teamName: '대표진' }), '대표진');
  assert.equal(roleTitleOf({ role: 'SUPER', teamName: '차기대표진' }), '차기대표진');
});

test('팀 운영진(TEAM)은 팀장이어도 팀 이름만 보인다', () => {
  assert.equal(roleTitleOf({ role: 'TEAM', teamName: '기획팀' }), '기획팀');
});

test('스터디장·ADV 팀장(HOST)은 그룹 리더다', () => {
  assert.equal(roleTitleOf({ role: 'HOST', teamName: null }), '그룹 리더');
});

test('팀이 없는 운영진은 소속이 없다', () => {
  assert.equal(roleTitleOf({ role: 'TEAM', teamName: null }), null);
});
