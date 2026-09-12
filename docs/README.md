# BOAZ 관리자 페이지 문서

`admin.bigdataboaz.com` (관리자 전용 React 앱)의 설계·스펙·화면 정의 문서 모음이다.

---

## 문서 지도

**문서마다 답하는 질문과 시제가 다르다.** 규범 문서를 현황 문서로 착각해서 읽으면 판단이 어긋난다.

| 층 | 문서 | 답하는 질문 | 시제 | 고치는 주체 |
| --- | --- | --- | --- | --- |
| 왜 | [`ia/01-ia-strategy.md`](ia/01-ia-strategy.md) | 어떤 기준으로 판단했는가 | 규범 | IA 설계 |
| 어디에 | [`ia/02-ia-tree.md`](ia/02-ia-tree.md) | 무엇이 어디에 있어야 하는가 | 당위 | IA 설계 |
| 어떤 규칙으로 | [`spec/01-attendance-system.md`](spec/01-attendance-system.md)<br>[`spec/02-role-model.md`](spec/02-role-model.md) | 권한·출결 규칙은 무엇인가 | 당위 | 백엔드 + 운영지원팀 |
| **지금 무엇이 있나** | [`screens/00-common.md`](screens/00-common.md) 외 | 현재 화면에 무엇이 되는가 | **사실** | 프론트 |
| 무엇이 다른가 | [`screens/91-ia-gap.md`](screens/91-ia-gap.md) | 당위와 사실의 차이 | 사실 | 전원 |
| 무엇을 정할까 | [`screens/92-open-items.md`](screens/92-open-items.md) | 결정해야 할 안건 | 미정 | 전원 |
| **무엇을 언제 만들까** | [`01-wbs.md`](01-wbs.md) | 앞으로 무엇을 어떤 순서·우선순위로 만드는가. 티켓·게이트·커트라인·배정 필요 분야 | **계획** | PM + 프론트 + 백엔드 |

---

## 어디부터 읽나

| 상황 | 읽을 문서 |
| --- | --- |
| 처음 합류했다 | [`screens/00-common.md`](screens/00-common.md) → 담당 도메인 문서 |
| 화면을 디자인한다 | 담당 도메인 문서 (`screens/01`~`05`) |
| 메뉴 구조를 바꾸려 한다 | [`ia/01-ia-strategy.md`](ia/01-ia-strategy.md)를 **먼저** 읽는다. 판단 기준이 거기 있다 |
| 권한을 구현한다 | [`spec/02-role-model.md`](spec/02-role-model.md) → [`spec/01-attendance-system.md`](spec/01-attendance-system.md) §2 |
| 백엔드를 연동한다 | [`screens/91-ia-gap.md`](screens/91-ia-gap.md) §4 (API 근거 없는 기능) → 담당 도메인 문서 |
| 회의에서 정할 것을 찾는다 | [`screens/92-open-items.md`](screens/92-open-items.md) |
| 특정 화면의 코드 위치를 찾는다 | [`screens/90-screen-inventory.md`](screens/90-screen-inventory.md) |
| 일정·우선순위·담당 분야를 확인한다 | [`01-wbs.md`](01-wbs.md) — 티켓은 EPIC 절, 결정 대기는 게이트 절, 배정은 "우선순위 · 난이도 · 배정 필요 분야" 절 |

---

## 파일 목록

```
docs/
├── README.md                          이 문서
├── 01-wbs.md                          실행 계획 — EPIC·티켓·시나리오·게이트·커트라인·배정 필요 분야
├── ia/
│   ├── 01-ia-strategy.md              IA를 어떤 기준으로 짰는가 (판단 근거)
│   └── 02-ia-tree.md                  목표 IA 트리 · 권한 매트릭스 · 라우트 맵
├── spec/
│   ├── 01-attendance-system.md        출결 시스템 · 권한 체계 설계 (정본 스펙)
│   └── 02-role-model.md               역할·권한 정본
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
- **의도가 바뀌면** `ia/` 또는 `spec/`을 고치고, 영향받는 행을 `91-ia-gap.md`에서 갱신한다.
- **결정이 나면** `92-open-items.md`에서 해당 항목을 지우고, 결과를 해당 규범 문서에 반영한다. 게이트가 닫혔으면 `01-wbs.md` 게이트 절도 함께 옮긴다.
- **계획이 바뀌면** `01-wbs.md`만 고친다. 규모 태그를 바꾸면 일정 절의 합산도 같이 고친다(2·3차 검토 모두 합산 오류가 있었다).

원본 3개(`ia/01`, `ia/02`, `spec/01`)는 **기준선이므로 내용을 고치지 않는다.** 갱신이 필요하면 상단 상태 배너에 무엇이 대체되었는지 적고, 실제 판단은 `91-ia-gap.md` §3에 기록한다. 기준선을 고치면 격차를 측정할 근거가 사라진다.
