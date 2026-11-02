# 프론트엔드 코드 작성 규칙 — 규범

| 기준 커밋 | 최종 갱신 | 운영 주체 | 표기 규칙 |
| --- | --- | --- | --- |
| `da42df2` | 2026-11-02 | 프론트엔드 담당 | 이 문서의 "표기" 절 |

## 이 문서의 목적

- `BOAZ-Admin-frontend` 저장소에서 코드를 쓰고 고칠 때 따르는 규칙을 정함
- 대상 독자: 이 저장소에서 작업하는 AI 도구(Claude Code, Codex 등), 프론트엔드 팀원, PR 리뷰어. AI 도구가 읽고 그대로 따를 수 있게 썼고, 사람에게도 같은 규칙이 적용됨
- 적용 범위: `src/`, `tests/`, `db/`. 문서(`docs/`) 작성 규칙은 프로젝트 `CLAUDE.md`의 "문서 작성 규칙"을 따름
- 다른 문서와의 관계
    - 프로젝트 `CLAUDE.md`: 저장소 구조와 작업 관례. 이 문서와 다르면 이 문서를 따르고 차이를 프론트엔드 담당에게 알림
    - `docs/spec/`: 화면이 어떻게 동작해야 하는지(목표 동작을 정한 기능 명세). 이 문서는 코드를 어떻게 쓰는지만 정함
- 숫자(위반 건수 등)와 코드 현황 서술은 따로 적지 않으면 상단 표의 기준 커밋(2026-10-31 `dev`) 기준임. "(회의록 기준)"이라고 적은 숫자는 [2026-10-28 프론트엔드 회의록](https://app.notion.com/p/FE-3a26710199ab8010b85ec421865f172d?p=4076710199ab80ffab35ce2cd4fb098d&pm=s)에서 옮긴 값임

### 표기

| 표기 | 뜻 |
| --- | --- |
| **반드시** | 어기면 리뷰에서 수정을 요청함 |
| **금지** | 쓰지 않음. 어기면 리뷰에서 수정을 요청함 |
| **권장** | 이유가 있으면 달리 해도 됨. 달리 했으면 PR 본문에 이유를 적음 |
| 검사: `tsc` / `ESLint` / `Prettier` | 도구가 막음. 어기면 CI가 실패함 |
| 검사: 테스트 | `tests/`의 테스트가 막음. CI는 테스트를 돌리지 않으므로 로컬에서 실행함(15절) |
| 검사: 리뷰 | 도구가 막지 않음. 작성자가 스스로 확인하고 리뷰어가 다시 확인함 |
| (표시 없음) | 적용 범위·절차·허용 범위를 정하는 규칙. 문장에 적힌 그대로 따름 |
| 2026-10-31 기준 | 상단 표의 기준 커밋 시점의 코드 상태. 이 날짜 뒤에 코드가 바뀌었을 수 있음 |

### 규칙 ID

- 모든 규칙에 `R<절 번호>-<순서>` 형식의 ID가 있음. 예: `R7-1`은 7절의 첫 번째 규칙
- 리뷰 코멘트, 커밋 설명, 작업 보고, PR 본문에서 `R7-1 위반`처럼 ID로 가리킴
- 규칙을 지우면 그 번호는 비워 두고 다시 쓰지 않음. 새 규칙은 그 절의 마지막 번호 다음에 붙임. 이미 남긴 리뷰 코멘트의 ID가 다른 규칙을 가리키지 않게 하기 위함임

## 용어

| 용어 | 뜻 |
| --- | --- |
| 층(layer) | `src/` 바로 아래 폴더 6개: `app`, `pages`, `widgets`, `features`, `entities`, `shared`. 2절 |
| 화면 폴더 | `pages/<화면>/`. 화면 하나의 코드를 모은 폴더. 예: `pages/system-audit/` |
| 세그먼트 | 층 안 폴더를 다시 나눈 하위 폴더. `ui/`(그리기), `model/`(타입·상수·계산·Hook), `api/`(서버 요청·임시 DB 함수) |
| 컴포넌트 | 대문자로 시작하고 JSX를 돌려주는 함수. 화면의 한 조각을 그림 |
| Hook | `use`로 시작하는 함수. 컴포넌트가 쓸 데이터를 불러오고, 들고 있고, 바꿈. 그리지 않음 |
| API 함수 | `entities/<데이터>/api/<데이터>Api.ts`에 있는 서버 요청 함수. 예: `fetchClubMembers` |
| dto | API 요청·응답 모양을 나타내는 타입. `entities/<데이터>/model/dto.ts`에 둠 |
| 임시 API | 백엔드 대신 응답하는 코드. `shared/api/mock/`. 라우트는 `shared/api/mock/routes/<데이터>Routes.ts` |
| 임시 DB | 브라우저 안에서 도는 SQLite(sql.js). 스키마 `db/schema.sql`, 초기 데이터 `db/seed.sql` |
| 임시 DB 함수 | 임시 DB를 읽고 쓰는 함수. `entities/<데이터>/api/<데이터>Repository.ts`. 임시 API만 부름 |
| 서버 데이터 | API로 받아 온 데이터(목록, 상세). 화면이 직접 만든 값이 아님 |
| 기존 위반 | 2026-10-31 이전 코드에 이미 있는 규칙 위반. 부록 A 목록 |

## 작업 절차 요약

```
범위 정하기 → 계약 확인 → 위치 정하기 → 코드 작성 → 테스트 → 자동 검사 → 자가 확인 → 보고·PR
(0절)        (7·8절)     (3절)        (1~14·16절) (15절)  (19-1절)    (19-3절)    (17·19절)
```

| 단계 | 할 일 | 완료 확인 방법 |
| --- | --- | --- |
| 범위 정하기 | 고칠 파일 목록을 정함. 0절에 따라 범위 밖 기존 위반은 고치지 않음 | 고칠 파일 목록이 있음 |
| 계약 확인 | 새 API가 필요하면 `docs/spec/`의 해당 도메인 명세에서 경로·요청·응답을 찾음. 없으면 18절에 따라 멈추고 물음 | API 경로와 응답 모양이 정해짐 |
| 위치 정하기 | 새 코드마다 3-1절 판단 순서로 층·세그먼트를 정함 | 새 파일 경로가 정해짐 |
| 코드 작성 | 1~14절 규칙을 지킴. 화면을 추가하면 16절도 지킴 | 코드 |
| 테스트 | 계산 함수·임시 API 라우트를 바꿨으면 테스트를 추가·수정하고 실행함 | `npx tsx --test tests/*.test.ts` 통과 |
| 자동 검사 | 19-1절 명령 4개를 실행함 | 4개 모두 통과 |
| 자가 확인 | 19-3절 체크리스트를 고친 부분에 대해 확인함 | 모든 항목 확인 |
| 보고·PR | 지키지 못한 규칙과 발견한 기존 위반을 ID로 적음. WBS 티켓이면 `docs/03-wbs-fe.md` 진행 현황을 고침 | PR 본문 작성됨 |

## 처음이라면: 빠른 시작

처음 이 저장소 코드를 고치는 사람·AI 도구는 아래를 먼저 끝냄.

- [ ]  개발 환경 표의 Node 버전을 맞추고 `npm ci` 실행
- [ ]  `npm run dev`로 화면이 뜨는지 확인. 서버 주소(`VITE_API_BASE_URL`)가 없으면 임시 API가 응답함
- [ ]  19-1절 명령 4개와 테스트 명령이 로컬에서 통과하는지 확인
- [ ]  0절(적용 범위)을 읽음. 기존 코드를 일부러 고치지 않는다는 원칙을 확인함
- [ ]  2절 그림에서 층 순서를 확인함
- [ ]  3-1절 판단 순서를 한 번 따라가 봄. 예: "회원 관리와 계정 관리가 같이 쓰는 필터 드롭다운"은 어디에 두나(답: `shared/ui/`)
- [ ]  6절 Hook 예시와 7절 데이터 흐름을 읽음. 화면이 데이터를 받는 길은 이것 하나뿐임
- [ ]  18절(멈춰야 하는 경우)을 읽음

## 개발 환경

| 도구 | 버전 | 근거 |
| --- | --- | --- |
| Node.js | 24.15.0 | `.nvmrc`. CI가 같은 파일을 읽음 |
| React | 19 | `package.json` |
| TypeScript | 5.9 | `package.json` |
| Vite | 6.3.5 | `package.json` |
| Tailwind CSS | 4.1.12 (`@tailwindcss/vite`) | `package.json` |
| ESLint / Prettier | 9 / 3 | `eslint.config.js`, `eslint-suppressions.json`, `.prettierrc.json` |
- 경로 별칭 `@/`는 `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json` 세 곳에 따로 정의되어 있음. 별칭을 바꾸면 세 파일을 모두 고침
- Prettier 설정: 작은따옴표, 세미콜론 사용, 끝 쉼표 `all`, 들여쓰기 2칸, 줄 길이 100자, 줄 끝 LF
- `stylelint`, `lefthook`은 설치만 되어 있고 설정 파일이 없어 쓰지 않음

---

## 0. 적용 범위

| ID | 규칙 |
| --- | --- |
| R0-1 | 새로 만드는 파일, 그리고 기존 파일에서 이번 작업으로 고치는 부분에 적용함 |
| R0-2 | **금지**: 이 규칙을 지키려고 이번 작업과 관계없는 기존 코드를 고치는 것. 발견한 기존 위반은 PR 본문·작업 보고에 ID와 파일 경로만 적음 |
| R0-3 | 기존 위반(부록 A)은 예외로 둠. 예외 목록은 줄어들기만 함. **금지**: 새 예외를 만드는 것 |
| R0-4 | 한 파일 안에서 옛 코드와 새 규칙이 섞여 읽기 어려워지면 그 파일만 규칙에 맞춰 정리할 수 있음. 바뀌는 줄이 많으면 기능 변경과 다른 PR로 나눔 |
| R0-5 | 같은 파일 안에서 이 문서가 정하지 않은 것은 그 파일의 지역 관례를 따름 |
| R0-6 | **금지**: `eslint-suppressions.json`에 항목을 추가하거나 건수를 늘리는 것(`--suppress-all`, `--suppress-rule`). 기존 위반을 고치면 `npx eslint . --prune-suppressions`로 건수를 줄임 |
- 근거: 큰 페이지 파일(최대 5,716줄)을 한 번에 고치면 열린 PR과 충돌하고 리뷰가 어려움. 새 코드부터 막으면 위반은 늘지 않고 고칠 때마다 줄어듦. `eslint-suppressions.json`은 ESLint가 기존 위반을 파일별 건수로 기억해 두는 파일이라, 건수를 늘리면 새 위반이 CI를 통과함
- 다시 볼 때: 부록 A가 비면 R0-3을 지움. `eslint-suppressions.json`이 비면 R0-6을 지움

## 1. import

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R1-1 | **반드시** 순서: 외부 라이브러리 → `@/` 경로 → 상대 경로. 그룹 사이에 빈 줄 하나 | 리뷰 |
| R1-2 | **반드시** 타입만 가져올 때는 `import type`. 값과 타입을 함께 가져오면 `import { ApiError, type HttpMethod }`처럼 씀 | `tsc` |
| R1-3 | **반드시** 다른 층·다른 화면 폴더의 파일은 `@/` 경로로 가져옴. 상대 경로(`../`)는 같은 층 아래 같은 폴더(`pages/<화면>/`, `widgets/<조각>/`, `features/<동작>/`, `entities/<데이터>/`) 안에서만 씀 | 리뷰 |
| R1-4 | `tests/`에서는 `../src/...` 상대 경로로 가져옴 | 리뷰 |

```tsx
import { useState } from 'react';

import { api } from '@/shared/api/client';
import { Tooltip } from '@/shared/ui/Tooltip';

import type { AuditLogQuery } from '../model/dto';
```

- 근거: R1-1은 파일 맨 위만 보고 이 파일이 어느 층에 기대는지 알 수 있게 함. R1-2는 import 문을 쓴 그대로 남기는 설정(`verbatimModuleSyntax`) 때문에 지키지 않으면 타입 체크가 실패함. R1-4는 2026-10-31 기준 테스트 34개가 모두 이렇게 씀
- 다시 볼 때: ESLint의 import 순서 정렬 규칙(`simple-import-sort`)을 켜면 R1-1 검사를 `ESLint`로 바꿈(플러그인은 설치만 되어 있음)

## 2. 층 사이 import 방향

```
app → pages → widgets → features → entities → shared
(왼쪽 층은 오른쪽 층을 가져다 쓸 수 있음. 반대는 안 됨)
```

| 층 | 담는 것 | 예 |
| --- | --- | --- |
| `app` | 앱 시작, 전역 상태(`App.tsx`의 `useState`), 화면 전환 | `App.tsx`, `main.tsx` |
| `pages` | 화면 하나 | `pages/system-audit/` |
| `widgets` | 여러 화면에 붙는 큰 UI 조각 | 사이드바, 로그인 창 |
| `features` | 여러 화면이 같이 쓰는 업무 동작(화면 조각 + 처리 함수 묶음) | 계정 정보 전달(2026-10-31 기준 `shared`에 있음, 부록 A) |
| `entities` | 업무 데이터별 타입·API·규칙 | 출결, 스터디팀, 회원, 기수 |
| `shared` | 업무와 관계없는 공통 UI·도구 | 버튼, 날짜 함수, API 클라이언트 |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R2-1 | **반드시** 화살표 왼쪽 층만 오른쪽 층을 가져다 씀 | 리뷰 |
| R2-2 | **금지**: 오른쪽 층이 왼쪽 층을 가져다 쓰는 것 | 리뷰 |
| R2-3 | **금지**: 화면 폴더끼리 가져다 쓰는 것(`pages/A` → `pages/B`) | 리뷰 |
| R2-4 | **금지**: `features` 폴더끼리 가져다 쓰는 것. 둘이 같이 쓰는 것은 `entities`나 `shared`로 내림 | 리뷰 |
| R2-5 | 두 화면 이상이 쓰는 코드는 3-1절 판단 순서에 따라 옮긴 뒤 가져다 씀 | 리뷰 |

```tsx
// 금지 (R2-3): 감사 로그 화면이 행사 출결 화면 폴더의 드롭다운을 가져옴
import { FilterDropdown } from '@/pages/attendance-events/ui/FilterDropdown';

// 허용: 여러 화면이 쓰는 조각을 shared/ui로 옮기고 거기서 가져옴
import { FilterDropdown } from '@/shared/ui/FilterDropdown';
```

허용하는 예외(이 두 가지만)

| 경우 | 허용 범위 | 이유 |
| --- | --- | --- |
| `shared/api/mock/` → `entities` | 임시 DB 함수와 그 타입 | 임시 API는 임시 DB 함수를 불러야 동작함. 백엔드 연결 뒤 폴더째 지울 코드임 |
| `entities/A` → `entities/B` | 연결된 업무 데이터의 타입·규칙. **반드시** 순환 참조가 없게 함 | 출결·스터디팀·기수·점수는 원래 연결된 데이터라, 막으면 같은 타입을 두 곳에 만들어야 함 |
- 근거: 파일을 고쳤을 때 영향받는 범위를 폴더 위치만 보고 알 수 있게 함. 2026-10-31 기준 `FilterDropdown`은 행사 출결 화면 폴더에 있지만 화면 3개가 더 씀. 행사 출결 화면을 고치다 바꾸면 다른 화면도 바뀌는데, 폴더 위치로는 알 수 없음
- 다시 볼 때: ESLint에 층 방향 검사를 넣으면 검사를 `ESLint`로 바꿈. 층 구조를 바꿀 때

## 3. 코드를 어디에 두나

### 3-1. 판단 순서

새 코드(컴포넌트·함수·타입·상수)마다 위에서부터 차례로 묻고, 처음 "예"가 나온 곳에 둠.

```
1. 한 화면만 쓰는가?                          → pages/<화면>/
2. 앱 전체 설정인가? (화면 목록, 화면 이름)     → shared/config/
3. 특정 업무 데이터에 묶여 있는가?              → entities/<데이터>/
   (출결 상태 타입, 점수 계산, 기수 선택 드롭다운)
4. 여러 화면이 같이 쓰는 업무 동작인가?         → features/<동작>/
   (계정 정보 전달: 창 + 전달문 만드는 함수)
5. 업무와 관계없는 UI인가?                     → shared/ui/
6. 업무와 관계없는 함수·Hook인가?              → shared/lib/
7. 서버 요청 도구인가?                         → shared/api/
```

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R3-1 | **금지**: 다른 화면도 쓸 것 같다는 이유만으로 공통 폴더에 미리 만드는 것. 두 번째 화면이 실제로 쓸 때 옮김 | 리뷰 |
| R3-2 | **금지**: 업무 데이터·동작에 묶인 코드를 `shared`에 두는 것 | 리뷰 |
| R3-3 | **반드시** 팝업과 버튼은 공통 컴포넌트를 씀. 공통 컴포넌트가 생기기 전까지는 `shared/ui/modalStyles.ts`의 클래스를 씀. **금지**: 새 클래스 조합으로 `<button>`·팝업 바탕을 만드는 것 | 리뷰 |
| R3-4 | 공통 폴더로 옮길 때는 옮기는 PR에서 가져다 쓰는 파일의 import를 모두 고침. 옛 위치에 다시 내보내는 파일을 남기지 않음 | `tsc`(깨진 import)·리뷰(다시 내보내는 파일) |
- 근거: `<button>` 태그 310개가 36개 파일에 직접 쓰였고, 주요 버튼만 세어도 클래스 조합이 25가지임(회의록 기준). 화면을 어둡게 덮는 팝업 바탕(`fixed inset-0`)은 20개 파일이 각자 만들어 겹침 순서(`z-50`, `z-60`, `z-[9999]`)가 달라 다른 팝업 아래에 깔릴 수 있음
- 다시 볼 때: 공통 `Modal`·`Button`이 생기면 R3-3의 `modalStyles.ts` 문장을 컴포넌트 이름으로 바꿈

### 3-2. 세그먼트: `ui/`, `model/`, `api/`

| 내용 | 위치 |
| --- | --- |
| JSX, 화면 구성, 화면 모양에 관한 값(분류별 배지 색 등) | `ui/` |
| 타입, 업무 상수, 계산 함수 | `model/` |
| 데이터 불러오기, 상태, 처리 함수 | `model/`의 Hook |
| API 요청·응답 타입 | `entities/<데이터>/model/dto.ts` |
| 여러 곳이 쓰는 업무 타입 | `entities/<데이터>/model/types.ts` |
| API 함수 | `entities/<데이터>/api/<데이터>Api.ts` |
| 임시 DB 함수 | `entities/<데이터>/api/<데이터>Repository.ts` |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R3-5 | **반드시** 컴포넌트는 Hook이 준 값을 그리고, 사용자 입력을 Hook이 준 처리 함수에 연결하기만 함 | 리뷰 |
| R3-6 | **반드시** 하나의 데이터만 다루는 Hook은 `entities/<데이터>/model/`에, 화면 하나가 여러 데이터를 모아 쓰는 Hook은 `pages/<화면>/model/`에 둠. 예: `useClubMembers`(회원 데이터), `useInputPageData`(출결 입력 화면) | 리뷰 |
| R3-7 | 큰 파일을 나눌 때는 목록 조회·편집·저장처럼 책임을 기준으로 나눔 | 리뷰 |
| R3-8 | **권장** 파일 하나가 800줄을 넘으면 나눌지 검토함 | 리뷰 |

FAQ 데이터는 아직 없음. 아래와 7·8절의 FAQ 코드는 폴더·함수 모양을 보여 주는 예시임.

```
pages/content-faq/
├─ ui/FaqSection.tsx         화면만
└─ model/
   ├─ faqCategories.ts       이 화면만 쓰는 상수
   └─ useFaqData.ts          데이터 불러오기·상태·처리 함수
entities/faq/
├─ model/
│  ├─ dto.ts                 FaqListResponse 같은 요청·응답 타입
│  └─ types.ts               FaqItem, FaqCategory
└─ api/
   ├─ faqApi.ts              fetchFaqs 같은 API 함수
   └─ faqRepository.ts       임시 DB 함수(임시 API만 부름)
shared/api/mock/routes/faqRoutes.ts   임시 API 라우트
```

- 근거: 컴포넌트 안의 계산은 화면을 띄우지 않으면 테스트할 수 없음. 테스트 34개 중 28개가 `model/` 함수를 테스트하고 `ui/`는 1개뿐임(회의록 기준). 2026-10-31 기준 `dto.ts` 9개, `<데이터>Api.ts` 14개, `<데이터>Repository.ts` 9개가 이 위치에 있음
- 다시 볼 때: 상태 관리·캐시 라이브러리를 들일 때

## 4. 이름

| 대상 | 형식 | 예 |
| --- | --- | --- |
| 컴포넌트, 타입, interface | PascalCase | `AuditLogPage`, `AuditLogQuery` |
| props 타입 | `<컴포넌트이름>Props` | `TooltipProps` |
| Hook이 돌려주는 타입 | `<무엇>State` | `AuditLogsState`, `ClubMembersState` |
| 변수, 함수 | camelCase | `selectedTeam`, `saveEvaluation` |
| 고정된 기준값 상수 | UPPER_SNAKE_CASE | `DEFAULT_AUDIT_PAGE_SIZE`, `REQUEST_TIMEOUT_MS` |
| 참·거짓 값 | `is`·`has`·`can`·`should`로 시작 | `isLoading`, `hasError`, `canEdit` |
| Hook | `use`로 시작 | `useAuditLogs` |
| 이벤트 처리 함수 | `handle`로 시작 | `handleSave` |
| 이벤트를 받는 props | `on`으로 시작 | `onSave={handleSave}` |
| API 함수 | 동작 + 대상. 조회 `fetch`, 생성 `create`, 수정 `update`, 삭제 `delete`, 제출 `submit` | `fetchClubMembers`, `createClubMember` |
| 임시 DB 함수 | 동작 + 대상. 조회 `list`·`find`, 쓰기 `insert`·`update`·`delete` | `listSemesterUsers` |
| 쓰지 않는 매개변수 | `_`로 시작 | `_index` |
| 컴포넌트 파일 | PascalCase | `AuditLogPage.tsx` |
| Hook 파일 | Hook 이름과 같게 | `useAuditLogs.ts` |
| 그 밖의 파일 | camelCase | `auditLogApi.ts` |
| 테스트 파일 | `<대상>.test.ts` | `auditLogRoutes.test.ts` |
| 폴더 | 영어 소문자와 하이픈 | `audit-log` |
| 화면 폴더 | `<메뉴 접두사>-<화면>` | `attendance-events`, `system-audit`, `content-faq` |
| localStorage 키 | `boaz_` + snake_case | `boaz_score_rules` |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R4-1 | **반드시** 위 표를 따름. 예외: 앱 진입 파일 `main.tsx` | `_` 접두사는 `tsc`, 나머지는 리뷰 |
| R4-2 | **금지**: `const`로 선언했다는 이유만으로 대문자로 쓰는 것. 대문자는 고정된 기준값에만 씀 | 리뷰 |
| R4-3 | **반드시** 식별자·타입 이름은 영어, 화면에 보이는 문구와 주석은 한국어 | 리뷰 |
| R4-4 | **반드시** 단위가 있는 숫자 상수는 이름 끝에 단위를 붙임. 예: `REQUEST_TIMEOUT_MS` | 리뷰 |
| R4-5 | **금지**: 뜻 없는 줄임말(`tmp`, `data2`, `cb`). 업계에서 널리 쓰는 것(`id`, `url`, `api`, `db`)은 허용 | 리뷰 |
- 근거: 새 규칙이 아니라 2026-10-31 코드의 방식을 확정한 것임. `.tsx` 60개 중 59개가 PascalCase, `.ts` 137개가 모두 camelCase(회의록 기준). `...Props` 타입 51곳, `handle...` 함수 160곳. React와 ESLint의 컴포넌트 파일 내보내기 검사(`react-refresh`)가 대문자 여부로 컴포넌트를 구분함
- 다시 볼 때: 없음

## 5. 컴포넌트 작성

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R5-1 | **반드시** 컴포넌트는 `export function 이름`으로 내보냄. **금지**: `export default`(예외: `app/App.tsx`) | 리뷰 |
| R5-2 | **권장** 파일 하나에 주 컴포넌트 하나. 그 파일에서만 쓰는 작은 컴포넌트는 같은 파일 아래쪽에 둘 수 있음 | 리뷰 |
| R5-3 | **반드시** props 타입은 컴포넌트 바로 위에 `interface <이름>Props`로 적음 | 리뷰 |
| R5-4 | **반드시** 목록의 `key`는 데이터의 안정된 ID를 씀. **금지**: 순서가 바뀌거나 항목이 추가·삭제되는 목록에서 배열 인덱스를 `key`로 쓰는 것 | 리뷰 |
| R5-5 | **반드시** 누를 수 있는 요소는 `<button type="button">`으로 만듦. 폼 제출 버튼만 `type="submit"`. **금지**: `onClick`을 붙인 `<div>`·`<span>` | 리뷰 |
| R5-6 | **반드시** 입력칸에는 라벨을 붙임(`<label>` 또는 `aria-label`) | 리뷰 |
| R5-7 | **금지**: `dangerouslySetInnerHTML` | 리뷰 |
| R5-8 | **권장** props가 8개를 넘으면 묶을 수 있는지 검토함 | 리뷰 |

```tsx
interface StatusBadgeProps {
  status: AttendanceStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <span className={STATUS_STYLES[status].badge}>{STATUS_STYLES[status].label}</span>;
}
```

- 근거: R5-1은 이름으로 찾기·바꾸기가 되게 함. 2026-10-31 기준 `export default`는 `App.tsx` 1곳뿐임. R5-5·R5-6은 키보드와 화면 낭독기로 조작할 수 있게 함
- 다시 볼 때: 접근성 primitive(Radix 등)를 들일 때 R5-5·R5-6을 그 사용법으로 바꿈

## 6. 상태와 Hook

### 6-1. 상태를 어디에 두나

| 상태 종류 | 소유자 | 예 |
| --- | --- | --- |
| 서버 데이터 | `model/`의 Hook | 회원 목록, 감사 로그 한 쪽 |
| 여러 화면이 공유하는 상태 | `app/App.tsx`의 `useState`, props로 내려보냄 | 로그인 역할, 보고 있는 화면 |
| 컴포넌트 하나의 상태 | 그 컴포넌트의 `useState` | 입력 중인 값, 열린 창 |
| 새로고침 뒤에도 남길 설정 | localStorage(`boaz_` 키) | 점수 규칙 초안, 전달문 양식 |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R6-1 | **반드시** 상태 하나에는 소유자를 하나만 둠 | 리뷰 |
| R6-2 | **금지**: Hook이 준 서버 데이터를 컴포넌트 `useState`에 복사해 두는 것. 편집 중인 초안은 예외이며, 이름에 `draft`를 붙여 구분함 | 리뷰 |
| R6-3 | **금지**: 다른 상태나 props로 계산할 수 있는 값을 `useState`에 두는 것. 그리는 중에 계산함 | 리뷰 |
| R6-4 | **금지**: 상태 관리 라이브러리를 새로 들이는 것. 필요하면 18절에 따라 멈추고 물음 | 리뷰 |
| R6-5 | **반드시** localStorage 키는 상수로 정의하고 `boaz_`로 시작함. 읽을 때는 값이 없거나 깨진 경우를 처리함(10절 예시) | 리뷰 |
| R6-6 | **금지**: localStorage에 토큰·비밀번호·회원 개인정보를 저장하는 것 | 리뷰 |

### 6-2. Hook 작성

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R6-7 | **반드시** 서버 데이터를 읽는 Hook은 `{ 데이터, isLoading, error }` 모양을 돌려주고, 돌려주는 타입을 `interface <무엇>State`로 적음 | 리뷰 |
| R6-8 | **반드시** `error`는 `Error` 또는 `null`로 맞춰 돌려줌. `catch`로 받은 값은 `unknown`이므로 `Error`로 바꿈 | 리뷰 |
| R6-9 | **반드시** `useEffect`에서 요청을 보내면 정리 함수에서 취소 표시를 남겨, 늦게 도착한 옛 응답이 새 결과를 덮지 않게 함 | 리뷰 |
| R6-10 | **반드시** `isLoading`처럼 다른 상태로 알 수 있는 값은 따로 저장하지 않고 계산함 | 리뷰 |
| R6-11 | **금지**: `react-hooks/exhaustive-deps` 경고를 `eslint-disable`로 끄는 것. 의존성이 객체면 `JSON.stringify`한 키를 의존성으로 씀 | 의존성 누락은 `ESLint`, `eslint-disable` 사용은 리뷰 |
| R6-12 | **반드시** `useEffect`는 외부와 맞출 때(요청, 구독, 타이머, 이벤트 리스너)만 씀. 버튼을 눌러 생긴 일은 이벤트 처리 함수에서 처리함 | 리뷰 |
| R6-13 | **반드시** 구독·타이머·이벤트 리스너는 정리 함수에서 해제함 | 리뷰 |
| R6-14 | **권장** `useMemo`·`useCallback`은 계산이 실제로 무겁거나 같은 참조가 필요할 때만 씀 | 리뷰 |

```tsx
// pages/system-audit/model/useAuditLogs.ts (2026-10-31 코드를 줄인 것)
/** 감사 로그 한 쪽의 상태. */
export interface AuditLogsState {
  page: AuditLogPage | null;
  isLoading: boolean;
  error: Error | null;
}

interface LoadedAuditLogs {
  page: AuditLogPage | null;
  error: Error | null;
  loadedKey: string | null;
}

const toError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));

/** 조회 조건에 맞는 감사 로그 한 쪽을 읽는다. 조건이 바뀌면 옛 응답은 버린다. */
export function useAuditLogs(query: AuditLogQuery): AuditLogsState {
  const key = JSON.stringify(query); // 객체 의존성은 문자열 키로 (R6-11)
  const [state, setState] = useState<LoadedAuditLogs>({
    page: null,
    error: null,
    loadedKey: null,
  });

  useEffect(() => {
    let isCancelled = false; // 늦게 온 옛 응답을 버림 (R6-9)
    // 같은 Hook에서 만든 키를 되돌리는 것이라 단언을 허용함 (R9-3 예외)
    fetchAuditLogs(JSON.parse(key) as AuditLogQuery)
      .then((page) => {
        if (!isCancelled) setState({ page, error: null, loadedKey: key });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;
        setState((current) => ({ ...current, error: toError(error), loadedKey: key }));
      });
    return () => {
      isCancelled = true;
    };
  }, [key]);

  // 읽는 중인지는 저장하지 않고 계산함 (R6-10)
  return { page: state.page, error: state.error, isLoading: state.loadedKey !== key };
}
```

- 근거: 조회 조건을 빠르게 바꾸면 응답이 보낸 순서와 다르게 올 수 있음. 취소 표시가 없으면 옛 조건의 결과가 화면에 남음
- 다시 볼 때: 캐시 라이브러리(TanStack Query 등)를 들이면 6-2절을 그 라이브러리 사용법으로 바꿈

## 7. API 함수와 데이터 흐름

```
컴포넌트(ui/) → Hook(model/) → API 함수(entities/*/api/*Api.ts) → client.ts → 서버 또는 임시 API
```

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R7-1 | **금지**: 컴포넌트가 API 함수를 직접 호출하는 것. Hook을 거침 | 리뷰 |
| R7-2 | **반드시** API 함수는 `Promise<응답 타입>`을 돌려주고, 반환 타입을 적음 | 리뷰 |
| R7-3 | **반드시** API 함수는 `shared/api/client.ts`의 `api`(`get`·`post`·`put`·`patch`·`delete`)로만 요청함. **금지**: `fetch`를 직접 부르는 것 | 리뷰 |
| R7-4 | **반드시** API 경로 문자열(`/api/v1/...`)은 API 함수 안에만 씀. 쿼리 문자열은 `withQuery`로 붙임 | 리뷰 |
| R7-5 | **반드시** 서버 응답을 화면용 모양으로 바꾸는 코드는 API 함수에만 둠 | 리뷰 |
| R7-6 | **반드시** 저장·수정·삭제 뒤에는 목록을 다시 불러옴. **금지**: 화면에서 목록 배열을 직접 고쳐 맞추는 것 | 리뷰 |
| R7-7 | **반드시** 저장 성공과 그 뒤 목록 다시 불러오기 실패를 구분함. 저장은 됐는데 목록만 실패하면 저장 실패로 알리지 않음 | 리뷰 |
| R7-8 | **반드시** 저장 버튼은 요청이 끝날 때까지 비활성화해 같은 요청이 두 번 가지 않게 함 | 리뷰 |
| R7-9 | **반드시** 새 API의 경로·요청·응답 모양은 `docs/spec/`의 해당 도메인 명세를 따름. 명세에 없으면 18절에 따라 멈춤 | 리뷰 |

```tsx
// entities/faq/api/faqApi.ts
import { api, withQuery } from '@/shared/api/client';

import type { FaqListResponse } from '../model/dto';
import type { FaqCategory, FaqItem } from '../model/types';

/** FAQ 목록을 분류별로 읽는다. 순서는 서버가 정한다. */
export async function fetchFaqs(category?: FaqCategory): Promise<FaqItem[]> {
  const response = await api.get<FaqListResponse>(withQuery('/api/v1/admin/faqs', { category }));
  return response.items; // 응답 모양 바꾸기는 여기서만 (R7-5)
}
```

```tsx
// R7-7: 저장과 목록 다시 불러오기를 따로 처리함
const handleSave = async () => {
  setIsSaving(true); // R7-8
  try {
    await save(draft);
  } catch (error) {
    alertApiError(error); // 저장 실패: 입력은 그대로 둠 (R10-4)
    return;
  } finally {
    setIsSaving(false);
  }
  try {
    await reload();
  } catch {
    window.alert('저장했습니다. 목록을 새로 불러오지 못했으니 새로고침해 주세요.');
  }
};
```

- 근거: 데이터를 가져오는 방법이 바뀌어도(임시 API → 실제 서버, 캐시 라이브러리 도입) Hook과 API 함수만 고치고 화면 파일은 그대로 둘 수 있음. `client.ts`가 시간 초과(10초), 오류 응답 읽기, 응답 없는 성공(204)을 한곳에서 처리함
- 다시 볼 때: MSW 도입이 정해지면 `client.ts` 설명을 고침. 캐시 라이브러리를 들이면 R7-6을 "캐시 무효화"로 바꿈

## 8. 임시 API와 임시 DB

백엔드가 없는 동안 쓰는 코드임. 백엔드와 같은 경로·같은 응답 모양으로 동작해야 연결할 때 화면 코드를 바꾸지 않음.

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R8-1 | **반드시** 임시 API 라우트는 `shared/api/mock/routes/<데이터>Routes.ts`에 `MockRoute` 배열로 두고 `mockRoutes.ts`에 등록함 | 리뷰 |
| R8-2 | **반드시** 라우트마다 `method`, `pattern`, `summary`(무엇을 하는지 한국어 한 줄), `handler`를 적음 | `tsc`·리뷰 |
| R8-3 | **반드시** 요청 값은 `shared/api/mock/validate.ts`의 함수로 검사하고, 잘못된 요청은 `ApiError(상태 코드, 오류 코드, 한국어 문구)`로 거절함 | 리뷰 |
| R8-4 | **반드시** "할 수 없다"는 제약(권한, 탈퇴 불가 조건, 중복 등)은 임시 API에서 먼저 막음. 화면에서 버튼을 숨기거나 막는 것은 그다음에 더함(11절) | 리뷰 |
| R8-5 | **반드시** 쓰기 API(POST·PUT·PATCH·DELETE)를 추가하면 `shared/api/mock/audit.ts`에 감사 기록 규칙을 추가하거나, 기록하지 않는 이유와 함께 `IGNORED_WRITES`에 적음 | 테스트 |
| R8-6 | **반드시** 임시 DB 함수는 임시 API에서만 부름. **금지**: 화면·Hook·API 함수가 임시 DB 함수를 부르는 것 | 리뷰 |
| R8-7 | **반드시** 테이블을 바꾸면 `db/schema.sql`과 `db/seed.sql`을 같은 PR에서 고침 | 테스트 |
| R8-8 | **반드시** 초기 데이터의 사람 이름·연락처·이메일은 가짜 값을 씀. **금지**: 실제 회원 정보를 넣는 것 | 리뷰 |
| R8-9 | **반드시** 새 라우트에는 `tests/<데이터>Routes.test.ts`에 성공 1건과 거절 1건 이상의 테스트를 추가함 | 리뷰 |

```tsx
// shared/api/mock/routes/faqRoutes.ts
export const faqRoutes: MockRoute[] = [
  {
    method: 'GET',
    pattern: '/api/v1/admin/faqs',
    summary: 'FAQ 목록 조회(분류로 거를 수 있음)',
    handler: ({ db, query }) => {
      // 잘못된 분류 값은 validate.ts 함수가 ApiError(400)로 거절함 (R8-3)
      const category = oneOf(query.get('category') || undefined, FAQ_CATEGORIES, 'category');
      return listFaqs(db, category);
    },
  },
];
```

- 근거: R8-5는 `tests/auditLogRoutes.test.ts`의 "모든 쓰기 API는 감사 액션이 정해져 있다" 테스트가 막음. R8-4는 화면에서만 막으면 주소 해시로 다른 화면에 들어가거나 다른 경로로 요청할 때 막히지 않기 때문임
- 다시 볼 때: 백엔드가 연결되면 이 절을 지우고, 백엔드 계약 문서를 가리키는 절로 바꿈

## 9. 타입

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R9-1 | **금지**: `any` | `ESLint` |
| R9-2 | **반드시** 타입을 모르는 외부 값(API 응답, localStorage, `JSON.parse` 결과, `catch`의 오류)은 `unknown`으로 받고, 값을 확인한 뒤 씀 | 리뷰 |
| R9-3 | **금지**: 타입 오류를 없애려고 `as`로 단언하는 것. 외부 값은 확인하는 코드로 좁힘. 허용하는 것: `as const`, `client.ts` 안의 응답 타입 지정, R6-11에 따라 같은 Hook에서 `JSON.stringify`로 만든 키를 되돌리는 `JSON.parse(key) as <타입>`(6-2절 예시) | 리뷰 |
| R9-4 | **반드시** 내보내는 함수는 매개변수와 반환 타입을 적음. 지역 변수는 추론에 맡김 | 리뷰 |
| R9-5 | 객체 모양은 `interface`, 합집합·유틸리티 타입은 `type`으로 적음 | 리뷰 |
| R9-6 | **반드시** 정해진 값만 오는 문자열은 합집합 타입으로 적음(아래 예) | 리뷰 |
| R9-7 | **금지**: `enum`, `namespace`. 지워도 동작이 같은 TypeScript 문법만 허용하는 설정(`erasableSyntaxOnly`) 때문에 쓸 수 없음. 합집합 타입과 `as const` 객체를 씀 | `tsc` |
| R9-8 | **금지**: `@ts-ignore`, `@ts-expect-error` | 리뷰 |

```tsx
// 금지
const parse = (data: any) => data.items;

// 허용
const parse = (data: FaqListResponse) => data.items;

// R9-6
type AttendanceStatus = 'present' | 'late' | 'absent';
```

- 근거: `any`와 `as`는 타입 검사를 끄는 것이라, 실제 서버 응답 모양이 다를 때 화면에서 처음 오류가 남. 기존 `any` 22건은 `eslint-suppressions.json`에 억제되어 있어 CI가 통과하지만, 새 `any`는 ESLint가 막음
- 다시 볼 때: 응답 검증 도구(zod 등)를 들일 때 R9-2에 그 도구 사용을 넣음

## 10. 오류 처리와 로그

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R10-1 | **반드시** API 실패는 `ApiError`(`shared/api/apiError.ts`)로 판단함. 오류 코드로 분기할 때는 `error instanceof ApiError && error.code === '...'`로 씀 | 리뷰 |
| R10-2 | **반드시** 사용자에게 알릴 때는 `alertApiError`(`shared/lib/alertApiError.ts`)를 씀. **금지**: 화면마다 API 오류 문구를 따로 쓰는 것. API 오류가 아닌 상황 안내(예: 7절 R7-7 예시의 "저장했습니다. 목록을 새로 불러오지 못했으니…")는 화면에서 씀 | 리뷰 |
| R10-3 | 에러 코드별 한국어 문구는 공통 메시지 표 한 곳에서 관리함(WBS 티켓 PLT-ERRMSG). 프론트는 서버 에러 코드를 새로 만들지 않고 문구만 붙임. 프론트가 만드는 코드는 `NETWORK_ERROR`, `HTTP_ERROR` 두 개뿐임 | 리뷰 |
| R10-4 | **반드시** 저장에 실패하면 실패를 알리고 사용자가 입력한 내용은 지우지 않음 | 리뷰 |
| R10-5 | **반드시** 데이터를 읽지 못하면 빈 목록처럼 보이게 두지 않고, 읽지 못했다는 안내와 다시 시도할 방법을 보여 줌 | 리뷰 |
| R10-6 | **금지**: 중요한 실패를 빈 `catch`로 숨기는 것. 빈 `catch`에는 실패를 무시해도 되는 이유를 한 줄 주석으로 적음 | 리뷰 |
| R10-7 | **금지**: `console.log`를 커밋하는 것 | 리뷰 |
| R10-8 | `console.error`는 예상하지 못한 오류를 진단할 때만 씀. 오류 종류와 메시지만 남김 | 리뷰 |
| R10-9 | **금지**: 로그·오류 메시지에 비밀번호, 토큰, 회원 정보, 평가 내용을 넣는 것 | 리뷰 |

```tsx
try {
  await saveFaq(item);
} catch (error) {
  alertApiError(error);
}

function readDraft(): ScoreRuleDraft | null {
  try {
    return parseDraft(JSON.parse(localStorage.getItem(SCORE_RULES_KEY) ?? 'null'));
  } catch {
    // 저장값이 깨졌으면 초안 없이 시작해도 됨
    return null;
  }
}
```

- 근거: 브라우저 콘솔은 배포된 사이트에서도 누구나 볼 수 있음. `console.log`로 찍은 회원 명단 같은 응답 데이터가 그대로 노출됨
- 다시 볼 때: ESLint의 `console` 사용 금지 규칙(`no-console`)을 켜면 R10-7 검사를 `ESLint`로 바꿈. 빈 `catch`를 막도록 ESLint의 빈 `catch` 허용 설정(`allowEmptyCatch: true`, 2026-10-31 기준 켜져 있음)을 바꾸면 R10-6도 같음. 배포 뒤 오류 수집 서비스(Sentry 등)를 들이면 R10-8을 고침

## 11. 권한, 보안, 개인정보

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R11-1 | **반드시** 권한 확인은 서버(백엔드 연결 전에는 임시 API)가 최종 판단함. 화면에서 메뉴·버튼을 숨기는 것은 사용자 편의임. **금지**: 화면 숨김만으로 권한을 막았다고 보는 것 | 리뷰 |
| R11-2 | **반드시** 권한이 없어 막을 때는 버튼을 숨기기보다 비활성화하고 이유를 보여 줌. 단, 존재 자체를 알면 안 되는 메뉴는 숨김 | 리뷰 |
| R11-3 | **금지**: 비밀값(API 키, 토큰, 비밀번호)을 코드에 넣는 것. `VITE_`로 시작하는 환경 변수는 배포 결과물에 그대로 들어가 누구나 볼 수 있음 | 리뷰 |
| R11-4 | **금지**: `.env*` 파일을 커밋하는 것 | 리뷰 |
| R11-5 | **반드시** 사용자 입력이 들어가는 링크(`href`, `src`)는 `http`·`https`로 시작하는지 확인함 | 리뷰 |
| R11-6 | **반드시** 화면에 비밀번호를 보여 줘야 하는 곳(초기 비밀번호 전달 등)은 그 창 안에서만 보여 주고, 목록·로그·감사 기록에는 남기지 않음 | 리뷰 |
| R11-7 | **금지**: 코드·테스트·초기 데이터·커밋·PR에 실제 사람 이름, 이메일, 전화번호를 넣는 것. `홍길동`, `name@example.com`, `010-0000-0000` 같은 가짜 값을 씀 | 리뷰 |
- 근거: 2026-10-31 기준 역할별 메뉴 제한은 사이드바에만 걸려 있어 주소 해시로 다른 화면에 들어가는 것을 막지 않음(프로젝트 `CLAUDE.md`). 관리자 콘솔은 회원 개인정보와 평가 내용을 다룸
- 다시 볼 때: permission 기반 화면 게이팅(SYS-GATE)을 구현할 때 R11-1·R11-2를 그 방식으로 구체화함

## 12. 화면 스타일과 팝업

### 12-1. 모서리

| 대상 | 클래스 |
| --- | --- |
| 입력칸, 버튼, 드롭다운 | `rounded-sm` |
| 표, 카드, 목록 상자 | `rounded-md` |
| 팝업 창 | `rounded-lg` |
| 배지, 프로필 사진 | `rounded-full` |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R12-1 | **금지**: `rounded-xl` 이상(`rounded-2xl`, `rounded-3xl`) | 리뷰 |
| R12-2 | **금지**: 배지·프로필 사진이 아닌 곳에 `rounded-full` | 리뷰 |

### 12-2. 간격

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R12-3 | **반드시** padding·margin·gap은 4px 배수. Tailwind 간격 숫자 1이 4px이므로 숫자가 정수인 클래스만 씀. 예: `p-1`(4px), `p-2`(8px), `gap-4`(16px) | 리뷰 |
| R12-4 | **금지**: 임의 값(`p-[13px]`, `mt-[7px]`) | 리뷰 |
| R12-5 | **금지**: 4px 배수가 아닌 기본 클래스(`p-0.5`, `gap-1.5`, `py-2.5`) | 리뷰 |

### 12-3. 색, 글자, 꾸밈

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R12-6 | **반드시** 바탕색은 slate 계열을 쓰고, 주색·강조색은 기존 화면에서 이미 쓰는 클래스를 그대로 씀. 빨강·초록은 오류·정상, 추가·제외처럼 뜻이 있을 때만 씀 | 리뷰 |
| R12-7 | **반드시** 본문 글자는 12px(`text-xs`) 이상. 읽어야 하는 글자는 흰 바탕에서 `slate-500`보다 진하게 씀(`slate-400`은 보조 표시에만) | 리뷰 |
| R12-8 | **반드시** 서체는 Pretendard 하나이고, 아이디·코드만 고정폭 서체를 씀. **금지**: 새 서체를 들이는 것 | 리뷰 |
| R12-9 | **반드시** 표·목록·폼은 왼쪽 정렬, 숫자는 오른쪽 정렬 | 리뷰 |
| R12-10 | **금지**: 그라데이션, 반투명 흐림 효과(`backdrop-blur`), 이모지 장식, 뜻 없는 장식 아이콘. 그림자는 팝업·드롭다운처럼 떠 있는 것에만 씀 | 리뷰 |

### 12-4. 팝업

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R12-11 | **반드시** 팝업은 `shared/lib/useDialogKeyboard.ts`를 써서 Escape로 닫히고, Tab 이동이 팝업 안에서만 돌고, 닫으면 팝업을 연 요소로 포커스가 돌아가게 함 | 리뷰 |
| R12-12 | **반드시** 팝업 창에는 `role="dialog"`, `aria-modal="true"`, 제목을 가리키는 `aria-labelledby`를 붙임 | 리뷰 |
| R12-13 | **반드시** 팝업이 겹치면 맨 위 팝업만 키보드에 반응함 | 리뷰 |
| R12-14 | **반드시** 저장하지 않은 입력이 있는 팝업을 닫을 때는 확인을 받음. 저장하지 않은 수정이 있는 화면은 `shared/lib/leaveGuard.ts`의 `registerLeaveGuard`로 확인 함수를 등록해, 다른 메뉴로 옮기기 전에 묻게 함 | 리뷰 |
- 근거: 같은 종류의 요소가 화면마다 같은 모양이어야 함. 2026-10-31 기준 팝업 바탕 20개 파일 중 `useDialogKeyboard`를 쓰는 곳은 5개 파일뿐임
- 다시 볼 때: Tailwind 테마에 간격·색·모서리 토큰을 따로 정의할 때. 공통 `Modal`이 생기면 12-4절을 "`Modal`을 씀"으로 줄임

## 13. 화면 문구

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R13-1 | **반드시** 문구는 무엇을 하는지만 짧게 씀. **금지**: "스마트한", "한눈에", "손쉽게" 같은 꾸밈말 | 리뷰 |
| R13-2 | **반드시** 버튼 문구는 누르면 일어나는 동작을 나타내는 말로 끝냄("확인", "목록" 같은 이름이 아님). 예: "저장", "계정 발급", "탈퇴 처리" | 리뷰 |
| R13-3 | **반드시** 지우거나 다른 데이터에 영향을 주는 동작(삭제, 탈퇴 처리, 비밀번호 재설정)은 확인 창을 띄우고, 무엇이 바뀌고 무엇이 남는지 적음. 예: "홍길동님을 정말 탈퇴 처리할까요? 활동 상태만 탈퇴로 바뀌고, 출결 기록과 팀 소속은 그대로 남습니다." | 리뷰 |
| R13-4 | **반드시** 동작을 막을 때는 이유와 먼저 해야 할 일을 함께 알림. 예: "현재 반기 A팀의 팀장입니다. 출결 화면에서 팀장을 먼저 바꿔 주세요." | 리뷰 |
| R13-5 | **반드시** 같은 대상은 화면마다 같은 이름으로 부름. 메뉴·화면 이름은 `shared/config/pageLabels.ts`의 `PAGE_LABELS`를 따름 | 리뷰 |
| R13-6 | **반드시** 날짜는 `shared/lib/date.ts`의 함수로 만듦. **금지**: 화면마다 날짜 형식을 직접 만드는 것 | 리뷰 |
| R13-7 | **금지**: 실제처럼 보이게 꾸민 가짜 통계 숫자, 장식용 요약 카드 | 리뷰 |
- 근거: 관리자 콘솔 사용자는 운영진이며, 막힌 이유를 모르면 같은 문의가 반복됨. R13-3·R13-4 예시는 회원 관리 화면(`MemberManagementPage`)과 `entities/club-member/model/withdrawBlock.ts`의 실제 문구임
- 다시 볼 때: 문구 표준표(용어집)를 만들 때

## 14. 주석

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R14-1 | **반드시** 내보내는 함수·Hook·타입에는 한국어 `/** */` 주석 한두 줄로 무엇을 하는지, 코드만 보고 알 수 없는 조건을 적음 | 리뷰 |
| R14-2 | **반드시** 코드 안 주석은 "왜"만 적음. 코드가 보여 주는 "무엇"은 적지 않음 | 리뷰 |
| R14-3 | **금지**: 주석으로 막아 둔 옛 코드를 남기는 것. 기록은 Git이 함 | 리뷰 |
| R14-4 | 한계를 알고도 임시로 택한 구현은 주석에 `shortcut: <한계>, <고칠 조건>` 형식으로 적음. 예: `shortcut: 페이지 나누기 없이 전체를 읽음, 회원이 1,000명을 넘으면 서버 페이지 나누기로 바꿈` | 리뷰 |
| R14-5 | **금지**: 주석에 실명, 개인 GitHub 계정명, 비밀값을 적는 것 | 리뷰 |

```tsx
/** 수행자 필터 선택지를 읽는다. 못 읽으면 error를 채우고 actors는 빈 배열로 둔다(R10-5). */
export function useAuditActors(): AuditActorsState { ... }

// 임시 API는 세션이 없으면 요청자가 없다. 시험은 1번 계정으로 로그인한 채 시작한다.
call('PUT', '/api/v1/mock/admin-session', { accountId: 1 });
```

- 근거: 2026-10-31 기준 `client.ts`, `apiError.ts`, Hook 파일이 이 방식으로 씀
- 다시 볼 때: 없음

## 15. 테스트

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R15-1 | **반드시** 테스트는 `tests/<대상>.test.ts`에 두고, `node:test`와 `node:assert/strict`로 씀 | 리뷰 |
| R15-2 | **반드시** `model/`의 계산 함수, 임시 API 라우트, 임시 DB 함수를 바꾸면 테스트를 함께 추가·수정함 | 리뷰 |
| R15-3 | **반드시** 테스트할 수 있는 코드(`model/`의 함수, 임시 API 라우트, 임시 DB 함수)의 버그를 고칠 때는 버그를 재현하는 테스트를 먼저 쓰고, 실패하는 것을 확인한 뒤 고침 | 리뷰 |
| R15-4 | **반드시** 테스트 이름은 확인하는 동작을 한국어 문장으로 씀. 예: `'모든 쓰기 API는 감사 액션이 정해져 있다'` | 리뷰 |
| R15-5 | **반드시** 테스트는 준비 → 실행 → 확인 순서로 쓰고, 테스트끼리 상태를 나누지 않음. 임시 DB는 테스트마다 새로 만듦 | 리뷰 |
| R15-6 | **반드시** CI가 테스트를 돌리지 않으므로 PR 전에 로컬에서 `npx tsx --test tests/*.test.ts`를 실행하고 결과를 PR 본문에 적음 | 리뷰 |
| R15-7 | 테스트가 실패하면 테스트가 틀린 경우가 아닌 한 구현을 고침. 원래 실패하던 테스트와 새로 깨진 테스트를 구분해 보고함 | 리뷰 |
- 근거: 2026-10-31 기준 테스트 34개가 이 방식으로 씀. 화면 테스트 도구는 없으므로, 로직을 `model/`로 빼야 테스트할 수 있음(3-2절)
- 다시 볼 때: CI에 테스트 단계를 넣으면 R15-6을 지우고 검사를 `테스트`로 바꿈. 화면 테스트 도구를 들이면 화면 테스트 규칙을 추가함

## 16. 화면 추가

이 저장소는 라우터를 쓰지 않고, `App.tsx`의 `activePage` 상태 하나로 화면을 바꿈.

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R16-1 | **반드시** 화면을 추가하면 네 곳을 같은 PR에서 고침: `shared/config/activePage.ts`의 `ActivePage`, `shared/config/pageLabels.ts`의 `PAGE_LABELS`, `widgets/sidebar/ui/Sidebar.tsx`의 `SIDEBAR_NAV`, `app/App.tsx`의 조건 렌더링 | `tsc`(`PAGE_LABELS` 누락만)·리뷰 |
| R16-2 | **반드시** 화면 ID는 메뉴 접두사 규칙을 따름: `att-`, `content-`, `recruiting`, `evaluation`, `system`. 상단 경로 표시와 사이드바 선택 판정이 이 접두사를 씀. 화면 ID 접두사(`att-`)와 화면 폴더 이름(`attendance-events`)은 다르며, 폴더 이름은 4절을 따름 | 리뷰 |
| R16-3 | **반드시** `SIDEBAR_NAV`의 `permission`에는 `docs/spec/06-system.md`의 권한 이름을 적음 | 리뷰 |
| R16-4 | **반드시** 메뉴 구조를 바꾸기 전에 `docs/ia/01-ia-strategy.md`를 읽음. 메뉴 구조 변경은 18절에 따라 묻고 진행함 | 리뷰 |
| R16-5 | **반드시** 화면을 추가·삭제하면 `docs/screens/06-screen-inventory.md`를 같은 PR에서 고침 | 리뷰 |
- 근거: 네 곳 중 하나라도 빠지면 화면이 사이드바에 안 보이거나, 눌러도 아무것도 그려지지 않음
- 다시 볼 때: 라우터(react-router 등)를 들이면 이 절을 라우트 추가 규칙으로 바꿈

## 17. 브랜치, 커밋, PR

| ID | 규칙 | 검사 |
| --- | --- | --- |
| R17-1 | **반드시** 작업은 이슈를 먼저 만들고, `dev`에서 `<type>/#<이슈 번호>-<짧은 설명>` 브랜치를 만들어 함. 예: `feat/#48-audit-log` | 리뷰 |
| R17-2 | **반드시** 커밋 메시지는 `<type>: <한국어 설명> (#<이슈 번호>)` 한 줄. type은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`, `perf`, `revert` | 리뷰 |
| R17-3 | **반드시** 커밋 하나에는 한 가지 변경만 담음. 기능 변경과 이동·이름 바꾸기·포맷 정리는 다른 커밋으로 나눔 | 리뷰 |
| R17-4 | **반드시** PR은 `dev`를 대상으로 하고, `.github/PULL_REQUEST_TEMPLATE.md`의 섹션 이름과 순서를 지킴 | 리뷰 |
| R17-5 | **반드시** PR "검증 결과"에 19-1절 명령 4개 결과와 테스트 결과를 적고, UI를 바꿨으면 "UI 변경 전후"에 화면 사진을 붙임 | 리뷰 |
| R17-6 | **반드시** WBS 티켓 작업이면 같은 PR에서 `docs/03-wbs-fe.md` 진행 현황표의 그 티켓 행을 고침 | 리뷰 |
| R17-7 | 분할 PR은 `Refs #<번호>`, 이슈를 끝내는 PR은 `Closes #<번호>`를 씀. 기본 브랜치가 `main`이라 `dev` 병합만으로는 이슈가 자동으로 닫히지 않으므로, `Closes` PR이 `dev`에 병합되면 PR 작성자가 이슈를 직접 닫음 | 리뷰 |
| R17-8 | **금지**: 커밋·PR·이슈에 AI 도구 기여 표시(`Co-Authored-By`, "Generated with ...")를 넣는 것 | 리뷰 |
| R17-9 | **금지**: `--no-verify`로 검사를 건너뛰는 것 | 리뷰 |
| R17-10 | **반드시** 화면 동작이 바뀌면 같은 PR에서 `docs/screens/01~05` 중 해당 도메인 문서와 그 문서 상단 표의 기준 커밋을 고침(`docs/README.md` "문서를 고칠 때") | 리뷰 |
- 근거: 원격 브랜치와 커밋 기록이 이미 이 형식을 씀
- 다시 볼 때: 커밋 메시지 검사 훅을 넣으면 R17-2 검사를 그 훅으로 바꿈

## 18. 멈춰야 하는 경우

아래 중 하나라도 해당하면 작업을 멈추고, 이슈나 PR에 상황을 적은 뒤 프론트엔드 담당에게 물음. AI 도구는 사용자에게 물음.

- 규칙을 지키려면 이번 작업 범위 밖 파일을 크게 고쳐야 하는 경우(R0-2)
- 새 의존성(라이브러리)을 들여야 하는 경우
- 메뉴 구조, 권한 체계, 역할별 접근 범위를 바꿔야 하는 경우
- 새 API가 필요한데 `docs/spec/`에 경로·응답 모양이 없는 경우(추정한 경로를 쓰지 않음)
- 두 출결 모델(`entities/attendance`의 3가지 상태, `InternalCategoryAttendancePage`의 9가지 상태) 중 어느 쪽에 속하는 작업인지 확실하지 않은 경우
- 자동 검사나 테스트가 실패하는데 원인이 이번 작업이 아닌 기존 코드인 경우
- 비밀값, 실제 개인정보를 코드·데이터에 넣어야만 진행되는 경우
- 이 문서의 규칙끼리, 또는 이 문서와 `docs/spec/`이 서로 맞지 않는 경우

## 19. 끝내기 전 확인

### 19-1. 명령

PR 템플릿의 "로컬 검사 4종"임. 모두 통과해야 끝났다고 보고함. 로직을 바꿨으면 테스트도 실행함.

```bash
npm run lint
npm run format:check
npm run check-types
npm run build

npx tsx --test tests/*.test.ts   # CI가 돌리지 않으므로 로컬에서 실행
```

### 19-2. CI 작업과 실패할 때 할 일

`main`·`dev` 대상 PR에서 아래 4개가 돎. Node 버전은 `.nvmrc`를 따름.

| 작업(워크플로) | 실행 명령 | 실패할 때 할 일 |
| --- | --- | --- |
| Lint (`lint.yml`) | `npm run lint` (경고 0개여야 통과) | `npm run lint:fix` 후 남은 것을 직접 고침. `eslint-disable`로 끄거나 `eslint-suppressions.json`에 추가하지 않음(R0-6) |
| Format (`format-check.yml`) | `npm run format:check` | `npm run format` 후 커밋 |
| Typecheck (`typecheck.yml`) | `npm run check-types` | 로컬에서 같은 명령으로 재현해 고침. `as`·`any`로 덮지 않음(R9) |
| Build (`build-check.yml`) | `npm run build` | 로컬에서 재현. 별칭 문제면 세 설정 파일을 모두 확인함 |

### 19-3. 작성자 자가 확인

- [ ]  19-1절 명령 4개 통과, 로직을 바꿨으면 테스트 통과
- [ ]  고친 파일이 이번 작업 범위 안에 있음(R0-2)
- [ ]  `eslint-suppressions.json`의 건수를 늘리지 않음(R0-6)
- [ ]  새 import가 층 방향을 지킴(R2)
- [ ]  새 코드의 위치를 3-1절 판단 순서로 정함(R3)
- [ ]  컴포넌트가 API 함수를 직접 부르지 않음(R7-1)
- [ ]  요청하는 Hook에 취소 표시가 있음(R6-9)
- [ ]  저장 실패 때 입력이 남고, 저장 성공과 목록 실패를 구분함(R10-4, R7-7)
- [ ]  쓰기 API를 추가했으면 감사 기록 규칙이 있음(R8-5)
- [ ]  `any`·`as` 단언·빈 `catch`·`console.log`를 새로 넣지 않음(R9-1, R9-3, R10-6, R10-7)
- [ ]  새 클래스에 `rounded-xl` 이상, 임의 간격, 반 단위 간격이 없음(R12)
- [ ]  팝업이면 키보드로 닫고 이동할 수 있음(R12-11)
- [ ]  실제 개인정보·비밀값이 없음(R11)
- [ ]  화면 목록·화면 동작을 바꿨으면 해당 `docs/screens/` 문서를 고침(R16-5, R17-10)
- [ ]  지키지 못한 규칙이 있으면 PR 본문에 ID와 이유를 적음
- [ ]  발견한 기존 위반을 고치지 않고 PR 본문에 ID와 파일 경로로 적음(R0-2)

### 19-4. 리뷰어 체크리스트

리뷰어는 아래를 모두 확인한 뒤 승인함.

- [ ]  CI 4개 통과, PR 본문에 테스트 결과가 있음(로직 변경 시)
- [ ]  수정 파일이 PR 목적과 관계있음. 관계없는 정리는 다른 PR로 나뉨
- [ ]  `eslint-suppressions.json`이 바뀌었으면 건수가 줄기만 했음(R0-6)
- [ ]  19-3절 항목 중 `검사: 리뷰`인 규칙을 고친 부분에서 확인함
- [ ]  화면을 바꿨으면 "UI 변경 전후" 사진이 있고, 좁은 폭에서 넘치지 않음
- [ ]  WBS 티켓이면 `docs/03-wbs-fe.md`가 갱신됨(R17-6)
- [ ]  리뷰 코멘트에는 규칙 ID를 붙임. 예: `R7-1: 이 호출은 useFaqData로 옮겨 주세요`

---

## 부록 A. 기존 위반 목록

R0-3에 따라 예외로 두는 위반임. R0-4 범위 안에서 해당 파일을 크게 고치는 PR(기능 변경과 다른 PR)에서 정리하고, 정리하면 이 표에서 그 줄을 지움. ESLint가 잡는 위반은 `eslint-suppressions.json`에도 건수가 있으므로, 정리하면 `npx eslint . --prune-suppressions`로 그 파일도 함께 줄임.

| 규칙 | 위치 | 정리 방법 |
| --- | --- | --- |
| R2-3 | `pages/attendance-events/ui/FilterDropdown` (감사 로그·계정 관리·회원 관리 화면이 가져다 씀) | `shared/ui/`로 옮김 |
| R2-3 | `pages/system-accounts/ui/SplitView.tsx`(`SplitView`, `SplitListItem`), `systemStyles.ts` (감사 로그·회원 관리 화면이 가져다 씀) | `shared/ui/`로 옮김 |
| R2-3 | `pages/attendance-internal-category/ui/CohortSelect` (행사 출결 화면이 가져다 씀) | `entities/cohort/ui/`로 옮김 |
| R3-2 | `shared/ui/AccountDeliveryDialog`, `shared/config/accountDeliveryMessages` (회원 관리·계정 관리·HOST 계정 화면이 가져다 씀. 업무 동작인 계정 정보 전달 코드가 `shared`에 있음) | `features/account-delivery/`로 옮김 |
| R3-3 | 직접 쓴 `<button>` 310개(36개 파일, 회의록 기준) | 공통 `Button`이 생긴 뒤 화면을 고칠 때 바꿈 |
| R6-11 | `eslint-disable` 2곳(`app/App.tsx`, `EventAttendanceManagePage`) | 의존성을 고쳐 지움 |
| R6-11 | `InternalCategoryAttendancePage`의 `exhaustive-deps` 5건(`eslint-suppressions.json`) | 의존성을 고치고 억제 파일의 건수를 줄임 |
| R7-1 | `ui/` 파일 8개: `InternalCategoryAttendancePage`, `BaseAttendanceCreateModal`, `StudyMemberPicker`, `RulesPage`, `ScoresPage`, `MemberManagementPage`, `SystemAccountsPage`, `LoginModal` (회의록 기준) | API 호출을 `model/`의 Hook으로 옮김 |
| R9-1 | `any` 22건: `InternalCategoryAttendancePage` 12, `RecruitmentManagePage` 6, `EvaluationManagePage` 3, `CurriculumSection` 1 (`eslint-suppressions.json` 기준) | 구체 타입으로 바꾸고 억제 파일의 건수를 줄임 |
| R10-6 | 빈 `catch` 13곳 (회의록 기준) | 무시해도 되는 곳은 주석을 달고, 아니면 `alertApiError`로 바꿈 |
| R12-1 | `rounded-xl` 이상을 쓰는 8개 파일 (회의록 기준) | 12-1절 표의 클래스로 바꿈 |
| R12-5 | 반 단위 간격 약 640곳(49개 파일) | 화면을 다시 디자인할 때 정수 클래스로 바꿈 |
| R12-11 | 팝업 바탕을 직접 만든 20개 파일 중 `useDialogKeyboard`를 쓰지 않는 파일 | 팝업을 고칠 때 붙임 |
| 그 밖 | `eslint-suppressions.json`의 `react-refresh/only-export-components` 2건(`InternalCategoryAttendancePage`), `no-unused-vars` 1건(`RecruitmentManagePage`) | 고치고 억제 파일의 건수를 줄임 |

## 부록 B. 자동으로 검사되는 것

2026-10-31 기준 `eslint.config.js`, `tsconfig.app.json`, CI 워크플로를 정리함.

| 도구 | 검사하는 것 | 이 문서의 규칙 |
| --- | --- | --- |
| TypeScript (`tsc`) | 타입 오류, 타입 import 표시(import 문을 쓴 그대로 남기는 설정 `verbatimModuleSyntax`), 쓰지 않는 변수·매개변수(쓰지 않는 지역 변수 금지 `noUnusedLocals`, 쓰지 않는 매개변수 금지 `noUnusedParameters`), `enum`·`namespace` 금지(지워도 동작이 같은 문법만 허용 `erasableSyntaxOnly`), `PAGE_LABELS` 누락 | R1-2, R4-1(`_` 접두사), R9-7, R16-1 일부 |
| ESLint | `any`(`typescript-eslint` 권장 규칙), Hook 호출 규칙, `useEffect` 의존성 배열 누락(`react-hooks/exhaustive-deps`), 컴포넌트 파일이 컴포넌트만 내보내는지(`react-refresh`). 기존 위반은 `eslint-suppressions.json`에 파일별 건수로 억제되어 있어, 새 위반만 실패함 | R9-1, R6-11(의존성 누락만) |
| Prettier | 따옴표, 세미콜론, 들여쓰기, 줄 길이 100자 | 코드 모양 전체 |
| 테스트(로컬) | 쓰기 API의 감사 기록 규칙, 임시 API 응답, 계산 함수 | R8-5, R8-7 |

도구가 검사하지 않는 것: R0-6(억제 파일 건수 증가), R1-1(import 순서), R2(층 방향), R3-4의 다시 내보내는 파일, R6-11의 `eslint-disable` 사용, R7-1(컴포넌트의 API 직접 호출), R10-6(빈 `catch`, 허용 설정이 켜져 있음), R10-7(`console.log`), R12(스타일). 도구를 켜기 전까지 리뷰로 확인함.

## 부록 C. 회의록 규칙 번호와의 대응

| 회의록·팀 문서 | 이 문서 |
| --- | --- |
| ① import 순서 | 1절 (R1-1, R1-2) |
| ② 폴더 사이 import 방향 | 2절 |
| ③ 공통 코드 배치 | 3-1절 |
| ④ 이름 | 4절 |
| ⑤ UI와 로직 분리 | 3-2절 |
| ⑥ 데이터 흐름 | 7절 |
| ⑦ `any` 금지 | 9절 |
| ⑧ 오류 처리와 로그 | 10절 |
| ⑨ 화면 스타일 | 12절 |
| (새로 추가) | 5절 컴포넌트, 6절 상태와 Hook, 8절 임시 API, 11절 권한·보안, 13절 문구, 14절 주석, 15절 테스트, 16절 화면 추가, 17절 브랜치·커밋, 18절 멈춰야 하는 경우 |

## 부록 D. 자주 묻는 질문

| 질문 | 답 |
| --- | --- |
| 기존 파일을 고치는데 그 파일에 `any`가 많음. 다 고쳐야 하나 | 아님. 이번에 고치는 줄에만 적용함(R0-1). 나머지는 PR 본문에 적기만 함 |
| 기존 파일에 `any`가 있는데 왜 lint가 통과하나 | 기존 위반이 `eslint-suppressions.json`에 파일별 건수로 억제되어 있음. 그 파일에 `any`를 하나 더 넣으면 건수를 넘어 실패함(R0-6) |
| 두 화면이 같은 드롭다운을 씀. `shared`인가 `entities`인가 | 특정 데이터를 고르는 드롭다운(기수 선택 등)이면 `entities/<데이터>/ui/`, 데이터와 관계없는 모양만의 드롭다운이면 `shared/ui/`(3-1절 3번·5번) |
| Hook은 `entities`와 `pages` 중 어디에 두나 | 데이터 하나만 다루면 `entities/<데이터>/model/`, 화면 하나가 여러 데이터를 모으면 `pages/<화면>/model/`(R3-6) |
| 백엔드 API 경로를 모름 | `docs/spec/`에서 찾고, 없으면 멈추고 물음(18절). 추정한 경로를 쓰지 않음 |
| 테스트가 CI에서는 통과하는데 로컬에서 실패함 | CI는 테스트를 돌리지 않음. 로컬 결과가 기준임(R15-6) |
| `npm run lint`가 다른 사람 파일에서 실패함 | 이번 작업이 원인이 아니면 고치지 않고 멈춤(18절) |
| 반 단위 간격(`gap-1.5`)이 꼭 필요해 보임 | 쓰지 않음(R12-5). `gap-1` 또는 `gap-2` 중 가까운 쪽을 씀. 어느 쪽도 맞지 않으면 PR 본문에 이유를 적고 리뷰에서 정함 |
| 화면에서 버튼을 숨겼는데 권한 처리가 끝난 것인가 | 아님. 임시 API에서도 막아야 함(R8-4, R11-1) |