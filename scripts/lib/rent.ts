// 동네 빌라·오피스텔 전월세 시세(미리보기 골격, 2026-11-25 설계).
// 원천: 국토교통부 실거래가 API(공공데이터포털, 이용허락 '제한 없음')
//   - 연립다세대 전월세: RTMSDataSvcRHRent (데이터 번호·엔드포인트는 PC에서 확인 필요)
//   - 오피스텔 전월세:   RTMSDataSvcOffiRent (15126475, 동·호 비공개)
//   - 15126474는 '아파트' 전월세라 쓰지 않는다(아파트는 이 도구 범위 밖).
// 개인정보 원칙: 지번·건물명·층·계약일(일)은 집계에만 쓰고 화면·저장 파일(rent-stats.json)에 남기지 않는다.
//   통계 한 칸은 거래 K_MIN건 이상일 때만 보여 준다(소수 거래로 특정 세대가 드러나는 것 방지).
import { regionOfDeal } from './rent-lawd.ts';
import type { SidoSlug } from './regions.ts';

export type HouseType = 'villa' | 'officetel';
export const HOUSE_LABEL: Record<HouseType, string> = { villa: '빌라(연립·다세대)', officetel: '오피스텔' };

/** 정규화된 거래 1건(수집 중 메모리에만 존재. 저장하지 않음) */
export interface Deal {
  type: HouseType; code: string; dong: string; ym: string; // 계약년월 YYYY-MM
  deposit: number; monthly: number; area: number; // 만원, 만원, ㎡
  buildYear: number | null; renewal: 'new' | 'renew' | null; usedRight: boolean | null;
}

/** 응답 필드 후보: 2024년 개편 영문 필드명(추정) → 옛 한글 필드명. --sample 실제 응답으로 확정한다. */
export const RENT_FIELD = {
  code: ['sggCd', '지역코드'], dong: ['umdNm', '법정동'],
  y: ['dealYear', '년', '계약년도'], m: ['dealMonth', '월'],
  deposit: ['deposit', '보증금액', '보증금'], monthly: ['monthlyRent', '월세금액', '월세'],
  area: ['excluUseAr', '전용면적'], buildYear: ['buildYear', '건축년도'],
  contractType: ['contractType', '계약구분'], usedRight: ['useRRRight', '갱신요구권사용'],
} as const;
export const RENT_REQUIRED: (keyof typeof RENT_FIELD)[] = ['code', 'dong', 'y', 'm', 'deposit', 'monthly', 'area'];

const num = (v: unknown) => { const n = Number(String(v ?? '').replace(/[,\s]/g, '')); return Number.isFinite(n) ? n : NaN; };
const pick = (item: Record<string, unknown>, f: keyof typeof RENT_FIELD) => { for (const k of RENT_FIELD[f]) if (k in item) return item[k]; return undefined; };

export function missingFields(item: Record<string, unknown>) {
  return RENT_REQUIRED.filter((f) => pick(item, f) === undefined);
}

/** API 항목 1건 → Deal. 금액·면적이 이상하면 null(보고서에 건수로 남김). */
export function normalizeDeal(item: Record<string, unknown>, type: HouseType, fallbackCode = ''): Deal | null {
  const code = String(pick(item, 'code') ?? fallbackCode).trim().slice(0, 5);
  const dong = String(pick(item, 'dong') ?? '').trim();
  const y = num(pick(item, 'y')), m = num(pick(item, 'm'));
  const deposit = num(pick(item, 'deposit')), monthly = num(pick(item, 'monthly')) || 0, area = num(pick(item, 'area'));
  if (!code || !dong || !(y > 2000) || !(m >= 1 && m <= 12) || !(deposit >= 0) || !(area > 0)) return null;
  if (deposit === 0 && monthly === 0) return null;
  const ct = String(pick(item, 'contractType') ?? '').trim();
  const ur = String(pick(item, 'usedRight') ?? '').trim();
  const by = num(pick(item, 'buildYear'));
  return {
    type, code, dong, ym: `${y}-${String(m).padStart(2, '0')}`, deposit, monthly, area,
    buildYear: by > 1900 ? by : null,
    renewal: ct === '신규' ? 'new' : ct === '갱신' ? 'renew' : null,
    usedRight: ur === '사용' ? true : ur ? false : null,
  };
}

// ===== 집계 =====
/** 통계 한 칸을 보여 줄 최소 거래 수(소수 거래 비식별 + 중위값 안정성) */
export const K_MIN = 3;
/** 면적대(전용면적 ㎡). 빌라·오피스텔 실거래 분포에 맞춘 구간 */
export const AREA_BANDS = [
  { key: 'a20', label: '20㎡ 이하(원룸)', max: 20 }, { key: 'a40', label: '20~40㎡(1.5룸·투룸)', max: 40 },
  { key: 'a60', label: '40~60㎡(투룸·쓰리룸)', max: 60 }, { key: 'a85', label: '60~85㎡', max: 85 }, { key: 'over', label: '85㎡ 초과', max: Infinity },
] as const;
const bandOf = (a: number) => AREA_BANDS.find((b) => a <= b.max)!.key;

export interface Dist { n: number; min: number; p25: number; median: number; p75: number; max: number }
export interface KindStats { jeonse: Dist | null; wolse: { n: number; deposit: Dist | null; monthly: Dist | null } | null }
export interface TypeStats extends KindStats {
  n: number; newCount: number; renewCount: number; usedRightCount: number;
  bands: { key: string; label: string; n: number; jeonseMedian: number | null; wolseDepositMedian: number | null; wolseMonthlyMedian: number | null }[];
  quarters: { q: string; n: number; jeonseMedian: number | null; wolseMonthlyMedian: number | null }[];
  buildYearMedian: number | null;
}
export interface RentArea {
  sido: SidoSlug; sigungu: string; sigunguName: string; dong: string | null; // dong null = 시·군·구 전체
  n: number; byType: Partial<Record<HouseType, TypeStats>>;
}
export interface RentStats { from: string; to: string; generatedAt: string; isMock: boolean; areas: RentArea[] }

const q = (s: number[], p: number) => { const i = (s.length - 1) * p; const lo = Math.floor(i), hi = Math.ceil(i); return Math.round(s[lo] + (s[hi] - s[lo]) * (i - lo)); };
export function dist(xs: number[]): Dist | null {
  if (xs.length < K_MIN) return null;
  const s = [...xs].sort((a, b) => a - b);
  return { n: s.length, min: s[0], p25: q(s, 0.25), median: q(s, 0.5), p75: q(s, 0.75), max: s.at(-1)! };
}
const med = (xs: number[]) => dist(xs)?.median ?? null;
const quarterOf = (ym: string) => `${ym.slice(0, 4)}-Q${Math.ceil(Number(ym.slice(5, 7)) / 3)}`;

/** 전세 = 월세 0원. 월세·준월세·준전세는 모두 '월세'로 묶는다(보증금 + 월세 각각 분포). */
export function typeStats(ds: Deal[]): TypeStats {
  const je = ds.filter((d) => d.monthly === 0), wo = ds.filter((d) => d.monthly > 0);
  const bands = AREA_BANDS.map((b) => {
    const xs = ds.filter((d) => bandOf(d.area) === b.key);
    const j = xs.filter((d) => d.monthly === 0), w = xs.filter((d) => d.monthly > 0);
    return { key: b.key, label: b.label, n: xs.length, jeonseMedian: med(j.map((d) => d.deposit)), wolseDepositMedian: med(w.map((d) => d.deposit)), wolseMonthlyMedian: med(w.map((d) => d.monthly)) };
  }).filter((b) => b.n >= K_MIN);
  const qs = [...new Set(ds.map((d) => quarterOf(d.ym)))].sort();
  return {
    n: ds.length,
    jeonse: dist(je.map((d) => d.deposit)),
    wolse: wo.length >= K_MIN ? { n: wo.length, deposit: dist(wo.map((d) => d.deposit)), monthly: dist(wo.map((d) => d.monthly)) } : null,
    newCount: ds.filter((d) => d.renewal === 'new').length, renewCount: ds.filter((d) => d.renewal === 'renew').length,
    usedRightCount: ds.filter((d) => d.usedRight === true).length,
    bands,
    quarters: qs.map((qq) => { const xs = ds.filter((d) => quarterOf(d.ym) === qq); return { q: qq, n: xs.length, jeonseMedian: med(xs.filter((d) => d.monthly === 0).map((d) => d.deposit)), wolseMonthlyMedian: med(xs.filter((d) => d.monthly > 0).map((d) => d.monthly)) }; }),
    buildYearMedian: med(ds.map((d) => d.buildYear).filter((x): x is number => x !== null)),
  };
}

/** 최근 months개월(데이터의 마지막 달 포함) 거래만 남긴다 */
export function lastMonths(ds: Deal[], months = 12) {
  const to = ds.map((d) => d.ym).sort().at(-1) ?? '';
  if (!to) return { from: '', to: '', deals: [] as Deal[] };
  const [y, m] = to.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - months, 1));
  const from = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { from, to, deals: ds.filter((d) => d.ym >= from && d.ym <= to) };
}

/** 거래 목록 → 시·군·구 + 법정동 단위 통계. 지역 판정이 안 되는 거래 수도 돌려준다. */
export function aggregate(all: Deal[], { months = 12, isMock = false } = {}) {
  const { from, to, deals } = lastMonths(all, months);
  const groups = new Map<string, { area: Omit<RentArea, 'n' | 'byType'>; ds: Deal[] }>();
  let unknown = 0;
  const add = (k: string, area: Omit<RentArea, 'n' | 'byType'>, d: Deal) => { const g = groups.get(k) ?? { area, ds: [] }; g.ds.push(d); groups.set(k, g); };
  for (const d of deals) {
    const r = regionOfDeal(d.code, d.dong);
    if (!r) { unknown++; continue; }
    add(`${r.sido}/${r.sigungu}/`, { sido: r.sido, sigungu: r.sigungu, sigunguName: r.sigunguName, dong: null }, d);
    add(`${r.sido}/${r.sigungu}/${d.dong}`, { sido: r.sido, sigungu: r.sigungu, sigunguName: r.sigunguName, dong: d.dong }, d);
  }
  const areas: RentArea[] = [...groups.values()].map(({ area, ds }) => {
    const byType: RentArea['byType'] = {};
    for (const t of ['villa', 'officetel'] as HouseType[]) { const xs = ds.filter((d) => d.type === t); if (xs.length) byType[t] = typeStats(xs); }
    return { ...area, n: ds.length, byType };
  }).sort((a, b) => `${a.sido}/${a.sigungu}/${a.dong ?? ''}`.localeCompare(`${b.sido}/${b.sigungu}/${b.dong ?? ''}`, 'ko'));
  const stats: RentStats = { from, to, generatedAt: new Date().toISOString(), isMock, areas };
  return { stats, unknown };
}

// ===== 페이지 규칙(얇은 페이지 방지) =====
/**
 * 동 페이지: 최근 12개월 거래 PAGE_MIN건 이상이면 만든다(그 아래는 시·군·구 페이지의 동별 표 한 줄로만).
 * 색인: INDEX_MIN건 이상 + 시·군·구 거래의 MAX_SHARE 이하(시·군·구 페이지와 거의 같은 중복 방지).
 *   근거: 중위값은 표본 30건 안팎부터 분기마다 크게 흔들리지 않고, 면적대 2~3칸(칸당 K_MIN건)을 채울 수 있다.
 */
export const RENT_RULE = { PAGE_MIN: 10, INDEX_MIN: 30, MAX_SHARE: 0.9, SIGUNGU_INDEX_MIN: 30 };
export const sigunguAreas = (s: RentStats) => s.areas.filter((a) => a.dong === null);
export const dongAreasOf = (s: RentStats, sido: string, sigungu: string) => s.areas.filter((a) => a.dong !== null && a.sido === sido && a.sigungu === sigungu);
export function dongPages(s: RentStats) { return s.areas.filter((a) => a.dong !== null && a.n >= RENT_RULE.PAGE_MIN); }
export function dongIndexable(s: RentStats, a: RentArea) {
  const total = s.areas.find((x) => x.dong === null && x.sido === a.sido && x.sigungu === a.sigungu)?.n ?? a.n;
  return a.n >= RENT_RULE.INDEX_MIN && a.n / total <= RENT_RULE.MAX_SHARE;
}
export const sigunguIndexable = (a: RentArea) => a.n >= RENT_RULE.SIGUNGU_INDEX_MIN;

/** 만원 → "2억 3,000만 원" */
export function manwon(v: number | null | undefined) {
  if (v === null || v === undefined) return '-';
  const eok = Math.floor(v / 10000), rest = v % 10000;
  if (!eok) return `${rest.toLocaleString('ko-KR')}만 원`;
  return rest ? `${eok}억 ${rest.toLocaleString('ko-KR')}만 원` : `${eok}억 원`;
}
