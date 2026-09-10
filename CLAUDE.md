# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

BOAZ 빅데이터 동아리 관리자 콘솔(`admin.bigdataboaz.com`)의 프론트엔드입니다. Figma Make로 생성된 코드 번들에서 출발했고, 아직 **백엔드가 연결되지 않은 UI 프로토타입**입니다. 모든 데이터는 `src/entities/*/model/constants.ts`에 하드코딩된 목 데이터이며, 일부 상태만 localStorage에 저장됩니다. 코드에 등장하는 `/api/v1/admin/...` 문자열은 실제 호출이 아니라, 향후 연동할 백엔드 계약을 화면과 주석에 명시해 둔 것입니다.

## 명령어

```bash
npm run dev          # Vite 개발 서버
npm run build        # tsc -b && vite build (타입 체크 후 빌드)
npm run check-types  # 타입 체크만 수행
npm run preview      # 빌드 결과 미리보기
```

테스트 프레임워크는 도입되어 있지 않습니다. `eslint`, `prettier`, `stylelint`, `lefthook`이 devDependencies에 들어 있지만 **설정 파일이 하나도 없어서 현재는 실행할 수 없습니다.** 따라서 변경 사항을 검증하는 유일한 자동 수단은 `npm run check-types`입니다. 린트를 실행해야 한다면 설정 파일을 먼저 만들어야 하며, 이는 별도 작업으로 다루어야 합니다.

## 아키텍처

### 라우팅이 없는 단일 페이지 구조

react-router를 쓰지 않습니다. `src/app/App.tsx`가 `ActivePage` 문자열 유니온(`src/shared/config/activePage.ts`) 상태 하나를 들고, JSX 조건 렌더링으로 모든 화면을 전환합니다. 페이지를 추가하려면 다음 네 곳을 함께 수정해야 합니다.

1. `src/shared/config/activePage.ts`의 `ActivePage` 유니온
2. `src/shared/config/pageLabels.ts`의 `PAGE_LABELS` (`Record<ActivePage, string>`이므로 누락 시 타입 에러가 발생합니다)
3. `src/widgets/sidebar/ui/Sidebar.tsx`의 `SIDEBAR_NAV`
4. `App.tsx`의 조건 렌더링 블록

`activePage` 접두사(`att-`, `content-`, `recruiting`, `evaluation`, `system`)가 상단 breadcrumb 표시와 사이드바 섹션 선택 판정에 그대로 쓰이므로, 새 ID를 정할 때 접두사 규칙을 지켜야 합니다.

### 전역 상태는 App.tsx의 useState

출결(`attendance`), 스터디팀, HOST 계정, 예외 요청, 점수 규칙, 로그인 역할이 모두 `App.tsx`의 `useState`에 있고 props로 내려갑니다. 상태 관리 라이브러리는 없습니다. 여러 페이지가 공유하는 상태를 추가할 때도 이 패턴을 따르는 것이 일관성 측면에서 유리합니다.

localStorage 키는 `boaz_score_rules`, `boaz_delivery_template`, `boaz_custom_notify_template`입니다. 점수 규칙이 `InternalCategoryAttendancePage`에 전달되는 **실제 경로는 `App.tsx`가 내려주는 `activeScoreRule` prop 하나**입니다. `App.tsx:55`의 `window.dispatchEvent(new Event("storage"))`는 듣는 리스너가 없고, `InternalCategoryAttendancePage.tsx:1402`의 `boaz_score_rules_changed` 리스너는 발행하는 곳이 없습니다. 이 두 이벤트는 이름이 어긋난 죽은 코드 한 쌍이므로 동기화 수단으로 의존하면 안 되며, 정리 대상입니다.

### 역할(Role) 처리

`UserRole`은 `"SUPER" | "TEAM" | "HOST" | "CONTENT_ADMIN"`입니다. 역할은 **로그인 후 진입 페이지를 결정하는 용도로만** 쓰이며, 사이드바는 역할과 무관하게 모든 메뉴를 보여줍니다. `SIDEBAR_NAV`의 `permission` 필드는 백엔드 권한 이름을 기록해 둔 메타데이터일 뿐, 현재 필터링에 사용되지 않습니다. 권한별 메뉴 노출을 구현한다면 이 필드가 출발점입니다.

### FSD 레이어와 경로 별칭

`src/{app,pages,widgets,features,entities,shared}` 구조이며 `@/pages/...`처럼 별칭으로 임포트합니다. 별칭은 `vite.config.ts`와 `tsconfig.json`·`tsconfig.app.json`에 **중복 정의되어 있으므로**, 별칭을 추가하거나 변경할 때 세 파일을 모두 손대야 합니다. `features/`는 아직 비어 있습니다(`.gitkeep`).

레이어 규칙이 엄격하게 지켜지지는 않았습니다. 페이지 컴포넌트가 한 파일에 1,000~6,000줄 규모로 몰려 있고, 자체 타입과 상수, 서브 컴포넌트를 파일 안에 함께 정의합니다. `src/shared/ui`의 `Btn`, `SectionCard`, `Tag`, `CardHeader`는 출결 계열 5개 파일에서만 쓰이고, 나머지 페이지는 Tailwind 클래스를 직접 씁니다. 기존 파일을 수정할 때는 그 파일의 지역 관례를 따르고, 전면적인 구조 정리는 별도 요청으로 처리하는 편이 안전합니다.

### 출결 모델이 두 갈래로 나뉘어 있음

이 저장소에서 가장 혼동하기 쉬운 지점입니다.

- `src/entities/attendance/model/types.ts`의 `AttendanceStatus`는 `present | late | absent` 세 가지입니다. `App.tsx`, `InputPage`, `DashboardPage`, `ScoresPage`가 이 모델을 사용하고, 세션 식별자는 `sessionKey(week, activity, team)`으로 만든 `"w1|study|A팀"` 형태의 문자열 키입니다.
- `src/pages/attendance-internal-category/ui/InternalCategoryAttendancePage.tsx`는 **자체적으로** `AttendStatus`(`earlyLeave`, `excusedAbsent`, `remote`, `unexcusedLate`, `unexcusedAbsent`, `unmarked` 포함 9가지)를 정의하고 독립적인 목 데이터로 동작합니다. BASE/ADV/STUDY 세 페이지가 이 컴포넌트를 `category` prop으로 구분해 공유합니다.

출결 상태를 다루는 작업을 할 때는 어느 모델에 속한 화면인지 먼저 확인해야 합니다. 두 모델은 서로 연결되어 있지 않습니다.

`src/pages/attendance-internal-legacy/ui/InternalAttendanceManagePage.tsx`는 어디에서도 임포트되지 않는 구버전 화면입니다.

## 스타일

Tailwind CSS v4를 `@tailwindcss/vite` 플러그인으로 사용합니다. `postcss.config.mjs`는 의도적으로 빈 설정입니다.

`src/app/styles/index.css`가 `fonts.css` → `tailwind.css` → `theme.css` 순서로 임포트하는 구조이며, `tailwind.css`는 `source(none)`으로 자동 탐색을 끄고 `@source '../../**/*.{js,ts,jsx,tsx}'`로 스캔 범위를 명시합니다. 클래스가 적용되지 않는다면 이 `@source` 범위를 먼저 확인해야 합니다.

`theme.css`에 `:root` CSS 변수(shadcn 계열 토큰과 `--sidebar-*`)가 정의되어 있고 `.dark` 블록도 있지만, 다크 모드 토글은 구현되어 있지 않습니다. 실제 화면은 대부분 Tailwind의 slate 계열 클래스를 직접 쓰며, 폰트는 Pretendard(`index.html`과 `fonts.css`에서 CDN으로 이중 로드)입니다.

## 참고 문서

`src/imports/pasted_text/`에 설계 근거 문서가 들어 있습니다. `admin-ia.md`는 확정된 IA 트리, `admin-ia-strategy.md`는 그 판단 기준, `recruitment-dashboard.md`는 기능 범위와 요구 사항입니다. 메뉴 구조나 권한 체계를 바꿀 때는 이 문서들을 먼저 확인하는 것이 좋습니다. `guidelines/Guidelines.md`는 Figma가 넣어 둔 빈 템플릿이므로 참고 가치가 없습니다.

## 작성 관례

- UI 문구와 커밋 메시지는 한국어를 사용하고, 식별자와 타입 이름은 영어를 사용합니다.
- 커밋 메시지는 `feat:`, `refactor:` 접두사를 사용하는 Conventional Commits 형식입니다.
- `tsconfig.app.json`에 `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`가 켜져 있습니다. 사용하지 않는 매개변수는 기존 코드처럼 `_onToggleRole`, `_sIdx`와 같이 밑줄 접두사를 붙여 처리하고, 타입 임포트는 반드시 `import type`으로 작성해야 합니다.
