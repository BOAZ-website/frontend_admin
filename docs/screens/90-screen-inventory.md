# 화면 인벤토리

| 기준 커밋 | 최종 갱신 |
| --- | --- |
| `d0ab04b` | 2026-08-29 |

> 사이드바 5허브 / 11그룹 / 24개 메뉴 항목과 `ActivePage` 31개 키의 대응표다.
> 개발·QA용 부록이며, 기능 설명은 각 도메인 문서를 본다. 표기 규칙은 [`00-common.md`](00-common.md).

원본: `src/widgets/sidebar/ui/Sidebar.tsx`의 `SIDEBAR_NAV` (18–134행), `src/shared/config/activePage.ts`, `src/app/App.tsx`의 렌더 분기 (410–516행).

---

## 1. 사이드바 메뉴 대응표

| # | 허브 | 그룹 | 사이드바 라벨 | `ActivePage` 키 | 화면 | 문서 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 콘텐츠 관리 | 아카이브 | 아카이빙 (프로젝트·블로그·사진) | `content-archive` | 아카이빙 관리 | [01](01-content.md) |
| 2 | 콘텐츠 관리 | 아카이브 | 수료자 후기 관리 | `content-reviews` | 수료자 후기 관리 | [01](01-content.md) |
| 3 | 콘텐츠 관리 | 소개 및 안내 | 커리큘럼 관리 | `content-curriculum` | 커리큘럼 관리 | [01](01-content.md) |
| 4 | 콘텐츠 관리 | 소개 및 안내 | 자주 묻는 질문 (FAQ) | `content-faq` | FAQ 관리 | [01](01-content.md) |
| 5 | 리크루팅 공고 | 공고 및 문항 | 모집 공고 관리 | `recruiting-posts` | 모집 공고 관리 | [02](02-recruiting.md) |
| 6 | 리크루팅 공고 | 공고 및 문항 | 지원서 문항 설정 | `recruiting-questions` | 지원서 문항 설정 | [02](02-recruiting.md) |
| 7 | 리크루팅 공고 | 공고 및 문항 | 지원자 화면 미리보기 | `recruiting-preview` | 지원자 화면 미리보기 | [02](02-recruiting.md) |
| 8 | 리크루팅 공고 | 지원자 데이터 | 지원서 CSV 추출 | `recruiting-csv` | 지원서 CSV 추출 | [02](02-recruiting.md) |
| 9 | 리크루팅 공고 | 지원자 데이터 | 사전 알림 명단 | `recruiting-leads` | 사전 알림 명단 | [02](02-recruiting.md) |
| 10 | 서류 평가 | 서류 심사 | 서류 평가 대시보드 (SUBMITTED) | `evaluation-evals` | 서류 평가 대시보드 | [03](03-evaluation.md) |
| 11 | 서류 평가 | 서류 심사 | 전체 지원자 현황 (DRAFT 포함) | `evaluation-applicants` | 전체 지원자 현황 | [03](03-evaluation.md) |
| 12 | 서류 평가 | 합격 및 승격 | 최종 합불 & 정회원 승격 | `evaluation-promote` | 최종 합불 및 승격 | [03](03-evaluation.md) |
| 13 | 출결 & 점수 | 출결 관리 | BASE Term 출결 관리 | `att-session` | BASE 출결 | [04](04-attendance.md) |
| 14 | 출결 & 점수 | 출결 관리 | ADV Term 출결 관리 | `att-adv` | ADV 출결 | [04](04-attendance.md) |
| 15 | 출결 & 점수 | 출결 관리 | 스터디 출결 관리 | `att-study` | 스터디 출결 | [04](04-attendance.md) |
| 16 | 출결 & 점수 | 출결 관리 | 행사 출결 관리 | `att-events` | 행사 출결 | [04](04-attendance.md) |
| 17 | 출결 & 점수 | 출결 관리 | 출결 점수 집계 | `att-scores` | 출결 점수 집계 | [04](04-attendance.md) |
| 18 | 출결 & 점수 | 출결 입력 | ADV 입력 및 증빙 (팀장용) | `att-input-adv` | 리더 전용 출결 입력 | [04](04-attendance.md) |
| 19 | 출결 & 점수 | 출결 입력 | 스터디 입력 및 증빙 (팀장용) | `att-input-study` | 리더 전용 출결 입력 | [04](04-attendance.md) |
| 20 | 출결 & 점수 | 설정 | HOST 계정·팀 연결 (ID/PW 발급) | `att-hosts` | HOST 계정 연결 | [04](04-attendance.md) |
| 21 | 출결 & 점수 | 설정 | 점수 규칙 | `att-rules` | 점수 규칙 | [04](04-attendance.md) |
| 22 | 시스템·계정 | 계정 및 권한 | 운영진 계정 관리 (CRUD) | `system-accounts` | 운영진 계정 관리 | [05](05-system.md) |
| 23 | 시스템·계정 | 계정 및 권한 | 권한 매트릭스 (10대 Permission) | `system-permissions` | 권한 매트릭스 | [05](05-system.md) |
| 24 | 시스템·계정 | 보안 | 보안 감사 로그 | `system-audit` | 보안 감사 로그 | [05](05-system.md) |

---

## 2. 메뉴에 노출되지 않는 키 (31 − 24 = 7)

| `ActivePage` 키 | 라벨 | 도달 경로 | 상태 |
| --- | --- | --- | --- |
| `content` | 콘텐츠 관리 | 사이드바 허브 클릭 시 경유 | 아카이빙 화면으로 대체 렌더 |
| `recruiting` | 모집 공고 관리 | 허브 경유 | 모집 공고 탭으로 대체 렌더 |
| `evaluation` | 서류 평가 대시보드 | 허브 경유 | 평가 대시보드 탭으로 대체 렌더 |
| `system` | 시스템·계정 | 허브 경유 | 계정 관리 탭으로 대체 렌더 |
| `att-dashboard` | 출결 대시보드 & 인증 검토 | 운영지원팀 계정 로그인·역할 전환 시 자동 진입 | 화면은 정상 동작. **사이드바 메뉴 없음** |
| `att-input` | 출결 입력 및 증빙 등록 (팀장용) | HOST 계정 로그인·역할 전환 시 자동 진입 | 화면은 정상 동작. **사이드바 메뉴 없음** |
| `att-internal` | 정규 출결 관리 | **없음** | 메뉴에도 App.tsx 렌더 분기에도 없어 선택 시 본문이 비어 있다. 대응 컴포넌트(`src/pages/attendance-internal-legacy/ui/InternalAttendanceManagePage.tsx`)는 어디에서도 import되지 않는 잔여 코드다 |

앞의 4개(`content`·`recruiting`·`evaluation`·`system`)는 허브 대표키로, 사이드바에서 허브를 누르면 즉시 첫 하위 메뉴로 치환되므로 의도된 동작이다.

`att-dashboard`와 `att-input`은 IA상 진입 경로 확정이 필요하다. `att-internal`은 대응 컴포넌트(`attendance-internal-legacy/ui/InternalAttendanceManagePage.tsx`)가 어디에서도 참조되지 않는 잔여 코드다. 현재 BASE·ADV·스터디 화면은 이 레거시 컴포넌트가 아니라 `attendance-internal-category/ui/InternalCategoryAttendancePage.tsx`가 담당한다. → [`92-open-items.md`](92-open-items.md)

---

## 3. 하나의 컴포넌트를 공유하는 메뉴

| 메뉴 | `ActivePage` 키 | 전달되는 구분값 | 결과 |
| --- | --- | --- | --- |
| BASE Term 출결 관리 | `att-session` | `category="SESSION"` | 화면 제목·좌측 목록·컬럼이 달라진다 |
| ADV Term 출결 관리 | `att-adv` | `category="ADV"` | 〃 |
| 스터디 출결 관리 | `att-study` | `category="STUDY"` | 〃 |
| **ADV 입력 및 증빙 (팀장용)** | `att-input-adv` | **없음** | **두 메뉴가 완전히 같은 화면을 연다** |
| **스터디 입력 및 증빙 (팀장용)** | `att-input-study` | **없음** | 〃 |
| 모집 공고 관리 외 4개 | `recruiting-*` | 탭 id | 하나의 화면에서 탭만 전환된다 |
| 서류 평가 3개 메뉴 | `evaluation-*` | 탭 id | 〃 |
| 시스템·계정 3개 메뉴 | `system-*` | 탭 id | 〃 |

출결 3종은 구분값으로 화면이 실제로 달라지지만, **출결 입력 2종은 구분값이 전달되지 않아 ADV 메뉴에서도 스터디 입력 화면이 열린다.** → [`04-attendance.md`](04-attendance.md#확정이-필요한-사항)

---

## 4. 진입 경로가 없는 화면·모달

컴포넌트는 구성되어 있으나 도달할 UI가 없는 것들이다.

| 대상 | 종류 | 위치 |
| --- | --- | --- |
| 정규 출결 관리 | 화면 | `att-internal` — 메뉴·렌더 분기 모두 없음. 잔여 컴포넌트 `attendance-internal-legacy/…InternalAttendanceManagePage.tsx` |
| 출석 양식 템플릿 관리 | 탭 | 행사 출결 화면 내부 |
| 출석 통계 & 리포트 | 탭 | 행사 출결 화면 내부 |
| 새 회차 생성 | 모달 | BASE·ADV·스터디 출결 화면 |
| 양식 템플릿 생성·수정 | 모달 | 행사 출결 화면 (묻힌 탭 안에 진입점이 있어 연쇄적으로 도달 불가) |

## 5. 표시만 되고 동작이 연결되지 않은 요소

| 대상 | 위치 |
| --- | --- |
| 임시 저장 (DRAFT) | 지원자 화면 미리보기 |
| 지원서 최종 제출 (SUBMITTED) | 지원자 화면 미리보기 |
| 새로고침 | 서류 평가 상세 모달 |

---

## 6. 역할 타입 대조

코드와 스펙에 **세 벌의 역할 정의가 공존**한다. 권한 제어를 구현하기 전에 정본을 확정해야 한다.

| 출처 | 값 | 비고 |
| --- | --- | --- |
| [`spec/01-attendance-system.md`](../spec/01-attendance-system.md) | `MASTER` `SUPER` `TEAM` `HOST` | 원본 스펙 |
| `src/entities/user/model/types.ts` (`UserRole`) | `SUPER` `TEAM` `HOST` `CONTENT_ADMIN` | `MASTER` 없음. `CONTENT_ADMIN`은 스펙에 없는 값 |
| `src/pages/system-accounts/…` (`AdminRole`) | `MASTER` `SUPER` `TEAM` | `HOST` 없음 |

## 7. 출결 상태 값 대조

출결 상태 정의도 여러 벌이 공존한다. 특히 BASE·ADV·스터디(9종)와 행사(8종)는 값 목록이 미묘하게 다르다 — 행사에는 `비대면`이 없고, 미체크 상태의 라벨이 각각 `미정`·`미체크`로 갈린다.

| 출처 | 값 | 개수 |
| --- | --- | --- |
| [`ia/02-ia-tree.md`](../ia/02-ia-tree.md) §6 제안 | 출석 · 지각 · 결석 · 사유결석 | 4 |
| `src/entities/attendance/model/types.ts` (공유 타입 — 출결 입력·대시보드·점수 집계) | 출석 · 지각 · 결석 | 3 |
| BASE·ADV·스터디 출결 화면 (`attendance-internal-category`) | 출석 · 지각 · 조퇴 · 결석 · 인정결석 · 비대면 · 무단지각 · 무단결석 · 미정 | 9 |
| 행사 출결 화면 (`attendance-events`) | 출석 · 지각 · 조퇴 · 결석 · 인정결석 · 무단지각 · 무단결석 · 미체크 | 8 |
| 점수 규칙 화면 | 지각 · 무단지각 3회 · 조퇴 · 사유결석 · 무단결석 (감점 체계) | 5 |

점수 규칙은 감점 체계, 출결 입력·집계는 가점 체계라 두 체계가 서로 대응되지 않는다. → [`92-open-items.md`](92-open-items.md)
