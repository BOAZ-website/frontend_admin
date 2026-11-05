/** 감사 로그 요청 Body의 files에서 읽은 파일 한 개. */
export interface BodyFile {
  name: string;
  url: string | null;
  isImage: boolean;
}

/** 사진으로 미리 볼 파일 확장자. */
const IMAGE_EXTENSION = /\.(jpe?g|png|gif|webp)$/i;

/**
 * http·https 주소만 돌려준다. requestBody는 요청 본문 그대로라 어떤 값이든 들어올 수 있으므로,
 * javascript: 같은 주소가 <img src>나 링크에 들어가지 않게 나머지는 null로 둔다(이름만 보인다).
 */
export function safeHttpUrl(value: string, base: string): URL | null {
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    // 주소로 읽을 수 없는 값은 링크로 만들지 않는다(이름만 보인다).
    return null;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * 요청 Body의 files 배열을 파일 목록으로 읽는다. 항목이 문자열이면 이름, {name, url} 객체면 이름과 주소다.
 * 주소가 있고 주소의 경로(쿼리 문자열 제외)가 사진 확장자면 사진으로 본다. files가 없거나 배열이 아니면 빈 목록이다.
 */
export function filesOfBody(
  body: Readonly<Record<string, unknown>> | null,
  base: string,
): BodyFile[] {
  const files = body?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((item: unknown): BodyFile[] => {
    if (typeof item === 'string') return [{ name: item, url: null, isImage: false }];
    if (!isRecord(item) || typeof item.name !== 'string') return [];
    const raw = typeof item.url === 'string' ? item.url : null;
    const url = raw === null ? null : safeHttpUrl(raw, base);
    return [
      {
        name: item.name,
        url: url ? raw : null,
        isImage: url !== null && IMAGE_EXTENSION.test(url.pathname),
      },
    ];
  });
}
