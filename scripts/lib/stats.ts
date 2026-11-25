// Per-시군구 aggregates used by the summary paragraph, stat cards and FAQ answers.
import type { Kiosk } from './normalize.ts';
import type { DocCode } from './docs.ts';
import { SIGUNGU, type SidoSlug } from './regions.ts';

export interface RegionStats {
  sido: SidoSlug; sigungu: string; sigunguName: string;
  total: number; is24h: number; openWeekend: number; openSun: number; openHoliday: number;
  openAfter22: number; hoursUnknown: number;
  docs: Partial<Record<DocCode, number>>;
  bySubGu: Record<string, number>; byDong: Record<string, number>;
  latestBaseDate: string | null;
}

const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;
const tally = (xs: (string | null)[]) =>
  Object.fromEntries([...Map.groupBy(xs.filter((x): x is string => !!x), (x) => x)].map(([k, v]) => [k, v.length]).sort((a, b) => (b[1] as number) - (a[1] as number)));

/** Weekday close at or after 22:00, or past midnight. */
const lateWeekday = (k: Kiosk) => {
  const w = k.hours.weekday;
  return !!w && (w[1] >= '22:00' || w[1] < w[0]);
};

export function regionStats(list: Kiosk[]): RegionStats[] {
  const groups = Map.groupBy(list, (k) => `${k.sido}/${k.sigungu}`);
  return [...groups.values()].map((ks) => {
    const { sido, sigungu, sigunguName } = ks[0];
    const docs: Partial<Record<DocCode, number>> = {};
    ks.forEach((k) => k.docs.forEach((d) => (docs[d] = (docs[d] ?? 0) + 1)));
    const subGuList = SIGUNGU[sido].find((s) => s.slug === sigungu)?.subGu;
    const bySubGu = subGuList
      ? Object.fromEntries(subGuList.map((g) => [g, count(ks, (k) => k.subGu === g)])) // 0인 구도 제목·요약용으로 유지
      : {};
    return {
      sido, sigungu, sigunguName, total: ks.length,
      is24h: count(ks, (k) => k.is24h),
      openWeekend: count(ks, (k) => k.openSat || k.openSun),
      openSun: count(ks, (k) => k.openSun),
      openHoliday: count(ks, (k) => k.openHoliday),
      openAfter22: count(ks, lateWeekday),
      hoursUnknown: count(ks, (k) => k.hoursConfidence === 'unknown'),
      docs, bySubGu, byDong: tally(ks.map((k) => k.dong)),
      latestBaseDate: ks.map((k) => k.baseDate).filter(Boolean).sort().at(-1) ?? null,
    };
  }).sort((a, b) => a.sido.localeCompare(b.sido) || a.sigungu.localeCompare(b.sigungu));
}
