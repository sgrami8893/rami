// 시·군·구 공유 이미지(scripts/og/rent-sgg.cjs가 만든 public/og/rent/*.jpg). 동 화면도 소속 시·군·구 이미지를 쓴다(2026-11-27 합의)
import { existsSync } from 'node:fs';
import { join } from 'node:path';
export const rentOg = (sido: string, slug: string) => {
  const rel = `/og/rent/${sido}__${slug}.jpg`;
  return existsSync(join(process.cwd(), 'public', rel)) ? `${rel}?v=1` : undefined;
};
