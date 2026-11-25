// /parking/ 빌드 데이터 접근 (골격). 지금은 가짜 데이터(parking.mock.json)만 있다.
import mock from '../data/parking.mock.json';
import type { ParkingLot, DayHours } from '../../scripts/lib/parking.ts';
import { freeHubIndexable, regionIndexable, lotIndexable } from '../../scripts/lib/parking.ts';
import { SIDO, SIGUNGU, type SidoSlug } from '../../scripts/lib/regions.ts';
import { PARKING_PREVIEW } from '../config.ts';

export type { ParkingLot };
export { freeHubIndexable, regionIndexable, lotIndexable };
export const IS_MOCK = true;
export const lots: ParkingLot[] = PARKING_PREVIEW ? (mock as unknown as ParkingLot[]) : [];
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
export const hoursText = (h: DayHours) => (h === null ? '정보 없음' : h === '24h' ? '24시간' : `${h[0]}~${h[1]}`);
export const won = (v: number | null) => (v === null ? '-' : `${v.toLocaleString('ko-KR')}원`);
export const toPoint = (l: ParkingLot) => ({
  id: l.id, name: l.name, lat: l.lat as number, lng: l.lng as number, href: lotPath(l), badge: FEE_LABEL[l.fee.type],
  meta: [`평일 ${hoursText(l.hours.weekday)}`, l.spaces !== null ? `${l.spaces}면` : ''].filter(Boolean).join(' · '),
});
