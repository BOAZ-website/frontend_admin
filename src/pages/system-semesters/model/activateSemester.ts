import type { Season, SeasonArchiveReadiness } from '@/entities/cohort/model/season';
import { alertApiError } from '@/shared/lib/alertApiError';

const BLOCK_REASON_LABEL: Record<
  SeasonArchiveReadiness['blockingItems'][number]['reason'],
  string
> = {
  PENDING: '승인 대기',
  NOT_SUBMITTED: '미제출',
};

/**
 * 종료 점검에서 막힌 이유를 알림 문구로 만든다. 막힌 것이 없으면 null.
 * 반기 이름 뒤에 "반기"를 붙여 조사(을/를)가 이름 끝 숫자에 따라 틀리지 않게 한다.
 */
export function archiveBlockMessage(
  currentName: string,
  nextName: string,
  readiness: SeasonArchiveReadiness,
): string | null {
  if (readiness.canArchive) return null;
  const lines = [
    ...(readiness.lastWeek && !readiness.lastWeek.isClosed
      ? [`- 마지막 ${readiness.lastWeek.weekNo}주차가 아직 끝나지 않았습니다.`]
      : []),
    ...readiness.blockingItems.map((item) => {
      const when = item.roundNo !== null ? `${item.roundNo}회차` : `${item.weekNo}주차`;
      return `- ${item.groupName} ${when}: ${BLOCK_REASON_LABEL[item.reason]}`;
    }),
  ];
  return `${currentName} 반기를 종료할 수 없어 ${nextName} 반기를 활성화하지 않았습니다.\n${lines.join('\n')}`;
}

interface ActivateActions {
  checkArchive: (season: Season) => Promise<SeasonArchiveReadiness>;
  archive: (season: Season) => Promise<void>;
  activate: (season: Season) => Promise<void>;
}

/**
 * 진행 예정 반기를 활성화한다. 진행 반기가 있으면 종료 점검(ATT-10) → 종료(ATT-11)를 먼저 하고 활성화(ATT-05)한다.
 * 점검에서 막히면 이유를 알리고 아무것도 바꾸지 않는다. 반기 상태를 바꿨으면(종료만 된 경우 포함) true.
 * 종료한 뒤 활성화만 실패하면 진행 반기가 없는 채로 남는다. 이때 다시 누르면 활성화만 한다(진행 반기가 없으므로).
 */
export async function confirmAndActivate(
  season: Season,
  current: Season | null,
  actions: ActivateActions,
): Promise<boolean> {
  const { name } = season;
  const message = current
    ? `${name} 반기를 활성화할까요?
${current.name} 반기의 종료 점검을 통과하면 ${current.name} 반기를 종료하고 ${name} 반기를 진행 반기로 만듭니다.
종료한 반기는 고칠 수 없고, 맡은 그룹이 없어진 HOST 계정은 지워집니다. 팀·출결 기록은 그대로 남습니다.`
    : `${name} 반기를 활성화할까요?
${name} 반기를 진행 반기로 만듭니다.`;
  if (!window.confirm(message)) return false;

  if (current) {
    try {
      const readiness = await actions.checkArchive(current);
      // 화면 목록이 낡아 이미 종료한 반기를 진행 반기로 알고 있으면(종료 뒤 목록 다시 읽기 실패) 바로 활성화한다.
      if (readiness.blockReason !== 'SEASON_ARCHIVED') {
        const blocked = archiveBlockMessage(current.name, name, readiness);
        if (blocked) {
          window.alert(blocked);
          return false;
        }
        await actions.archive(current);
      }
    } catch (error) {
      alertApiError(error);
      return false;
    }
  }
  try {
    await actions.activate(season);
    return true;
  } catch (error) {
    alertApiError(error);
    if (!current) return false;
    window.alert(
      `${current.name} 반기는 종료되었습니다. 활성화 버튼을 다시 눌러 ${name} 반기를 활성화해 주세요.`,
    );
    return true;
  }
}
