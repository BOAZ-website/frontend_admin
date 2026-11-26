import { trackLabelOf } from './trackLabel';
import type { UserTrack } from './types';

/**
 * 부문 캐릭터(trackImage.ts)에 맞춘 버튼 색. 캐릭터처럼 옅은 파스텔 바탕에, 읽히도록 같은 계열의 아주 진한 글자를 쓴다.
 * 색은 캐릭터 그림에서 뽑았다(몸통과 팔다리 색의 중간 = 바탕, 팔다리 색 = 마우스를 올렸을 때).
 *   · 분석: 연보라 캐릭터 (몸통 #e8dff0, 팔다리 #c8b6e4)
 *   · 시각화: 베이지 캐릭터 (몸통 #f9efdd, 팔다리 #ebd09c)
 *   · 엔지니어링: 하늘색 캐릭터 (몸통 #dde3f1, 팔다리 #9fbbe8)
 * Tailwind 기본 색에는 이 캐릭터 색과 맞는 것이 없어(violet은 더 파랗고 amber는 더 노랗다) 색 코드를 직접 적는다.
 * 캐릭터 그림이 바뀌면 이 값도 다시 뽑는다. Tailwind가 클래스를 찾을 수 있게 문자열을 통째로 적는다.
 */
export const TRACK_BUTTON_CLASS: Record<UserTrack, string> = {
  분석: 'bg-[#ddd2ef] text-[#45336f] hover:bg-[#c8b6e4]',
  시각화: 'bg-[#f3e3c3] text-[#674717] hover:bg-[#ebd09c]',
  엔지니어링: 'bg-[#cfdcf3] text-[#1f3d75] hover:bg-[#9fbbe8]',
};

/** 부문이 없거나(HOST 등) 세 부문이 아니면 쓰는 기본 버튼 색. */
export const DEFAULT_BUTTON_CLASS = 'bg-slate-200 text-slate-800 hover:bg-slate-300';

/** 부문 코드(ENGINEERING 등)나 이름으로 버튼 색 클래스를 찾는다. */
export const trackButtonClassOf = (track: string | null | undefined): string => {
  const label = trackLabelOf(track);
  return label && label in TRACK_BUTTON_CLASS
    ? TRACK_BUTTON_CLASS[label as UserTrack]
    : DEFAULT_BUTTON_CLASS;
};
