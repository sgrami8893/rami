// 주차장 표준데이터 → ParkingLot 정규화 (골격, 2026-11-25).
// ⚠ 원천 필드명(FIELD)은 실제 CSV 헤더를 받기 전의 예상치다. 헤더를 받으면 FIELD만 고치고 테스트를 실데이터 행으로 바꾼다.
import { resolveRegion, type SidoSlug } from './regions.ts';

export const FIELD = {
  id: '주차장관리번호', name: '주차장명', kind: '주차장구분', lotType: '주차장유형',
  road: '소재지도로명주소', jibun: '소재지지번주소', spaces: '주차구획수',
  wdOpen: '평일운영시작시각', wdClose: '평일운영종료시각', satOpen: '토요일운영시작시각', satClose: '토요일운영종료시각',
  holOpen: '공휴일운영시작시각', holClose: '공휴일운영종료시각',
  feeInfo: '요금정보', baseMin: '주차기본시간', baseFee: '주차기본요금', unitMin: '추가단위시간', unitFee: '추가단위요금',
  dayPass: '1일주차권요금', monthly: '월정기권요금', payment: '결제방법', note: '특기사항',
  agency: '관리기관명', phone: '전화번호', lat: '위도', lng: '경도', baseDate: '데이터기준일자',
} as const;

export type FeeType = 'free' | 'paid' | 'mixed' | 'unknown';
export type DayHours = [string, string] | '24h' | null;
export interface ParkingLot {
  id: string; name: string;
  kind: 'public' | 'private' | 'unknown'; lotType: 'onStreet' | 'offStreet' | 'attached' | 'unknown';
  sido: SidoSlug; sigungu: string; sigunguName: string;
  roadAddress: string; jibunAddress: string;
  lat: number | null; lng: number | null;
  spaces: number | null;
  hours: { weekday: DayHours; sat: DayHours; holiday: DayHours };
  fee: { type: FeeType; baseMin: number | null; baseFee: number | null; unitMin: number | null; unitFee: number | null; dayPass: number | null; monthly: number | null };
  payment: string[]; note: string; agency: string; phone: string; baseDate: string | null;
  flags: ('feeConflict' | 'hoursAmbiguous' | 'coordOutOfRange')[];
}

const num = (s: string | undefined) => {
  const t = (s ?? '').replace(/[,원\s]/g, '');
  if (!t) return null;
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? v : null;
};
const time = (s: string | undefined) => {
  const m = (s ?? '').trim().match(/^(\d{1,2}):?(\d{2})$/);
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h <= 24 && mi < 60 ? `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}` : null;
};

/** 00:00~00:00·00:00~24:00 은 24시간으로 본다(00:00~00:00은 '모호'로 표시해 둔다). */
export function dayHours(open?: string, close?: string): { h: DayHours; ambiguous: boolean } {
  const o = time(open), c = time(close);
  if (!o || !c) return { h: null, ambiguous: !!(open || close) };
  if (o === '00:00' && (c === '24:00' || c === '23:59')) return { h: '24h', ambiguous: false };
  if (o === '00:00' && c === '00:00') return { h: '24h', ambiguous: true };
  return { h: [o, c], ambiguous: false };
}

/** '무료' 판정: 요금정보가 무료이고 요금 숫자가 모두 0·빈값일 때만 free. 충돌하면 unknown + feeConflict. */
export function classifyFee(info: string, amounts: (number | null)[]): { type: FeeType; conflict: boolean } {
  const t = info.replace(/\s/g, '');
  const anyPaid = amounts.some((a) => a !== null && a > 0);
  if (t === '무료') return anyPaid ? { type: 'unknown', conflict: true } : { type: 'free', conflict: false };
  if (t === '유료') return { type: 'paid', conflict: false };
  if (t === '혼합') return { type: 'mixed', conflict: false };
  return { type: 'unknown', conflict: false };
}

/** 수도권 범위(옹진군 섬 포함) */
export const inCapitalArea = (lat: number, lng: number) => lat >= 36.8 && lat <= 38.4 && lng >= 124.5 && lng <= 128;

export function normalizeParking(row: Record<string, string>): ParkingLot | null {
  const g = (k: keyof typeof FIELD) => (row[FIELD[k]] ?? '').trim();
  const region = resolveRegion(g('road'), g('jibun'));
  if (!region || !g('name')) return null;
  const flags: ParkingLot['flags'] = [];
  const wd = dayHours(g('wdOpen'), g('wdClose')), sat = dayHours(g('satOpen'), g('satClose')), hol = dayHours(g('holOpen'), g('holClose'));
  if (wd.ambiguous || sat.ambiguous || hol.ambiguous) flags.push('hoursAmbiguous');
  const amounts = { baseMin: num(g('baseMin')), baseFee: num(g('baseFee')), unitMin: num(g('unitMin')), unitFee: num(g('unitFee')), dayPass: num(g('dayPass')), monthly: num(g('monthly')) };
  const fee = classifyFee(g('feeInfo'), [amounts.baseFee, amounts.unitFee, amounts.dayPass, amounts.monthly]);
  if (fee.conflict) flags.push('feeConflict');
  let lat = num(g('lat')), lng = num(g('lng'));
  if (lat !== null && lng !== null && !inCapitalArea(lat, lng)) { flags.push('coordOutOfRange'); lat = lng = null; }
  if (lat === null || lng === null) lat = lng = null;
  const kind = g('kind');
  const type = g('lotType');
  return {
    id: g('id') || `${region.sigungu}-${g('name')}`,
    name: g('name'),
    kind: kind.includes('공영') ? 'public' : kind.includes('민영') ? 'private' : 'unknown',
    lotType: type.includes('노상') ? 'onStreet' : type.includes('노외') ? 'offStreet' : type.includes('부설') ? 'attached' : 'unknown',
    sido: region.sido, sigungu: region.sigungu, sigunguName: region.sigunguName,
    roadAddress: g('road'), jibunAddress: g('jibun'), lat, lng,
    spaces: num(g('spaces')),
    hours: { weekday: wd.h, sat: sat.h, holiday: hol.h },
    fee: { type: fee.type, ...amounts },
    payment: g('payment').split(/[,+/]/).map((s) => s.trim()).filter(Boolean),
    note: g('note'), agency: g('agency'), phone: g('phone'), baseDate: g('baseDate') || null,
    flags,
  };
}

/** 색인 기준(무인민원발급기 조건 허브와 같은 수치) */
export const PARKING_RULE = { minLots: 20, minRegions: 3, maxShare: 0.85, minRegionLots: 3 };
export function freeHubIndexable(lots: ParkingLot[], sido: SidoSlug) {
  const all = lots.filter((l) => l.sido === sido);
  const free = all.filter((l) => l.fee.type === 'free');
  const regions = new Set(free.map((l) => l.sigungu)).size;
  return { count: free.length, total: all.length, regions, indexable: free.length >= PARKING_RULE.minLots && regions >= PARKING_RULE.minRegions && free.length / (all.length || 1) <= PARKING_RULE.maxShare };
}
/** 시·군·구 페이지: 주차장 3곳 미만이면 noindex(얇은 페이지) */
export const regionIndexable = (count: number) => count >= PARKING_RULE.minRegionLots;
/** 상세: 주소·요금 구분·운영시간 중 2가지 이상 있어야 색인 */
export const lotIndexable = (l: ParkingLot) =>
  [!!l.roadAddress, l.fee.type !== 'unknown', !!(l.hours.weekday || l.hours.sat || l.hours.holiday)].filter(Boolean).length >= 2;
