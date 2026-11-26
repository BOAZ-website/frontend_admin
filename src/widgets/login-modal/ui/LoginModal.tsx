import type { AuthSession } from '@/entities/auth/model/types';
import boazLogo from '@/shared/assets/boaz-logo.png';
import { Dialog } from '@/shared/ui/dialog/Dialog';

import { LoginForm } from './LoginForm';

interface LoginModalProps {
  /** Escape·바깥 누르기·닫기 버튼으로 닫을 때 부른다. */
  onClose: () => void;
  /** 로그인에 성공하면 서버가 돌려준 세션을 그대로 넘긴다. 역할 대응은 부르는 쪽(App)이 한다. */
  onLoginSuccess: (session: AuthSession) => void;
}

/**
 * 로그인한 채 다른 계정으로 들어갈 때 여는 로그인 창. 모양은 공통 팝업(Dialog)이다.
 * 로그인 전 첫 화면은 이 창이 아니라 LoginScreen이다.
 */
export function LoginModal({ onClose, onLoginSuccess }: LoginModalProps) {
  return (
    <Dialog
      title="로그인"
      description="BOAZ 관리자 콘솔"
      icon={<img src={boazLogo} alt="" width={32} height={32} className="size-8 shrink-0" />}
      onClose={onClose}
      closeLabel="로그인 창 닫기"
      width="sm"
    >
      <LoginForm
        onLoginSuccess={(session) => {
          onLoginSuccess(session);
          onClose();
        }}
      />
    </Dialog>
  );
}
