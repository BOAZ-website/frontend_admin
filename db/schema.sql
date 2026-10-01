-- BOAZ Admin 임시 DB 스키마 (SQLite)
--
-- 백엔드가 붙기 전까지 이 파일과 seed.sql이 앱의 "DB" 역할을 한다.
-- 앱이 시작될 때 sql.js(브라우저용 SQLite)로 schema.sql → seed.sql 순서로 실행하며,
-- 화면의 모든 조회·입력은 이 DB를 기준으로 한다(새로고침하면 seed 상태로 돌아간다).
-- 테이블 구성은 확정 스펙이 아니라 현재 화면 구조에서 필요한 형태로 잡은 초안이다.

PRAGMA foreign_keys = ON;

-- 부문(ENUM). 분석·시각화·엔지니어링만 쓸 수 있고, 사람과 팀의 부문은 모두 이 값을 가리킨다.
-- 값을 늘리거나 바꿀 때는 이 테이블만 고치면 된다.
CREATE TABLE tracks (
  name       TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL UNIQUE
);

-- 활동 기수 목록. 가장 큰 기수가 현재 기수이고, 그보다 작은 기수는 지난 기수(아카이브 조회 대상)다.
-- 새 기수의 출결을 만들면 그 기수가 가장 커지므로 이전 기수는 자동으로 지난 기수가 된다.
-- 팀·출결이 아직 없는 기수도 이 목록에는 있을 수 있다(그 기수를 고르면 빈 화면이 보인다).
CREATE TABLE cohorts (
  cohort INTEGER PRIMARY KEY CHECK (cohort > 0)
);

-- 동아리원. 스터디원·ADV 팀원·스터디장 후보는 모두 이 테이블의 사람을 가리킨다.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  term        INTEGER NOT NULL,                             -- 기수 (예: 26)
  track       TEXT    NOT NULL REFERENCES tracks (name),
  affiliation TEXT    NOT NULL DEFAULT '',                  -- 학교·회사 등 소속
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  UNIQUE (name, term)
);

-- 사진 파일. path는 public/images 아래의 상대 경로이고, 나중에 업로드 서비스로 옮기면 url을 채운다.
-- 화면에서는 url이 있으면 url, 없으면 path를 써서 이미지를 연다.
CREATE TABLE images (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  path          TEXT NOT NULL,                              -- 예: images/study/sample-study-photo.jpg
  url           TEXT,                                       -- 외부 URL(추후). 없으면 NULL
  original_name TEXT,
  size_label    TEXT                                        -- 예: '2.4 MB'
);

-- 스터디·ADV 팀. group_type으로 스터디/ADV를, kind로 스터디의 종류를 구분한다.
--   · 일반 스터디  : group_type='STUDY', kind='GENERAL'
--   · 멘멘 스터디  : group_type='STUDY', kind='MENTORING'
--   · ADV 팀       : group_type='ADV',   kind='GENERAL'
--   · BASE 트랙    : group_type='BASE',  kind='GENERAL' (기수마다 분석·시각화·엔지니어링 트랙 1개씩, team_name = 트랙 이름)
-- 모든 팀은 활동 기수(cohort)와 부문(track)을 하나씩 가진다. 지난 기수의 팀·출결은 그대로 남아 아카이브 조회에 쓰인다.
-- 이름은 같은 기수·부문 안에서만 겹칠 수 없고,
-- 다른 부문이라면 같은 이름을 쓸 수 있다(예: 분석 '테라폼 스터디'와 엔지니어링 '테라폼 스터디').
-- 화면과 출결 기록은 이름이 아니라 팀 id로 팀을 가리킨다.
-- 이름은 멘멘 스터디는 'A조', 'B조'처럼, 일반 스터디는 '테라폼 스터디'처럼 이름만 쓴다(team_name = study_name).
-- 멘멘 스터디는 팀원마다 멘멘/친바 두 줄로 출결을 기록한다(attendance_records.sub_type).
CREATE TABLE teams (
  id          TEXT PRIMARY KEY,
  group_type  TEXT NOT NULL CHECK (group_type IN ('STUDY', 'ADV', 'BASE')),
  cohort      INTEGER NOT NULL DEFAULT 27 CHECK (cohort > 0),   -- 활동 기수. 회원의 기수(users.term)와는 별개다
  track       TEXT NOT NULL REFERENCES tracks (name),       -- 부문
  team_name   TEXT NOT NULL,                                -- 부문 안에서만 유일
  study_name  TEXT NOT NULL,
  leader_id   TEXT REFERENCES users (id),                   -- 스터디장·팀장
  schedule    TEXT NOT NULL DEFAULT '미정',
  period      TEXT NOT NULL CHECK (period IN ('방학', '학기')),
  kind        TEXT NOT NULL DEFAULT 'GENERAL' CHECK (kind IN ('GENERAL', 'MENTORING')),
  description TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  UNIQUE (cohort, track, team_name),                        -- 같은 기수·부문 안에서 이름 중복 불가
  CHECK (group_type = 'STUDY' OR kind = 'GENERAL')          -- 멘멘은 스터디에만 있다
);

-- 종류별로 바로 조회하기 위한 뷰.
CREATE VIEW mentoring_studies AS
  SELECT * FROM teams WHERE group_type = 'STUDY' AND kind = 'MENTORING';
CREATE VIEW general_studies AS
  SELECT * FROM teams WHERE group_type = 'STUDY' AND kind = 'GENERAL';

-- 팀 소속. 한 사람이 여러 팀에 들어갈 수 있다.
CREATE TABLE team_members (
  id         TEXT PRIMARY KEY,                              -- 출결 기록이 가리키는 멤버 ID
  team_id    TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES users (id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, user_id)
);

-- 주차. status로 각 주차의 활성 여부를 데이터로 정한다(화면은 이 값을 따라 입력 가능 여부를 바꾼다).
--   · CLOSED   종료: 진행이 끝난 주차. 기록은 보이고 입력은 잠긴다(수정 요청으로만 변경)
--   · OPEN     진행 중: 출결을 입력할 수 있다
--   · UPCOMING 진행 예정: 아직 열리지 않았다. 출결은 미정이고 입력할 수 없다
-- 방학은 1~8주차, 학기는 9~16주차이며 스터디는 기간과 관계없이 1~8주차 표를 쓴다.
CREATE TABLE weeks (
  id       TEXT PRIMARY KEY,                                -- 'w1' ~ 'w16'
  week_num INTEGER NOT NULL UNIQUE,
  period   TEXT    NOT NULL CHECK (period IN ('방학', '학기')),
  label    TEXT    NOT NULL,                                -- '1주차'
  status   TEXT    NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('CLOSED', 'OPEN', 'UPCOMING'))
);

-- 기수별 주차 날짜 매핑. 출결 생성 창과 CSV 추출 설정 창이 같은 값을 읽고 쓴다.
-- 아직 날짜를 정하지 않은 주차는 행이 없다.
CREATE TABLE cohort_week_dates (
  cohort   INTEGER NOT NULL CHECK (cohort > 0),
  week_num INTEGER NOT NULL CHECK (week_num BETWEEN 1 AND 16),
  date     TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),  -- YYYY-MM-DD
  PRIMARY KEY (cohort, week_num)
);

-- 팀의 주차별 제출 상태와 활동 사진. 방학 1~8주차, 학기 9~16주차.
CREATE TABLE attendance_sessions (
  team_id            TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  week_id            TEXT    NOT NULL REFERENCES weeks (id),  -- 'w1' ~ 'w16'
  submitted          INTEGER NOT NULL DEFAULT 0,
  submitted_at       TEXT,
  confirmed_by_admin INTEGER NOT NULL DEFAULT 0,
  image_id           INTEGER REFERENCES images (id),
  -- 멘멘 스터디가 주차별로 첨부하는 PDF 자료(없으면 NULL). 멘멘 스터디만 쓴다.
  pdf_url            TEXT,
  pdf_name           TEXT,
  pdf_size           TEXT,
  PRIMARY KEY (team_id, week_id)
);

-- 멤버별 출결. 멘멘 스터디는 멤버마다 sub_type '멘멘'/'친바' 두 줄을 따로 기록하고, 그 외에는 ''를 쓴다.
CREATE TABLE attendance_records (
  team_id   TEXT NOT NULL,
  week_id   TEXT NOT NULL,
  member_id TEXT NOT NULL REFERENCES team_members (id) ON DELETE CASCADE,
  sub_type  TEXT NOT NULL DEFAULT '' CHECK (sub_type IN ('', '멘멘', '친바')),
  status    TEXT NOT NULL DEFAULT 'unmarked' CHECK (
    status IN ('present', 'late', 'earlyLeave', 'absent', 'excusedAbsent',
               'remote', 'unexcusedLate', 'unexcusedAbsent', 'unmarked')
  ),
  memo      TEXT,
  PRIMARY KEY (team_id, week_id, member_id, sub_type),
  FOREIGN KEY (team_id, week_id) REFERENCES attendance_sessions (team_id, week_id) ON DELETE CASCADE
);

-- 멘멘/친바 줄은 멘멘 스터디에서만 쓸 수 있다.
CREATE TRIGGER trg_records_sub_type_mentoring_only
BEFORE INSERT ON attendance_records
WHEN NEW.sub_type <> '' AND (SELECT kind FROM teams WHERE id = NEW.team_id) <> 'MENTORING'
BEGIN
  SELECT RAISE(ABORT, 'sub_type(멘멘/친바)은 멘멘 스터디에서만 쓸 수 있습니다');
END;

CREATE INDEX idx_team_members_team ON team_members (team_id);
CREATE INDEX idx_records_session ON attendance_records (team_id, week_id);


-- ─────────────────────────── 행사 출결 ───────────────────────────
-- 행사(컨퍼런스·해커톤·정기 세션 등)의 출석 명단은 팀 출결과 별개로 관리한다.

-- 행사 양식 템플릿. 새 행사를 만들 때 불러다 쓰는 기본값이다.
CREATE TABLE event_templates (
  id                     TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  allow_external         INTEGER NOT NULL DEFAULT 0,          -- 외부 참가자 허용 여부(0/1)
  default_checkin_method TEXT NOT NULL CHECK (default_checkin_method IN ('QR_CODE', 'CODE', 'MANUAL', 'OPEN_LINK')),
  created_at             TEXT NOT NULL
);

-- 템플릿의 추가 입력 항목(표의 추가 컬럼). position이 표시 순서다.
CREATE TABLE event_template_fields (
  template_id TEXT    NOT NULL REFERENCES event_templates (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  field_id    TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  type        TEXT    NOT NULL CHECK (type IN ('TEXT', 'SELECT', 'PHONE', 'EMAIL')),
  options     TEXT,                                            -- SELECT의 선택지(JSON 배열)
  is_required INTEGER NOT NULL DEFAULT 0,
  target      TEXT    NOT NULL DEFAULT 'ALL' CHECK (target IN ('ALL', 'INTERNAL_ONLY', 'EXTERNAL_ONLY')),
  PRIMARY KEY (template_id, position)
);

CREATE TABLE events (
  id                       TEXT PRIMARY KEY,
  title                    TEXT NOT NULL,
  status                   TEXT NOT NULL CHECK (status IN ('UPCOMING', 'IN_PROGRESS', 'FINISHED')),
  event_date               TEXT NOT NULL,                      -- YYYY-MM-DD
  start_time               TEXT NOT NULL,                      -- HH:MM
  end_time                 TEXT NOT NULL,
  location                 TEXT NOT NULL DEFAULT '',
  description              TEXT NOT NULL DEFAULT '',
  allow_external           INTEGER NOT NULL DEFAULT 0,
  checkin_method           TEXT NOT NULL CHECK (checkin_method IN ('QR_CODE', 'CODE', 'MANUAL', 'OPEN_LINK')),
  checkin_code             TEXT NOT NULL DEFAULT '',
  status_column_index      INTEGER,                            -- 표에서 출결 컬럼 앞에 오는 추가 컬럼 수. NULL이면 추가 컬럼 뒤(맨 끝)
  target_terms             TEXT NOT NULL DEFAULT '[]',         -- 대상 기수(JSON 배열)
  target_tracks            TEXT NOT NULL DEFAULT '[]',         -- 대상 부문 코드(JSON 배열)
  total_target_count       INTEGER NOT NULL DEFAULT 0,
  internal_attended_count  INTEGER NOT NULL DEFAULT 0,
  external_attended_count  INTEGER NOT NULL DEFAULT 0,
  created_at               TEXT NOT NULL
);

-- 행사 출석 표의 추가 컬럼. position이 표시 순서다.
CREATE TABLE event_fields (
  event_id    TEXT    NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  field_id    TEXT    NOT NULL,
  label       TEXT    NOT NULL,
  type        TEXT    NOT NULL CHECK (type IN ('TEXT', 'SELECT', 'PHONE', 'EMAIL')),
  options     TEXT,
  is_required INTEGER NOT NULL DEFAULT 0,
  target      TEXT    NOT NULL DEFAULT 'ALL' CHECK (target IN ('ALL', 'INTERNAL_ONLY', 'EXTERNAL_ONLY')),
  PRIMARY KEY (event_id, position)
);

-- 행사 참가자와 그 출결. position이 명단 표시 순서다.
-- custom_answers는 추가 컬럼 값(컬럼 이름 또는 field_id → 값)의 JSON 객체다.
CREATE TABLE event_attendees (
  id             TEXT PRIMARY KEY,
  event_id       TEXT    NOT NULL REFERENCES events (id) ON DELETE CASCADE,
  user_id        TEXT REFERENCES users (id) ON DELETE SET NULL, -- 내부 참가자. 외부 참가자는 NULL
  position       INTEGER NOT NULL,
  is_external    INTEGER NOT NULL DEFAULT 0,
  name           TEXT    NOT NULL,
  affiliation    TEXT    NOT NULL DEFAULT '',
  term           INTEGER,
  email          TEXT    NOT NULL DEFAULT '',
  phone          TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL CHECK (status IN ('present', 'late', 'earlyLeave', 'absent', 'excusedAbsent',
                                                    'unexcusedLate', 'unexcusedAbsent', 'unmarked')),
  checked_in_at  TEXT    NOT NULL DEFAULT '-',
  memo           TEXT,
  custom_answers TEXT    NOT NULL DEFAULT '{}',
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_event_attendees_event ON event_attendees (event_id, position);


-- ─────────────────────────── HOST 계정 ───────────────────────────
-- 스터디장·ADV 팀장이 로그인하는 HOST 계정. 계정마다 담당 팀 이름(team)이 하나 있고,
-- 여러 팀을 맡거나 겸직이면 아래 자식 테이블에 함께 남는다.
CREATE TABLE host_accounts (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL UNIQUE,
  initial_password TEXT,
  user_id          TEXT REFERENCES users (id) ON DELETE SET NULL, -- 계정 주인(동아리원). 이름·기수·부문은 users에서 읽는다
  host_name        TEXT,                                       -- user_id가 없을 때만 쓰는 이름
  generation       TEXT,                                       -- user_id가 없을 때만 쓰는 기수(예: '26기')
  track            TEXT,                                       -- user_id가 없을 때만 쓰는 부문
  role             TEXT,                                       -- 예: '그룹리더'
  team_id          TEXT REFERENCES teams (id) ON DELETE SET NULL, -- 담당 팀. 팀 이름·부문은 teams에서 읽는다. 아직 팀이 없으면 NULL(팀 개설 대기)
  group_type       TEXT,                                       -- 'ADV' | '스터디'
  account_type     TEXT CHECK (account_type IN ('STUDY', 'ADV')),
  created_at       TEXT NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  last_login       TEXT
);

-- 계정이 가진 권한(ADV/STUDY). ADV와 스터디를 함께 맡는 계정은 두 줄이다.
CREATE TABLE host_permissions (
  host_id    TEXT    NOT NULL REFERENCES host_accounts (id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  permission TEXT    NOT NULL CHECK (permission IN ('ADV', 'STUDY')),
  PRIMARY KEY (host_id, position)
);

-- 계정이 맡은 그룹(팀) 목록. 스터디·ADV 팀 출결이 쓰는 teams를 그대로 가리킨다.
CREATE TABLE host_assigned_groups (
  host_id  TEXT    NOT NULL REFERENCES host_accounts (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  team_id  TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  PRIMARY KEY (host_id, position)
);

-- 겸직 표시(운영진, 다른 팀 등).
CREATE TABLE host_concurrent_roles (
  host_id  TEXT    NOT NULL REFERENCES host_accounts (id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  role     TEXT    NOT NULL,
  PRIMARY KEY (host_id, position)
);
