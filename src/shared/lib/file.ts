import { resolveImageUrl, toImagePath } from './imagePath';

/** 첨부 PDF 최대 크기(20MB). */
export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;

const BYTES_PER_KB = 1024;
const BYTES_PER_MB = 1024 * 1024;

/** 파일 크기를 화면에 보이는 문자열로 바꾼다(1MB 초과는 MB, 그 외는 KB). */
export function formatFileSize(bytes: number): string {
  return bytes > BYTES_PER_MB
    ? `${(bytes / BYTES_PER_MB).toFixed(1)} MB`
    : `${Math.round(bytes / BYTES_PER_KB)} KB`;
}

/** 확장자나 MIME 타입이 PDF인 파일인지. 브라우저가 type을 비워 보내는 경우가 있어 확장자도 본다. */
export function isPdfFile(file: Pick<File, 'name' | 'type'>): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * 목 데이터용 샘플 PDF. 사진처럼 public 아래(public/files/study)에 두고 DB에는 상대 경로만 저장한다.
 * 파일을 URL(CDN 등)로 옮기면 화면 코드는 그대로 두고 이 경로 처리만 바꾸면 된다.
 */
export const SAMPLE_MENTORING_PDF_PATH = 'files/study/sample-mentoring-report.pdf';

/** DB에 저장된 파일 경로를 화면에서 열 수 있는 주소로 바꾼다(업로드한 blob 주소는 그대로 둔다). */
export function resolveFileUrl(path: string): string {
  return resolveImageUrl({ path });
}

/** resolveFileUrl의 반대. 화면 주소를 DB에 저장할 경로로 되돌린다. */
export function toFilePath(url: string): string {
  return toImagePath(url);
}
