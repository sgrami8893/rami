// Build-time data access. All pages read from the generated JSON; nothing is fetched at runtime.
import kiosksJson from '../data/kiosks.json';
import statsJson from '../data/region-stats.json';
import type { Kiosk } from '../../scripts/lib/normalize.ts';
import type { RegionStats } from '../../scripts/lib/stats.ts';
import { SIDO, SIGUNGU, type SidoSlug } from '../../scripts/lib/regions.ts';
import { distanceM } from '../../scripts/lib/normalize.ts';

export type { Kiosk, RegionStats, SidoSlug };
export const kiosks = kiosksJson as unknown as Kiosk[];
export const stats = statsJson as unknown as RegionStats[];
export const byId = new Map(kiosks.map((k) => [k.id, k]));

export const SIDO_ORDER: SidoSlug[] = ['seoul', 'gyeonggi', 'incheon'];
export const sidoName = (s: SidoSlug) => SIDO[s].name;
export const sidoShort = (s: SidoSlug) => SIDO[s].aliases[0];

export const statsFor = (sido: SidoSlug, sigungu: string) => stats.find((s) => s.sido === sido && s.sigungu === sigungu)!;
export const kiosksIn = (sido: SidoSlug, sigungu: string) => kiosks.filter((k) => k.sido === sido && k.sigungu === sigungu);
export const regionsIn = (sido: SidoSlug) => stats.filter((s) => s.sido === sido);
export const subGuOf = (sido: SidoSlug, sigungu: string) => SIGUNGU[sido].find((s) => s.slug === sigungu)?.subGu ?? [];

/** 무인발급기 도구의 루트. 모든 내부 링크는 이 함수들로 만든다. */
export const MUIN_BASE = '/muin/';
export const regionPath = (sido?: SidoSlug, sigungu?: string) => `${MUIN_BASE}${sido ? `${sido}/` : ''}${sigungu ? `${sigungu}/` : ''}`;
export const kioskPath = (k: Pick<Kiosk, 'sido' | 'sigungu' | 'id'>) => `${MUIN_BASE}${k.sido}/${k.sigungu}/k/${k.id}/`;
/** 브레드크럼 앞부분(허브 > 도구) */
export const MUIN_CRUMBS = [{ name: '홈', href: '/' }, { name: '무인민원발급기', href: MUIN_BASE }];

export const hasCoords = (k: Kiosk) => k.lat !== null && k.lng !== null;
/** 상세 페이지는 모든 기기에 만든다(원천 데이터에 좌표가 없어도 주소·운영시간·서류 정보는 있음). */
export const hasDetail = (_k: Kiosk) => true;

function centroid(ks: Kiosk[]) {
  const c = ks.filter(hasCoords);
  if (!c.length) return null;
  return { lat: c.reduce((a, k) => a + k.lat!, 0) / c.length, lng: c.reduce((a, k) => a + k.lng!, 0) / c.length };
}

/** Nearest kiosks OUTSIDE the region that satisfy `pred` (used for "0곳" FAQ answers and empty filter states). */
export function nearestOutside(sido: SidoSlug, sigungu: string, pred: (k: Kiosk) => boolean, n = 3) {
  const c = centroid(kiosksIn(sido, sigungu));
  const others = kiosks.filter((k) => !(k.sido === sido && k.sigungu === sigungu) && pred(k));
  // 좌표가 없으면 거리 대신 "같은 시·도의 이웃 시·군·구" 순서로 대신한다(m 없음).
  if (!c) {
    const order = nearbyRegions(sido, sigungu, 99).map((s) => `${s.sido}/${s.sigungu}`);
    const rank = (k: Kiosk) => { const i = order.indexOf(`${k.sido}/${k.sigungu}`); return i < 0 ? 999 : i; };
    return others.sort((a, b) => rank(a) - rank(b)).slice(0, n).map((k) => ({ k, m: undefined as number | undefined }));
  }
  return others.filter(hasCoords)
    .map((k) => ({ k, m: distanceM(c, { lat: k.lat!, lng: k.lng! }) as number | undefined }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n);
}

/** Other regions ordered by distance between centroids (stand-in for an adjacency table). */
export function nearbyRegions(sido: SidoSlug, sigungu: string, n = 6) {
  const c = centroid(kiosksIn(sido, sigungu));
  // 좌표가 없으면 같은 시·도 안의 시·군·구를 slug 순서(대체로 행정구역 코드 인접)로 보여 준다.
  if (!c) return stats.filter((s) => s.sido === sido && s.sigungu !== sigungu).slice(0, n);
  return stats
    .filter((s) => !(s.sido === sido && s.sigungu === sigungu))
    .map((s) => ({ s, c: centroid(kiosksIn(s.sido, s.sigungu)) }))
    .filter((x) => x.c)
    .map((x) => ({ s: x.s, m: distanceM(c, x.c!) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, n)
    .map((x) => x.s);
}
