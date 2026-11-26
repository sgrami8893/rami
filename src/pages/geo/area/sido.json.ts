// 시·도 외곽선(지도 '틀'용, 통계 없음). src/lib/area-geo.ts
import type { APIRoute } from 'astro';
import { sidoOutlines } from '../../../lib/area-geo.ts';
export const GET: APIRoute = async () => new Response(JSON.stringify(await sidoOutlines()), { headers: { 'Content-Type': 'application/json' } });
