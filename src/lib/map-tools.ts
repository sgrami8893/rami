// 지도 위 도구 전환(2026-11-26 사용자 '도구 버튼이 너무 많다', '누르면 바로 지도 전환'): PC는 지도 도구 막대 맨 앞의 [전월세|주차장|발급기] 하나만.
// 지금 보는 지역(시·도, 시·군·구)에 맞는 각 도구 페이지 주소를 고른다. 그 지역 페이지가 없으면 시·도, 그것도 없으면 도구 첫 화면.
import { TOOLS } from '../config.ts';
import { HAS_PAGES, SIDOS as RENT_SIDOS, sigunguOf, rentPath } from './rent.ts';
import { SIDOS as PARKING_SIDOS, regionsOf, parkingPath, lots } from './parking.ts';
import { SIDO_ORDER, regionsIn, regionPath } from './data.ts';
import type { SidoSlug } from '../../scripts/lib/regions.ts';

export type ToolKey = 'rent' | 'parking' | 'muin';
type Table = { root: string; sido: Record<string, string>; sgg: Record<string, string> };
const live = new Set<string>(TOOLS.filter((t) => t.status === 'live').map((t) => t.slug));
export const TOOL_LABEL: Record<ToolKey, string> = { rent: '전월세', parking: '주차장', muin: '발급기' };

let memo: Partial<Record<ToolKey, Table>> | null = null;
export function toolTables() {
  if (memo) return memo;
  const t: Partial<Record<ToolKey, Table>> = {};
  if (live.has('rent') && HAS_PAGES) {
    const x: Table = { root: '/', sido: {}, sgg: {} };
    for (const s of RENT_SIDOS) { x.sido[s] = rentPath(s); for (const a of sigunguOf(s)) x.sgg[`${s}__${a.sigungu}`] = rentPath(s, a.sigungu); }
    t.rent = x;
  }
  if (live.has('parking') && lots.length) {
    // 주차장 첫 화면(/parking/)은 지도가 없어서, 시·도를 모를 때도 서울 지도 페이지로 간다
    const x: Table = { root: parkingPath('seoul' as SidoSlug), sido: {}, sgg: {} };
    for (const s of PARKING_SIDOS) { x.sido[s] = parkingPath(s); for (const r of regionsOf(s)) x.sgg[`${s}__${r.sigungu}`] = parkingPath(s, r.sigungu); }
    t.parking = x;
  }
  if (live.has('muin')) {
    const x: Table = { root: regionPath(), sido: {}, sgg: {} };
    for (const s of SIDO_ORDER) { x.sido[s] = regionPath(s); for (const r of regionsIn(s)) x.sgg[`${s}__${r.sigungu}`] = regionPath(s, r.sigungu); }
    t.muin = x;
  }
  return (memo = t);
}
export function toolHref(tool: ToolKey, sido?: string | null, sgg?: string | null) {
  const x = toolTables()[tool];
  if (!x) return null;
  return (sido && sgg && x.sgg[`${sido}__${sgg}`]) || (sido && x.sido[sido]) || x.root;
}
export const toolKeys = () => (['rent', 'parking', 'muin'] as ToolKey[]).filter((k) => toolTables()[k]);
