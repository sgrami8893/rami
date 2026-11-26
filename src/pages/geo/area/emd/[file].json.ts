// 시·군·구 하나의 법정동(읍·면은 리) 경계(지도 '틀'용, 통계 없음). src/lib/area-geo.ts
import type { APIRoute, GetStaticPaths } from 'astro';
import { areaFiles, emdOutlines } from '../../../../lib/area-geo.ts';
export const getStaticPaths: GetStaticPaths = () => areaFiles().map((file) => ({ params: { file } }));
export const GET: APIRoute = async ({ params }) => new Response(JSON.stringify(await emdOutlines(params.file!)), { headers: { 'Content-Type': 'application/json' } });
