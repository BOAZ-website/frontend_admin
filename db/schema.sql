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

-- 활동 반기. cohort(활동 기수 번호, 예: 27)가 키이고, 화면과 API는 반기 표기(semester_label, 예: '26-2')로 가리킨다.
-- 현재 반기는 is_current = 1인 한 행이며 운영진이 API로 바꾼다. 그보다 작은 반기는 지난 반기(아카이브 조회 대상)다.
-- 회원의 기수(users.term)와는 별개다. 기수와 반기의 관계는 아래 adv_term과 semester_member_terms가 정한다.
-- 팀·출결이 아직 없는 반기도 이 목록에는 있을 수 있다(그 반기를 고르면 빈 화면이 보인다).
CREATE TABLE cohorts (
  cohort         INTEGER PRIMARY KEY CHECK (cohort > 0),
  semester_label TEXT    NOT NULL UNIQUE CHECK (semester_label GLOB '[0-9][0-9]-[12]'),
  start_date     TEXT    NOT NULL CHECK (start_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  end_date       TEXT    NOT NULL CHECK (end_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  is_current     INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1)),
  adv_term       INTEGER CHECK (adv_term > 0),             -- 이 반기에 ADV를 진행하는 회원 기수(ADV 팀의 teams.cohort). 없으면 NULL
  CHECK (start_date <= end_date)
);
CREATE UNIQUE INDEX idx_cohorts_single_current ON cohorts (is_current) WHERE is_current = 1;
CREATE UNIQUE INDEX idx_cohorts_adv_term ON cohorts (adv_term) WHERE adv_term IS NOT NULL;

-- 반기별 출결 점수 집계 대상 회원 기수(예: 26-2 반기 → 26기·27기).
CREATE TABLE semester_member_terms (
  cohort INTEGER NOT NULL REFERENCES cohorts (cohort) ON DELETE CASCADE,
  term   INTEGER NOT NULL CHECK (term > 0),
  PRIMARY KEY (cohort, term)
);

-- 동아리원. 스터디원·ADV 팀원·스터디장 후보는 모두 이 테이블의 사람을 가리킨다.
CREATE TABLE users (
  id          TEXT PRIMARY KEY,
  provider    TEXT NOT NULL DEFAULT 'KAKAO' CHECK (provider IN ('KAKAO', 'GOOGLE', 'NAVER')),
  provider_id TEXT NOT NULL DEFAULT '',
  nickname    TEXT,
  member_type TEXT NOT NULL DEFAULT 'OUTSIDER' CHECK (member_type IN ('OUTSIDER', 'MEMBER')),
  name        TEXT    NOT NULL,
  term        INTEGER NOT NULL,                             -- 기수 (예: 26)
  track       TEXT    NOT NULL REFERENCES tracks (name),    -- 부문
  affiliation TEXT    NOT NULL DEFAULT '',                  -- 학교·회사 등 소속
  email       TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  university  TEXT    NOT NULL DEFAULT '',                  -- 대학교
  major       TEXT    NOT NULL DEFAULT '',                  -- 전공
  minor_double_major TEXT NOT NULL DEFAULT '[]',             -- JSON 배열
  last_semester INTEGER,
  military_status TEXT CHECK (military_status IN ('COMPLETED_OR_EXEMPT', 'NOT_COMPLETED')),
  birth_date TEXT,
  graduation_date TEXT CHECK (graduation_date IS NULL OR graduation_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]'),
  grad_school_plan INTEGER NOT NULL DEFAULT 0 CHECK (grad_school_plan IN (0, 1)),
  -- 동아리원 관리 화면에서 고치는 값: 활동 상태(ACTIVE 활동기수, ALUMNI 수료, WITHDRAWN 탈퇴), 동아리 역할
  club_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (club_status IN ('ACTIVE', 'ALUMNI', 'WITHDRAWN')),
  club_role   TEXT NOT NULL DEFAULT 'MEMBER' CHECK (club_role IN ('MEMBER', 'OPERATOR', 'PRESIDENT')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (name, term)
);

-- 출결·점수 시스템에서 사용하는 반기별 회원 명단. users는 전역 계정/프로필이고,
-- 이 테이블에 등록된 사람만 해당 반기의 팀원·팀장 후보로 조회된다. 새 반기는 빈 명단으로 시작한다.
CREATE TABLE semester_members (
  cohort    INTEGER NOT NULL REFERENCES cohorts (cohort) ON DELETE CASCADE,
  user_id   TEXT    NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name      TEXT    NOT NULL,
  term      INTEGER NOT NULL CHECK (term > 0),
  track     TEXT    NOT NULL REFERENCES tracks (name),
  created_at TEXT   NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (cohort, user_id)
);
CREATE INDEX idx_semester_members_user ON semester_members (user_id);

-- 동아리 활동 명단. 로그인 계정(users)과 분리해 기수별·부문별 이력을 보존한다.
CREATE TABLE members (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  term       INTEGER NOT NULL CHECK (term > 0),
  track      TEXT NOT NULL REFERENCES tracks (name),
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, term, track)
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
  semester_cohort INTEGER NOT NULL DEFAULT 27 REFERENCES cohorts (cohort), -- 이 팀 데이터가 속한 반기
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
  UNIQUE (cohort, track, team_name),                        -- 기존 기수 키 중복 방지
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
  member_id  TEXT REFERENCES members (id),
  user_id    TEXT REFERENCES users (id),                    -- 기존 시드 호환용, 이후 member_id 사용
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (team_id, user_id)
);

-- 주차 목록. 방학은 1~8주차, 학기는 9~16주차이며 스터디는 기간과 관계없이 1~8주차 표를 쓴다.
-- 주차의 진행 상태는 반기마다 다르므로 아래 semester_weeks에 둔다.
CREATE TABLE weeks (
  id       TEXT PRIMARY KEY,                                -- 'w1' ~ 'w16'
  week_num INTEGER NOT NULL UNIQUE,
  period   TEXT    NOT NULL CHECK (period IN ('방학', '학기')),
  label    TEXT    NOT NULL                                 -- '1주차'
);

-- 반기별 주차 진행 상태. API는 이 값으로 출결 입력 가능 여부를 정한다. 행이 없는 주차는 진행 예정으로 본다.
--   · CLOSED   종료: 진행이 끝난 주차. 기록은 보이고 입력은 잠긴다(수정 요청으로만 변경)
--   · OPEN     진행 중: 출결을 입력할 수 있다
--   · UPCOMING 진행 예정: 아직 열리지 않았다. 출결은 미정이고 입력할 수 없다
CREATE TABLE semester_weeks (
  cohort  INTEGER NOT NULL REFERENCES cohorts (cohort) ON DELETE CASCADE,
  week_id TEXT    NOT NULL REFERENCES weeks (id),
  status  TEXT    NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('CLOSED', 'OPEN', 'UPCOMING')),
  PRIMARY KEY (cohort, week_id)
);

-- 기수별 주차 날짜 매핑. 출결 생성 창과 CSV 추출 설정 창이 같은 값을 읽고 쓴다.
-- 아직 날짜를 정하지 않은 주차는 행이 없다.
CREATE TABLE cohort_week_dates (
  cohort   INTEGER NOT NULL CHECK (cohort > 0),
  week_num INTEGER NOT NULL CHECK (week_num BETWEEN 1 AND 16),
  date     TEXT    NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'), -- YYYY-MM-DD
  PRIMARY KEY (cohort, week_num)
);

-- 팀의 주차별 제출 상태와 활동 사진. 방학 1~8주차, 학기 9~16주차.
CREATE TABLE attendance_sessions (
  team_id            TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  week_id            TEXT    NOT NULL REFERENCES weeks (id), -- 'w1' ~ 'w16'
  submitted          INTEGER NOT NULL DEFAULT 0,
  submitted_at       TEXT,
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

-- 기존 조회 코드와의 호환용 뷰. 반기는 모든 팀이 명시적인 외래 키로 직접 가진다.
CREATE VIEW team_semesters AS
  SELECT id AS team_id, semester_cohort FROM teams;

-- 출결 점수 규칙 버전. 점수 기준이 바뀔 때 새 버전을 만들고 적용 기간으로 사용할 버전을 고른다.
-- 전체에서 ACTIVE 규칙은 하나뿐이다. term은 기존 API 호환용 값이다.
CREATE TABLE score_rules (
  id                        TEXT PRIMARY KEY,
  version                   INTEGER NOT NULL,
  term                      INTEGER NOT NULL REFERENCES cohorts (cohort) CHECK (term > 0),
  name                      TEXT    NOT NULL,
  start_date                TEXT    NOT NULL,
  end_date                  TEXT,
  status                    TEXT    NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE', 'DRAFT', 'SCHEDULED')),
  activated_at              TEXT,
  created_by                TEXT    NOT NULL,
  description               TEXT    NOT NULL DEFAULT '',
  present_score             REAL    NOT NULL DEFAULT 0,
  absent_penalty            REAL    NOT NULL DEFAULT 0,
  unexcused_absent_penalty  REAL    NOT NULL DEFAULT 0,
  late_penalty              REAL    NOT NULL DEFAULT 0,
  early_leave_penalty       REAL    NOT NULL DEFAULT 0,
  unexcused_late_penalty    REAL    NOT NULL DEFAULT 0,
  study_fail_penalty        REAL    NOT NULL DEFAULT 0,
  study_perfect_bonus       REAL    NOT NULL DEFAULT 0,
  study_pass_bonus          REAL    NOT NULL DEFAULT 0,
  study_leader_bonus        REAL    NOT NULL DEFAULT 0,
  study_pass_max_absences   REAL    NOT NULL DEFAULT 2,  -- 스터디 수료로 보는 최대 결석 횟수(이보다 많이 결석하면 study_fail_penalty)
  study_none_completed_penalty REAL NOT NULL DEFAULT -5, -- 스터디를 하나도 이수(참여)하지 않은 경우 감점
  base_score                REAL    NOT NULL DEFAULT 10,  -- 기본 활동점수(최초 가입 시 1회, 기본: +10)
  newcomer_excused_absent_penalty REAL    NOT NULL DEFAULT -10,  -- 신입 특칙: 운영진이 인정한 사유의 결석(기본: -10)
  newcomer_late_penalty     REAL    NOT NULL DEFAULT -15,  -- 신입 특칙: 지각 또는 조퇴(기본: -15)
  newcomer_excused_late_penalty REAL    NOT NULL DEFAULT -5,  -- 신입 특칙: 인정 사유가 있는 지각 또는 조퇴(기본: -5)
  conference_first_bonus    REAL    NOT NULL DEFAULT 1,  -- 컨퍼런스 1차 출석 가점(기본: +1)
  conference_second_bonus   REAL    NOT NULL DEFAULT 1,  -- 컨퍼런스 2차 출석 가점(기본: +1)
  excused_absent_score      REAL    NOT NULL DEFAULT 0,  -- 인정결석 점수(기본: 0)
  unexcused_lates_per_absence REAL    NOT NULL DEFAULT 3,  -- 무단결석 1회로 환산하는 무단지각 횟수(기본: 3)
  expel_unexcused_absences  REAL    NOT NULL DEFAULT 3,  -- 제명되는 무단결석 누적 횟수(기본: 3)
  CHECK (end_date IS NULL OR start_date <= end_date)
);
CREATE UNIQUE INDEX idx_score_rules_single_active ON score_rules (status) WHERE status = 'ACTIVE';



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

-- ─────────────────────────── 운영진 계정·권한 ───────────────────────────
-- 운영진(관리자) 계정. HOST 계정은 위 host_accounts가 따로 맡는다.
-- 운영진은 모두 회원(users)이다. 계정은 user_id로 회원 한 명을 가리키고, 이름·기수·부문은 users에서 읽는다
-- (계정에 따로 저장하지 않아 동아리원 관리에서 고친 값이 그대로 반영된다).
-- 권한은 (role, team_name) 조합의 기본 권한 세트(코드) + 계정별 예외(admin_permission_override)
-- + 맡은 그룹에서 계산되는 권한(admin_group_leader)으로 정해진다. docs/spec/06-system.md §3.
CREATE TABLE admin (
  id         INTEGER PRIMARY KEY,
  user_id    TEXT    NOT NULL UNIQUE REFERENCES users (id) ON DELETE RESTRICT, -- 계정 주인(회원). 회원 한 명에 계정 하나, 계정이 있는 회원은 지울 수 없다
  username   TEXT    UNIQUE,                               -- 로그인 아이디. 운영진으로 정해졌지만 계정을 아직 발급하지 않았으면 NULL
  password   TEXT,                                         -- 임시 DB 전용 평문(실제 서버는 해시). 아이디와 함께 NULL이거나 함께 채워진다
  role       TEXT    NOT NULL CHECK (role IN ('MASTER', 'SUPER', 'TEAM')),
  team_name  TEXT    NOT NULL,                             -- 운영진의 자리(대표진·서비스운영팀 등). 새 팀이 생길 수 있어 값을 제한하지 않는다
  is_team_lead INTEGER NOT NULL DEFAULT 0 CHECK (is_team_lead IN (0, 1)), -- 그 팀의 팀장인지. 대표진은 쓰지 않는다. 권한과는 관계없다
  created_by INTEGER REFERENCES admin (id) ON DELETE SET NULL,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

-- 계정별 권한 예외. 기본 권한 세트 대비 더한 것(GRANT)·뺀 것(REVOKE)만 저장한다.
-- 권한 하나에 행이 최대 하나라 같은 권한에 GRANT와 REVOKE가 함께 걸리지 않는다.
CREATE TABLE admin_permission_override (
  id         INTEGER PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admin (id) ON DELETE CASCADE,
  permission TEXT    NOT NULL,
  effect     TEXT    NOT NULL CHECK (effect IN ('GRANT', 'REVOKE')),
  granted_by INTEGER NOT NULL,
  created_at TEXT    NOT NULL,
  UNIQUE (admin_id, permission)
);

-- 운영진이 맡은 그룹(ADV 팀·스터디). 백엔드의 activity_group 자리를 teams가 대신한다.
-- 맡은 그룹의 종류(ADV·STUDY)에 따라 출결 입력 권한(_OWN_GROUP_)이 매 요청 계산된다.
-- 행은 직접 넣지 않는다. 팀장(teams.leader_id)이 바뀌거나 팀장인 회원에게 계정이 생기면 아래 트리거가 맞춘다.
CREATE TABLE admin_group_leader (
  id       INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admin (id) ON DELETE CASCADE,
  group_id TEXT    NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  UNIQUE (group_id)                                        -- 그룹당 리더 1명
);

-- 팀을 만들거나 팀장을 바꾸면 그 팀의 리더 계정을 새 팀장의 운영진 계정으로 바꾼다(계정이 없으면 비운다).
CREATE TRIGGER trg_admin_group_leader_on_team_insert
AFTER INSERT ON teams
WHEN NEW.group_type IN ('ADV', 'STUDY')
BEGIN
  INSERT INTO admin_group_leader (admin_id, group_id)
  SELECT a.id, NEW.id FROM admin a WHERE a.user_id = NEW.leader_id;
END;

CREATE TRIGGER trg_admin_group_leader_on_leader_change
AFTER UPDATE OF leader_id ON teams
WHEN NEW.group_type IN ('ADV', 'STUDY') AND NEW.leader_id IS NOT OLD.leader_id
BEGIN
  DELETE FROM admin_group_leader WHERE group_id = NEW.id;
  INSERT INTO admin_group_leader (admin_id, group_id)
  SELECT a.id, NEW.id FROM admin a WHERE a.user_id = NEW.leader_id;
END;

-- 이번 반기 팀의 팀장인 회원에게 운영진 계정이 생기면 그 팀들을 맡은 그룹으로 붙인다.
CREATE TRIGGER trg_admin_group_leader_on_admin_insert
AFTER INSERT ON admin
BEGIN
  INSERT INTO admin_group_leader (admin_id, group_id)
  SELECT NEW.id, t.id FROM teams t
   WHERE t.leader_id = NEW.user_id
     AND t.group_type IN ('ADV', 'STUDY')
     AND t.semester_cohort = (SELECT cohort FROM cohorts WHERE is_current = 1);
END;
