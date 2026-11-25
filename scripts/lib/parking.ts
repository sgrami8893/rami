// 주차장 표준데이터 → ParkingLot 정규화 (골격, 2026-11-25).
// ⚠ 원천 필드명(FIELD)은 2026-11-25 제미나이가 2차 자료(미러 스키마)로 확인한 34개 헤더로 잠정 매핑했다.
//    실제 다운로드 CSV 첫 줄로 교차 검증하기 전까지는 PARKING_PREVIEW 빌드에서만 쓴다(배포 노출 금지).
import { resolveRegion, type SidoSlug } from './regions.ts';

export const FIELD = {
  id: '주차장관리번호', name: '주차장명', kind: '주차장구분', lotType: '주차장유형',
  road: '소재지도로명주소', jibun: '소재지지번주소', spaces: '주차구획수',
  wdOpen: '평일운영시작시각', wdClose: '평일운영종료시각', satOpen: '토요일운영시작시각', satClose: '토요일운영종료시각',
  holOpen: '공휴일운영시작시각', holClose: '공휴일운영종료시각',
  feeInfo: '요금정보', baseMin: '주차기본시간', baseFee: '주차기본요금', unitMin: '추가단위시간', unitFee: '추가단위요금',
  dayPassHours: '1일주차권요금적용시간', dayPass: '1일주차권요금', monthly: '월정기권요금', payment: '결제방법', note: '특기사항',
  agency: '관리기관명', phone: '전화번호', lat: '위도', lng: '경도', disabled: '장애인전용주차구역보유여부', baseDate: '데이터기준일자',
  grade: '급지구분', oddEven: '부제시행구분', days: '운영요일', providerCode: '제공기관코드', providerName: '제공기관명',
} as const;

/** 이 필드가 없으면 갱신을 중단한다(파이프라인 검증용). 나머지는 없어도 빈값으로 처리. */
export const REQUIRED_FIELDS: (keyof typeof FIELD)[] = ['id', 'name', 'road', 'jibun', 'feeInfo', 'lat', 'lng', 'baseDate'];
export const missingFields = (header: string[]) => REQUIRED_FIELDS.filter((k) => !header.includes(FIELD[k])).map((k) => FIELD[k]);

export type FeeType = 'free' | 'paid' | 'mixed' | 'unknown';
export type DayHours = [string, string] | '24h' | null;
export interface ParkingLot {
  id: string; name: string;
  kind: 'public' | 'private' | 'unknown'; lotType: 'onStreet' | 'offStreet' | 'attached' | 'unknown';
  sido: SidoSlug; sigungu: string; sigunguName: string; dong: string | null;
  roadAddress: string; jibunAddress: string;
  lat: number | null; lng: number | null;
  spaces: number | null;
  hours: { weekday: DayHours; sat: DayHours; holiday: DayHours };
  fee: { type: FeeType; baseMin: number | null; baseFee: number | null; unitMin: number | null; unitFee: number | null; dayPass: number | null; monthly: number | null };
  dayPassHours: string; days: string; grade: string; oddEven: string; disabledSpots: boolean | null;
  payment: string[]; note: string; agency: string; phone: string; baseDate: string | null;
  providerCode: string; providerName: string;
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
  // 도로명주소가 빈 행이 많아서(실제 응답 확인) 지번주소로도 지역을 찾는다
  const region = resolveRegion(g('road') || g('jibun'), g('jibun'));
  if (!region || !g('name')) return null;
  const flags: ParkingLot['flags'] = [];
  const wd = dayHours(g('wdOpen'), g('wdClose')), sat = dayHours(g('satOpen'), g('satClose')), hol = dayHours(g('holOpen'), g('holClose'));
  if (wd.ambiguous || sat.ambiguous || hol.ambiguous) flags.push('hoursAmbiguous');
  const amounts = { baseMin: num(g('baseMin')), baseFee: num(g('baseFee')), unitMin: num(g('unitMin')), unitFee: num(g('unitFee')), dayPass: num(g('dayPass')), monthly: num(g('monthly')) };
  const fee = classifyFee(g('feeInfo'), [amounts.baseFee, amounts.unitFee, amounts.dayPass, amounts.monthly]);
  if (fee.conflict) flags.push('feeConflict');
  // 실제 응답(2026-11-25)에 '무료'인데 basicTime=30 같은 의미 없는 값이 있어서, 무료로 확정되면 요금 숫자는 버린다
  if (fee.type === 'free') for (const k of Object.keys(amounts) as (keyof typeof amounts)[]) amounts[k] = null;
  let lat = num(g('lat')), lng = num(g('lng'));
  if (lat !== null && lng !== null && !inCapitalArea(lat, lng)) { flags.push('coordOutOfRange'); lat = lng = null; }
  if (lat === null || lng === null) lat = lng = null;
  const kind = g('kind');
  const type = g('lotType');
  return {
    // 관리번호는 제공기관마다 따로 매겨질 수 있어 제공기관코드를 앞에 붙인다(없으면 시군구-이름)
    id: g('id') ? (g('providerCode') ? `${g('providerCode')}-${g('id')}` : g('id')) : `${region.sigungu}-${g('name')}`,
    name: g('name'),
    kind: kind.includes('공영') ? 'public' : kind.includes('민영') ? 'private' : 'unknown',
    lotType: type.includes('노상') ? 'onStreet' : type.includes('노외') ? 'offStreet' : type.includes('부설') ? 'attached' : 'unknown',
    sido: region.sido, sigungu: region.sigungu, sigunguName: region.sigunguName, dong: region.dong,
    roadAddress: g('road'), jibunAddress: g('jibun'), lat, lng,
    spaces: num(g('spaces')) || null, // 0은 '구획 수 미상'으로 본다(실제 응답에 0이 많음)
    hours: { weekday: wd.h, sat: sat.h, holiday: hol.h },
    fee: { type: fee.type, ...amounts },
    dayPassHours: g('dayPassHours'), days: g('days'), grade: g('grade'), oddEven: g('oddEven'),
    disabledSpots: /^(Y|y|예|있음|보유)$/.test(g('disabled')) ? true : /^(N|n|아니오|없음|미보유)$/.test(g('disabled')) ? false : null,
    providerCode: g('providerCode'), providerName: g('providerName'),
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

/** 시·군·구 무료 허브: 무료 5곳 이상이고, 무료 비율이 85% 이하(시·군·구 목록과 거의 같은 중복 페이지 방지)일 때만 색인 */
export const FREE_SIGUNGU_MIN = 5;
export function freeSigunguIndexable(lots: ParkingLot[]) {
  const free = lots.filter((l) => l.fee.type === 'free').length;
  return { count: free, total: lots.length, indexable: free >= FREE_SIGUNGU_MIN && free / (lots.length || 1) <= PARKING_RULE.maxShare };
}

/** 운영시간 판정용 형식(scripts/lib/hours.ts Hours)으로 변환. 일요일은 공휴일 시간을 쓴다. 정보 없음은 undefined(판정 불가). */
export function lotHours(l: Pick<ParkingLot, 'hours'>) {
  const conv = (h: DayHours) => (h === null ? undefined : h === '24h' ? (['00:00', '24:00'] as [string, string]) : h);
  return { weekday: conv(l.hours.weekday), sat: conv(l.hours.sat), sun: conv(l.hours.holiday), holiday: conv(l.hours.holiday) };
}

/** 동 페이지(주차장): 같은 동 5곳 이상 + 시·군·구의 85% 이하(무인민원발급기 동 페이지와 같은 기준) */
export const PARKING_DONG_RULE = { min: 5, maxShare: 0.85 };
export function parkingDongs(lots: ParkingLot[]) {
  const by = new Map<string, ParkingLot[]>();
  for (const l of lots) if (l.dong) { const k = `${l.sido}/${l.sigungu}/${l.dong}`; by.set(k, [...(by.get(k) ?? []), l]); }
  const total = new Map<string, number>();
  for (const l of lots) total.set(`${l.sido}/${l.sigungu}`, (total.get(`${l.sido}/${l.sigungu}`) ?? 0) + 1);
  return [...by.values()].filter((ls) => ls.length >= PARKING_DONG_RULE.min && ls.length / (total.get(`${ls[0].sido}/${ls[0].sigungu}`) ?? 1) <= PARKING_DONG_RULE.maxShare)
    .map((ls) => ({ sido: ls[0].sido, sigungu: ls[0].sigungu, sigunguName: ls[0].sigunguName, dong: ls[0].dong!, lots: ls }));
}
