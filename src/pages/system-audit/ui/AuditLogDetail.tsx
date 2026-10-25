import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { MODAL_CLOSE_BTN } from '@/pages/system-accounts/ui/systemStyles';

import { AUDIT_ACTIONS, type AuditLogEntry } from '@/entities/audit-log/model/types';

const EMPTY_CELL = '-';
/** 사진으로 미리 볼 파일 확장자. */
const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp)$/i;

/** Body의 files에서 읽은 파일 한 개. */
interface BodyFile {
  name: string;
  url: string | null;
  isImage: boolean;
}

/**
 * http·https 주소만 돌려준다. requestBody는 요청 본문 그대로라 어떤 값이든 들어올 수 있으므로,
 * javascript: 같은 주소가 <img src>나 링크에 들어가지 않게 나머지는 null로 둔다(이름만 보인다).
 */
function safeHttpUrl(value: string): string | null {
  try {
    const { protocol } = new URL(value, window.location.origin);
    return protocol === 'http:' || protocol === 'https:' ? value : null;
  } catch {
    return null;
  }
}

/**
 * 요청 Body의 files 배열을 파일 목록으로 읽는다. 항목이 문자열이면 이름, {name, url} 객체면 이름과 주소다.
 * 주소가 있고 사진 확장자면 사진으로 본다. files가 없거나 배열이 아니면 빈 목록이다.
 */
function filesOfBody(body: Readonly<Record<string, unknown>> | null): BodyFile[] {
  const files = body?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((item: unknown): BodyFile[] => {
    if (typeof item === 'string') return [{ name: item, url: null, isImage: false }];
    if (typeof item !== 'object' || item === null) return [];
    const { name, url } = item as { name?: unknown; url?: unknown };
    if (typeof name !== 'string') return [];
    const fileUrl = typeof url === 'string' ? safeHttpUrl(url) : null;
    return [
      { name, url: fileUrl, isImage: fileUrl !== null && IMAGE_EXTENSION.test(fileUrl || name) },
    ];
  });
}

/** 이름 열(64px)과 값 열로 된 한 줄. 팝업의 글자는 제목을 빼고 모두 12px이다. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-16 shrink-0 text-xs leading-5 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-xs leading-5 font-medium break-words text-slate-900">
        {children}
      </dd>
    </div>
  );
}

/**
 * 올린(또는 삭제한) 파일 칸. 사진은 두 줄씩 크게 미리 보이고(누르면 새 창에서 원본), 아래에 파일 이름을 쓴다.
 * 사진이 아닌 파일은 이름 목록이고, 주소가 있으면 링크다.
 */
function Attachments({ title, files }: { title: string; files: readonly BodyFile[] }) {
  const images = files.filter((file) => file.isImage && file.url);
  const others = files.filter((file) => !(file.isImage && file.url));
  return (
    <section className="border-t border-slate-200 py-4" aria-label={title}>
      <h4 className="text-xs font-semibold text-slate-900">{title}</h4>
      {images.length > 0 && (
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {images.map((file, index) => (
            <li key={`${file.name}-${index}`} className="min-w-0">
              <a
                href={file.url ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                title={`${file.name} 원본 보기`}
                className="block overflow-hidden rounded-sm border border-slate-200 transition-colors hover:border-slate-400"
              >
                <img
                  src={file.url ?? undefined}
                  alt={file.name}
                  loading="lazy"
                  className="aspect-4/3 w-full bg-slate-100 object-cover"
                />
              </a>
              <p className="mt-1 truncate text-xs text-slate-700" title={file.name}>
                {file.name}
              </p>
            </li>
          ))}
        </ul>
      )}
      {others.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-700">
          {others.map((file, index) => (
            <li key={`${file.name}-${index}`} className="truncate" title={file.name}>
              {file.url ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                >
                  {file.name}
                </a>
              ) : (
                file.name
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** 보낸 값을 2칸 들여쓰기한 글자로 바꾼다. 항목마다 한 줄이라 읽기 쉽다. */
const formatBody = (body: Readonly<Record<string, unknown>>): string =>
  JSON.stringify(body, null, 2);

interface AuditLogDetailProps {
  entry: AuditLogEntry;
  onClose: () => void;
  /** 권한 관리 화면에서 수행자의 권한 창을 연다(회원 id). */
  onOpenPermissions: (userId: string) => void;
}

/**
 * 감사 로그 한 줄의 상세 창. 표의 "상세 보기"를 누르면 화면 가운데에 작은 창으로 열린다.
 * 바깥을 누르거나 Escape·닫기 버튼으로 닫는다.
 * 실제 백엔드가 감사 기록에 요청 Body만 남기는 것을 기준으로, 기록 기본값과 Body에서 알 수 있는 것만 보인다:
 * 머리에 행동, 그 아래 수행자·일시, 호출한 API와 보낸 값(Body), 맨 아래에 Body의 files에서 읽은 파일.
 * 글자 크기는 제목(14px)과 나머지(12px) 두 가지만 쓴다. 개인정보 값은 기록에 남기지 않아 "(비공개)"로 보인다.
 */
export function AuditLogDetail({ entry, onClose, onOpenPermissions }: AuditLogDetailProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  const actorName = entry.actorName ?? (entry.actorId === null ? EMPTY_CELL : '삭제된 회원');
  const actorUserId = entry.actorHasAccount ? entry.actorUserId : null;
  const files = filesOfBody(entry.requestBody);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-detail-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 p-4"
    >
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <h3 id="audit-detail-title" className="min-w-0 text-sm font-bold text-slate-900">
            {AUDIT_ACTIONS[entry.action].label}
          </h3>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="상세 닫기"
            className={`shrink-0 ${MODAL_CLOSE_BTN}`}
          >
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 text-left">
          <dl className="space-y-1 py-4">
            <Row label="수행자">
              {/* 이름을 누르면 권한 관리 화면에서 그 사람의 권한 창을 연다. 계정이 없으면 옮겨 갈 곳이 없어 글자로 둔다. */}
              {actorUserId ? (
                <button
                  type="button"
                  onClick={() => onOpenPermissions(actorUserId)}
                  title="권한 보기"
                  className="cursor-pointer text-xs font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                >
                  {actorName}
                </button>
              ) : (
                actorName
              )}
            </Row>
            <Row label="일시">
              <span className="tabular-nums">{entry.occurredAt}</span>
            </Row>
          </dl>
          {/* 요청이 이 팝업의 중심이다. 핵심 줄 아래에 호출한 경로와 보낸 값(Body)을 크게 둔다. */}
          {entry.api && (
            <div className="border-t border-slate-200 py-4">
              <p className="text-xs leading-5 break-all text-slate-700">
                <span
                  className={`font-semibold ${
                    entry.api.method === 'DELETE' ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {entry.api.method}
                </span>{' '}
                {entry.api.path}
              </p>
              <pre className="mt-2 max-h-80 min-h-20 overflow-y-auto whitespace-pre-wrap break-all rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-900">
                {entry.requestBody ? formatBody(entry.requestBody) : '보낸 값 없음'}
              </pre>
            </div>
          )}
          {/* Body의 files에서 읽은 파일. Body가 없는 기록(삭제 등)에는 나오지 않는다. */}
          {files.length > 0 && (
            <Attachments
              title={`${entry.action === 'CONTENT_DELETE' ? '삭제한' : '올린'} 파일 ${files.length}개`}
              files={files}
            />
          )}
        </div>
      </div>
    </div>
  );
}
