# 동아리원 관리 TDD 기록

## 사용자 흐름

- 운영지원팀은 이름·이메일을 검색하고 기수·부문·활동 상태를 함께 필터링한다.
- 운영지원팀은 전체·활동·수료·운영진 인원을 한눈에 확인한다.
- 운영지원팀은 기존 동아리원 정보를 수정한다. 동아리원 등록은 이 화면이 아니라 서류 평가의 합격자 승격으로 한다.

## RED / GREEN

- RED: `tsx --test tests/memberManagement.test.ts`
  - 동아리원 관리 모델이 없어 `ERR_MODULE_NOT_FOUND`로 실패했다.
- GREEN: `tsx --test tests/memberManagement.test.ts`
  - 필터·정렬·요약 테스트 3개가 모두 통과했다.

## 검증 결과

| 보장 사항                                          | 검증                                                          | 결과 |
| -------------------------------------------------- | ------------------------------------------------------------- | ---- |
| 검색과 기수·부문·상태 필터를 함께 적용한다         | `tests/memberManagement.test.ts`                              | PASS |
| 원본을 변경하지 않고 최신 기수·이름순으로 정렬한다 | `tests/memberManagement.test.ts`                              | PASS |
| 전체·활동·수료·운영진 인원을 요약한다              | `tests/memberManagement.test.ts`                              | PASS |
| 동아리원 목록·수정 API가 임시 DB에 읽고 쓴다       | `tests/clubMemberRoutes.test.ts`                              | PASS |
| 기수 필터 선택지를 users 기수 목록 API로 받는다    | `tests/clubMemberRoutes.test.ts`                              | PASS |
| 코드 품질과 타입이 유효하다                        | `npm run lint`, `npm run format:check`, `npm run check-types` | PASS |
| 프로덕션 번들이 생성된다                           | `npm run build`                                               | PASS |

## 알려진 제한

- 화면은 `/api/v1/club-members` API로 목록을 읽고 수정한다. `VITE_API_BASE_URL`이 없으면 임시 API가 임시 DB(`db/schema.sql`의 `users` 테이블)로 응답하며, 새로고침하면 `db/seed.sql` 상태로 돌아간다. 실제 백엔드 연동은 후속 작업이다.
- 브라우저 자동화 환경을 사용할 수 없어 실제 클릭 기반 UI 검증은 수행하지 못했다.
