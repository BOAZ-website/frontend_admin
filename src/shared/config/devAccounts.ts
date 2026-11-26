/**
 * 개발용 계정 설정. 개발 모드(npm run dev)에서만 쓰고, 배포 빌드에서는 IS_DEV_ACCOUNTS_ENABLED가 false라
 * db/seed-dev.sql(테스트계정)은 빠진다. 다만 임시 API가 쓰는 db/seed.sql은 배포 빌드에도
 * 들어가므로, 그 시드의 가짜 비밀번호는 번들에 남는다. 실제 백엔드를 연결하면 임시 API와 함께 빠진다.
 *
 * shortcut: 임시 API의 시드 계정에 기대는 개발 편의 기능이다. 실제 로그인 연동(PLT-SESSION) 뒤 이 파일과
 * db/seed-dev.sql을 지운다. 가져다 쓰는 곳은 `grep -rn "config/devAccounts" src`로 찾는다.
 *
 * 테스트계정 boaz_dev_all(db/seed-dev.sql)은 서비스운영팀장(MASTER) 권한에 다른 부문 서류 평가·최종 합불 변경 권한을 더한 계정이라
 * 권한 표보다 권한이 넓다. 화면의 권한 판단을 막지 않고 모든 기능을 둘러보는 데 쓴다.
 */

/** 개발용 계정 기능(새로고침 뒤 세션 되살리기, 개발용 시드)을 켤지. */
export const IS_DEV_ACCOUNTS_ENABLED: boolean = import.meta.env.DEV;

/** 저장한 아이디가 없을 때 처음 여는 운영진 계정 id(시드의 서비스운영팀장). */
export const DEV_DEFAULT_ACCOUNT_ID = 1;
