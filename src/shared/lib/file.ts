import { resolveImageUrl, toImagePath } from './imagePath';

/** 첨부 PDF 최대 크기(20MB). */
export const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;
export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

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

/** 확장자와 MIME, 파일 헤더가 모두 PDF인 경우에만 미리보기를 허용한다. */
export async function hasPdfSignature(file: File): Promise<boolean> {
  if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) return false;
  const header = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  return header.length === 5 && [37, 80, 68, 70, 45].every((byte, index) => header[index] === byte);
}

/** blob URL 대신 임시 로컬 DB에 보관할 수 있는 문자열로 파일을 읽는다. */
export function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'));
    reader.readAsDataURL(blob);
  });
}

/** 임시 업로드 계층. 서버 저장소가 연결되면 이 함수가 영속 경로와 공개 URL을 반환한다. */
export async function uploadFile(blob: Blob): Promise<{ path: string; url: string }> {
  const url = await readBlobAsDataUrl(blob);
  return { path: url, url };
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
