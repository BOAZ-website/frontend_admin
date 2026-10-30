-- ─────────────────────────── 새 개발용 계정과 MASTER+평가 관련 추가 권한 생성 ───────────────────────────

--1. 회원 정보 생성(test_user는 이름, boaz_dev_all은 id)
INSERT INTO users (id, name, term, track, club_role)
VALUES ('u_dev_full_access', 'test_user', '27','엔지니어링', 'OPERATOR');

--2. 관리자 계정 생성
INSERT INTO admin (id, user_id, username, password, role, team_name, created_by, created_at, updated_at)
VALUES (41, 'u_dev_full_access','boaz_dev_all','Boaz!2026', 'MASTER', '서비스운영팀', 1, datetime('now'), datetime('now'));

--3. MASTER 기본 권한에 없는 4개 권한 추가
INSERT INTO admin_permission_override(admin_id, permission, effect, granted_by, created_at)
VALUES
  (41, 'EVALUATION_OWN_TRACK_WRITE', 'GRANT', 1, datetime('now')),
  (41, 'EVALUATION_ALL_TRACK_WRITE', 'GRANT', 1, datetime('now')),
  (41, 'FINAL_DECISION_WRITE', 'GRANT', 1, datetime('now')),
  (41, 'FINAL_DECISION_READ', 'GRANT', 1, datetime('now'));
