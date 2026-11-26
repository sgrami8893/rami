// /rent/ 빌드 데이터 접근 (골격). 지금은 가짜 통계(rent-stats.mock.json)만 있다.
import mock from '../data/rent-stats.mock.json';
// 실데이터(npm run fetch-rent 결과)가 있으면 그것을, 없으면 가짜 데이터를 쓴다(파일이 없어도 빌드되게 glob)
const real = Object.values(import.meta.glob('../data/rent-stats.json', { eager: true, import: 'default' }))[0] as RentStats | undefined;
import { RENT_PREVIEW } from '../config.ts';
import { SIDO, SIGUNGU, type SidoSlug } from '../../scripts/lib/regions.ts';
import { sigunguAreas, dongAreasOf, dongPages, dongIndexable, sigunguIndexable, RENT_RULE, type RentStats, type RentArea } from '../../scripts/lib/rent.ts';

export type { RentArea };
export { dongIndexable, sigunguIndexable, RENT_RULE };
export const IS_MOCK = !real;
const EMPTY: RentStats = { from: '', to: '', generatedAt: '', isMock: true, areas: [] };
export const stats: RentStats = RENT_PREVIEW ? (real ?? (mock as unknown as RentStats)) : EMPTY;
export const RENT_BASE = '/rent/';
export const SIDOS: SidoSlug[] = (['seoul', 'gyeonggi', 'incheon'] as SidoSlug[]).filter((s) => stats.areas.some((a) => a.sido === s));
export const sidoName = (s: SidoSlug) => SIDO[s].name;
export const sidoShort = (s: SidoSlug) => SIDO[s].aliases[0];
export const sigunguOf = (s: SidoSlug) => sigunguAreas(stats).filter((a) => a.sido === s).sort((a, b) => a.sigunguName.localeCompare(b.sigunguName, 'ko'));
export const dongsOf = (s: string, sg: string) => dongAreasOf(stats, s, sg).sort((a, b) => b.n - a.n);
export const DONG_PAGES = dongPages(stats);
export const hasDongPage = (a: RentArea) => DONG_PAGES.includes(a);
export const rentPath = (s?: string, sg?: string, dong?: string | null) => `${RENT_BASE}${s ? `${s}/` : ''}${sg ? `${sg}/` : ''}${dong ? `${encodeURIComponent(dong)}/` : ''}`;
export const subGuText = (s: SidoSlug, sg: string) => { const x = SIGUNGU[s].find((y) => y.slug === sg); return x?.subGu?.length ? `(${x.subGu.join('·')})` : ''; };
/** "2025년 11월~2026년 10월" */
export const periodText = () => { const f = (ym: string) => `${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`; return stats.from ? `${f(stats.from)}~${f(stats.to)}` : ''; };
