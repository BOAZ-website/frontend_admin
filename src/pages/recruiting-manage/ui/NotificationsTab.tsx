import { useState } from 'react';
import { Copy, RotateCcw, Save, Search, Trash2 } from 'lucide-react';

import { useSubscriptions } from '@/entities/recruitment/model/useSubscriptions';
import type { Recruitment } from '@/entities/recruitment/model/types';
import { alertApiError } from '@/shared/lib/alertApiError';
import { Btn } from '@/shared/ui/Btn';
import { DataLoadFailedNotice } from '@/shared/ui/DataLoadFailedNotice';
import { FIELD_INPUT, FIELD_LABEL } from '@/shared/ui/systemStyles';

import { fillMessageTemplate } from '../model/recruitmentView';

/** 운영진이 저장한 기본 양식. 서버 저장 API가 생기기 전까지 이 브라우저에만 남는다(ALM-03). */
const TEMPLATE_STORAGE_KEY = 'boaz_custom_notify_template';

const DEFAULT_TEMPLATE = `[BOAZ] 기다리시던 BOAZ 제{term}기 정규 신입 부원 모집이 시작되었습니다!

국내 최초 빅데이터 동아리 BOAZ에서 함께 성장할 부원을 모집합니다.

■ 모집 기간: {start_date} ~ {end_date}까지
■ 모집 트랙: 데이터 분석 / 데이터 엔지니어링 / 데이터 시각화

새로운 도전을 기다립니다. 많은 관심과 지원 부탁드립니다!`;

/** 쓸 수 있는 치환 변수. 신청자 이름·관심 트랙은 서버가 보관하지 않아 쓸 수 없다. */
const VARIABLES = [
  { tag: '{term}', description: '기수' },
  { tag: '{start_date}', description: '접수 시작 일시' },
  { tag: '{end_date}', description: '접수 마감 일시' },
] as const;

/** 'YYYY-MM-DDTHH:mm:ss' → 'YYYY-MM-DD HH:mm'. 안내 문구에 실제 접수 시각을 적는다. */
const minuteOf = (dateTime: string) => dateTime.slice(0, 16).replace('T', ' ');

function readSavedTemplate(): string {
  try {
    return localStorage.getItem(TEMPLATE_STORAGE_KEY) || DEFAULT_TEMPLATE;
  } catch {
    return DEFAULT_TEMPLATE;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.alert('클립보드에 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.');
    return false;
  }
}

interface NotificationsTabProps {
  /** 기수가 큰 순서. 맨 앞 공고의 기수·접수 기간으로 양식을 채운다. */
  recruitments: Recruitment[] | null;
  onToast: (message: string) => void;
}

/** 사전 알림 명단(REC-ALM). 명단 확인·전체 삭제, 안내 문구 편집·복사. 발송은 운영진이 외부에서 한다. */
export function NotificationsTab({ recruitments, onToast }: NotificationsTabProps) {
  const state = useSubscriptions();
  const [savedTemplate, setSavedTemplate] = useState(readSavedTemplate);
  const [template, setTemplate] = useState(savedTemplate);
  const [query, setQuery] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const latest = recruitments?.[0];
  const message = latest
    ? fillMessageTemplate(template, {
        term: String(latest.term),
        start_date: minuteOf(latest.start_date),
        end_date: minuteOf(latest.end_date),
      })
    : template;
  const subscriptions = state.subscriptions ?? [];
  const keyword = query.trim().toLowerCase();
  const shown = keyword
    ? subscriptions.filter((item) => item.email.toLowerCase().includes(keyword))
    : subscriptions;

  const handleSaveTemplate = () => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, template);
    } catch {
      window.alert('양식을 저장하지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.');
      return;
    }
    setSavedTemplate(template);
    onToast('지금 양식을 기본 양식으로 저장했습니다.');
  };

  const handleDeleteAll = async () => {
    if (
      !window.confirm(
        `사전 알림 신청자 ${subscriptions.length}명을 모두 삭제할까요?\n삭제한 명단은 되돌릴 수 없습니다.`,
      )
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      await state.removeAll();
    } catch (error) {
      alertApiError(error);
      return;
    } finally {
      setIsDeleting(false);
    }
    onToast('사전 알림 명단을 모두 삭제했습니다.');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight text-slate-900">사전 알림 명단</h2>
        <p className="mt-1 text-xs text-slate-500">
          모집 시작 알림을 신청한 사람의 이메일을 확인하고, 안내 문구를 복사해 직접 보냅니다.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label htmlFor="notify-template" className="text-sm font-bold text-slate-900">
              모집 시작 안내 문구
            </label>
            <div className="flex items-center gap-2">
              <Btn size="xs" variant="outline" onClick={handleSaveTemplate}>
                <Save size={12} /> 기본 양식으로 저장
              </Btn>
              <Btn size="xs" variant="ghost" onClick={() => setTemplate(savedTemplate)}>
                <RotateCcw size={12} /> 기본 양식 복원
              </Btn>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            치환 변수:
            {VARIABLES.map((variable) => (
              <button
                key={variable.tag}
                type="button"
                onClick={() => setTemplate(`${template}${variable.tag}`)}
                className="cursor-pointer rounded-sm border border-slate-200 px-2 py-1 font-mono text-xs text-slate-700 hover:bg-slate-50"
              >
                {variable.tag} {variable.description}
              </button>
            ))}
          </div>
          <textarea
            id="notify-template"
            rows={10}
            value={template}
            onChange={(event) => setTemplate(event.target.value)}
            className={`${FIELD_INPUT} h-auto py-2 text-xs leading-relaxed`}
          />
        </div>

        <div className="space-y-3 rounded-md border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">보낼 문구 미리보기</p>
            <Btn
              size="xs"
              onClick={async () => {
                if (await copyText(message)) onToast('안내 문구를 복사했습니다.');
              }}
            >
              <Copy size={12} /> 문구 복사
            </Btn>
          </div>
          <p className="text-xs text-slate-500">
            {latest
              ? `제${latest.term}기 공고의 기수·접수 기간으로 채웠습니다.`
              : '등록된 모집 공고가 없어 변수를 채우지 못했습니다.'}
          </p>
          <div className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
            {message}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-64">
            <label htmlFor="subscription-search" className={FIELD_LABEL}>
              이메일 검색
            </label>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="subscription-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={`${FIELD_INPUT} pl-8`}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {shown.length} / {subscriptions.length}명
            </span>
            <Btn
              variant="outline"
              disabled={shown.length === 0}
              onClick={async () => {
                if (await copyText(shown.map((item) => item.email).join('\n'))) {
                  onToast(`이메일 ${shown.length}개를 복사했습니다.`);
                }
              }}
            >
              <Copy size={13} /> {keyword ? '검색 결과' : '전체'} 이메일 복사
            </Btn>
            <Btn
              variant="danger"
              disabled={subscriptions.length === 0 || isDeleting}
              onClick={() => void handleDeleteAll()}
            >
              <Trash2 size={13} /> 명단 전체 삭제
            </Btn>
          </div>
        </div>

        {state.error && <DataLoadFailedNotice onRetry={state.reload} />}
        {state.subscriptions === null && !state.error && (
          <p className="text-xs text-slate-500">명단을 불러오는 중입니다.</p>
        )}
        {state.subscriptions && (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-semibold">이메일</th>
                  <th className="w-48 px-4 py-2 font-semibold">신청 일시</th>
                  <th className="w-24 px-4 py-2 font-semibold">
                    <span className="sr-only">복사</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shown.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-mono text-slate-800">{item.email}</td>
                    <td className="px-4 py-2 text-slate-600">
                      {item.created_at.replace('T', ' ')}
                    </td>
                    <td className="px-4 py-2">
                      <Btn
                        size="xs"
                        variant="ghost"
                        onClick={async () => {
                          if (await copyText(item.email)) onToast(`${item.email}을 복사했습니다.`);
                        }}
                      >
                        <Copy size={12} /> 복사
                      </Btn>
                    </td>
                  </tr>
                ))}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                      {keyword ? '검색 결과가 없습니다.' : '사전 알림 신청자가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
