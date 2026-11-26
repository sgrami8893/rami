// /parking/ 빌드 데이터 접근.
// 실데이터 src/data/parking.json(국내 PC에서 npm run fetch-parking 으로 생성·커밋)이 있으면 그것을 쓰고,
// 없으면 PARKING_PREVIEW=1 빌드에서만 가짜 데이터(parking.mock.json)로 구조를 보여 준다.
// 배포 빌드에서 주차장 페이지가 생기는 조건: 실데이터가 있고 config.ts TOOLS의 parking이 'live'.
import mock from '../data/parking.mock.json';
import type { ParkingLot, DayHours, DayKey } from '../../scripts/lib/parking.ts';
import { freeHubIndexable, regionIndexable, lotIndexable, dedupeLots, withAmbiguousDays } from '../../scripts/lib/parking.ts';
import { SIDO, SIGUNGU, type SidoSlug } from '../../scripts/lib/regions.ts';
import { PARKING_PREVIEW, TOOLS } from '../config.ts';

export type { ParkingLot };
export { freeHubIndexable, regionIndexable, lotIndexable };
const real = Object.values(import.meta.glob('../data/parking.json', { eager: true, import: 'default' }))[0] as ParkingLot[] | undefined;
const LIVE = TOOLS.find((t) => t.slug === 'parking')?.status === 'live';
export const IS_MOCK = !real?.length;
export const lots: ParkingLot[] = !IS_MOCK && (LIVE || PARKING_PREVIEW)
  ? dedupeLots(real!).lots.map(withAmbiguousDays)
  : PARKING_PREVIEW ? (mock as unknown as ParkingLot[]) : [];
const report = Object.values(import.meta.glob('../data/parking.report.json', { eager: true, import: 'default' }))[0] as { fetchedAt?: string } | undefined;
/** 수집일(한국 시간, YYYY-MM-DD). 기관별 데이터 기준일은 상세 페이지에 따로 표시. 출처 표기에 쓴다 */
export const PARKING_DATE = IS_MOCK || !report?.fetchedAt ? null : new Date(new Date(report.fetchedAt).getTime() + 9 * 3600e3).toISOString().slice(0, 10);
export const PARKING_BASE = '/parking/';
export const SIDOS: SidoSlug[] = (['seoul', 'gyeonggi', 'incheon'] as SidoSlug[]).filter((s) => lots.some((l) => l.sido === s));
export const sidoName = (s: SidoSlug) => SIDO[s].name;
export const sidoShort = (s: SidoSlug) => SIDO[s].aliases[0];
export const sigunguName = (s: SidoSlug, sg: string) => SIGUNGU[s].find((x) => x.slug === sg)?.name ?? sg;
export const parkingPath = (s?: SidoSlug, sg?: string) => `${PARKING_BASE}${s ? `${s}/` : ''}${sg ? `${sg}/` : ''}`;
export const lotPath = (l: Pick<ParkingLot, 'sido' | 'sigungu' | 'id'>) => `${PARKING_BASE}${l.sido}/${l.sigungu}/p/${encodeURIComponent(l.id)}/`;
export const freePath = (s: SidoSlug) => `${PARKING_BASE}${s}/free/`;
export const regionsOf = (s: SidoSlug) => {
  const by = new Map<string, ParkingLot[]>();
  lots.filter((l) => l.sido === s).forEach((l) => by.set(l.sigungu, [...(by.get(l.sigungu) ?? []), l]));
  return [...by].map(([sg, ls]) => ({ sigungu: sg, name: sigunguName(s, sg), lots: ls, free: ls.filter((l) => l.fee.type === 'free').length }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
};
export const FEE_LABEL = { free: '무료', paid: '유료', mixed: '무료·유료 혼합', unknown: '요금 확인 필요' } as const;
export const LOT_TYPE = { onStreet: '노상', offStreet: '노외', attached: '부설', unknown: '유형 미상' } as const;
export const hoursText = (h: DayHours, ambiguous = false) => (h === null ? '정보 없음' : h === '24h' ? (ambiguous ? '24시간(확인 필요)' : '24시간') : `${h[0]}~${h[1]}`);
export const dayText = (l: ParkingLot, k: DayKey) => hoursText(l.hours[k], !!l.ambiguousDays?.includes(k));
export const won = (v: number | null) => (v === null ? '-' : `${v.toLocaleString('ko-KR')}원`);
export const toPoint = (l: ParkingLot) => ({
  id: l.id, name: l.name, lat: l.lat as number, lng: l.lng as number, href: lotPath(l), badge: FEE_LABEL[l.fee.type],
  meta: [`평일 ${dayText(l, 'weekday')}`, l.spaces !== null ? `${l.spaces}면` : ''].filter(Boolean).join(' · '),
});
