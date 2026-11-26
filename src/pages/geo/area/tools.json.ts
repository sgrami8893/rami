// 지도 위 도구 전환 링크 표(src/lib/map-tools.ts). 지도를 옮겨 지역이 바뀌면 브라우저가 이 표로 링크를 고친다
import type { APIRoute } from 'astro';
import { toolTables } from '../../../lib/map-tools.ts';
export const GET: APIRoute = () => new Response(JSON.stringify(toolTables()), { headers: { 'Content-Type': 'application/json' } });
