# 협업 가이드

## 개발 환경과 검사

Node.js 버전은 `.nvmrc`의 24.15.0을 사용합니다. 기존 lockfile과 도구 버전을 유지합니다.
Windows PowerShell에서 npm.ps1 실행이 제한되면 `npm.cmd`를 사용하세요.

```sh
npm ci
npm run dev
```

PR을 만들기 전에 다음 명령을 모두 실행합니다. CI는 자동 수정 없이 같은 명령을 실행합니다.

```sh
npm run lint
npm run format:check
npm run check-types
npm run build
```

`npm run lint:fix`, `npm run format`으로 자동 수정할 수 있습니다.
Prettier와 Git은 LF 줄바꿈을 사용합니다. 타입 검사와 빌드 명령은 기존 프로젝트 참조 구성을 유지합니다.
현재 빌드에는 환경변수가 필요하지 않습니다. PR 검사에 배포 자격 증명을 추가하지 마세요.

### 기존 lint 위반 관리

CI 도입 시 발견한 기존 위반은 루트 `eslint-suppressions.json`에 파일·규칙별 개수로 기록합니다.
기존 화면의 동작 변경이 필요한 `any` 타입과 Hook 의존성 수정은 후속 작업으로 진행합니다.
이는 ESLint의 bulk suppression 기능이며, 규칙을 전역으로 끄지 않습니다.
새 파일 또는 해당 파일·규칙의 기존 개수를 초과하는 위반은 CI에서 실패합니다.
같은 파일·규칙에서 기존 위반을 지우고 새 위반을 넣으면 개수만으로 구분하지 못하므로 리뷰에서 확인해야 합니다.

전체 미해결 항목은 `npx eslint . --no-suppressions`으로 확인합니다.
기존 위반을 수정한 PR에서는 `npx eslint . --prune-suppressions`로 목록을 줄이고 변경분을 함께 제출하세요.
일반 PR에서 `--suppress-all`로 목록을 늘려 CI 실패를 숨기지 않습니다.
Prettier는 앱 코드, 설정, 협업 문서를 검사하며 원본 디자인 자료인 `src/imports/`와 생성물·로컬 문서는 제외합니다.

## 브랜치와 커밋

`main`은 배포 가능한 안정 버전, `dev`는 다음 릴리즈 통합 브랜치입니다.

| 작업      | 분기 → PR 대상 | 이름                         |
| --------- | -------------- | ---------------------------- |
| 일반 작업 | dev → dev      | `feat/#12-attendance-export` |
| 릴리즈    | dev → main     | 장기 브랜치 `dev` 유지       |
| 긴급 수정 | main → main    | `hotfix/#21-login-failure`   |

일반 작업 접두사는 `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, `style`, `revert`를 사용합니다.
`style`은 포맷 변경이며 화면 디자인 변경은 `feat` 또는 `fix`로 구분합니다.
브랜치명에 `#`가 있으므로 명령에서 따옴표로 감쌉니다.

```sh
git switch dev
git pull --ff-only origin dev
git switch -c 'feat/#12-attendance-export'
```

커밋과 PR 제목은 `type: 설명 (#이슈번호)` 형식입니다. 예: `chore: GitHub 워크플로우 구축 (#3)`.
일반 PR은 `dev`를 대상으로 만들고 템플릿에 목적, 영향, 이슈, 검증 결과, UI 전후, 리뷰 집중 사항을 작성합니다.
분할 PR은 `Refs #3`, 전체 완료 PR은 `Closes #3`로 연결합니다.
기본 브랜치가 `main`이므로 `dev` 병합만으로 이슈 자동 종료를 기대하지 않습니다.
릴리즈 PR에는 포함 이슈, 주요 변경, 검증 결과를 정리합니다.
hotfix는 main 병합 후 dev에도 반영 PR을 만들어 누락을 방지합니다.
병합한 단기 브랜치만 삭제하고 main/dev는 유지합니다.

## 리뷰와 CI

main/dev 대상 PR에서 `lint`, `format`, `typecheck`, `build` 네 job이 독립적으로 실행됩니다.
문서 전용 PR과 Draft PR도 검사하며 후속 push에서 재실행합니다.
같은 워크플로우의 이전 PR 실행만 취소합니다. 빌드 검사는 배포하지 않습니다.
merge queue는 현재 사용하지 않으며 도입 전에 네 워크플로우 모두에 `merge_group` 이벤트를 추가해야 합니다.

CodeRabbit은 한국어로 main/dev 대상 일반 PR과 후속 push를 리뷰하며 Draft는 제외합니다.
`.coderabbit.yaml`만으로 GitHub App이 설치되지는 않습니다. 조직 관리자가 저장소 접근과 플랜을 확인해야 합니다.
CodeRabbit 제안은 작성자가 검토하고 사람 리뷰어가 최종 판단합니다.
CodeRabbit 자체 승인을 필수 조건으로 설정하지 않습니다. 장애 시 사람 리뷰를 진행합니다.

## 브랜치 보호 도입 및 인수인계

아래는 적용 절차이며, 설정 파일 추가만으로 원격 보호가 활성화되지는 않습니다.

1. 도입 PR에서 네 검사의 성공과 의도한 실패를 확인하고 검증 기록을 남깁니다.
2. 도입 PR을 dev에 병합하고 dev → main PR로 설정을 반영합니다.
3. 팀은 승인 수와 관리자 예외를 확정합니다. 제안 기본값은 main/dev 모두 PR 필수, 작성자 외 1명 승인, 대화 해결 필수, 새 커밋 시 기존 승인 무효화입니다.
4. 관리자는 실제 check 이름과 GitHub Actions 제공 앱을 확인한 뒤 네 검사를 필수로 등록합니다. main/dev force push와 삭제를 금지합니다.
5. 최신 base 반영 강제와 관리자 우회 여부는 팀 운영 방식에 맞춰 결정하고 담당자와 함께 기록합니다.
6. 실패 PR의 병합 차단과 정상 PR의 승인 후 병합 가능 상태를 확인합니다.

검증 기록은 [워크플로우 검증표](.github/WORKFLOW_VALIDATION.md)에 남깁니다.
실패 테스트는 임시 PR 안에서 수행하고 변경을 복구합니다. 오류가 있는 코드를 장기 브랜치에 병합하지 않습니다.
필수 check가 Pending이면 대상 브랜치, 이벤트, Actions 실행 권한과 필수 check 이름을 확인합니다.
job 이름을 변경하면 보호 설정도 함께 갱신해야 합니다.
CI 장애는 실행 URL과 SHA를 기록한 뒤 수정 PR로 복구합니다. 검사를 상시 무시하는 옵션을 사용하지 않습니다.
긴급 우회는 관리자와 사유, 후속 복구 PR을 기록하고 작업 직후 보호 설정을 복원합니다.
다음 기수에 관리자·리뷰어, 정상/실패 실행 URL, CodeRabbit 접근 범위와 보호 설정을 인계합니다.

## 근거

- [협업 워크플로우 원문](https://app.notion.com/p/GitHub-3d962d1d0f5d8191956ecd51fe842304)
- [checkout 릴리즈](https://github.com/actions/checkout/releases/tag/v7.0.1)
- [setup-node 릴리즈](https://github.com/actions/setup-node/releases/tag/v7.0.0)
- [Node.js 24.15.0 LTS](https://nodejs.org/en/blog/release/v24.15.0)
- [CodeRabbit 설정](https://docs.coderabbit.ai/reference/configuration)
