# BOAZ Admin Frontend 협업 컨벤션

```text
이슈 생성 → 브랜치 생성 → 작업 → 로컬 검사 4종 → PR(dev) → 리뷰 → 병합 → 브랜치 삭제
```

## 이름 규칙

| 대상      | 형식                       | 예시                                                 |
| --------- | -------------------------- | ---------------------------------------------------- |
| 이슈 제목 | `[type] 설명`              | `[feat] 출결 현황 엑셀 내보내기`                     |
| 브랜치    | `type/#이슈번호-영문-설명` | `feat/#12-attendance-export`                         |
| 커밋      | `type: 설명 (#이슈번호)`   | `feat: 출결 현황 표에 엑셀 내보내기 버튼 추가 (#12)` |
| PR 제목   | `type: 설명 (#이슈번호)`   | `feat: 출결 현황 엑셀 내보내기 (#12)`                |

- type은 아래 표의 값만, 소문자로 씁니다. 이슈·브랜치·커밋·PR에 같은 type을 씁니다.
- 브랜치·커밋·PR에는 반드시 이슈 번호를 넣습니다.
- 브랜치 설명은 영어 소문자와 하이픈(`-`)만 씁니다. 이슈·커밋·PR 설명은 한국어로 씁니다.
- 긴급 수정 브랜치는 `hotfix/#이슈번호-영문-설명` 형식입니다. 예: `hotfix/#21-login-session-expired`

## type

| type       | 사용하는 경우                            |
| ---------- | ---------------------------------------- |
| `feat`     | 새 기능, 새 화면, 화면 디자인 추가       |
| `fix`      | 버그 수정, 기존 화면 디자인 수정         |
| `refactor` | 동작 변화 없는 코드 구조 개선            |
| `docs`     | 문서 작성·수정                           |
| `chore`    | 설정, 템플릿, 의존성 등 기타 작업        |
| `style`    | 코드 포맷 변경 (화면 디자인 변경이 아님) |
| `test`     | 테스트 추가·수정                         |
| `ci`       | GitHub Actions 등 CI 설정                |
| `build`    | 빌드 설정, 패키지 구성                   |
| `perf`     | 성능 개선                                |
| `revert`   | 이전 커밋 되돌리기                       |

## 브랜치

- `main`과 `dev`에 직접 커밋하지 않습니다.
- 작업 브랜치는 최신 `dev`에서 만듭니다. 긴급 수정만 `main`에서 만듭니다.
- 긴급 수정은 `main`에 병합한 뒤 `dev`에도 PR로 반영합니다.

```sh
git switch dev
git pull --ff-only origin dev
git switch -c 'feat/#12-attendance-export'
```

브랜치는 `main` ← `dev` ← 작업 브랜치 한 층으로만 둡니다.

- 다른 작업 브랜치 위에 작업 브랜치를 만들지 않습니다. 앞 작업이 꼭 필요하면 앞 PR이 `dev`에 병합된 뒤 최신 `dev`에서 새로 만듭니다.
- PR 하나에는 이슈 하나의 변경만 담습니다. 다른 이슈의 커밋이 PR에 섞이지 않게 합니다.
- 작업 중에 `dev`가 바뀌면, 최신 `dev`를 내 작업 브랜치로 pull 받아 병합하고 충돌을 푼 뒤 이어서 작업합니다. 강제 푸시는 하지 않습니다.
- 리뷰를 반영할 때는 그 PR 브랜치에 커밋을 더합니다. 그 변경을 다른 작업 브랜치에 병합하지 않습니다.
- 병합이 끝난 작업 브랜치는 지웁니다.

```sh
git switch 'feat/#12-attendance-export'
git pull origin dev
# 충돌이 나면 파일을 고친 뒤: git add <파일> && git commit
git push
```

## 이슈와 PR

- 이슈와 PR은 템플릿(`.github/ISSUE_TEMPLATE/task.md`, `.github/PULL_REQUEST_TEMPLATE.md`)의 섹션 이름과 순서를 그대로 지킵니다.
- 일반 PR은 `dev`를 대상으로 만듭니다. `main` 대상 PR은 릴리즈(`dev` → `main`)와 긴급 수정만 만듭니다.
- 이슈의 일부만 처리하면 `Refs #번호`, 이슈를 모두 끝내면 `Closes #번호`로 연결합니다.
- 기본 브랜치가 `dev`이므로, `Closes #번호`로 연결한 PR이 `dev`에 병합되면 이슈가 자동으로 닫힙니다. `dev`가 아닌 브랜치로 병합한 PR은 이슈가 닫히지 않으니 직접 닫습니다.

## PR 전 로컬 검사

아래 4개 명령을 모두 통과해야 PR을 만듭니다. 하나라도 실패하면 병합하지 않습니다.

```sh
npm run lint
npm run format:check
npm run check-types
npm run build
```

## 템플릿 바로가기

| 템플릿 | 작성하기                                                                                     | 원본                                                         |
| ------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 이슈   | [새 이슈 만들기](https://github.com/BOAZ-website/frontend_admin/issues/new?template=task.md) | [task.md](.github/ISSUE_TEMPLATE/task.md)                    |
| PR     | [dev 대상 PR 만들기](https://github.com/BOAZ-website/frontend_admin/compare/dev...)          | [PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) |

PR 템플릿은 PR을 만들 때 본문에 자동으로 채워집니다. "dev 대상 PR 만들기"에서 비교할 작업 브랜치를 고르면 됩니다.
