# 디자인 시스템 정리 기준

## 이 문서의 목적

관리자 콘솔의 화면 조각(표, 버튼, 입력칸, 팝업 등) 가운데 무엇을 디자인 시스템 컴포넌트로 옮길지, 어디에 어떤 모양으로 둘지 정한다.

| 항목 | 내용 |
| --- | --- |
| 대상 독자 | 프론트엔드 담당, 화면을 고치는 AI 도구 |
| 적용 범위 | `src/shared/ui/`와, 그 조각을 가져다 쓰는 `src/pages/`·`src/widgets/` |
| 기준 날짜 | 2026-11-13. 아래 개수·경로는 이 날짜의 `feat/#78-semester-management` 작업본 기준 |
| 디자인 시스템 저장소 | [`BOAZ-website/design-system`](https://github.com/BOAZ-website/design-system). 저장소 사이 역할 나누기는 5절 |
| 다른 문서와의 관계 | 코드 작성 규칙은 [`04-code-style.md`](04-code-style.md)가 정본이다. 이 문서는 그중 "공통 화면 조각"을 어떻게 모을지만 정한다. 두 문서가 다르면 `04-code-style.md`를 따르고, 다른 점을 이 문서 부록 B에 적어 둔다 |

## 표기

| 표기 | 뜻 |
| --- | --- |
| **반드시** | 어기면 리뷰에서 수정을 요청함 |
| **금지** | 쓰지 않음. 어기면 리뷰에서 수정을 요청함 |
| **권장** | 이유가 있으면 달리 해도 됨. 달리 했으면 PR 본문에 이유를 적음 |
| 검사: 리뷰 | 도구가 막지 않음. 작성자가 확인하고 리뷰어가 다시 확인함 |

규칙 ID는 `D<절>-<순서>`로 쓴다(`04-code-style.md`의 `R` 규칙과 구분). 지운 번호는 다시 쓰지 않는다.

## 용어

| 말 | 뜻 |
| --- | --- |
| 디자인 시스템 컴포넌트 | 업무(출결·반기 등)를 모르고 모양만 정하는 공통 화면 조각. `src/shared/ui/<이름>/`에 둔다 |
| 컬럼 정의 | 표의 열 하나를 적은 객체. `id`·`header`·`cell` 등. 이름은 TanStack Table의 `ColumnDef` 관례를 따른다 |
| 기본 창 | 브라우저가 띄우는 확인·안내 창. `window.confirm`, `window.alert` |

## 0. 적용 범위

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D0-1 | 새로 만드는 화면 조각과, 이번 작업으로 고치는 부분에 적용함 | 리뷰 |
| D0-2 | **금지**: 이 문서를 지키려고 이번 작업과 관계없는 화면을 고치는 것. 옮길 곳은 2절 표에 적고 따로 작업함 | 리뷰 |

- 근거: `04-code-style.md` R0-1·R0-2와 같은 방식이다. 한 PR에 화면 기능 변경과 공통 조각 이전이 섞이면 리뷰가 어려워진다.
- 다시 볼 때: 2절 표가 모두 "완료"가 되면 D0-2를 지운다.

## 1. 위치와 폴더

```
src/shared/ui/
├── table/            표 (Table.tsx, DataTable.tsx)  ← 2026-11-13 처음 만든 폴더
├── <다음 조각>/        버튼, 팝업 바탕 등을 옮길 때 같은 모양으로 만든다
├── Tooltip.tsx       아직 폴더로 옮기지 않은 조각(2절 표)
└── systemStyles.ts   클래스 이름 묶음. 2절 표의 조각을 다 옮기면 지운다
```

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D1-1 | **반드시** 디자인 시스템 컴포넌트는 `src/shared/ui/<이름>/` 폴더에 둠. 폴더 이름은 영어 소문자와 하이픈(`04-code-style.md` 4절) | 리뷰 |
| D1-2 | **금지**: 디자인 시스템 컴포넌트가 업무 데이터(회원, 반기, 출결 등)의 타입이나 화면 문구를 아는 것. 대신 화면이 값과 글자를 넘김 | 리뷰 |
| D1-3 | **금지**: 화면별 설정(표의 컬럼 배열, 선택지 목록)을 `src/shared/ui/`에 두는 것. 대신 그 화면 폴더(`src/pages/<화면>/`)에 둠 | 리뷰 |
| D1-4 | **반드시** 다른 조각과 겹치는 모양(테두리 색, 모서리, 글자 크기)은 `04-code-style.md` 12절 값을 씀 | 리뷰 |
| D1-5 | **권장** 컴포넌트 이름과 속성 이름은 널리 쓰는 라이브러리 관례를 따름(표는 TanStack Table). 나중에 라이브러리나 별도 디자인 시스템 패키지로 옮길 때 고칠 곳을 줄이기 위해서다 | 리뷰 |

- 근거: 폴더 하나에 한 조각을 모으면, 나중에 디자인 시스템 패키지로 뺄 때 폴더째 옮기고 import 경로만 고치면 된다. 화면별 설정이 공통 폴더에 섞이면 한 화면을 고칠 때 다른 화면이 깨진다.
- 다시 볼 때: 디자인 시스템을 별도 패키지(저장소)로 뺄 때 이 절의 경로를 그 패키지 경로로 바꾼다.

## 2. 옮길 대상

`src/shared/ui/`에 지금 있는 것과, 화면마다 클래스 이름으로 맞추고 있는 것이다. 개수는 그 조각을 가져다 쓰는 파일 수(2026-11-13).

| 조각 | 지금 위치 | 쓰는 파일 | 옮길 곳 | 상태 |
| --- | --- | --- | --- | --- |
| 표 | `table/Table.tsx`, `table/DataTable.tsx` | 2 (반기 관리) | 그대로 | 일부 완료. 남은 8개 파일은 3절 |
| 표 클래스 | `systemStyles.ts`의 `TABLE_BOX`·`TH_CLASS`·`TD_CLASS` | 8 | `table/`로 흡수 후 삭제 | 대기 |
| 버튼 | `CreateButton.tsx`, `systemStyles.ts`의 `MODAL_CONFIRM_BTN`·`MODAL_CANCEL_BTN`·`ICON_BTN`·`FIELD_TEXT_BTN` | 5 / 10 / 8 / 2 / 5 | `button/` | 대기 |
| 입력칸 | `systemStyles.ts`의 `FIELD_INPUT`, `DateTextInput.tsx`, `DatePickerField.tsx` | 8 / 2 / 1 | `field/` | 대기 |
| 드롭다운 | `SelectDropdown.tsx`, `FilterDropdown.tsx` | 6 / 4 | `dropdown/` | 대기 |
| 팝업 바탕 | `modalStyles.ts`의 `MODAL_SURFACE`·`MODAL_PRIMARY_BTN`, `shared/lib/useDialogKeyboard.ts` | 10 / 1 / 9 | `dialog/` | 대기. 확인·안내 창은 4절 |
| 여러 개 고르기(체크박스 그룹) | `CheckListPopover.tsx` (Radix Popover + Checkbox) | 1 (반기 관리 휴강) | `checklist/` | 정함: 여러 개 고르는 목록은 이 조각만 씀 |
| 말풍선 | `Tooltip.tsx` | 14 | `tooltip/` | 대기 |
| 분할 화면 | `SplitView.tsx` | 4 | `split-view/` | 대기 |
| 읽기 실패 안내 | `DataLoadFailedNotice.tsx`, `widgets/page-loading/` | 1 | `status/` | 대기 |
| 쓰는 곳 없음 | `Btn.tsx`, `SectionCard.tsx`, `CardHeader.tsx`, `Tag.tsx` | 0 | 지울지 결정 | 결정 필요 |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D2-1 | **반드시** 조각 하나를 옮기는 PR에서 그 조각을 쓰는 파일의 import를 모두 고침. 옛 위치에 다시 내보내는 파일을 남기지 않음(`04-code-style.md` R3-4) | `tsc`·리뷰 |
| D2-2 | **반드시** 옮긴 뒤 이 표의 "상태"를 "완료"로 고치고 변경 기록에 한 줄 남김 | 리뷰 |

- 근거: 위 표의 쓰는 파일 수는 `grep -rl "shared/ui/<이름>'" src`, 클래스는 `grep -rlw <이름> src`로 셌다.
- 다시 볼 때: 조각을 하나 옮길 때마다.

## 3. 표

```tsx
// 목록 표: 화면 폴더에 컬럼 배열을 두고 DataTable에 넘긴다(src/pages/system-semesters/ui/RosterSection.tsx)
const columns: DataTableColumn<RosterRow>[] = [
  { id: 'term', header: '기수', size: 48, accessorFn: ({ entry }) => entry.term },
  { id: 'name', header: '이름', size: 96, accessorFn: ({ entry }) => entry.name, meta: { isKey: true } },
  { id: 'groups', header: '참여 그룹', accessorFn: ({ entry }) => entry.groups.map((g) => g.name).join(', '), meta: { align: 'left', isWrapped: true } },
];
<DataTable columns={columns} data={rows} getRowId={({ entry }) => entry.userId} />

// 칸 합치기처럼 줄마다 모양이 다른 표: Table 조각을 직접 쓴다(src/pages/system-semesters/ui/SemesterSummaryTable.tsx)
<Table>
  <TableHead><Tr><Th>활동</Th><Th>휴강</Th></Tr></TableHead>
  <TableBody><Tr><Th scope="row">BASE</Th><Td rowSpan={2}>…</Td></Tr></TableBody>
</Table>
```

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D3-1 | **반드시** "한 줄 = 데이터 한 건"인 목록 표는 `shared/ui/table/DataTable`에 컬럼 정의 배열을 넘겨 그림 | 리뷰 |
| D3-2 | **반드시** 칸을 합치거나 줄마다 모양이 다른 표는 `shared/ui/table/Table`의 `Table`·`TableHead`·`TableBody`·`Tr`·`Th`·`Td`로 그림 | 리뷰 |
| D3-3 | **반드시** 컬럼 정의는 TanStack Table `ColumnDef` 관례의 이름을 씀: `id`, `header`, `accessorKey`, `accessorFn`, `cell`, `size`. 정렬·줄바꿈·글자 색 같은 화면 설정은 `meta`에 둠 | `tsc` |
| D3-4 | **반드시** 컬럼 배열은 그 표를 쓰는 화면 폴더에 둠. 탭마다 열이 다르면 탭별 배열을 두거나 공통 배열을 걸러 씀 | 리뷰 |
| D3-5 | **금지**: 세로줄·테두리를 화면에서 직접 긋는 것. 대신 `Tr`이 정한 선을 씀. 선이 빠지면 `Table.tsx`를 고침 | 리뷰 |
| D3-6 | **금지**: 새 표에 `TABLE_BOX`·`TH_CLASS`·`TD_CLASS`를 쓰는 것. 대신 `Table` 조각을 씀 | 리뷰 |

옮길 표(2026-11-13, `TABLE_BOX` 등을 쓰는 파일):

| 화면 | 파일 |
| --- | --- |
| 반기 관리 | `src/pages/system-semesters/ui/RosterSection.tsx`의 동아리원 고르기 표 |
| 동아리원 명단 | `src/pages/member-management/ui/MemberManagementPage.tsx` |
| 계정·권한 | `src/pages/system-accounts/ui/`의 `MyAccountCard.tsx`, `AccountPermissionEditor.tsx`, `GroupLeaderTable.tsx`, `OperatorRosterTable.tsx`, `HolderProfileTable.tsx`, `PermissionMatrix.tsx` |
| 감사 로그 | `src/pages/system-audit/ui/AuditLogPage.tsx` |

출결·행사 화면(`src/pages/attendance-*`)의 표는 열 너비 끌기·수정 모드 같은 자체 기능이 많아 위 목록에 넣지 않았다. 옮길지는 따로 정한다.

- 근거: 세로줄을 줄 단위(`divide-x`)로 그으면 `rowSpan`으로 합친 칸 옆 줄에서 선이 빠진다(2026-11-13 반기 요약 표에서 실제로 생김). `Tr`은 "줄의 첫 칸을 뺀 모든 칸의 왼쪽 선"으로 그어 이 문제가 없다. 컬럼 이름을 TanStack 관례로 맞춘 이유는 정렬·필터가 필요해 그 라이브러리를 들일 때 컬럼 배열을 거의 그대로 옮기기 위해서다.
- 다시 볼 때: TanStack Table을 들이면 `DataTable` 안쪽을 그 라이브러리로 바꾸고, D3-3의 `meta` 항목을 그 라이브러리의 `meta` 타입 선언으로 옮긴다.

## 4. 확인·안내 팝업

> 2026-11-13 프론트엔드 담당이 정했다. 코드 규칙은 [`04-code-style.md`](04-code-style.md) R12-15~R12-17이 정본이고, 이 절은 옮길 목록만 관리한다. 팀 계획 문서(`PLT-CONFIRM`)와 충돌이 남아 있다(부록 B).

정한 방향: 확인·안내 창은 브라우저 기본 창으로 통일한다. 어떤 것은 기본 창, 어떤 것은 직접 만든 창이면 같은 종류의 물음이 화면마다 다르게 보여 쓰는 사람이 헷갈리기 때문이다.

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D4-1 | **반드시** 확인·안내 창은 `04-code-style.md` R12-15·R12-16대로 브라우저 기본 창을 씀 | 리뷰 |
| D4-2 | **반드시** 창 안에서 고르거나 입력해야 하는 창만 `shared/ui/dialog/`의 컴포넌트로 만듦(`04-code-style.md` R12-17) | 리뷰 |

기본 창으로 바꿀 것과 남길 것(2026-11-13):

| 창 | 파일 | 처리 |
| --- | --- | --- |
| FAQ 삭제 확인 `ConfirmModal`(2곳) | `src/pages/content-faq/ui/FaqSection.tsx` | 기본 창으로 바꿈 |
| 정회원 승격 확인(체크 칸 2개) | `src/pages/recruiting-evaluation/ui/EvaluationManagePage.tsx` | 결정 필요: 체크 칸을 없애고 기본 창으로 바꿀지 |
| 새 반기 명단 확인 | `src/pages/system-semesters/ui/RosterConfirmDialog.tsx` | 남김(창 안에서 명단을 고침, D4-2) |

지금 기본 창을 쓰는 곳: `window.confirm` 38곳, `window.alert` 20곳, `alertApiError` 16곳(합쳐서 `src/` 27개 파일).

- 근거: 위 개수는 `grep -rhoE "window\.confirm|window\.alert|alertApiError\(" src`로 셌다.
- 다시 볼 때: 부록 B의 `PLT-CONFIRM` 충돌이 정리되면 그 줄을 지운다. 표의 창을 바꿀 때마다 "처리"를 "완료"로 고친다.

## 5. 디자인 시스템 저장소와 나누는 일

디자인 시스템은 [`BOAZ-website/design-system`](https://github.com/BOAZ-website/design-system) 저장소에서 진행한다. 저장소 구조는 그 저장소 이슈 [#97](https://github.com/BOAZ-website/design-system/issues/97)(공통 `core/`·홈페이지 `home/`·관리자 `admin/` 분리)에서 정한다. 이 절은 그 구조에서 이 저장소(`frontend_admin`)가 무엇을 맡고, 어떤 순서로 코드를 정리하는지 적는다.

### 5-1. 무엇을 어디에 두나

| 내용 | 디자인 시스템 저장소 | 이 저장소 |
| --- | --- | --- |
| 글꼴, 접근성·문구 원칙 | `core/tokens/font.json`, `core/guidelines/` | 따름 |
| 관리자 색·글자 크기·모서리 값 | `admin/tokens/` → 빌드 결과 `dist/admin.css` | 값이 안정될 때까지 `src/app/styles/theme.css`에서 조정(5-2절 1단계). 옮긴 뒤에는 `admin.css`를 import하고 `theme.css`에는 덮어쓸 값만 둠 |
| 관리자 컴포넌트 명세(모양·동작·접근성) | `admin/components/<이름>.md` | 명세를 따름 |
| 관리자 컴포넌트 코드 | 두지 않음 | `src/shared/ui/<이름>/`(1절 D1-1). 앱의 Tailwind 설정과 묶여 있어 패키지로 빼지 않음 |
| 관리자 사용 규칙(Tailwind 클래스, 확인·안내 창) | `admin/patterns/` | 코드 규칙은 [`04-code-style.md`](04-code-style.md)가 정본이고, 디자인 시스템 문서와 같은 내용을 유지함 |
| 화면별 설정(표 컬럼 배열 등) | 두지 않음 | 그 화면 폴더(D1-3) |

### 5-2. 정리 순서

`1 값 정리 → 2 조각 폴더화 → 3 명세 작성 → 4 값 이전 → 5 막기`

| 단계 | 할 일 | 이 저장소에서 하는 것 | 완료 확인 |
| --- | --- | --- | --- |
| 1. 값 정리 | 화면의 직접 색(`slate-*`, hex)을 역할 이름(`bg-background`, `text-muted-foreground`, `bg-primary` 등)으로 바꿈 | `theme.css`의 `:root` 값을 확정하고(`--primary`와 `--destructive`가 같은 `#ef4444`인 문제, `--radius` 0.75rem 계산값과 12-1절 4·6·8px 차이 정리) 화면 클래스를 바꿈. 디자인 시스템 ADOPT-05·06 | `grep -rE 'slate-[0-9]' src` 0건 |
| 2. 조각 폴더화 | 2절 표의 조각을 `src/shared/ui/<이름>/`으로 옮김 | 조각 하나 = PR 하나. 표(`table/`)는 2026-11-13에 시작함 | 2절 표 상태가 모두 "완료" |
| 3. 명세 작성 | 옮긴 조각의 모양·동작을 디자인 시스템 저장소 `admin/components/<이름>.md`에 적음 | 명세와 코드가 다르면 이 저장소 코드를 명세에 맞춤 | 조각마다 명세 파일이 있음 |
| 4. 값 이전 | `theme.css` 값을 `admin/tokens/`로 옮기고 `dist/admin.css`를 빌드 | `admin.css`를 `src/app/styles/index.css`에서 import하고 `theme.css`의 같은 값을 지움 | `theme.css`에 팔레트 hex 0건 |
| 5. 막기 | 허용 목록 밖 Tailwind 색을 쓰지 못하게 함 | ESLint 규칙 또는 `@theme { --color-*: initial; }`(디자인 시스템 ADOPT-06-10) | 새 `slate-*` 클래스가 CI에서 막힘 |

| ID | 규칙 | 검사 |
| --- | --- | --- |
| D5-1 | **반드시** 1단계가 끝나기 전에는 관리자 값을 디자인 시스템 저장소로 옮기지 않음. 값을 바꿀 때마다 디자인 시스템 릴리스가 필요해지기 때문이다 | 리뷰 |
| D5-2 | **반드시** 조각을 옮기는 PR과 화면 기능 PR을 나눔(D0-2) | 리뷰 |
| D5-3 | **반드시** 디자인 시스템 명세와 이 저장소 코드가 다르면 명세를 고칠지 코드를 고칠지 먼저 묻고, 정한 쪽으로 맞춤 | 리뷰 |

- 근거: 2026-11-13 기준 이 저장소에는 shadcn 컴포넌트 파일이 없고(`src/components/ui` 없음), shadcn 역할 이름은 `theme.css` 변수로만 있으며 화면에서 `bg-primary`를 쓰는 곳은 0곳이다. 그래서 역할 이름으로 화면을 바꾸는 1단계가 먼저 끝나야 값 이전(4단계)이 화면을 깨지 않는다.
- 다시 볼 때: #97 구조가 바뀌면 5-1절 표를 고친다. 4단계가 끝나면 D5-1을 지운다.

## 멈춰야 하는 경우

- 공통 조각을 고치는데 쓰는 파일이 5개를 넘으면, 고치기 전에 영향 받는 화면 목록을 보여 주고 묻는다.
- 화면 하나만 쓰는 모양을 공통 조각에 옵션으로 넣어야 할 것 같으면 멈추고 묻는다. 대개 그 화면에서 `className`으로 덧붙이면 된다.
- 확인 창을 컴포넌트로 만들자는 요청(`PLT-CONFIRM` 등)을 받으면 `04-code-style.md` R12-15와 부록 B의 충돌을 알리고 묻는다.

## 끝내기 전 확인

```bash
npm run check-types
npm run lint
npm run format:check
npx tsx --test tests/*.test.ts
```

- [ ] 옮긴 조각을 쓰는 화면을 열어 전과 모양이 같은지 봄
- [ ] 2절 표의 상태와 변경 기록을 고침

## 부록 A. 이 문서를 만든 계기

2026-11-13 반기 관리 화면 작업에서, 칸을 합친 표의 세로줄이 빠지는 문제를 화면마다 직접 고치고 있었다. 표 모양을 한 곳에서 정하려고 `src/shared/ui/table/`을 만들었고, 같은 방식으로 다른 조각도 모으기 위해 이 문서를 만들었다.

## 부록 B. 다른 문서와 충돌하는 점

| 문서 | 지금 내용 | 이 문서 | 처리 |
| --- | --- | --- | --- |
| [`spec/00-platform.md`](spec/00-platform.md) `PLT-CONFIRM` | 공용 확인 모달을 만들고 브라우저 `confirm()`을 모두 없앤다 | 4절: 확인 창은 기본 창으로 통일 | 합의 필요 |
| [`03-wbs-fe.md`](03-wbs-fe.md) `PLT-CONFIRM`, `REC-POST`, `CNT-ARC` | 완료 기준 "`src/`에 브라우저 `confirm()` 0건", 삭제 확인을 공용 모달로 교체 | 같음 | 합의 필요 |
| 디자인 시스템 저장소 `docs/wbs/50-adopt.md` ADOPT-07-04 | 관리자 모달도 패키지 `Modal`(COMPONENT-25)을 씀 | 4절: 확인·안내는 기본 창, 입력하는 창만 `shared/ui/dialog/` | #97 "결정" 항목에 올림 |
| 디자인 시스템 저장소 `docs/wbs/50-adopt.md` ADOPT-07 목적 | 버튼·입력·모달 등은 패키지 컴포넌트를 씀 | 5-1절: 관리자 컴포넌트 코드는 이 저장소 `src/shared/ui/`에 둠 | #97 "ADOPT-07 변경 합의"에서 정함 |
| 저장소 `CLAUDE.md` "스타일" | `Btn`·`SectionCard`·`Tag`·`CardHeader`는 출결 계열 5개 파일에서 쓴다 | 2절: 2026-11-13 기준 쓰는 곳이 없다 | `CLAUDE.md` 문장 고침 필요 |

## 변경 기록

- 2026-11-13: 여러 개 고르는 목록(체크박스 그룹)은 `shared/ui/CheckListPopover.tsx`로 정함. 동작은 Radix UI(`@radix-ui/react-popover`, `@radix-ui/react-checkbox`)가 맡고, 줄마다 체크박스가 있음.
- 2026-11-13: 처음 작성. 표 컴포넌트(`shared/ui/table/`) 위치와 컬럼 정의 관례, 옮길 대상 목록, 확인·안내 팝업은 브라우저 기본 창으로 정함(`04-code-style.md` R12-15~R12-17). 디자인 시스템 저장소 #97 구조에 맞춘 역할 나누기와 정리 순서(5절) 추가.
