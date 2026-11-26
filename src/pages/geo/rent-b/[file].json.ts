// 전월세 지도: 시·군·구 하나의 건물별 실거래 이력. 동을 고르거나 아주 가까이 확대할 때 브라우저가 받는다(src/lib/rent-buildings.ts).
import type { APIRoute, GetStaticPaths } from 'astro';
import { buildingCollection, buildingFiles } from '../../../lib/rent-buildings.ts';
import { HAS_PAGES } from '../../../lib/rent.ts';
export const getStaticPaths: GetStaticPaths = () => (HAS_PAGES ? buildingFiles().map((file) => ({ params: { file } })) : []);
export const GET: APIRoute = ({ params }) => new Response(JSON.stringify(buildingCollection(params.file!)), { headers: { 'Content-Type': 'application/json' } });
