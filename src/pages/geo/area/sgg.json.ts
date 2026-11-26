// 시·군·구 경계(지도 '틀'용, 통계 없음). src/lib/area-geo.ts
import type { APIRoute } from 'astro';
import { sggOutlines } from '../../../lib/area-geo.ts';
export const GET: APIRoute = async () => new Response(JSON.stringify(await sggOutlines()), { headers: { 'Content-Type': 'application/json' } });
