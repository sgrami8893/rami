// '내 주변'(2026-11-26): 좌표 있는 공영주차장 전체를 작게. 브라우저가 내 위치와의 거리를 직접 계산한다(위치는 서버로 보내지 않음).
// [위도, 경도, 이름, 상세 주소, 핀 글자(무료·300원/5분 등), 요금 구분]
import type { APIRoute } from 'astro';
import { lots, toPoint, FEE_LABEL } from '../../lib/parking.ts';
export const GET: APIRoute = () => {
  const rows = lots.filter((l) => l.lat !== null && l.lng !== null).map((l) => { const p = toPoint(l); return [Math.round(p.lat * 1e5) / 1e5, Math.round(p.lng * 1e5) / 1e5, p.name, p.href, p.tag, FEE_LABEL[l.fee.type]]; });
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json' } });
};
