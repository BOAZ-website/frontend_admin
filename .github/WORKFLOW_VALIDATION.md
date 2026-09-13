# 워크플로우 검증 기록

로컬 검증과 실제 GitHub 실행 증거를 구분해 기록합니다.

## 도입 PR

- [PR #19 → dev](https://github.com/BOAZ-website/frontend_admin/pull/19), 구현 커밋 `e76e645`.
- GitHub Actions 네 검사 모두 성공:
  [lint](https://github.com/BOAZ-website/frontend_admin/actions/runs/34739562706),
  [format](https://github.com/BOAZ-website/frontend_admin/actions/runs/34739562699),
  [typecheck](https://github.com/BOAZ-website/frontend_admin/actions/runs/34739562708),
  [build](https://github.com/BOAZ-website/frontend_admin/actions/runs/34739562737).
- 실제 check 이름은 각각 `lint`, `format`, `typecheck`, `build`임을 확인.
- 확인 시점 CodeRabbit check/review 없음. 앱 설치·접근 범위·플랜과 자동 리뷰 작동은 관리자 확인 필요.
- PR 미병합. 보호 규칙은 도입 PR 병합과 팀 정책 확정 후 적용.

## 원격 확인 (2026-09-13)

- 저장소: `BOAZ-website/frontend_admin`, 공개 저장소, 현재 사용자 ADMIN.
- 기본 브랜치: main. main/dev 존재. 두 브랜치 보호 비활성, ruleset 없음.
- 원격 main은 로컬 main보다 앞서 있으며 현재 작업 브랜치는 `chore/#3-github-workflow`.
- CodeRabbit 설치 및 플랜: 미확인.
- 승인 수, 최신 base 강제, 관리자 우회와 담당자: 팀 확정 필요.

## 로컬 검증 (2026-09-13)

- Node.js 24.15.0, npm 11.12.1, `npm ci --no-audit --no-fund` 성공. 의존성과 lockfile 변경 없음.
- lint, format:check, check-types, build 성공. 기존 lint 43건은 `eslint-suppressions.json`에 명시적으로 기록.
- 기존 코드·설정 40개 파일이 원본에 Prettier를 적용한 결과와 일치함을 확인.
- YAML 파싱 및 main/dev 트리거, 네 job 이름, 권한, 동시 실행 그룹, npm ci 확인.
- lint: 새 파일 경로의 미사용 변수 입력을 종료 코드 1로 거부.
- format: 포맷 위반 입력을 종료 코드 1로 거부.
- typecheck: 임시 TS 파일의 타입 불일치를 TS2322, 종료 코드 2로 거부. 검사 후 파일 제거.
- build: index.html 진입 경로를 임시로 잘못 지정하면 타입 검사 통과 후 번들 단계 실패. 원본 복구 후 빌드 성공 확인.
- 빌드에는 기존 500 kB 초과 청크 경고가 있으며 빌드는 성공함. 코드 분할은 별도 성능 작업.

## 실제 PR 검증표

| 시나리오        | 기대 결과                       | 상태 / PR·실행 URL                     |
| --------------- | ------------------------------- | -------------------------------------- |
| 정상 변경 → dev | 네 검사 성공, 일반 PR 자동 리뷰 | PR #19 네 검사 성공 / 자동 리뷰 미확인 |
| 포맷 위반       | format 실패                     | 원격 실행 전                           |
| ESLint 위반     | lint 실패                       | 원격 실행 전                           |
| 타입 오류       | typecheck 실패                  | 원격 실행 전                           |
| 번들 오류       | 타입 통과 후 build 실패         | 원격 실행 전                           |
| 수정 후 push    | 최신 SHA의 네 검사 성공         | 원격 실행 전                           |
| 문서만 변경     | 네 검사 완료, Pending 없음      | 원격 실행 전                           |
| dev → main      | 네 검사와 리뷰 확인             | 원격 실행 전                           |
| 보호 후 실패 PR | 병합 차단                       | 보호 적용 전                           |
| 보호 후 정상 PR | 사람 승인 후 병합 가능          | 보호 적용 전                           |

최소 실패 재현 예시는 포맷이 틀린 TS 파일, 사용하지 않는 지역 변수,
문자열 변수에 숫자 대입, index.html의 module 진입 경로를 존재하지 않는 파일로 변경하는 것입니다.
각 실패 커밋과 복구 커밋의 SHA·실행 URL을 남기세요. 기존 suppression이 없는 새 파일로 lint 실패를 확인합니다.

이 표와 CodeRabbit 작동·보호 검증까지 완료한 후 이슈 #3을 종료합니다.
