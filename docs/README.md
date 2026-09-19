# BOAZ 관리자 페이지 문서

`admin.bigdataboaz.com` (관리자 전용 React 앱)의 설계·스펙·화면 정의 문서 모음이다.

---

## 문서 지도

**문서마다 답하는 질문과 시제가 다르다.** 규범 문서를 현황 문서로 착각해서 읽으면 판단이 어긋난다.

| 층 | 문서 | 답하는 질문 | 시제 | 고치는 주체 |
| --- | --- | --- | --- | --- |
| 왜 | [`ia/01-ia-strategy.md`](ia/01-ia-strategy.md) | 어떤 기준으로 판단했는가 | 규범 | IA 설계 |
| 어디에 | [`ia/02-ia-tree.md`](ia/02-ia-tree.md) | 무엇이 어디에 있어야 하는가 | 당위 | IA 설계 |
| 어떤 규칙으로 | [`spec/01-attendance-system.md`](spec/01-attendance-system.md)<br>[`spec/02-role-model.md`](spec/02-role-model.md) | 권한·출결 규칙은 무엇인가 (기준선) | 당위 | 백엔드 + 운영지원팀 |
| **무엇을 만드나** | [`spec/00-platform.md`](spec/00-platform.md) · [`spec/03-recruiting.md`](spec/03-recruiting.md) ~ [`spec/07-content.md`](spec/07-content.md) | 공통 바닥과 도메인별 화면·기능이 무엇인가. 화면 ID·기능 ID의 출처 | **당위** | PM + 도메인 담당팀 |
| **지금 무엇이 있나** | [`screens/00-common.md`](screens/00-common.md) 외 | 현재 화면에 무엇이 되는가 | **사실** | 프론트 |
| 무엇이 다른가 | [`screens/91-ia-gap.md`](screens/91-ia-gap.md) | 당위와 사실의 차이 | 사실 | 전원 |
| 무엇을 정할까 | [`screens/92-open-items.md`](screens/92-open-items.md) | 결정해야 할 안건 | 미정 | 전원 |
| **무엇을 언제 만들까** | [`01-wbs.md`](01-wbs.md) | 앞으로 무엇을 어떤 순서·우선순위로 만드는가. EPIC·화면 티켓·기능 ID·마일스톤 | **계획** | PM + 프론트 + 백엔드 |

---

## 어디부터 읽나

| 상황 | 읽을 문서 |
| --- | --- |
| 처음 합류했다 | [`screens/00-common.md`](screens/00-common.md) → 담당 도메인 문서 |
| 화면을 디자인한다 | 담당 도메인 기능명세서 (`spec/03`~`07`) → 현재 구현은 `screens/01`~`05` |
| 화면 ID·기능 ID가 무엇인지 찾는다 | 담당 도메인 기능명세서 (`spec/03`~`07`) — `01-wbs.md`의 티켓 키와 1:1 대응 |
| 공통 기반(라우터·인증·API·공용 컴포넌트)을 만든다 | [`spec/00-platform.md`](spec/00-platform.md) — 도메인 요구가 어느 `T0.x`에 귀속되는지 §5 |
| 기능명세서 표기 규칙을 확인한다 | [`spec/README.md`](spec/README.md) — 읽는 순서 · Epic↔티켓 키 대응 · Open Issue 접두사 · 미결 목록 위치 |
| 메뉴 구조를 바꾸려 한다 | [`ia/01-ia-strategy.md`](ia/01-ia-strategy.md)를 **먼저** 읽는다. 판단 기준이 거기 있다 |
| 권한을 구현한다 | [`spec/06-system.md`](spec/06-system.md) §3 (정본, Permission 41개) → [`spec/02-role-model.md`](spec/02-role-model.md) §1 역할 4종 |
| 백엔드를 연동한다 | [`screens/91-ia-gap.md`](screens/91-ia-gap.md) §4 (API 근거 없는 기능) → 담당 도메인 문서 |
| 회의에서 정할 것을 찾는다 | [`screens/92-open-items.md`](screens/92-open-items.md) |
| 특정 화면의 코드 위치를 찾는다 | [`screens/90-screen-inventory.md`](screens/90-screen-inventory.md) |
| 일정·우선순위·담당 분야를 확인한다 | [`01-wbs.md`](01-wbs.md) — 화면 티켓은 EPIC 절, 결정 대기는 각 EPIC의 디자인 확정(`*-DSN`) 티켓과 API 확인 항목, 일정은 마일스톤 절 |

---

## 파일 목록

```
docs/
├── README.md                          이 문서
├── 01-wbs.md                          실행 계획 — EPIC·화면 티켓·기능 ID·마일스톤 (기능명세서 기준)
├── ia/
│   ├── 01-ia-strategy.md              IA를 어떤 기준으로 짰는가 (판단 근거)
│   └── 02-ia-tree.md                  목표 IA 트리 · 권한 매트릭스 · 라우트 맵
├── spec/
│   ├── README.md                      기능명세서 세트 색인 — 읽는 순서 · 표기 규칙
│   ├── 00-platform.md                 플랫폼 기반 기능명세서    — Epic 0 (공통 바닥)
│   ├── 01-attendance-system.md        출결 시스템 · 권한 체계 설계 (기준선. 출결 설계는 05가 대체)
│   ├── 02-role-model.md               역할 4종 정의 (Permission 10종은 06이 대체)
│   ├── 03-recruiting.md               리크루팅 기능명세서       — Epic 1
│   ├── 04-evaluation.md               서류 평가 기능명세서      — Epic 2
│   ├── 05-attendance.md               출결 관리 기능명세서 v2.0 — Epic 3 (출결 정본)
│   ├── 06-system.md                   시스템 계정 기능명세서    — Epic 4 (권한 정본)
│   └── 07-content.md                  콘텐츠 관리 기능명세서    — Epic 5
└── screens/
    ├── 00-common.md                   공통 전제 · 상태 태그 · 서술 원칙
    ├── 01-content.md                  콘텐츠 관리
    ├── 02-recruiting.md               리크루팅 공고
    ├── 03-evaluation.md               서류 평가
    ├── 04-attendance.md               출결 & 점수 시스템
    ├── 05-system.md                   시스템·계정
    ├── 90-screen-inventory.md         사이드바 24 ↔ ActivePage 31 ↔ 컴포넌트
    ├── 91-ia-gap.md                   의도 IA ↔ 구현 대조표 (조회용)
    ├── 92-open-items.md               결정 안건 (읽는 문서)
    └── images/                        화면 캡처
```

---

## 규범 문서끼리도 시기가 다르다

[`spec/01-attendance-system.md`](spec/01-attendance-system.md) §2는 스스로를 **"권한 체계 (선행 개편)"**이라 밝히며 [`ia/02-ia-tree.md`](ia/02-ia-tree.md) §2의 권한 매트릭스를 대체한다.

따라서 **구현이 `ia/02-ia-tree.md`와 다르다고 해서 곧바로 위반이 아니다.** 더 최신 문서를 따랐거나, `ia/02-ia-tree.md`가 스스로 미확정으로 남긴 항목에 대한 결정일 수 있다. 원인 구분은 [`screens/91-ia-gap.md`](screens/91-ia-gap.md)가 `스펙 갱신` / `PoC 범위` / `미결정` 세 갈래로 한다.

---

## 문서를 고칠 때

- **현황이 바뀌면** `screens/01`~`05`를 고치고 상단 표의 기준 커밋을 갱신한다.
- **공통 전제를 고치면** `00-common.md`의 원본을 고친 뒤 `grep -rn "SYNC:common-preconditions" screens/`로 5개 도메인 문서에 반영한다.
- **의도가 바뀌면** 해당 도메인의 기능명세서(`spec/03`~`07`)를 고치고, 영향받는 행을 `91-ia-gap.md`에서 갱신한다.
- **기능 ID를 추가·변경하면** `01-wbs.md`의 해당 티켓 하위 항목도 함께 고친다. 둘은 1:1로 대응한다.
- **결정이 나면** `92-open-items.md`에서 해당 항목을 지우고, 결과를 해당 규범 문서에 반영한다. 결정된 항목은 `01-wbs.md`의 해당 `*-DSN` 티켓 행에도 확정 내용으로 옮긴다.
- **계획이 바뀌면** `01-wbs.md`만 고친다. 규모를 바꾸면 마일스톤 절의 기준일과 어긋나지 않는지 함께 확인한다.

원본 3개(`ia/01`, `ia/02`, `spec/01`)는 **기준선이므로 내용을 고치지 않는다.** 갱신이 필요하면 상단 상태 배너에 무엇이 대체되었는지 적고, 실제 판단은 `91-ia-gap.md` §3에 기록한다. 기준선을 고치면 격차를 측정할 근거가 사라진다.

**규범 문서가 두 층이 됐다.** `spec/01`·`spec/02`는 기준선이고, 기능명세서(`spec/00`과 `spec/03`~`07`)가 그 위에 얹히는 현재 정본이다. 충돌하면 기능명세서를 따르고, 무엇이 대체됐는지는 기준선 문서의 상단 배너가 밝힌다.
