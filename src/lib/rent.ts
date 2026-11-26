// /rent/ 빌드 데이터 접근. 실데이터 rent-stats.json(PC에서 npm run fetch-rent), 미리보기에서 없으면 가짜 통계.
import mock from '../data/rent-stats.mock.json';
// 실데이터(npm run fetch-rent 결과)가 있으면 그것을, 없으면 가짜 데이터를 쓴다(파일이 없어도 빌드되게 glob)
const real = Object.values(import.meta.glob('../data/rent-stats.json', { eager: true, import: 'default' }))[0] as RentStats | undefined;
import { RENT_PREVIEW, DATA_SOURCES, TOOLS } from '../config.ts';
import { SIDO, SIGUNGU, type SidoSlug } from '../../scripts/lib/regions.ts';
import { sigunguAreas, dongAreasOf, dongPages, dongIndexable, sigunguIndexable, RENT_RULE, manwon, type RentStats, type RentArea } from '../../scripts/lib/rent.ts';

export type { RentArea };
export { dongIndexable, sigunguIndexable, RENT_RULE };
export const IS_MOCK = !real;
const EMPTY: RentStats = { from: '', to: '', generatedAt: '', isMock: true, areas: [] };
// 배포 빌드: TOOLS의 rent가 'live'이고 실데이터가 있을 때만 페이지를 만든다(가짜 데이터는 미리보기에서만)
const LIVE = TOOLS.find((t) => t.slug === 'rent')?.status === 'live';
export const stats: RentStats = RENT_PREVIEW ? (real ?? (mock as unknown as RentStats)) : LIVE && real ? real : EMPTY;
export const HAS_PAGES = stats.areas.length > 0;
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
/** 푸터 출처(국토부 실거래가 2종 + 계약 기간) */
export const RENT_SOURCES = (['rentVilla', 'rentOffi'] as const).map((k) => ({ ...DATA_SOURCES[k], label: '계약 기간', date: periodText() }));

/** 검색 결과 설명문: 거래 건수 + 빌라 전세 중위값(없으면 오피스텔) + 계산기 안내. 판단 표현 없이 사실만 */
export function rentDescription(place: string, a: RentArea) {
  const v = a.byType.villa, o = a.byType.officetel;
  const facts: string[] = [];
  if (v?.jeonse) facts.push(`빌라 전세 중위값 ${manwon(v.jeonse.median)}`);
  else if (o?.jeonse) facts.push(`오피스텔 전세 중위값 ${manwon(o.jeonse.median)}`);
  const w = (v?.wolse?.monthly ? v : o)?.wolse;
  if (w?.deposit && w.monthly) facts.push(`월세는 보증금 ${manwon(w.deposit.median)}에 월 ${manwon(w.monthly.median)}이 중간값`);
  return `${place} 빌라·오피스텔 전월세 실거래 ${a.n.toLocaleString('ko-KR')}건(${periodText()})을 모았어요.${facts.length ? ` ${facts.join(', ')}이에요.` : ''} 중개보수·전월세 전환 계산기도 함께 있어요.`;
}
