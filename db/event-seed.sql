-- 행사 DB 예시 데이터(event-schema.sql). 유저 DB 예시 데이터(seed.sql) 다음에 넣는다.
-- 회원인 참가자는 user_id에 유저 DB의 회원 id를 직접 적는다(다른 DB라 조인으로 찾지 않는다).

-- ─────────────────────────── 행사 출결 (mock 데이터) ───────────────────────────

-- ── 출결 방식별 예시 행사 ─────────────────────────
-- 운영지원팀의 세 가지 출결 방식(신입 특칙형 · 컨퍼런스 1/2차형 · 일반 행사형)을 각각 보여 주는 예시다.
-- 추가 컬럼은 운영지원팀 명단 파일의 열을 그대로 따른다. 이름·출결·비고는 표에 원래 있는 열이다.
INSERT INTO events (id, title, status, event_date, start_time, end_time, location, description, allow_external,
                    checkin_method, checkin_code, status_column_index, attendance_format, session_labels, target_terms, target_tracks,
                    total_target_count, internal_attended_count, external_attended_count, created_at) VALUES
  ('evt_ex_newcomer', 'OT', 'FINISHED', '2026-07-11', '14:00', '18:00', '서울대학교 글로벌공학센터 세미나실', '[신입 특칙형 예시] 출석·뒤풀이 비용을 O/X로 기록. 결석 시 원칙적으로 선발 취소, 지각·조퇴 -15점', 0,
   'MANUAL', '7110', 3, 'NEWCOMER', '[]', '[27,28]', '["ANALYSIS","ENGINEERING","VISUALIZATION"]',
   6, 5, 0, '2026-07-11'),
  ('evt_ex_conference', 'BOAZ 24회 컨퍼런스', 'FINISHED', '2026-10-03', '13:00', '18:00', '연세대학교 백양누리 그랜드볼룸', '[컨퍼런스 1/2차형 예시] 1차·2차 출석을 0 불참 · 1 참석 · 2 조퇴 · 3 지각으로 기록. 현재 활동기수 · 활동기수 외 회원 · 외부 참석자 명단을 따로 받음', 1,
   'QR_CODE', '1003', NULL, 'CONFERENCE', '[]', '[27,28]', '["ANALYSIS","ENGINEERING","VISUALIZATION"]',
   8, 5, 2, '2026-10-03'),
  ('evt_ex_general', '2026 하반기 일반 행사', 'IN_PROGRESS', '', '15:00', '22:00', '', '[일반 행사형 예시] MT·해커톤·컨퍼톡·홈커밍데이를 한 표에서 관리. 행사마다 출결 코드 1 출석 · 2 지각 · 3 조퇴 · 4 결석 · 5 인정결석 · 0 무단지각 · X 무단결석', 0,
   'MANUAL', '0905', NULL, 'GENERAL', '["MT","해커톤","컨퍼톡","홈커밍데이"]', '[27,28]', '["ANALYSIS","ENGINEERING","VISUALIZATION"]',
   7, 5, 0, '2026-09-05');

INSERT INTO event_fields (event_id, position, field_id, label, type, options, is_required, target) VALUES
  ('evt_ex_newcomer', 0, 'f_ex_nc_term', '활동 TERM', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_newcomer', 1, 'f_ex_nc_cohort', '기수', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_newcomer', 2, 'f_ex_nc_track', '부문', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_newcomer', 3, 'f_ex_nc_fee', '뒤풀이 비용', 'SELECT', '["O","X"]', 0, 'ALL'),
  ('evt_ex_conference', 0, 'f_ex_cf_cohort', '기수', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_conference', 1, 'f_ex_cf_track', '부문', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_general', 0, 'f_ex_gn_term', '활동 TERM', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_general', 1, 'f_ex_gn_cohort', '기수', 'TEXT', NULL, 0, 'ALL'),
  ('evt_ex_general', 2, 'f_ex_gn_track', '부문', 'TEXT', NULL, 0, 'ALL');

INSERT INTO event_attendees (id, event_id, user_id, position, is_external, name, affiliation, term, email, phone, status,
                             second_status, session_statuses, checked_in_at, memo, custom_answers) VALUES
  -- 신입 특칙형: 신입(BASE) 기수만 대상
  ('att_ex_nc1', 'evt_ex_newcomer', 'u_28_01', 26, 0, '김서하', '28기 분석', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"분석"}'),
  ('att_ex_nc2', 'evt_ex_newcomer', 'u_28_02', 27, 0, '정채원', '28기 분석', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"분석"}'),
  ('att_ex_nc3', 'evt_ex_newcomer', 'u_28_04', 28, 0, '강태양', '28기 엔지니어링', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"엔지니어링"}'),
  ('att_ex_nc4', 'evt_ex_newcomer', 'u_28_05', 29, 0, '이도현', '28기 엔지니어링', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"엔지니어링"}'),
  ('att_ex_nc5', 'evt_ex_newcomer', 'u_28_08', 30, 0, '최민혁', '28기 시각화', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"시각화"}'),
  ('att_ex_nc6', 'evt_ex_newcomer', 'u_28_09', 31, 0, '한예린', '28기 시각화', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"시각화"}'),
  -- 컨퍼런스 1/2차형: 시트(현재 활동기수 · 활동기수 외 회원 · 외부 참석자)는 기수와 외부 여부로 나뉜다. 처음에는 출결이 모두 미정이다
  ('att_ex_cf1', 'evt_ex_conference', 'u_28_01', 32, 0, '김서하', '28기 분석', 28, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"28기","부문":"분석"}'),
  ('att_ex_cf2', 'evt_ex_conference', 'u_28_03', 33, 0, '오승현', '28기 분석', 28, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"28기","부문":"분석"}'),
  ('att_ex_cf3', 'evt_ex_conference', 'u_28_06', 34, 0, '임수진', '28기 엔지니어링', 28, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"28기","부문":"엔지니어링"}'),
  ('att_ex_cf4', 'evt_ex_conference', 'u_27_01', 35, 0, '문지훈', '27기 시각화', 27, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"27기","부문":"시각화"}'),
  ('att_ex_cf5', 'evt_ex_conference', 'u_27_02', 36, 0, '고준서', '27기 분석', 27, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"27기","부문":"분석"}'),
  ('att_ex_cf6', 'evt_ex_conference', 'u_26_01', 37, 0, '남민서', '26기 분석', 26, '', '', 'unmarked', 'unmarked', '{}', '-', NULL, '{"기수":"26기","부문":"분석"}'),
  ('att_ex_cf7', 'evt_ex_conference', NULL, 38, 1, '윤하준', '외부 참석자', NULL, '', '', 'unmarked', NULL, '{}', '-', '기념품 배부', '{}'),
  ('att_ex_cf8', 'evt_ex_conference', NULL, 39, 1, '서지안', '외부 참석자', NULL, '', '', 'unmarked', NULL, '{}', '-', NULL, '{}'),
  -- 일반 행사형: MT·해커톤·컨퍼톡·홈커밍데이를 한 표에 두고 행사마다 출결 코드를 기록(빈칸은 기록 없음)
  ('att_ex_gn1', 'evt_ex_general', 'u_28_01', 40, 0, '김서하', '28기 분석', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"분석"}'),
  ('att_ex_gn2', 'evt_ex_general', 'u_28_10', 41, 0, '윤재혁', '28기 시각화', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"시각화"}'),
  ('att_ex_gn3', 'evt_ex_general', 'u_28_05', 42, 0, '이도현', '28기 엔지니어링', 28, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"BASE","기수":"28기","부문":"엔지니어링"}'),
  ('att_ex_gn4', 'evt_ex_general', 'u_27_03', 43, 0, '남소희', '27기 엔지니어링', 27, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"ADV","기수":"27기","부문":"엔지니어링"}'),
  ('att_ex_gn5', 'evt_ex_general', 'u_27_04', 44, 0, '도현진', '27기 분석', 27, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"ADV","기수":"27기","부문":"분석"}'),
  ('att_ex_gn6', 'evt_ex_general', 'u_27_01', 45, 0, '문지훈', '27기 시각화', 27, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"ADV","기수":"27기","부문":"시각화"}'),
  ('att_ex_gn7', 'evt_ex_general', 'u_27_02', 46, 0, '고준서', '27기 분석', 27, '', '', 'unmarked', NULL, '{}', '-', NULL, '{"활동 TERM":"ADV","기수":"27기","부문":"분석"}');
