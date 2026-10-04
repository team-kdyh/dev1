/** Vite base 경로가 / 또는 /dev1/이어도 같은 정적 에셋을 가리킨다. */
export function assetUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}assets/${relativePath.replace(/^\/+/, '')}`;
}
