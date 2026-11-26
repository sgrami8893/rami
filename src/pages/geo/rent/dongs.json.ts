// 전월세 '내 예산 맞춤' 목록: 전체 동 중위값(경계 없음, src/lib/rent-geo.ts dongIndex). 전월세 페이지가 있을 때만 만든다.
import type { APIRoute } from 'astro';
import { dongIndex } from '../../../lib/rent-geo.ts';
import { HAS_PAGES } from '../../../lib/rent.ts';
export const GET: APIRoute = () => new Response(JSON.stringify(HAS_PAGES ? dongIndex() : null), { headers: { 'Content-Type': 'application/json' } });
