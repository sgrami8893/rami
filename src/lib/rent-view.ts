// v2 전월세 화면 공통 표시 도우미(2026-11-26). 금액 글자·목록 줄 값(유형×전세/월세 4가지)·색 칸.
import type { RentArea } from '../../scripts/lib/rent.ts';
import { colorOf, LOW_N } from './rent-geo.ts';
/** 만원 → '2억 4,000만' / '9,500만' / '2억' */
export const amt = (v: number | null | undefined) => {
  if (v === null || v === undefined) return '-';
  const e = Math.floor(v / 10000), r = v % 10000;
  return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r || !e ? `${r.toLocaleString('ko-KR')}만` : ''}`;
};
export type Mode = 'vj' | 'vw' | 'oj' | 'ow';
export const MODES: Mode[] = ['vj', 'vw', 'oj', 'ow'];
/** 지역 하나의 4가지 값. 거래 적음(LOW_N 미만)이면 값 없음 */
export function modeVals(a: RentArea, low = LOW_N) {
  const v = a.byType.villa, o = a.byType.officetel;
  const ok = a.n >= low;
  const w = (t: typeof v) => (t?.wolse?.monthly && t.wolse.deposit ? { dep: t.wolse.deposit.median, mon: t.wolse.monthly.median } : null);
  return {
    vj: ok ? v?.jeonse?.median ?? null : null, vw: ok ? w(v) : null,
    oj: ok ? o?.jeonse?.median ?? null : null, ow: ok ? w(o) : null,
  };
}
export const modeText = (m: Mode, x: ReturnType<typeof modeVals>) => {
  const v = x[m];
  if (v === null) return null;
  return typeof v === 'number' ? amt(v) : `${amt(v.dep)}/${v.mon}만`;
};
/** 정렬용 숫자(전세는 보증금, 월세는 월세) */
export const modeNum = (m: Mode, x: ReturnType<typeof modeVals>) => { const v = x[m]; return v === null ? '' : String(typeof v === 'number' ? v : v.mon); };
export const modeColor = (m: Mode, x: ReturnType<typeof modeVals>) => { const v = x[m]; return colorOf(m, v === null ? null : typeof v === 'number' ? v : v.mon); };

import { SIDOS, sidoShort, sigunguOf, dongsOf, hasDongPage, rentPath } from './rent.ts';
import type { PlaceLevel } from '../components/v2/PlaceBar.astro';
import type { SidoSlug } from '../../scripts/lib/regions.ts';
/** 전월세 위치 줄: 시·도 › 시·군·구 › 동 */
export function rentPlace(sido?: SidoSlug, sg?: string, dong?: string | null): PlaceLevel[] {
  const out: PlaceLevel[] = [];
  out.push({ label: sido ? sidoShort(sido) : '시·도', items: SIDOS.map((s) => ({ label: sidoShort(s), href: rentPath(s) })), all: { label: '전월세 처음', href: '/rent/' } });
  if (!sido) return out;
  const sgs = sigunguOf(sido);
  out.push({ label: sg ? sgs.find((x) => x.sigungu === sg)?.sigunguName ?? sg : '시·군·구', items: sgs.map((x) => ({ label: x.sigunguName, href: rentPath(sido, x.sigungu) })), all: { label: `${sidoShort(sido)} 전체`, href: rentPath(sido) } });
  if (!sg) return out;
  const ds = dongsOf(sido, sg).filter(hasDongPage).sort((a, b) => a.dong!.localeCompare(b.dong!, 'ko'));
  const sgName = sgs.find((x) => x.sigungu === sg)?.sigunguName ?? sg;
  out.push({ label: dong ?? '동', items: ds.map((d) => ({ label: d.dong!, href: rentPath(sido, sg, d.dong) })), all: { label: `${sgName} 전체`, href: rentPath(sido, sg) } });
  return out;
}
