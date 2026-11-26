import type { AuthSession } from '@/entities/auth/model/types';
import boazLogo from '@/shared/assets/boaz-logo.png';

import { LoginForm } from './LoginForm';

interface LoginScreenProps {
  onLoginSuccess: (session: AuthSession) => void;
}

/**
 * 로그인 전·로그아웃 뒤의 첫 화면. 팝업이 아니라 화면 전체를 쓰므로 닫을 수 없다.
 * 로그인한 채 다른 계정으로 들어갈 때는 팝업(LoginModal)을 쓴다.
 */
export function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  return (
    <main className="flex min-h-screen items-start justify-center bg-white px-4 pt-[10vh] pb-12 font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center gap-2 text-center">
          {/* 화면 제목은 보이지 않게 두고 화면 읽기 프로그램에만 알린다. */}
          <h1 className="sr-only">BOAZ 관리자 콘솔 로그인</h1>
          {/* 로고는 흰 네모 칸에 담는다. 그림 가장자리의 옅은 원은 원 안쪽만 남겨 지우고, 바깥은 칸의 흰 바탕이 채운다. */}
          <div className="size-40 bg-white">
            <img
              src={boazLogo}
              alt="BOAZ"
              width={160}
              height={160}
              className="size-40 [clip-path:circle(46%)]"
            />
          </div>
          <p className="-mt-1 text-lg font-semibold tracking-wide text-sky-950">
            Bigdata is Our A to Z{' '}
            {/* 관리자 페이지임을 문구 안에서 알린다. 색은 로고에 맞춘 파란색(sky-600)이고, 로그인 버튼도 같은 색이다. */}
            <span className="text-sky-600">Admin</span>
          </p>
        </div>
        <section
          aria-label="로그인"
          className="rounded-md border border-slate-200 bg-white px-6 py-8"
        >
          <LoginForm onLoginSuccess={onLoginSuccess} />
        </section>
      </div>
    </main>
  );
}
