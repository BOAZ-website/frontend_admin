import { useLoaded } from '@/shared/lib/useLoaded';

import { deleteAllSubscriptions, fetchSubscriptions } from '../api/recruitmentApi';
import type { Subscription } from './types';

export interface SubscriptionsState {
  /** 최근 신청 순. 읽는 중이면 null. */
  subscriptions: Subscription[] | null;
  isLoading: boolean;
  error: Error | null;
  reload: () => void;
  /** 명단을 모두 지운다. 한 명만 지우는 API는 없다. */
  removeAll: () => Promise<void>;
}

const loadAll = (): Promise<Subscription[]> => fetchSubscriptions();

/** 사전 알림 신청 명단과 전체 삭제. 삭제가 성공하면 명단을 다시 읽는다. */
export function useSubscriptions(): SubscriptionsState {
  const { data, isLoading, error, reload } = useLoaded('all', loadAll);
  return {
    subscriptions: data,
    isLoading,
    error,
    reload,
    removeAll: async () => {
      await deleteAllSubscriptions();
      reload();
    },
  };
}
