// 전월세 지도: 시·군·구 하나의 법정동(읍·면은 리) 경계 + 동별 통계. 지도를 그 지역으로 옮길 때 브라우저가 받는다.
import type { APIRoute, GetStaticPaths } from 'astro';
import { emdCollection, emdFileNames } from '../../../lib/rent-geo.ts';
import { HAS_PAGES } from '../../../lib/rent.ts';
export const getStaticPaths: GetStaticPaths = () => (HAS_PAGES ? emdFileNames().map((file) => ({ params: { file } })) : []);
export const GET: APIRoute = async ({ params }) => new Response(JSON.stringify(await emdCollection(params.file!)), { headers: { 'Content-Type': 'application/json' } });
