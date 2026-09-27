import { useEffect } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';

import { MODAL_SURFACE } from './modalStyles';

interface PdfPreviewModalProps {
  url: string;
  name: string;
  onClose: () => void;
}

/** PDF를 내려받지 않고 화면 안에서 바로 보여주는 미리보기 창. 브라우저 내장 PDF 뷰어를 iframe으로 쓴다. */
export function PdfPreviewModal({ url, name, onClose }: PdfPreviewModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 미리보기`}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className={`flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl animate-in zoom-in-95 duration-150 ${MODAL_SURFACE}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 px-4 py-3">
          <FileText size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
          <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-slate-900">{name}</h3>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <ExternalLink size={13} aria-hidden="true" />
            <span>새 탭에서 열기</span>
          </a>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="미리보기 닫기"
          >
            <X size={18} />
          </button>
        </div>
        <iframe
          src={url}
          title={`${name} 미리보기`}
          className="min-h-0 w-full flex-1 bg-slate-100"
        />
      </div>
    </div>
  );
}
