// 전월세 지도: 시·군·구 경계 + 시·군·구 통계 + 색 구간(src/lib/rent-geo.ts). 전월세 페이지가 있을 때만 만든다.
import type { APIRoute } from 'astro';
import { sggCollection } from '../../../lib/rent-geo.ts';
import { HAS_PAGES } from '../../../lib/rent.ts';
export const GET: APIRoute = async () => new Response(JSON.stringify(HAS_PAGES ? await sggCollection() : null), { headers: { 'Content-Type': 'application/json' } });
