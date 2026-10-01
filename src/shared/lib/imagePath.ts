/**
 * 이미지는 public/images 아래 한 폴더에 모아 두고 DB에는 그 상대 경로(예: images/study/a.jpg)만 저장한다.
 * 화면에서는 이 함수로 경로를 열 수 있는 주소로 바꾼다. 나중에 이미지를 URL(CDN 등)로 옮기면
 * DB의 images.url에 주소를 채우면 되고, 아래 함수만 url을 우선하도록 두면 화면 코드는 그대로다.
 */

const EXTERNAL_PREFIXES = ['http://', 'https://', 'blob:', 'data:'];

function baseUrl(): string {
  return import.meta.env?.BASE_URL ?? '/';
}

function isExternal(value: string): boolean {
  return EXTERNAL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** DB의 이미지 정보(url 우선, 없으면 path)를 화면에서 쓸 주소로 바꾼다. */
export function resolveImageUrl(image: { path: string; url?: string | null }): string {
  if (image.url) return image.url;
  if (isExternal(image.path)) return image.path;
  return `${baseUrl()}${image.path.replace(/^\/+/, '')}`;
}

/** resolveImageUrl의 반대. 화면 주소를 DB에 저장할 경로로 되돌린다(업로드한 blob/data 주소는 그대로 둔다). */
export function toImagePath(url: string): string {
  if (isExternal(url)) return url;
  const base = baseUrl();
  return url.startsWith(base) ? url.slice(base.length) : url.replace(/^\/+/, '');
}

/** 목 데이터용 샘플 사진. 모든 이미지는 public/images 아래 한 폴더에 모아 두고 경로명으로 접근한다. */
export const SAMPLE_STUDY_PHOTO_PATH = 'images/study/sample-study-photo.jpg';
