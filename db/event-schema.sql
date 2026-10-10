-- 행사 DB: 행사·행사 참가자.
-- 유저 DB(schema.sql: users·반기·팀 …)와 따로 둔다. 회원과는 user_id(users.id)로만 이어지며 외래 키·조인을 쓰지 않는다.
-- 참가자의 이름·기수·부문은 이 DB에 함께 저장한다(회원은 연결할 때 유저 DB 값으로 맞춘다).

-- ─────────────────────────── 행사 출결 ───────────────────────────
-- 행사(컨퍼런스·해커톤·정기 세션 등)의 출석 명단은 팀 출결과 별개로 관리한다.

CREATE TABLE events (
  id                       TEXT PRIMARY KEY,
  semester_cohort          INTEGER NOT NULL DEFAULT 27,         -- 유저 DB의 반기(cohorts.cohort). 다른 DB라 외래 키가 없다
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
  attendance_format        TEXT NOT NULL DEFAULT 'GENERAL'     -- 출결 방식: 신입 특칙형 / 컨퍼런스 1/2차형 / 일반 행사형 / 기타
                           CHECK (attendance_format IN ('NEWCOMER', 'CONFERENCE', 'GENERAL', 'OTHER')),
  session_labels           TEXT NOT NULL DEFAULT '[]',         -- 일반 행사형에서 한 표에 함께 관리하는 행사 이름(JSON 배열)
  status_options           TEXT NOT NULL DEFAULT '[]',         -- 기타 방식의 출결 값 [{code, label}] (JSON 배열). 다른 방식은 비어 있다
  hidden_columns           TEXT NOT NULL DEFAULT '[]',         -- 컬럼 설정에서 지운 기본 열 'STATUS'(출결) · 'SECOND_STATUS'(2차 출결) · 'MEMO'(비고) (JSON 배열)
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
  user_id        TEXT,                          -- 유저 DB의 회원(users.id). 다른 DB라 외래 키가 없다. 회원이 아니면 NULL
  position       INTEGER NOT NULL,
  is_external    INTEGER NOT NULL DEFAULT 0,
  name           TEXT    NOT NULL,
  affiliation    TEXT    NOT NULL DEFAULT '',
  term           INTEGER,
  email          TEXT    NOT NULL DEFAULT '',
  phone          TEXT    NOT NULL DEFAULT '',
  status         TEXT    NOT NULL CHECK (status IN ('present', 'late', 'earlyLeave', 'absent', 'excusedAbsent',
                                                    'unexcusedLate', 'unexcusedAbsent', 'unmarked')),
  -- 컨퍼런스 행사의 2차 출결(status가 1차). 다른 방식의 행사는 NULL
  second_status  TEXT    CHECK (second_status IN ('present', 'late', 'earlyLeave', 'absent', 'excusedAbsent',
                                                  'unexcusedLate', 'unexcusedAbsent', 'unmarked')),
  session_statuses TEXT  NOT NULL DEFAULT '{}',  -- 행사 이름(events.session_labels) → 출결(JSON 객체)
  custom_status  TEXT,                          -- 기타 방식 행사의 출결(events.status_options의 code)
  checked_in_at  TEXT    NOT NULL DEFAULT '-',
  memo           TEXT,
  custom_answers TEXT    NOT NULL DEFAULT '{}',
  UNIQUE (event_id, user_id)
);
CREATE INDEX idx_event_attendees_event ON event_attendees (event_id, position);
